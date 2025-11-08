const express = require("express");
const fs = require("fs");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db"); // 假设你将数据库连接池导出
const { logActivity } = require("../services/logService");

// 创建路由函数，接收 io 实例
const createDocumentRoutes = (io) => {
  const router = express.Router();
  
  const TurndownService = require("turndown");
  const { marked } = require("marked");
  const { diff_match_patch } = require("diff-match-patch");
  const PDFDocument = require("pdfkit");
  const archiver = require("archiver");
  const {
    Document: DocxDocument,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
  } = require("docx");

  const turndownService = new TurndownService({ headingStyle: "atx" });
  const dmp = new diff_match_patch();

const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  if (typeof value === "object") {
    return Array.isArray(value) ? value : [];
  }
  return [];
};

const getDocumentAccess = async (documentId, user) => {
  const docResult = await pool.query("SELECT * FROM documents WHERE id = $1", [
    documentId,
  ]);

  if (docResult.rows.length === 0) {
    return { notFound: true };
  }

  const document = docResult.rows[0];
  document.tags = normalizeArray(document.tags);
  document.content_format = document.content_format || "rich";
  if (document.content_format !== "markdown") {
    document.markdown_content = null;
  }
  let role = "none";

  if (document.owner_id === user.id || user.role === "admin") {
    role = "owner";
  } else {
    const collaboratorResult = await pool.query(
      "SELECT role FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
      [documentId, user.id]
    );

    if (collaboratorResult.rows.length > 0) {
      role = collaboratorResult.rows[0].role;
    }
  }

  const canView = role !== "none";
  let canEdit = role === "owner" || role === "editor" || user.role === "admin";

  if (
    document.is_locked &&
    document.locked_by &&
    document.locked_by !== user.id &&
    user.role !== "admin"
  ) {
    canEdit = false;
  }

  return {
    document,
    role,
    canView,
    canEdit,
    notFound: false,
  };
};

const ensureDelta = (rawContent) => {
  if (!rawContent) {
    return { ops: [{ insert: "\n" }] };
  }
  if (typeof rawContent === "string") {
    try {
      const parsed = JSON.parse(rawContent);
      if (parsed && Array.isArray(parsed.ops)) {
        return parsed;
      }
      return { ops: [{ insert: parsed.toString() }, { insert: "\n" }] };
    } catch (error) {
      return { ops: [{ insert: rawContent }, { insert: "\n" }] };
    }
  }
  if (typeof rawContent === "object" && Array.isArray(rawContent.ops)) {
    return rawContent;
  }
  return { ops: [{ insert: String(rawContent) }, { insert: "\n" }] };
};

const escapeHtml = (unsafe) =>
  String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeFileName = (input, fallback = "document") => {
  if (!input || typeof input !== "string") {
    return fallback;
  }
  // 只移除文件系统非法字符，保留中文字符
  const cleaned = input.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : fallback;
};

const encodeFileName = (filename, documentId = null) => {
  // 对于 HTTP header，使用 RFC 5987 格式编码非ASCII字符
  // 先清理文件名，移除非法字符（但保留中文字符）
  const sanitized = sanitizeFileName(filename);
  
  // 检查是否包含非ASCII字符
  const hasNonAscii = /[^\x00-\x7F]/.test(sanitized);
  
  if (hasNonAscii) {
    // 对于非ASCII字符，使用 RFC 5987 格式：filename*=UTF-8''encoded
    // 创建 ASCII fallback：只保留字母、数字、点、下划线、连字符
    let asciiFallback = sanitized
      .replace(/[^\x00-\x7F]/g, "") // 移除所有非ASCII字符
      .replace(/[^a-zA-Z0-9._-]/g, "_") // 保留字母数字和常用字符
      .replace(/_+/g, "_") // 合并连续的下划线
      .replace(/^_+|_+$/g, ""); // 移除开头和结尾的下划线
    
    // 如果 ASCII fallback 为空或太短，使用文档 ID 作为后备
    if (!asciiFallback || asciiFallback.length < 1) {
      asciiFallback = documentId ? `document-${documentId}` : "document";
    }
    
    // 编码完整文件名（保留中文）
    const encoded = encodeURIComponent(sanitized);
    // 返回兼容格式：先提供 ASCII fallback，然后提供 UTF-8 编码版本
    return `filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
  }
  
  // 对于纯ASCII字符，检查是否包含需要引号的字符
  const needsQuotes = /[\s;()]/g.test(sanitized);
  if (needsQuotes) {
    // 需要引号，并且转义引号
    const escaped = sanitized.replace(/"/g, '\\"');
    return `filename="${escaped}"`;
  }
  
  // 纯ASCII且不需要引号，直接返回
  return `filename="${sanitized}"`;
};

const normalizeColor = (value) => {
  if (!value || typeof value !== "string") {
    return undefined;
  }
  const hexMatch = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((ch) => ch + ch)
        .join("");
    }
    return hex.toUpperCase();
  }
  const rgbMatch = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const toHex = (num) => {
      const hex = Number(num).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    };
    return `${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(
      rgbMatch[3]
    )}`.toUpperCase();
  }
  return undefined;
};

const createInlineRun = (text, attributes = {}) => ({
  text: String(text ?? ""),
  bold: !!attributes.bold,
  italic: !!attributes.italic,
  underline: !!attributes.underline,
  strike: !!attributes.strike,
  code: !!attributes.code,
  link: attributes.link || null,
  color: attributes.color || null,
  background: attributes.background || null,
});

const buildBlocksFromDelta = (rawDelta) => {
  const delta = ensureDelta(rawDelta);
  const ops = Array.isArray(delta.ops) ? delta.ops : [];
  const blocks = [];
  let currentRuns = [];

  const pushBlock = (attributes = {}) => {
    const indent = attributes.indent || 0;
    const align = attributes.align || null;
    const runs = currentRuns.map((run) => ({ ...run }));
    currentRuns = [];

    if (attributes["code-block"]) {
      const codeText = runs.map((run) => run.text).join("");
      blocks.push({
        type: "code",
        text: codeText,
        indent,
        align,
      });
      return;
    }

    if (attributes.header) {
      blocks.push({
        type: "header",
        level: Math.min(Math.max(parseInt(attributes.header, 10) || 1, 1), 6),
        runs,
        indent,
        align,
      });
      return;
    }

    if (attributes.list) {
      blocks.push({
        type: "listItem",
        ordered: attributes.list === "ordered",
        runs,
        indent,
        align,
      });
      return;
    }

    if (attributes.blockquote) {
      blocks.push({
        type: "blockquote",
        runs,
        indent,
        align,
      });
      return;
    }

    blocks.push({
      type: "paragraph",
      runs: runs.length > 0 ? runs : [createInlineRun("")],
      indent,
      align,
    });
  };

  const pushImageBlock = (src, attributes = {}) => {
    blocks.push({
      type: "image",
      src,
      indent: attributes.indent || 0,
      align: attributes.align || null,
    });
  };

  ops.forEach((op) => {
    if (op.insert && typeof op.insert === "object") {
      if (op.insert.image) {
        if (currentRuns.length > 0) {
          pushBlock({});
        }
        pushImageBlock(op.insert.image, op.attributes || {});
      }
      return;
    }

    if (typeof op.insert !== "string") {
      return;
    }

    let text = op.insert;
    const attributes = op.attributes || {};

    while (text.length >= 0) {
      const newlineIndex = text.indexOf("\n");
      if (newlineIndex === -1) {
        if (text.length > 0) {
          currentRuns.push(createInlineRun(text, attributes));
        }
        break;
      }

      const segment = text.slice(0, newlineIndex);
      if (segment.length > 0) {
        currentRuns.push(createInlineRun(segment, attributes));
      }

      pushBlock(attributes);
      text = text.slice(newlineIndex + 1);

      if (text.length === 0) {
        break;
      }
    }
  });

  if (currentRuns.length > 0) {
    pushBlock({});
  }

  return blocks;
};

const appendTextRun = (text, attributes, collection) => {
  if (text === undefined || text === null) {
    return;
  }
  const value = String(text);
  if (value.length === 0) {
    return;
  }
  collection.push({
    text: value,
    bold: !!attributes.bold,
    italic: !!attributes.italic,
    underline: !!attributes.underline,
    strike: !!attributes.strike,
    code: !!attributes.code,
    link: attributes.link || null,
    color: attributes.color || null,
    background: attributes.background || null,
  });
};

const inlineTokensToRuns = (tokens, inherited = {}) => {
  if (!tokens || tokens.length === 0) {
    return [];
  }
  const runs = [];

  const applyToken = (token, attrs) => {
    switch (token.type) {
      case "text":
      case "escape":
        if (token.tokens && token.tokens.length > 0) {
          token.tokens.forEach((child) => applyToken(child, attrs));
        } else {
          appendTextRun(token.text || "", attrs, runs);
        }
        break;
      case "strong":
        (token.tokens || []).forEach((child) =>
          applyToken(child, { ...attrs, bold: true })
        );
        break;
      case "em":
        (token.tokens || []).forEach((child) =>
          applyToken(child, { ...attrs, italic: true })
        );
        break;
      case "codespan":
        appendTextRun(token.text || "", { ...attrs, code: true }, runs);
        break;
      case "link":
        (token.tokens || [{ type: "text", text: token.text || "" }]).forEach(
          (child) => applyToken(child, { ...attrs, link: token.href || attrs.link })
        );
        break;
      case "del":
        (token.tokens || []).forEach((child) =>
          applyToken(child, { ...attrs, strike: true })
        );
        break;
      case "br":
        appendTextRun("\n", attrs, runs);
        break;
      case "image":
        appendTextRun(`[图片] ${token.href || token.text || ""}`, attrs, runs);
        break;
      default:
        if (token.text) {
          appendTextRun(token.text, attrs, runs);
        }
        if (token.tokens) {
          token.tokens.forEach((child) => applyToken(child, attrs));
        }
    }
  };

  tokens.forEach((token) => applyToken(token, inherited));
  return runs;
};

const buildBlocksFromMarkdown = (markdown = "") => {
  const tokens = marked.lexer(markdown || "");
  const blocks = [];

  const processTokens = (tokenList, context) => {
    tokenList.forEach((token) => {
      switch (token.type) {
        case "heading":
          blocks.push({
            type: "header",
            level: Math.min(Math.max(token.depth || 1, 1), 6),
            runs: inlineTokensToRuns(
              token.tokens || [{ type: "text", text: token.text || "" }]
            ),
            indent: context.indent || 0,
            align: null,
          });
          break;
        case "paragraph":
        case "text":
          blocks.push({
            type: context.blockquote ? "blockquote" : "paragraph",
            runs: inlineTokensToRuns(
              token.tokens || [{ type: "text", text: token.text || "" }]
            ),
            indent: context.indent || 0,
            align: null,
          });
          break;
        case "code":
          blocks.push({
            type: "code",
            text: token.text || "",
            indent: context.indent || 0,
            align: null,
          });
          break;
        case "blockquote":
          processTokens(token.tokens || [], {
            indent: (context.indent || 0) + 1,
            blockquote: true,
          });
          break;
        case "list":
          token.items.forEach((item) => {
            blocks.push({
              type: "listItem",
              ordered: !!token.ordered,
              runs: inlineTokensToRuns(
                item.tokens || [{ type: "text", text: item.text || "" }]
              ),
              indent: context.indent || 0,
              align: null,
            });
            if (item.tokens) {
              const nestedLists = item.tokens.filter(
                (child) => child.type === "list"
              );
              if (nestedLists.length > 0) {
                processTokens(nestedLists, {
                  indent: (context.indent || 0) + 1,
                  blockquote: context.blockquote,
                });
              }
            }
          });
          break;
        case "hr":
          blocks.push({ type: "horizontalRule" });
          break;
        default:
          break;
      }
    });
  };

  processTokens(tokens, { indent: 0, blockquote: false });
  return blocks;
};

const renderInlineHtml = (runs = [], options = {}) => {
  if (!runs || runs.length === 0) {
    return "<br />";
  }

  return runs
    .map((run) => {
      let text = escapeHtml(run.text || "");
      if (!text) {
        return "";
      }

      text = text.replace(/\r?\n/g, "<br />");

      if (run.code && options.blockType !== "code") {
        text = `<code>${text}</code>`;
      }
      if (run.bold) {
        text = `<strong>${text}</strong>`;
      }
      if (run.italic) {
        text = `<em>${text}</em>`;
      }
      if (run.underline) {
        text = `<u>${text}</u>`;
      }
      if (run.strike) {
        text = `<s>${text}</s>`;
      }
      if (run.color || run.background) {
        const styles = [];
        if (run.color) {
          styles.push(`color: ${escapeHtml(run.color)}`);
        }
        if (run.background) {
          styles.push(`background-color: ${escapeHtml(run.background)}`);
        }
        text = `<span style="${styles.join("; ")}">${text}</span>`;
      }
      if (run.link) {
        const safeLink = escapeHtml(run.link);
        text = `<a href="${safeLink}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return text;
    })
    .join("");
};

const blocksToHtml = (blocks = []) => {
  const parts = [];
  let listContext = null;

  const closeList = () => {
    if (listContext) {
      parts.push(`</${listContext}>`);
      listContext = null;
    }
  };

  blocks.forEach((block) => {
    switch (block.type) {
      case "image":
        closeList();
        parts.push(
          `<p${block.align ? ` style="text-align: ${block.align};"` : ""}><img src="${escapeHtml(
            block.src
          )}" alt="" /></p>`
        );
        break;
      case "horizontalRule":
        closeList();
        parts.push("<hr />");
        break;
      case "code":
        closeList();
        parts.push(`<pre><code>${escapeHtml(block.text || "")}</code></pre>`);
        break;
      case "listItem": {
        const tag = block.ordered ? "ol" : "ul";
        if (listContext !== tag) {
          closeList();
          listContext = tag;
          parts.push(`<${tag}>`);
        }
        parts.push(`<li>${renderInlineHtml(block.runs, { blockType: block.type })}</li>`);
        break;
      }
      case "header": {
        closeList();
        const level = Math.min(Math.max(block.level || 1, 1), 6);
        parts.push(
          `<h${level}${
            block.align ? ` style="text-align: ${block.align};"` : ""
          }>${renderInlineHtml(block.runs, { blockType: block.type })}</h${level}>`
        );
        break;
      }
      case "blockquote":
        closeList();
        parts.push(
          `<blockquote${
            block.align ? ` style="text-align: ${block.align};"` : ""
          }>${renderInlineHtml(block.runs, { blockType: block.type })}</blockquote>`
        );
        break;
      default:
        closeList();
        parts.push(
          `<p${
            block.align ? ` style="text-align: ${block.align};"` : ""
          }>${renderInlineHtml(block.runs, { blockType: block.type })}</p>`
        );
        break;
    }
  });

  closeList();
  return parts.join("");
};

const runsToPlainText = (runs = []) =>
  runs.map((run) => String(run.text || "")).join("");

const blocksToPlainText = (blocks = []) =>
  blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return runsToPlainText(block.runs).trim();
        case "listItem":
          return `${block.ordered ? "1." : "-"} ${runsToPlainText(block.runs)}`;
        case "blockquote":
          return runsToPlainText(block.runs)
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
        case "code":
          return block.text || "";
        case "image":
          return `[图片] ${block.src}`;
        case "horizontalRule":
          return "-----";
        default:
          return runsToPlainText(block.runs);
      }
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

const blocksToMarkdown = (blocks = [], fallbackMarkdown) => {
  if (fallbackMarkdown && fallbackMarkdown.trim().length > 0) {
    return fallbackMarkdown;
  }
  const html = blocksToHtml(blocks);
  return turndownService.turndown(html);
};

const pdfFontCandidates = [
  { regular: "C:/Windows/Fonts/msyh.ttf", bold: "C:/Windows/Fonts/msyhbd.ttf" },
  { regular: "C:/Windows/Fonts/msyh.ttc", bold: "C:/Windows/Fonts/msyhbd.ttc" },
  { regular: "C:/Windows/Fonts/simhei.ttf", bold: "C:/Windows/Fonts/simhei.ttf" },
  { regular: "C:/Windows/Fonts/simsun.ttc", bold: "C:/Windows/Fonts/simsun.ttc" },
  {
    regular: path.join(__dirname, "../assets/fonts/NotoSansSC-Regular.otf"),
    bold: path.join(__dirname, "../assets/fonts/NotoSansSC-Bold.otf"),
  },
];

const resolvePdfFonts = () => {
  for (const candidate of pdfFontCandidates) {
    if (candidate.regular && fs.existsSync(candidate.regular)) {
      const fontSet = {
        regular: candidate.regular,
        bold:
          candidate.bold && fs.existsSync(candidate.bold)
            ? candidate.bold
            : candidate.regular,
      };
      return fontSet;
    }
  }
  return { regular: null, bold: null };
};

const generatePdfBufferFromBlocks = (blocks = []) =>
  new Promise((resolve, reject) => {
    try {
      const fonts = resolvePdfFonts();
      const doc = new PDFDocument({ margin: 56 });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // 处理字体：优先使用中文字体，如果没有则使用系统默认字体
      let defaultFont = "Helvetica";
      let boldFont = "Helvetica-Bold";
      
      // 如果找到了中文字体文件，注册并使用
      if (fonts.regular && fs.existsSync(fonts.regular)) {
        try {
          doc.registerFont("ChineseFont", fonts.regular);
          defaultFont = "ChineseFont";
          if (fonts.bold && fs.existsSync(fonts.bold)) {
            doc.registerFont("ChineseFontBold", fonts.bold);
            boldFont = "ChineseFontBold";
          } else {
            // 如果没有粗体字体，使用普通字体作为粗体
            boldFont = "ChineseFont";
          }
        } catch (error) {
          console.warn("注册中文字体失败，使用默认字体:", error.message);
          defaultFont = "Helvetica";
          boldFont = "Helvetica-Bold";
        }
      }
      
      doc.font(defaultFont).fontSize(12);

      const listCounters = {};

      const writeRuns = (runs = [], options = {}) => {
        const { align = "left" } = options;
        if (!runs || runs.length === 0) {
          doc.text(" ", { align });
          return;
        }

        runs.forEach((run, idx) => {
          const isLast = idx === runs.length - 1;
          const fontPath = run.bold ? boldFont : defaultFont;
          doc.font(fontPath);
          doc.fillColor(run.color || "#000000");

          const segments = String(run.text || "").replace(/\r/g, "").split("\n");
          segments.forEach((segment, segIdx) => {
            const finalSegment = isLast && segIdx === segments.length - 1;
            doc.text(segment.length > 0 ? segment : " ", {
              continued: !finalSegment,
              align: idx === 0 && segIdx === 0 ? align : undefined,
            });
          });
        });

        doc.fillColor("#000000");
      };

      blocks.forEach((block) => {
        switch (block.type) {
          case "header": {
            const sizeMap = { 1: 20, 2: 18, 3: 16, 4: 14, 5: 13, 6: 12 };
            const size = sizeMap[block.level] || 14;
            doc.moveDown(0.3);
            doc.font(boldFont).fontSize(size);
            writeRuns(block.runs, { align: block.align || "left" });
            doc.font(defaultFont).fontSize(12);
            doc.moveDown(0.3);
            break;
          }
          case "listItem": {
            const indent = block.indent || 0;
            if (block.ordered) {
              listCounters[indent] = (listCounters[indent] || 0) + 1;
            } else {
              listCounters[indent] = 0;
            }
            const bullet = block.ordered
              ? `${listCounters[indent]}. `
              : "• ";
            doc.text(`${"  ".repeat(indent)}${bullet}`, { continued: true });
            writeRuns(block.runs, { align: "left" });
            doc.text(" ");
            break;
          }
          case "blockquote": {
            doc.moveDown(0.2);
            doc.fillColor("#555555");
            doc.text("❝ ", { continued: true });
            writeRuns(block.runs, { align: "left" });
            doc.text(" ");
            doc.fillColor("#000000");
            break;
          }
          case "code": {
            doc.moveDown(0.2);
            doc.font(defaultFont).fillColor("#333333");
            const lines = (block.text || "").split("\n");
            lines.forEach((line) => {
              doc.text(line || " ", { align: "left" });
            });
            doc.fillColor("#000000");
            doc.moveDown(0.2);
            break;
          }
          case "image": {
            doc.moveDown(0.2);
            doc.text(`[图片] ${block.src}`);
            doc.moveDown(0.2);
            break;
          }
          case "horizontalRule": {
            const width =
              doc.page.width - doc.page.margins.left - doc.page.margins.right;
            doc.moveTo(doc.x, doc.y).lineTo(doc.x + width, doc.y).stroke();
            doc.moveDown(0.2);
            break;
          }
          default:
            writeRuns(block.runs, { align: block.align || "left" });
            doc.text(" ");
        }
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

const runsToDocx = (runs = []) => {
  if (!runs || runs.length === 0) {
    return [new TextRun({ text: "" })];
  }
  const docxRuns = [];
  runs.forEach((run) => {
    const segments = String(run.text || "").split(/\n/);
    segments.forEach((segment, index) => {
      const options = {
        text: segment,
        bold: !!run.bold,
        italics: !!run.italic,
        strike: !!run.strike,
        underline: run.underline ? {} : undefined,
        color: normalizeColor(run.color),
      };
      if (run.code) {
        options.font = "Consolas";
      }
      docxRuns.push(new TextRun(options));
      if (index < segments.length - 1) {
        docxRuns.push(new TextRun({ text: "", break: 1 }));
      }
    });
  });

  if (docxRuns.length === 0) {
    docxRuns.push(new TextRun({ text: "" }));
  }

  return docxRuns;
};

const generateDocxBufferFromBlocks = async (blocks = []) => {
  const paragraphs = [];

  const numbering = {
    config: [
      {
        reference: "ordered-list",
        levels: Array.from({ length: 5 }, (_, level) => ({
          level,
          format: "decimal",
          text: `%${level + 1}.`,
          alignment: AlignmentType.LEFT,
        })),
      },
      {
        reference: "bullet-list",
        levels: Array.from({ length: 5 }, (_, level) => ({
          level,
          format: "bullet",
          text: "•",
          alignment: AlignmentType.LEFT,
        })),
      },
    ],
  };

  blocks.forEach((block) => {
    switch (block.type) {
      case "header": {
        const level = Math.min(Math.max(block.level || 1, 1), 6);
        const headingMap = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        };
        paragraphs.push(
          new Paragraph({
            children: runsToDocx(block.runs),
            heading: headingMap[level] || HeadingLevel.HEADING_3,
            alignment: block.align
              ? AlignmentType[block.align.toUpperCase()] || AlignmentType.LEFT
              : undefined,
          })
        );
        break;
      }
      case "listItem": {
        const paragraphOptions = {
          children: runsToDocx(block.runs),
        };
        if (block.ordered) {
          paragraphOptions.numbering = {
            reference: "ordered-list",
            level: block.indent || 0,
          };
        } else {
          paragraphOptions.bullet = {
            level: block.indent || 0,
          };
        }
        paragraphs.push(new Paragraph(paragraphOptions));
        break;
      }
      case "blockquote":
        paragraphs.push(
          new Paragraph({
            children: runsToDocx(block.runs),
            indent: { left: 400 },
            spacing: { before: 120, after: 120 },
          })
        );
        break;
      case "code":
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.text || "",
                font: "Consolas",
              }),
            ],
            spacing: { before: 120, after: 120 },
          })
        );
        break;
      case "image":
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[图片] ${block.src}`,
              }),
            ],
          })
        );
        break;
      case "horizontalRule":
        paragraphs.push(new Paragraph({ thematicBreak: true }));
        break;
      default:
        paragraphs.push(
          new Paragraph({
            children: runsToDocx(block.runs),
            alignment: block.align
              ? AlignmentType[block.align.toUpperCase()] || AlignmentType.LEFT
              : undefined,
          })
        );
        break;
    }
  });

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
    numbering,
  });

  return Packer.toBuffer(doc);
};

const getRenderData = (document) => {
  const delta = ensureDelta(document.content);
  let blocks;
  if (
    document.content_format === "markdown" &&
    document.markdown_content &&
    document.markdown_content.trim().length > 0
  ) {
    blocks = buildBlocksFromMarkdown(document.markdown_content);
  } else {
    blocks = buildBlocksFromDelta(delta);
  }

  const html = blocksToHtml(blocks);
  const markdown = blocksToMarkdown(blocks, document.markdown_content);
  const plainText = blocksToPlainText(blocks);

  return {
    delta,
    blocks,
    html,
    markdown,
    plainText,
  };
};

const markdownToDelta = (markdown = "") => {
  const blocks = buildBlocksFromMarkdown(markdown);
  const ops = [];

  blocks.forEach((block) => {
    switch (block.type) {
      case "code":
        ops.push({ insert: block.text || "" });
        ops.push({ insert: "\n", attributes: { "code-block": true } });
        break;
      case "image":
        ops.push({ insert: { image: block.src } });
        ops.push({ insert: "\n" });
        break;
      case "horizontalRule":
        ops.push({ insert: "\n" });
        break;
      default: {
        (block.runs || []).forEach((run) => {
          const attributes = {};
          if (run.bold) attributes.bold = true;
          if (run.italic) attributes.italic = true;
          if (run.underline) attributes.underline = true;
          if (run.strike) attributes.strike = true;
          if (run.code) attributes.code = true;
          if (run.link) attributes.link = run.link;
          if (run.color) attributes.color = run.color;
          if (run.background) attributes.background = run.background;
          const payload = { insert: run.text || "" };
          if (Object.keys(attributes).length > 0) {
            payload.attributes = attributes;
          }
          ops.push(payload);
        });

        const blockAttributes = {};
        if (block.type === "header") {
          blockAttributes.header = block.level || 1;
        } else if (block.type === "listItem") {
          blockAttributes.list = block.ordered ? "ordered" : "bullet";
        } else if (block.type === "blockquote") {
          blockAttributes.blockquote = true;
        }
        if (block.indent) {
          blockAttributes.indent = block.indent;
        }
        if (block.align) {
          blockAttributes.align = block.align;
        }

        if (Object.keys(blockAttributes).length > 0) {
          ops.push({ insert: "\n", attributes: blockAttributes });
        } else {
          ops.push({ insert: "\n" });
        }
        break;
      }
    }
  });

  if (ops.length === 0) {
    ops.push({ insert: "\n" });
  }

  return { ops };
};

const diffToHtml = (diffs) =>
  diffs
    .map(([op, text]) => {
      const safeText = escapeHtml(text);
      if (!safeText) {
        return "";
      }
      switch (op) {
        case 1:
          return `<ins class="diff-added">${safeText}</ins>`;
        case -1:
          return `<del class="diff-removed">${safeText}</del>`;
        default:
          return `<span class="diff-unchanged">${safeText}</span>`;
      }
    })
    .join("");

const generateExportPayload = async (document, format, fileBase) => {
  const exportFormat = String(format || "json").toLowerCase();
  const baseName = sanitizeFileName(
    fileBase || document.title || `document-${document.id}`
  );
  const { delta, blocks, html, markdown, plainText } = getRenderData(document);

  switch (exportFormat) {
    case "markdown":
      return {
        buffer: Buffer.from(markdown || "", "utf-8"),
        fileName: `${baseName}.md`,
        contentType: "text/markdown",
      };
    case "docx":
      return {
        buffer: await generateDocxBufferFromBlocks(blocks),
        fileName: `${baseName}.docx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    case "pdf":
      return {
        buffer: await generatePdfBufferFromBlocks(blocks),
        fileName: `${baseName}.pdf`,
        contentType: "application/pdf",
      };
    case "json":
    default:
      // JSON 导出只包含文本内容，不包含数据库元数据
      const jsonPayload = {
        title: document.title || "",
        category: document.category || null,
        tags: normalizeArray(document.tags),
        content_format: document.content_format || "rich",
      };
      
      // 根据内容格式添加相应内容
      if (document.content_format === "markdown") {
        jsonPayload.markdown = markdown || "";
        jsonPayload.plain_text = plainText || "";
      } else {
        // 富文本：只导出 Delta 格式的内容
        jsonPayload.content = delta || { ops: [{ insert: "\n" }] };
        jsonPayload.plain_text = plainText || "";
      }
      
      return {
        buffer: Buffer.from(
          JSON.stringify(jsonPayload, null, 2),
          "utf-8"
        ),
        fileName: `${baseName}.json`,
        contentType: "application/json",
      };
  }
};

const prepareDocumentPayload = (payload) => {
  const {
    title,
    category,
    tags,
    content,
    format = "json",
    markdown,
  } = payload;

  if (!title || !title.trim()) {
    throw new Error("缺少标题");
  }

  const sanitizedTags = sanitizeTags(
    Array.isArray(tags)
      ? tags
      : typeof tags === "string"
      ? tags.split(",")
      : []
  );

  let preparedContent;
  let contentFormat = "rich";
  let markdownContent = null;

  if (String(format).toLowerCase() === "markdown") {
    const markdownSource = markdown || content;
    if (!markdownSource) {
      throw new Error("缺少 Markdown 内容");
    }
    preparedContent = markdownToDelta(markdownSource);
    markdownContent = markdownSource;
    contentFormat = "markdown";
  } else {
    if (!content) {
      throw new Error("缺少文档内容");
    }
    let parsedContent = content;
    if (typeof content === "string") {
      try {
        parsedContent = JSON.parse(content);
      } catch (error) {
        throw new Error("内容必须是有效的 JSON");
      }
    }
    if (typeof parsedContent !== "object") {
      throw new Error("文档内容格式不正确");
    }
    preparedContent = ensureDelta(parsedContent);
  }

  const deltaContent = ensureDelta(preparedContent);

  return {
    title: title.trim(),
    category: category ? category.trim() : null,
    tags: sanitizedTags,
    content: deltaContent,
    contentFormat,
    markdownContent,
  };
};

// 中间件：检查用户是否为文档所有者
const isOwner = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const docResult = await pool.query(
      "SELECT owner_id FROM documents WHERE id = $1",
      [documentId]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: "文档不存在" });
    }

    if (docResult.rows[0].owner_id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "只有文档所有者才能执行此操作" });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "服务器内部错误" });
  }
};

// 1. 获取文档列表（支持筛选、排序）
router.get("/", protect, async (req, res) => {
  try {
    const {
      q,
      category,
      tag,
      sort = "updated_at",
      order = "desc",
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      owner,
      locked,
    } = req.query;

    const allowedSorts = new Set(["updated_at", "created_at", "title"]);
    const sortColumn = allowedSorts.has(sort) ? sort : "updated_at";
    const sortOrder = order && order.toLowerCase() === "asc" ? "ASC" : "DESC";

    const filters = [];
    const values = [];

    let query = `
      SELECT d.id,
             d.title,
             d.owner_id,
             d.updated_at,
             d.created_at,
             d.category,
             d.tags,
             d.template_id,
             d.is_locked,
             d.locked_by,
             d.locked_at,
             d.content_format,
             u.email AS owner_email,
             u.full_name AS owner_name,
             lu.email AS locked_by_email,
             lu.full_name AS locked_by_name
        FROM documents d
        JOIN users u ON d.owner_id = u.id
   LEFT JOIN users lu ON d.locked_by = lu.id
    `;

    if (req.user.role === "admin") {
      query += " WHERE 1=1 ";
    } else {
      values.push(req.user.id);
      const placeholder = `$${values.length}`;
      query += ` WHERE (d.owner_id = ${placeholder} OR d.id IN (SELECT document_id FROM document_collaborators WHERE user_id = ${placeholder}))`;
    }

    if (q) {
      values.push(`%${q.toLowerCase()}%`);
      const placeholder = `$${values.length}`;
      filters.push(
        `(LOWER(d.title) LIKE ${placeholder}
          OR LOWER(COALESCE(u.email, '')) LIKE ${placeholder}
          OR LOWER(COALESCE(u.full_name, '')) LIKE ${placeholder}
          OR LOWER(COALESCE(d.category, '')) LIKE ${placeholder}
          OR LOWER(d.tags::text) LIKE ${placeholder})`
      );
    }

    if (category) {
      values.push(category);
      filters.push(`d.category = $${values.length}`);
    }

    if (tag) {
      values.push(JSON.stringify([tag]));
      filters.push(`d.tags @> $${values.length}::jsonb`);
    }

    if (createdFrom) {
      values.push(new Date(createdFrom));
      filters.push(`d.created_at >= $${values.length}`);
    }

    if (createdTo) {
      values.push(new Date(createdTo));
      filters.push(`d.created_at <= $${values.length}`);
    }

    if (updatedFrom) {
      values.push(new Date(updatedFrom));
      filters.push(`d.updated_at >= $${values.length}`);
    }

    if (updatedTo) {
      values.push(new Date(updatedTo));
      filters.push(`d.updated_at <= $${values.length}`);
    }

    if (owner && req.user.role === "admin") {
      values.push(owner);
      filters.push(`d.owner_id = $${values.length}`);
    }

    if (locked === "true") {
      filters.push("d.is_locked = true");
    } else if (locked === "false") {
      filters.push("d.is_locked = false");
    }

    if (filters.length > 0) {
      query += ` AND ${filters.join(" AND ")}`;
    }

    query += ` ORDER BY d.${sortColumn} ${sortOrder}`;

    const documents = await pool.query(query, values);

    const normalizedDocuments = documents.rows.map((doc) => ({
      ...doc,
      tags: normalizeArray(doc.tags),
      is_locked: doc.is_locked,
      locked_by: doc.locked_by,
      locked_at: doc.locked_at,
      locked_by_email: doc.locked_by_email,
      locked_by_name: doc.locked_by_name,
    }));

    res.json(normalizedDocuments);
  } catch (error) {
    console.error("获取文档列表失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 2. 创建一个新文档
router.post("/", protect, async (req, res) => {
  const {
    title,
    category,
    tags,
    templateId,
    content,
    contentFormat,
    markdownContent,
  } = req.body;
  const ownerId = req.user.id;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: "文档标题不能为空" });
  }

  try {
    let initialContent =
      typeof content === "object" && content !== null
        ? content
        : null;
    let appliedTemplateId = null;
    let sanitizedTags = sanitizeTags(tags);
    let documentCategory = category ? category.trim() : null;
    const format = contentFormat === "markdown" ? "markdown" : "rich";
    let markdownToSave =
      format === "markdown"
        ? (markdownContent !== undefined ? markdownContent : content) || ""
        : null;

    if (format === "markdown" && !markdownToSave) {
      markdownToSave = "";
    }

    if (templateId) {
      const templateResult = await pool.query(
        `SELECT id, content, category AS template_category, tags AS template_tags
           FROM document_templates
          WHERE id = $1 AND (is_public = true OR owner_id = $2)`,
        [templateId, ownerId]
      );

      if (templateResult.rows.length === 0) {
        return res.status(404).json({ message: "模板不存在或无权使用" });
      }

      const template = templateResult.rows[0];
      initialContent = template.content || initialContent;
      if (!documentCategory && template.template_category) {
        documentCategory = template.template_category;
      }
      if (sanitizedTags.length === 0) {
        sanitizedTags = normalizeArray(template.template_tags);
      }
      appliedTemplateId = template.id;
      if (format === "markdown" && !markdownToSave) {
        const htmlFromTemplate = deltaToSimpleHtml(template.content);
        markdownToSave = turndownService.turndown(htmlFromTemplate);
      }
    }

    if (!initialContent) {
      initialContent = { ops: [{ insert: "\n" }] };
    }

    if (format === "markdown") {
      const deltaFromMarkdown = markdownToDelta(markdownToSave || "");
      initialContent = deltaFromMarkdown;
    }

    const newDocument = await pool.query(
      `INSERT INTO documents (title, owner_id, content, category, tags, template_id, content_format, markdown_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id,
              title,
              owner_id,
              content,
              category,
              tags,
              template_id,
              content_format,
              markdown_content,
              created_at,
              updated_at`,
      [
        title.trim(),
        ownerId,
        JSON.stringify(initialContent),
        documentCategory,
        JSON.stringify(sanitizedTags),
        appliedTemplateId,
        format,
        markdownToSave,
      ]
    );

    res.status(201).json({
      ...newDocument.rows[0],
      tags: sanitizedTags,
    });
  } catch (error) {
    console.error("创建文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 2.1 模板库
router.get("/templates", protect, async (req, res) => {
  try {
    const templatesResult = await pool.query(
      `SELECT id,
              name,
              description,
              content,
              category,
              tags,
              is_public,
              owner_id,
              created_at
         FROM document_templates
        WHERE is_public = true OR owner_id = $1
        ORDER BY created_at DESC`,
      [req.user.id]
    );

    const templates = templatesResult.rows.map((template) => ({
      ...template,
      tags: normalizeArray(template.tags),
    }));

    res.json(templates);
  } catch (error) {
    console.error("获取模板列表失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/templates", protect, async (req, res) => {
  const { name, description, content, category, tags, isPublic = true } =
    req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "模板名称不能为空" });
  }

  const templateContent =
    typeof content === "object" && content !== null
      ? content
      : { ops: [{ insert: "\n" }] };

  const sanitizedTags = sanitizeTags(
    Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",") : []
  );

  try {
    const newTemplate = await pool.query(
      `INSERT INTO document_templates (name, description, content, category, tags, owner_id, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id,
              name,
              description,
              content,
              category,
              tags,
              owner_id,
              is_public,
              created_at`,
      [
        name.trim(),
        description ? description.trim() : null,
        JSON.stringify(templateContent),
        category ? category.trim() : null,
        JSON.stringify(sanitizedTags),
        req.user.id,
        !!isPublic,
      ]
    );

    await logActivity(
      req.user.id,
      "CREATE_TEMPLATE",
      "template",
      newTemplate.rows[0].id,
      {
        category: newTemplate.rows[0].category,
        isPublic: !!isPublic,
      }
    );

    res.status(201).json({
      ...newTemplate.rows[0],
      tags: sanitizedTags,
    });
  } catch (error) {
    console.error("创建模板失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.get("/:id/versions/compare", protect, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const fromId = parseInt(req.query.from, 10);
    const toId = parseInt(req.query.to, 10);

    if (isNaN(documentId) || isNaN(fromId) || isNaN(toId)) {
      return res.status(400).json({ message: "无效的版本参数" });
    }

    const access = await getDocumentAccess(documentId, req.user);
    if (access.notFound) {
      return res.status(404).json({ message: "文档不存在" });
    }
    if (!access.canView) {
      return res.status(403).json({ message: "无权查看该文档" });
    }

    const versionsResult = await pool.query(
      `SELECT id, title, content, category, tags, summary, created_at, content_format, markdown_content
         FROM document_versions
        WHERE document_id = $1 AND id IN ($2, $3)`,
      [documentId, fromId, toId]
    );

    if (versionsResult.rows.length !== 2) {
      return res.status(404).json({ message: "版本不存在" });
    }

    const fromVersion = versionsResult.rows.find((v) => v.id === fromId);
    const toVersion = versionsResult.rows.find((v) => v.id === toId);

    // 确定内容格式（优先使用版本中的格式，如果没有则默认富文本）
    const fromFormat = fromVersion.content_format || "rich";
    const toFormat = toVersion.content_format || "rich";
    
    // 如果两个版本的格式不同，使用富文本格式进行对比
    const compareFormat = fromFormat === "markdown" && toFormat === "markdown" ? "markdown" : "rich";

    let fromText, toText;

    if (compareFormat === "markdown") {
      // Markdown 格式：直接使用 Markdown 文本进行对比
      fromText = fromVersion.markdown_content || "";
      toText = toVersion.markdown_content || "";
    } else {
      // 富文本格式：将 Delta 转换为 HTML 进行对比
      fromText = deltaToSimpleHtml(ensureDelta(fromVersion.content));
      toText = deltaToSimpleHtml(ensureDelta(toVersion.content));
    }

    const diffs = dmp.diff_main(fromText, toText);
    dmp.diff_cleanupSemantic(diffs);
    
    let diffHtml = diffToHtml(diffs);
    
    // 如果是 Markdown 格式，需要对差异 HTML 进行特殊处理
    // 因为 Markdown 文本中的特殊字符（如 *、#、_）需要转义或正确处理
    if (compareFormat === "markdown") {
      // Markdown 差异显示：将差异包装在代码块样式的容器中，保持 Markdown 格式
      // 差异高亮（ins/del）仍然保留，但 Markdown 语法会原样显示
      diffHtml = `<div class="markdown-diff" style="font-family: 'Consolas', 'Monaco', 'Courier New', monospace; white-space: pre-wrap; word-wrap: break-word; line-height: 1.6;">${diffHtml}</div>`;
    }

    res.json({
      fromVersion,
      toVersion,
      diffHtml,
      compareFormat,
    });
  } catch (error) {
    console.error("版本对比失败:", error);
    console.error("错误详情:", error.stack);
    res.status(500).json({ message: "服务器内部错误", error: error.message });
  }
});

// 3. 获取单个文档 (【最终终极修正版】)
router.get("/:id", protect, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    const documentResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [id]
    );
    if (documentResult.rows.length === 0) {
      return res.status(404).json({ message: "文档不存在" });
    }
    const document = documentResult.rows[0];
    document.tags = normalizeArray(document.tags);
    document.content_format = document.content_format || "rich";

    if (document.markdown_content && document.content_format === "markdown") {
      document.markdown_content = document.markdown_content.toString();
    }

    // --- 【最终的、统一的权限检查逻辑】 ---
    let userRoleForDoc = "none"; // 默认无权限

    // 检查是否为所有者或全局管理员
    if (document.owner_id === req.user.id || req.user.role === "admin") {
      userRoleForDoc = "owner"; // 'owner' 拥有最高权限
    } else {
      // 如果不是，再检查是否为协作者
      const collaboratorResult = await pool.query(
        "SELECT role FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
        [id, req.user.id]
      );
      if (collaboratorResult.rows.length > 0) {
        userRoleForDoc = collaboratorResult.rows[0].role; // 'editor' or 'viewer'
      }
    }

    // 如果最终没有任何权限，则拒绝访问
    if (userRoleForDoc === "none") {
      return res.status(403).json({ message: "无权访问此文档" });
    }

    let lockedByUser = null;
    if (document.locked_by) {
      const lockUserResult = await pool.query(
        "SELECT id, email, full_name FROM users WHERE id = $1",
        [document.locked_by]
      );
      lockedByUser = lockUserResult.rows[0] || null;
    }

    res.json({
      ...document,
      userRoleForDoc,
      lockedBy: lockedByUser,
    });
  } catch (error) {
    console.error("获取文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 4. 更新文档 (【最终终极绝对修正版】)
router.put("/:id", protect, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    // --- (核心修复 1) 首先，获取完整的文档信息用于权限判断 ---
    const documentResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [id]
    );
    if (documentResult.rows.length === 0) {
      return res.status(404).json({ message: "文档不存在" });
    }
    const document = documentResult.rows[0];

    // --- (核心修复 2) 植入完整的、正确的编辑权限检查逻辑 ---
    let canEdit = false;
    const isOwner = document.owner_id === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (isOwner || isAdmin) {
      canEdit = true;
    } else {
      const collaboratorResult = await pool.query(
        "SELECT role FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
        [id, req.user.id]
      );
      if (
        collaboratorResult.rows.length > 0 &&
        collaboratorResult.rows[0].role === "editor"
      ) {
        canEdit = true;
      }
    }

    if (!canEdit) {
      return res.status(403).json({ message: "你没有权限编辑此文档" });
    }

    // --- (核心修复 3) 确保更新逻辑正确无误 ---
    const {
      title,
      content,
      category,
      tags,
      contentFormat,
      markdownContent,
      lockAction,
    } = req.body;
    const fields = [];
    const values = [];
    let sanitizedTags;
    let newLockApplied = false;

    if (title !== undefined) {
      fields.push(`title = $${fields.length + 1}`);
      values.push(title);
    }
    if (content !== undefined) {
      const delta = ensureDelta(content);
      fields.push(`content = $${fields.length + 1}`);
      values.push(JSON.stringify(delta));
    }

    if (contentFormat !== undefined) {
      const normalizedFormat =
        contentFormat === "markdown" ? "markdown" : "rich";
      fields.push(`content_format = $${fields.length + 1}`);
      values.push(normalizedFormat);

      if (normalizedFormat === "markdown" && markdownContent !== undefined) {
        const delta = markdownToDelta(markdownContent || "");
        fields.push(`content = $${fields.length + 1}`);
        values.push(JSON.stringify(delta));
        fields.push(`markdown_content = $${fields.length + 1}`);
        values.push(markdownContent || "");
      }
    } else if (markdownContent !== undefined) {
      fields.push(`markdown_content = $${fields.length + 1}`);
      values.push(markdownContent || "");
    }

    if (category !== undefined) {
      fields.push(`category = $${fields.length + 1}`);
      values.push(category ? category.trim() : null);
    }

    if (tags !== undefined) {
      const rawTags = Array.isArray(tags)
        ? tags
        : typeof tags === "string"
        ? tags.split(",")
        : [];
      sanitizedTags = sanitizeTags(rawTags);
      fields.push(`tags = $${fields.length + 1}`);
      values.push(JSON.stringify(sanitizedTags));
    }

    if (lockAction === "lock") {
      if (
        document.is_locked &&
        document.locked_by &&
        document.locked_by !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res.status(423).json({ message: "文档已被其他用户锁定" });
      }
      fields.push(`is_locked = $${fields.length + 1}`);
      values.push(true);
      fields.push(`locked_by = $${fields.length + 1}`);
      values.push(req.user.id);
      fields.push(`locked_at = NOW()`);
      newLockApplied = true;
    }

    if (lockAction === "unlock") {
      if (
        document.is_locked &&
        document.locked_by &&
        document.locked_by !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ message: "无权解锁该文档" });
      }
      fields.push(`is_locked = $${fields.length + 1}`);
      values.push(false);
      fields.push(`locked_by = NULL`);
      fields.push(`locked_at = NULL`);
      newLockApplied = true;
    }

    if (fields.length === 0) {
      return res.json(document);
    }

    values.push(id);
    const query = `UPDATE documents SET ${fields.join(
      ", "
    )}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
    const updatedDocument = await pool.query(query, values);

    // 为了与 GET 请求保持一致，我们也返回 userRoleForDoc
    let lockedByDetail = null;
    if (
      updatedDocument.rows[0].locked_by &&
      !(newLockApplied && lockAction === "unlock")
    ) {
      const lockUserResult = await pool.query(
        "SELECT id, email, full_name FROM users WHERE id = $1",
        [updatedDocument.rows[0].locked_by]
      );
      lockedByDetail = lockUserResult.rows[0] || null;
    }

    const result = {
      ...updatedDocument.rows[0],
      userRoleForDoc: canEdit ? "editor" : "viewer",
      tags:
        sanitizedTags !== undefined
          ? sanitizedTags
          : normalizeArray(updatedDocument.rows[0].tags),
      lockedBy: lockedByDetail,
    };

    // 如果执行了锁定/解锁操作，通过 Socket 发送完整文档更新
    if (newLockApplied && io) {
      // 获取完整的文档内容（包括解析后的 content）
      const fullDocResult = await pool.query(
        `SELECT d.*,
                u.id as locked_by_id,
                u.email as locked_by_email,
                u.full_name as locked_by_full_name
         FROM documents d
         LEFT JOIN users u ON d.locked_by = u.id
         WHERE d.id = $1`,
        [id]
      );
      
      if (fullDocResult.rows.length > 0) {
        const fullDoc = fullDocResult.rows[0];
        let parsedContent = { ops: [{ insert: "\n" }] };
        if (fullDoc.content) {
          try {
            parsedContent = typeof fullDoc.content === "string"
              ? JSON.parse(fullDoc.content)
              : fullDoc.content;
          } catch (e) {
            console.error("解析文档内容失败:", e);
          }
        }

        io.to(String(id)).emit("receiveMetadata", {
          is_locked: !!fullDoc.is_locked,
          lockedBy: fullDoc.locked_by_id ? {
            id: fullDoc.locked_by_id,
            email: fullDoc.locked_by_email,
            full_name: fullDoc.locked_by_full_name,
          } : null,
          forceRefresh: true, // 强制刷新完整内容
          content: parsedContent,
          content_format: fullDoc.content_format || "rich",
          markdown_content: fullDoc.markdown_content || "",
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error("更新文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 2.2 版本历史
router.get("/:id/versions", protect, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    const access = await getDocumentAccess(documentId, req.user);
    if (access.notFound) {
      return res.status(404).json({ message: "文档不存在" });
    }
    if (!access.canView) {
      return res.status(403).json({ message: "无权查看该文档" });
    }

    const versionsResult = await pool.query(
      `SELECT dv.id,
              dv.title,
              dv.category,
              dv.tags,
              dv.summary,
              dv.created_at,
              dv.created_by,
              dv.content_format,
              dv.markdown_content,
              u.email AS created_by_email,
              u.full_name AS created_by_name
         FROM document_versions dv
    LEFT JOIN users u ON dv.created_by = u.id
        WHERE dv.document_id = $1
     ORDER BY dv.created_at DESC`,
      [documentId]
    );

    const versions = versionsResult.rows.map((version) => ({
      ...version,
      tags: normalizeArray(version.tags),
    }));

    res.json(versions);
  } catch (error) {
    console.error("获取版本列表失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/:id/versions", protect, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    const { summary } = req.body;

    const access = await getDocumentAccess(documentId, req.user);
    if (access.notFound) {
      return res.status(404).json({ message: "文档不存在" });
    }
    if (!access.canEdit) {
      return res.status(403).json({ message: "无权保存版本" });
    }

    const { document } = access;
    const deltaContent = ensureDelta(document.content);
    const storedContent = JSON.stringify(deltaContent);
    const storedTags = normalizeArray(document.tags);
    const storedFormat = document.content_format || "rich";
    const storedMarkdown = document.markdown_content || null;

    const newVersionResult = await pool.query(
      `INSERT INTO document_versions (document_id, title, content, category, tags, created_by, summary, content_format, markdown_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id,
              title,
              category,
              tags,
              summary,
              created_at,
              created_by,
              content_format,
              markdown_content`,
      [
        documentId,
        document.title,
        storedContent,
        document.category,
        JSON.stringify(storedTags),
        req.user.id,
        summary || null,
        storedFormat,
        storedMarkdown,
      ]
    );

    await logActivity(req.user.id, "SAVE_DOCUMENT_VERSION", "document", documentId, {
      versionId: newVersionResult.rows[0].id,
    });

    res.status(201).json({
      ...newVersionResult.rows[0],
      tags: storedTags,
    });
  } catch (error) {
    console.error("保存文档版本失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.get("/:id/versions/:versionId", protect, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.versionId, 10);

    if (isNaN(documentId) || isNaN(versionId)) {
      return res.status(400).json({ message: "无效的版本请求" });
    }

    const access = await getDocumentAccess(documentId, req.user);
    if (access.notFound) {
      return res.status(404).json({ message: "文档不存在" });
    }
    if (!access.canView) {
      return res.status(403).json({ message: "无权查看该文档" });
    }

    const versionResult = await pool.query(
      `SELECT dv.id,
              dv.title,
              dv.content,
              dv.category,
              dv.tags,
              dv.summary,
              dv.created_at,
              dv.created_by,
              u.email AS created_by_email,
              u.full_name AS created_by_name
         FROM document_versions dv
    LEFT JOIN users u ON dv.created_by = u.id
        WHERE dv.document_id = $1 AND dv.id = $2`,
      [documentId, versionId]
    );

    if (versionResult.rows.length === 0) {
      return res.status(404).json({ message: "版本不存在" });
    }

    const version = versionResult.rows[0];
    res.json({
      ...version,
      tags: normalizeArray(version.tags),
      content_format: version.content_format || "rich",
      markdown_content: version.markdown_content,
    });
  } catch (error) {
    console.error("获取版本详情失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/:id/versions/:versionId/restore", protect, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.versionId, 10);

    if (isNaN(documentId) || isNaN(versionId)) {
      return res.status(400).json({ message: "无效的版本请求" });
    }

    const access = await getDocumentAccess(documentId, req.user);
    if (access.notFound) {
      return res.status(404).json({ message: "文档不存在" });
    }
    if (!access.canEdit) {
      return res.status(403).json({ message: "无权恢复该版本" });
    }

    const versionResult = await pool.query(
      "SELECT * FROM document_versions WHERE document_id = $1 AND id = $2",
      [documentId, versionId]
    );

    if (versionResult.rows.length === 0) {
      return res.status(404).json({ message: "版本不存在" });
    }

    const version = versionResult.rows[0];

    const currentDocument = access.document;
    const currentTags = normalizeArray(currentDocument.tags);
    const currentFormat = currentDocument.content_format || "rich";
    const currentMarkdown =
      currentFormat === "markdown" ? currentDocument.markdown_content || "" : null;

    await pool.query(
      `INSERT INTO document_versions (document_id, title, content, category, tags, created_by, summary, content_format, markdown_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
        ,
      [
        documentId,
        currentDocument.title,
        typeof currentDocument.content === "string"
          ? currentDocument.content
          : JSON.stringify(currentDocument.content),
        currentDocument.category,
        JSON.stringify(currentTags),
        req.user.id,
        "自动备份：恢复前版本",
        currentFormat,
        currentMarkdown,
      ]
    );

    await pool.query(
      `UPDATE documents
          SET title = $1,
              content = $2,
              category = $3,
              tags = $4,
              content_format = $5,
              markdown_content = $6,
              updated_at = NOW()
        WHERE id = $7`,
      [
        version.title,
        typeof version.content === "string"
          ? version.content
          : JSON.stringify(version.content),
        version.category,
        JSON.stringify(normalizeArray(version.tags)),
        version.content_format || "rich",
        version.content_format === "markdown" ? version.markdown_content : null,
        documentId,
      ]
    );

    await logActivity(req.user.id, "RESTORE_DOCUMENT_VERSION", "document", documentId, {
      versionId,
    });

    // 通过 Socket 发送完整文档更新，通知所有协作者
    if (io) {
      // 获取恢复后的完整文档
      const restoredDocResult = await pool.query(
        `SELECT d.*,
                u.id as locked_by_id,
                u.email as locked_by_email,
                u.full_name as locked_by_full_name
         FROM documents d
         LEFT JOIN users u ON d.locked_by = u.id
         WHERE d.id = $1`,
        [documentId]
      );
      
      if (restoredDocResult.rows.length > 0) {
        const restoredDoc = restoredDocResult.rows[0];
        let parsedContent = { ops: [{ insert: "\n" }] };
        if (restoredDoc.content) {
          try {
            parsedContent = typeof restoredDoc.content === "string"
              ? JSON.parse(restoredDoc.content)
              : restoredDoc.content;
          } catch (e) {
            console.error("解析恢复后的文档内容失败:", e);
          }
        }

        io.to(String(documentId)).emit("receiveMetadata", {
          title: restoredDoc.title,
          category: restoredDoc.category,
          tags: normalizeArray(restoredDoc.tags),
          content: parsedContent,
          content_format: restoredDoc.content_format || "rich",
          markdown_content: restoredDoc.markdown_content || "",
          is_locked: !!restoredDoc.is_locked,
          lockedBy: restoredDoc.locked_by_id ? {
            id: restoredDoc.locked_by_id,
            email: restoredDoc.locked_by_email,
            full_name: restoredDoc.locked_by_full_name,
          } : null,
          forceRefresh: true, // 强制刷新完整内容
        });
      }
    }

    res.json({ message: "成功恢复版本" });
  } catch (error) {
    console.error("恢复文档版本失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 2.4 文档导入与导出（JSON）
router.get("/:id/export", protect, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    const { format = "json" } = req.query;
    const exportFormat = String(format).toLowerCase();

    const access = await getDocumentAccess(documentId, req.user);
    if (access.notFound) {
      return res.status(404).json({ message: "文档不存在" });
    }
    if (!access.canView) {
      return res.status(403).json({ message: "无权导出该文档" });
    }

    const { document } = access;
    const payload = await generateExportPayload(
      document,
      exportFormat,
      document.title
    );

    res.setHeader("Content-Type", payload.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; ${encodeFileName(payload.fileName, documentId)}`
    );

    return res.send(payload.buffer);
  } catch (error) {
    console.error("导出文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/import", protect, async (req, res) => {
  try {
    const prepared = prepareDocumentPayload(req.body);

    const newDocument = await pool.query(
      `INSERT INTO documents (title, owner_id, content, category, tags, content_format, markdown_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id,
              title,
              owner_id,
              content,
              category,
              tags,
              content_format,
              markdown_content,
              created_at,
              updated_at`,
      [
        prepared.title,
        req.user.id,
        JSON.stringify(prepared.content),
        prepared.category,
        JSON.stringify(prepared.tags),
        prepared.contentFormat,
        prepared.markdownContent,
      ]
    );

    await logActivity(req.user.id, "IMPORT_DOCUMENT", "document", newDocument.rows[0].id, {
      category: newDocument.rows[0].category,
      tags: prepared.tags,
      contentFormat: prepared.contentFormat,
    });

    res.status(201).json({
      ...newDocument.rows[0],
      tags: prepared.tags,
    });
  } catch (error) {
    console.error("导入文档失败:", error);
    const message = error.message || "导入失败：无法解析数据";
    if (message.startsWith("缺少") || message.includes("内容必须") || message.includes("格式不正确")) {
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/import/bulk", protect, async (req, res) => {
  try {
    const { documents } = req.body;
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ message: "请提供待导入的文档数组" });
    }

    const results = [];
    for (const payload of documents) {
      try {
        const prepared = prepareDocumentPayload(payload);
        const inserted = await pool.query(
          `INSERT INTO documents (title, owner_id, content, category, tags, content_format, markdown_content)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, title, category, tags, content_format`,
          [
            prepared.title,
            req.user.id,
            JSON.stringify(prepared.content),
            prepared.category,
            JSON.stringify(prepared.tags),
            prepared.contentFormat,
            prepared.markdownContent,
          ]
        );

        await logActivity(
          req.user.id,
          "IMPORT_DOCUMENT",
          "document",
          inserted.rows[0].id,
          {
            category: inserted.rows[0].category,
            tags: prepared.tags,
            contentFormat: prepared.contentFormat,
          }
        );

        results.push({
          status: "success",
          id: inserted.rows[0].id,
          title: prepared.title,
        });
      } catch (error) {
        results.push({
          status: "failed",
          title: payload?.title,
          message: error.message || "解析失败",
        });
      }
    }

    const importedCount = results.filter((r) => r.status === "success").length;

    res.status(207).json({
      imported: importedCount,
      total: documents.length,
      results,
    });
  } catch (error) {
    console.error("批量导入文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/export/bulk", protect, async (req, res) => {
  try {
    const { ids, format = "json" } = req.body;
    
    // 验证请求数据
    if (!ids) {
      return res.status(400).json({ message: "请提供要导出的文档 ID 列表" });
    }
    
    if (!Array.isArray(ids)) {
      console.error("批量导出：ids 不是数组", typeof ids, ids);
      return res.status(400).json({ message: "文档 ID 列表必须是数组格式" });
    }
    
    if (ids.length === 0) {
      return res.status(400).json({ message: "请至少选择一个文档进行导出" });
    }

    // 验证并转换所有 ID
    const documentIds = ids
      .map((id) => {
        if (typeof id === "number") {
          return id;
        }
        if (typeof id === "string") {
          const parsed = parseInt(id, 10);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      })
      .filter((id) => id !== null && id > 0);

    if (documentIds.length === 0) {
      return res.status(400).json({ message: "没有有效的文档 ID" });
    }

    // 检查用户是否有权限访问至少一个文档
    let hasAccess = false;
    for (const documentId of documentIds) {
      const access = await getDocumentAccess(documentId, req.user);
      if (!access.notFound && access.canView) {
        hasAccess = true;
        break;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "无权导出所选文档" });
    }

    // 设置响应头
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=documents-export.zip"
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    
    // 处理归档错误
    archive.on("error", (err) => {
      console.error("归档错误:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "创建压缩包失败" });
      }
    });

    archive.pipe(res);

    // 添加文档到归档
    let addedCount = 0;
    for (const documentId of documentIds) {
      try {
        const access = await getDocumentAccess(documentId, req.user);
        if (access.notFound || !access.canView) {
          continue;
        }

        const payload = await generateExportPayload(
          access.document,
          String(format).toLowerCase(),
          access.document.title
        );

        archive.append(payload.buffer, { name: payload.fileName });
        addedCount++;
      } catch (error) {
        console.error(`添加文档 ${documentId} 到归档失败:`, error);
        // 继续处理其他文档
      }
    }

    if (addedCount === 0) {
      archive.abort();
      if (!res.headersSent) {
        return res.status(403).json({ message: "无法导出任何文档，请检查权限" });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error("批量导出文档失败:", error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: "服务器内部错误",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
});

// 文档锁定
router.post("/:id/lock", protect, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    const access = await getDocumentAccess(documentId, req.user);
    if (access.notFound) {
      return res.status(404).json({ message: "文档不存在" });
    }
    if (!access.canEdit) {
      return res.status(403).json({ message: "无权锁定该文档" });
    }

    const doc = access.document;
    if (
      doc.is_locked &&
      doc.locked_by &&
      doc.locked_by !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(423).json({ message: "文档已被其他用户锁定" });
    }

    const updated = await pool.query(
      `UPDATE documents
          SET is_locked = true,
              locked_by = $1,
              locked_at = NOW()
        WHERE id = $2
    RETURNING id, title, is_locked, locked_by, locked_at`,
      [req.user.id, documentId]
    );

    await logActivity(req.user.id, "LOCK_DOCUMENT", "document", documentId);

    res.json(updated.rows[0]);
  } catch (error) {
    console.error("锁定文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/:id/unlock", protect, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    const access = await getDocumentAccess(documentId, req.user);
    if (access.notFound) {
      return res.status(404).json({ message: "文档不存在" });
    }
    if (!access.canEdit) {
      return res.status(403).json({ message: "无权解锁该文档" });
    }

    const doc = access.document;
    if (
      doc.is_locked &&
      doc.locked_by &&
      doc.locked_by !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "无权解锁该文档" });
    }

    const updated = await pool.query(
      `UPDATE documents
          SET is_locked = false,
              locked_by = NULL,
              locked_at = NULL
        WHERE id = $1
    RETURNING id, title, is_locked, locked_by, locked_at`,
      [documentId]
    );

    await logActivity(req.user.id, "UNLOCK_DOCUMENT", "document", documentId);

    res.json(updated.rows[0]);
  } catch (error) {
    console.error("解锁文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 5. 获取文档的协作者列表
router.get("/:id/collaborators", protect, isOwner, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const collaborators = await pool.query(
      `SELECT u.id, u.email, dc.role 
             FROM document_collaborators dc
             JOIN users u ON dc.user_id = u.id
             WHERE dc.document_id = $1`,
      [documentId]
    );
    res.json(collaborators.rows);
  } catch (error) {
    console.error("获取协作者列表失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 6. 添加/更新协作者
router.post("/:id/collaborators", protect, isOwner, async (req, res) => {
  const documentId = parseInt(req.params.id, 10);
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ message: "需要提供用户邮箱和角色" });
  }

  try {
    // 查找用户 ID
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "找不到该邮箱对应的用户" });
    }
    const userId = userResult.rows[0].id;

    // 检查是否试图将所有者添加为协作者
    const docOwnerResult = await pool.query(
      "SELECT owner_id FROM documents WHERE id = $1",
      [documentId]
    );
    if (docOwnerResult.rows[0].owner_id === userId) {
      return res.status(400).json({ message: "不能将所有者添加为协作者" });
    }

    // 使用 ON CONFLICT 实现 "UPSERT" (更新或插入)
    const newCollaborator = await pool.query(
      `INSERT INTO document_collaborators (document_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (document_id, user_id) 
             DO UPDATE SET role = EXCLUDED.role
             RETURNING *`,
      [documentId, userId, role]
    );

    // --- (核心集成) 记录日志 ---
    await logActivity(
      req.user.id, // 操作者：文档所有者
      "ADD_COLLABORATOR", // 动作
      "document", // 对象类型
      documentId, // 对象ID
      { targetUserId: userId, newRole: role } // 详情
    );

    res.status(201).json({ id: userId, email, role });
  } catch (error) {
    console.error("添加协作者失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 7. 移除协作者
router.delete(
  "/:id/collaborators/:userId",
  protect,
  isOwner,
  async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);

      await pool.query(
        "DELETE FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
        [documentId, userId]
      );

      // --- (核心集成) 记录日志 ---
      await logActivity(
        req.user.id, // 操作者
        "REMOVE_COLLABORATOR", // 动作
        "document", // 对象类型
        documentId, // 对象ID
        { targetUserId: userId } // 详情
      );

      res.status(204).send(); // 204 No Content 表示成功删除
    } catch (error) {
      console.error("移除协作者失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  }
);

// --- (新增) 8. 删除一个文档 ---
router.delete("/:id", protect, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // 权限检查：必须是所有者或管理员
    const docResult = await pool.query(
      "SELECT owner_id FROM documents WHERE id = $1",
      [id]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: "文档不存在" });
    }

    const isOwner = docResult.rows[0].owner_id === userId;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "无权删除此文档" });
    }

    // 执行删除
    await pool.query("DELETE FROM documents WHERE id = $1", [id]);

    // --- 2. (核心集成) 记录日志 ---
    await logActivity(
      userId, // 操作者
      "DELETE_DOCUMENT", // 动作
      "document", // 对象类型
      id // 对象ID
    );

    res.status(204).send();
  } catch (error) {
    console.error("删除文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

  return router;
};

module.exports = createDocumentRoutes;
