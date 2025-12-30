/**
 * 导出工具函数
 * 从 documentRoutes.js 提取的所有导出相关工具函数
 */
const fs = require("fs");
const path = require("path");
const TurndownService = require("turndown");
const { marked } = require("marked");
const { diff_match_patch } = require("diff-match-patch");
const PDFDocument = require("pdfkit");
const {
  Document: DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = require("docx");
const { ensureDelta, normalizeArray, sanitizeTags } = require("./documentUtils");
const logger = require("./logger");

const turndownService = new TurndownService({ headingStyle: "atx" });
const dmp = new diff_match_patch();

// ==================== 基础工具函数 ====================

/**
 * HTML 转义
 */
const escapeHtml = (unsafe) =>
  String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * 清理文件名
 */
const sanitizeFileName = (input, fallback = "document") => {
  if (!input || typeof input !== "string") {
    return fallback;
  }
  const cleaned = input.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : fallback;
};

/**
 * 编码文件名（用于 HTTP header）
 */
const encodeFileName = (filename, documentId = null) => {
  const sanitized = sanitizeFileName(filename);
  const hasNonAscii = /[^\x00-\x7F]/.test(sanitized);

  if (hasNonAscii) {
    let asciiFallback = sanitized
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!asciiFallback || asciiFallback.length < 1) {
      asciiFallback = documentId ? `document-${documentId}` : "document";
    }

    const encoded = encodeURIComponent(sanitized);
    return `filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
  }

  const needsQuotes = /[\s;()]/g.test(sanitized);
  if (needsQuotes) {
    const escaped = sanitized.replace(/"/g, '\\"');
    return `filename="${escaped}"`;
  }

  return `filename="${sanitized}"`;
};

/**
 * 规范化颜色值
 */
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
    return `${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`.toUpperCase();
  }
  return undefined;
};

/**
 * Delta 转简单 HTML（用于版本比较）
 */
const deltaToSimpleHtml = (delta) => {
  if (!delta || !delta.ops) return "";
  return delta.ops
    .map((op) => {
      if (op.insert) {
        if (typeof op.insert === "string") {
          return op.insert;
        } else if (op.insert && typeof op.insert === "object") {
          return Object.keys(op.insert)
            .map((key) => {
              if (key === "image") {
                return `<img src="${op.insert.image}" />`;
              }
              return "";
            })
            .join("");
        }
      }
      return "";
    })
    .join("");
};

// ==================== Block 构建函数 ====================

/**
 * 创建内联运行
 */
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

/**
 * 从 Delta 构建 Blocks
 */
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

/**
 * 追加文本运行
 */
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

/**
 * 从 Markdown tokens 构建内联运行
 */
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
        (token.tokens || []).forEach((child) => applyToken(child, { ...attrs, bold: true }));
        break;
      case "em":
        (token.tokens || []).forEach((child) => applyToken(child, { ...attrs, italic: true }));
        break;
      case "codespan":
        appendTextRun(token.text || "", { ...attrs, code: true }, runs);
        break;
      case "link":
        (token.tokens || [{ type: "text", text: token.text || "" }]).forEach((child) =>
          applyToken(child, { ...attrs, link: token.href || attrs.link })
        );
        break;
      case "del":
        (token.tokens || []).forEach((child) => applyToken(child, { ...attrs, strike: true }));
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

/**
 * 从 Markdown 构建 Blocks
 */
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
            runs: inlineTokensToRuns(token.tokens || [{ type: "text", text: token.text || "" }]),
            indent: context.indent || 0,
            align: null,
          });
          break;
        case "paragraph":
        case "text":
          blocks.push({
            type: context.blockquote ? "blockquote" : "paragraph",
            runs: inlineTokensToRuns(token.tokens || [{ type: "text", text: token.text || "" }]),
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
              runs: inlineTokensToRuns(item.tokens || [{ type: "text", text: item.text || "" }]),
              indent: context.indent || 0,
              align: null,
            });
            if (item.tokens) {
              const nestedLists = item.tokens.filter((child) => child.type === "list");
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

// ==================== 渲染函数 ====================

/**
 * 渲染内联 HTML
 */
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

/**
 * Blocks 转 HTML
 */
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
          `<p${block.align ? ` style="text-align: ${block.align};"` : ""}>${renderInlineHtml(
            block.runs,
            { blockType: block.type }
          )}</p>`
        );
        break;
    }
  });

  closeList();
  return parts.join("");
};

/**
 * Runs 转纯文本
 */
const runsToPlainText = (runs = []) => runs.map((run) => String(run.text || "")).join("");

/**
 * Blocks 转纯文本
 */
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

/**
 * Blocks 转 Markdown
 */
const blocksToMarkdown = (blocks = [], fallbackMarkdown) => {
  if (fallbackMarkdown && fallbackMarkdown.trim().length > 0) {
    return fallbackMarkdown;
  }
  const html = blocksToHtml(blocks);
  return turndownService.turndown(html);
};

// ==================== PDF 生成函数 ====================

/**
 * PDF 字体候选列表
 */
const pdfFontCandidates = [
  { regular: "C:/Windows/Fonts/msyh.ttf", bold: "C:/Windows/Fonts/msyhbd.ttf" },
  { regular: "C:/Windows/Fonts/simhei.ttf", bold: "C:/Windows/Fonts/simhei.ttf" },
  { regular: "C:/Windows/Fonts/simsun.ttc", bold: "C:/Windows/Fonts/simsun.ttc" },
  { regular: "C:/Windows/Fonts/msyh.ttc", bold: "C:/Windows/Fonts/msyhbd.ttc" },
  {
    regular: path.join(__dirname, "../assets/fonts/NotoSansSC-Regular.otf"),
    bold: path.join(__dirname, "../assets/fonts/NotoSansSC-Bold.otf"),
  },
];

/**
 * 解析 PDF 字体
 */
const resolvePdfFonts = () => {
  const preferredFormats = [".ttf", ".otf"];
  const fallbackFormats = [".ttc"];

  for (const candidate of pdfFontCandidates) {
    if (candidate.regular && fs.existsSync(candidate.regular)) {
      const ext = path.extname(candidate.regular).toLowerCase();
      if (preferredFormats.includes(ext)) {
        const fontSet = {
          regular: candidate.regular,
          bold:
            candidate.bold && fs.existsSync(candidate.bold) ? candidate.bold : candidate.regular,
        };
        logger.info(`[PDF Font] 找到首选格式字体: ${candidate.regular} (${ext})`);
        return fontSet;
      }
    }
  }

  for (const candidate of pdfFontCandidates) {
    if (candidate.regular && fs.existsSync(candidate.regular)) {
      const ext = path.extname(candidate.regular).toLowerCase();
      if (fallbackFormats.includes(ext)) {
        const fontSet = {
          regular: candidate.regular,
          bold:
            candidate.bold && fs.existsSync(candidate.bold) ? candidate.bold : candidate.regular,
        };
        logger.warn(`[PDF Font] 找到备用格式字体（可能不稳定）: ${candidate.regular} (${ext})`);
        return fontSet;
      }
    }
  }

  logger.info("[PDF Font] 未找到可用的中文字体，将使用默认字体 Helvetica");
  return { regular: null, bold: null };
};

/**
 * 从 Blocks 生成 PDF Buffer
 */
const generatePdfBufferFromBlocks = (blocks = []) =>
  new Promise((resolve, reject) => {
    try {
      if (!Array.isArray(blocks)) {
        return reject(new Error("blocks必须是数组"));
      }

      const fonts = resolvePdfFonts();
      const doc = new PDFDocument({
        margin: 56,
        autoFirstPage: true,
        size: "A4",
      });
      const chunks = [];
      let hasError = false;

      const timeout = setTimeout(() => {
        if (!hasError) {
          hasError = true;
          doc.destroy();
          reject(new Error("PDF生成超时"));
        }
      }, 30000);

      doc.on("data", (chunk) => {
        if (!hasError) {
          chunks.push(chunk);
        }
      });

      doc.on("end", () => {
        clearTimeout(timeout);
        if (hasError) return;
        try {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) {
            reject(new Error("PDF生成失败：生成的缓冲区为空"));
          } else {
            resolve(buffer);
          }
        } catch (err) {
          reject(new Error(`PDF缓冲生成失败: ${err.message}`));
        }
      });

      doc.on("error", (err) => {
        if (hasError) return;
        hasError = true;
        clearTimeout(timeout);
        logger.error("PDF生成错误:", err);
        reject(new Error(`PDF生成失败: ${err.message || "未知错误"}`));
      });

      let defaultFont = "Helvetica";
      let boldFont = "Helvetica-Bold";

      const isValidFontFile = (fontPath) => {
        if (!fontPath || !fs.existsSync(fontPath)) {
          return false;
        }
        const ext = path.extname(fontPath).toLowerCase();
        if (ext !== ".ttf" && ext !== ".otf" && ext !== ".ttc") {
          logger.warn(`字体文件格式可能不支持: ${fontPath}, 扩展名: ${ext}`);
        }
        try {
          const stats = fs.statSync(fontPath);
          if (stats.size < 1000) {
            logger.warn(`字体文件太小，可能无效: ${fontPath}, 大小: ${stats.size}`);
            return false;
          }
          return true;
        } catch (error) {
          logger.warn(`无法读取字体文件: ${fontPath}`, error.message);
          return false;
        }
      };

      const tryRegisterFont = (fontName, fontPath) => {
        if (!fontPath || !isValidFontFile(fontPath)) {
          return false;
        }

        const ext = path.extname(fontPath).toLowerCase();
        if (ext === ".ttc") {
          logger.warn(`警告: .ttc 格式字体可能不被pdfkit完全支持: ${fontPath}`);
        }

        try {
          doc.registerFont(fontName, fontPath);
          logger.info(`成功注册字体: ${fontName} from ${fontPath}`);
          return true;
        } catch (error) {
          logger.warn(`注册字体失败: ${fontName} from ${fontPath}`, error.message);
          if (
            error.message &&
            (error.message.includes("createSubset") || error.message.includes("is not a function"))
          ) {
            logger.warn(`字体文件格式可能不被pdfkit支持，将跳过该字体: ${fontPath}`);
            logger.warn(`建议：使用 .ttf 或 .otf 格式的字体文件`);
          }
          return false;
        }
      };

      if (fonts.regular) {
        if (tryRegisterFont("ChineseFont", fonts.regular)) {
          defaultFont = "ChineseFont";
          if (fonts.bold && fonts.bold !== fonts.regular) {
            if (tryRegisterFont("ChineseFontBold", fonts.bold)) {
              boldFont = "ChineseFontBold";
            } else {
              boldFont = "ChineseFont";
            }
          } else {
            boldFont = "ChineseFont";
          }
        } else {
          logger.warn("中文字体注册失败，将使用默认字体 Helvetica");
          defaultFont = "Helvetica";
          boldFont = "Helvetica-Bold";
        }
      }

      try {
        doc.font(defaultFont).fontSize(12);
        logger.info(`PDF使用字体: ${defaultFont}, 粗体: ${boldFont}`);
      } catch (error) {
        logger.error(`设置字体 ${defaultFont} 失败:`, error.message);
        try {
          doc.font("Helvetica").fontSize(12);
          defaultFont = "Helvetica";
          boldFont = "Helvetica-Bold";
          logger.info("回退到默认字体 Helvetica");
        } catch (fallbackError) {
          clearTimeout(timeout);
          reject(
            new Error(`设置PDF字体失败: ${error.message}, 回退也失败: ${fallbackError.message}`)
          );
          return;
        }
      }

      const listCounters = {};

      const writeRuns = (runs = [], options = {}) => {
        try {
          const { align = "left" } = options;
          if (!runs || runs.length === 0) {
            doc.text(" ", { align });
            return;
          }

          runs.forEach((run, idx) => {
            try {
              const isLast = idx === runs.length - 1;
              const targetFont = run.bold ? boldFont : defaultFont;
              try {
                doc.font(targetFont);
              } catch (fontError) {
                logger.warn(`设置字体 ${targetFont} 失败，使用默认字体: ${fontError.message}`);
                try {
                  doc.font(defaultFont);
                } catch (defaultFontError) {
                  logger.warn(
                    `默认字体 ${defaultFont} 也失败，使用Helvetica: ${defaultFontError.message}`
                  );
                  try {
                    doc.font("Helvetica");
                  } catch (helveticaError) {
                    logger.error("所有字体都失败，PDF可能无法正常生成:", helveticaError.message);
                  }
                }
              }

              try {
                const color = run.color || "#000000";
                if (
                  typeof color === "string" &&
                  (color.startsWith("#") || color.startsWith("rgb"))
                ) {
                  doc.fillColor(color);
                } else {
                  doc.fillColor("#000000");
                }
              } catch (colorError) {
                logger.warn(`设置颜色失败，使用默认颜色: ${colorError.message}`);
                doc.fillColor("#000000");
              }

              const segments = String(run.text || "")
                .replace(/\r/g, "")
                .split("\n");
              segments.forEach((segment, segIdx) => {
                try {
                  const finalSegment = isLast && segIdx === segments.length - 1;
                  doc.text(segment.length > 0 ? segment : " ", {
                    continued: !finalSegment,
                    align: idx === 0 && segIdx === 0 ? align : undefined,
                  });
                } catch (textError) {
                  logger.warn(`写入文本片段失败: ${textError.message}`);
                }
              });
            } catch (runError) {
              logger.warn(`处理run失败: ${runError.message}`);
            }
          });

          doc.fillColor("#000000");
        } catch (error) {
          logger.error("writeRuns错误:", error);
          try {
            doc.text(" ", { align: options.align || "left" });
          } catch (e) {
            // PDF可能已损坏
          }
        }
      };

      if (!blocks || blocks.length === 0) {
        doc.text(" ", { align: "left" });
      } else {
        blocks.forEach((block) => {
          try {
            if (!block || !block.type) {
              logger.warn("遇到无效的block:", block);
              return;
            }

            switch (block.type) {
              case "header": {
                try {
                  const sizeMap = { 1: 20, 2: 18, 3: 16, 4: 14, 5: 13, 6: 12 };
                  const size = sizeMap[block.level] || 14;
                  doc.moveDown(0.3);
                  doc.font(boldFont).fontSize(size);
                  writeRuns(block.runs || [], { align: block.align || "left" });
                  doc.font(defaultFont).fontSize(12);
                  doc.moveDown(0.3);
                } catch (error) {
                  logger.warn("处理header失败:", error.message);
                  doc.text(`[标题]`, { align: "left" });
                }
                break;
              }
              case "listItem": {
                try {
                  const indent = block.indent || 0;
                  if (block.ordered) {
                    listCounters[indent] = (listCounters[indent] || 0) + 1;
                  } else {
                    listCounters[indent] = 0;
                  }
                  const bullet = block.ordered ? `${listCounters[indent]}. ` : "• ";
                  doc.text(`${"  ".repeat(indent)}${bullet}`, { continued: true });
                  writeRuns(block.runs || [], { align: "left" });
                  doc.text(" ");
                } catch (error) {
                  logger.warn("处理listItem失败:", error.message);
                  doc.text("• [列表项]", { align: "left" });
                }
                break;
              }
              case "blockquote": {
                try {
                  doc.moveDown(0.2);
                  doc.fillColor("#555555");
                  doc.text("❝ ", { continued: true });
                  writeRuns(block.runs || [], { align: "left" });
                  doc.text(" ");
                  doc.fillColor("#000000");
                } catch (error) {
                  logger.warn("处理blockquote失败:", error.message);
                  doc.text("[引用]", { align: "left" });
                  doc.fillColor("#000000");
                }
                break;
              }
              case "code": {
                try {
                  doc.moveDown(0.2);
                  doc.font(defaultFont).fillColor("#333333");
                  const lines = String(block.text || "").split("\n");
                  lines.forEach((line) => {
                    doc.text(line || " ", { align: "left" });
                  });
                  doc.fillColor("#000000");
                  doc.moveDown(0.2);
                } catch (error) {
                  logger.warn("处理code失败:", error.message);
                  doc.text("[代码块]", { align: "left" });
                  doc.fillColor("#000000");
                }
                break;
              }
              case "image": {
                try {
                  doc.moveDown(0.2);
                  doc.text(`[图片] ${block.src || "未知图片"}`, { align: "left" });
                  doc.moveDown(0.2);
                } catch (error) {
                  logger.warn("处理image失败:", error.message);
                  doc.text("[图片]", { align: "left" });
                }
                break;
              }
              case "horizontalRule": {
                try {
                  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
                  doc
                    .moveTo(doc.x, doc.y)
                    .lineTo(doc.x + width, doc.y)
                    .stroke();
                  doc.moveDown(0.2);
                } catch (error) {
                  logger.warn("处理horizontalRule失败:", error.message);
                  doc.moveDown(0.5);
                }
                break;
              }
              default: {
                try {
                  if (block.runs && Array.isArray(block.runs) && block.runs.length > 0) {
                    writeRuns(block.runs, { align: block.align || "left" });
                  } else if (block.text) {
                    doc.text(String(block.text || " "), { align: block.align || "left" });
                  } else {
                    doc.text(" ", { align: "left" });
                  }
                  doc.text(" ");
                } catch (error) {
                  logger.warn("处理默认block失败:", error.message);
                  doc.text(" ", { align: "left" });
                }
                break;
              }
            }
          } catch (blockError) {
            logger.error(`处理block时出错 (type: ${block?.type}):`, blockError);
            try {
              doc.text(`[内容块]`, { align: "left" });
            } catch (e) {
              // PDF可能已损坏
            }
          }
        });
      }

      if (!blocks || blocks.length === 0) {
        doc.text(" ", { align: "left" });
      }

      doc.end();
    } catch (error) {
      logger.error("generatePdfBufferFromBlocks外层错误:", error);
      reject(new Error(`PDF生成失败: ${error.message || "未知错误"}`));
    }
  });

// ==================== DOCX 生成函数 ====================

/**
 * Runs 转 DOCX
 */
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

/**
 * 从 Blocks 生成 DOCX Buffer
 */
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

// ==================== 渲染数据获取 ====================

/**
 * 获取渲染数据
 */
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

/**
 * Markdown 转 Delta
 */
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

/**
 * Diff 转 HTML
 */
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

// ==================== 导出生成函数 ====================

/**
 * 生成导出 Payload
 */
const generateExportPayload = async (document, format, fileBase) => {
  const exportFormat = String(format || "json").toLowerCase();
  const baseName = sanitizeFileName(fileBase || document.title || `document-${document.id}`);
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
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    case "pdf":
      try {
        logger.info("开始生成PDF, blocks数量:", blocks?.length || 0);
        if (!blocks || blocks.length === 0) {
          logger.warn("警告: blocks为空，将生成空PDF");
        }
        const pdfBuffer = await generatePdfBufferFromBlocks(blocks || []);
        if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
          throw new Error("PDF生成失败：返回的buffer无效");
        }
        if (pdfBuffer.length === 0) {
          throw new Error("PDF生成失败：生成的buffer为空");
        }
        logger.info("PDF生成成功, buffer大小:", pdfBuffer.length);
        return {
          buffer: pdfBuffer,
          fileName: `${baseName}.pdf`,
          contentType: "application/pdf",
        };
      } catch (error) {
        logger.error("生成PDF buffer失败:", error);
        throw new Error(`PDF生成失败: ${error.message || "未知错误"}`);
      }
    case "json":
    default:
      const jsonPayload = {
        title: document.title || "",
        category: document.category || null,
        tags: normalizeArray(document.tags),
        content_format: document.content_format || "rich",
      };

      if (document.content_format === "markdown") {
        jsonPayload.markdown = markdown || "";
        jsonPayload.plain_text = plainText || "";
      } else {
        jsonPayload.content = delta || { ops: [{ insert: "\n" }] };
        jsonPayload.plain_text = plainText || "";
      }

      return {
        buffer: Buffer.from(JSON.stringify(jsonPayload, null, 2), "utf-8"),
        fileName: `${baseName}.json`,
        contentType: "application/json",
      };
  }
};

/**
 * 准备文档 Payload（用于导入）
 */
const prepareDocumentPayload = (payload) => {
  const {
    title,
    category,
    tags,
    content,
    format = "json",
    markdown,
    markdown_content,
    content_format,
  } = payload;

  if (!title || !title.trim()) {
    throw new Error("缺少标题");
  }

  const sanitizedTags = sanitizeTags(
    Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",") : []
  );

  let preparedContent;
  let contentFormat = content_format || "rich";
  let markdownContent = markdown_content || markdown || null;

  // 如果有 markdown_content 字段，说明是 markdown 格式
  if (markdownContent || String(format).toLowerCase() === "markdown") {
    const markdownSource = markdownContent || content;
    if (!markdownSource) {
      // 如果没有markdown内容，尝试使用content
      if (content) {
        preparedContent = ensureDelta(typeof content === "string" ? JSON.parse(content) : content);
        contentFormat = "rich";
        markdownContent = null;
      } else {
        throw new Error("缺少文档内容");
      }
    } else {
      preparedContent = markdownToDelta(markdownSource);
      contentFormat = "markdown";
    }
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

  return {
    title: title.trim(),
    category: category ? category.trim() : null,
    tags: sanitizedTags,
    content: ensureDelta(preparedContent),
    contentFormat,
    markdownContent,
  };
};

module.exports = {
  // 基础工具函数
  escapeHtml,
  sanitizeFileName,
  encodeFileName,
  normalizeColor,
  deltaToSimpleHtml,

  // Block 构建函数
  createInlineRun,
  buildBlocksFromDelta,
  appendTextRun,
  inlineTokensToRuns,
  buildBlocksFromMarkdown,

  // 渲染函数
  renderInlineHtml,
  blocksToHtml,
  runsToPlainText,
  blocksToPlainText,
  blocksToMarkdown,

  // PDF 生成函数
  pdfFontCandidates,
  resolvePdfFonts,
  generatePdfBufferFromBlocks,

  // DOCX 生成函数
  runsToDocx,
  generateDocxBufferFromBlocks,

  // 渲染数据获取
  getRenderData,
  markdownToDelta,
  diffToHtml,

  // 导出生成函数
  generateExportPayload,
  prepareDocumentPayload,

  // Turndown 服务实例（用于 HTML 转 Markdown）
  turndownService,
};
