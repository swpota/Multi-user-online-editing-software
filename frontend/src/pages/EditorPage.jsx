import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "react-quill/dist/quill.bubble.css";
import io from "socket.io-client";
import ShareModal from "../components/ShareModal";
import DOMPurify from "dompurify";
import { marked } from "marked";

const cloneDelta = (delta) => {
  if (!delta || typeof delta !== "object") {
    return { ops: [{ insert: "\n" }] };
  }
  try {
    return JSON.parse(JSON.stringify(delta));
  } catch (error) {
    return { ops: [{ insert: "\n" }] };
  }
};

const deltasEqual = (a, b) => {
  try {
    return JSON.stringify(a || {}) === JSON.stringify(b || {});
  } catch (error) {
    return false;
  }
};

const stringToColor = (str) => {
  let hash = 0;
  if (!str || str.length === 0) return "#000000";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).substr(-2);
  }
  return color;
};

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  if (typeof value === "object") {
    return Array.isArray(value) ? value : [];
  }
  return [];
};

const SAVE_INTERVAL_MS = 2000;

const parseTagsInput = (input) =>
  input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

function EditorPage({ user }) {
  const { documentId } = useParams();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState({ ops: [{ insert: "\n" }] });
  const [socket, setSocket] = useState(null);
  const [saveStatus, setSaveStatus] = useState("连接中...");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [previewVersion, setPreviewVersion] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const quillRef = useRef(null);
  const [contentFormat, setContentFormat] = useState("rich");
  const [markdownValue, setMarkdownValue] = useState("");
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState(null);
  const [lockProcessing, setLockProcessing] = useState(false);
  const [compareFrom, setCompareFrom] = useState(null);
  const [compareTo, setCompareTo] = useState(null);
  const [diffHtml, setDiffHtml] = useState("");
  const [diffError, setDiffError] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);

  const markdownPreviewHtml = useMemo(() => {
    if (!showMarkdownPreview) return "";
    const raw = marked.parse(markdownValue || "");
    return DOMPurify.sanitize(raw);
  }, [showMarkdownPreview, markdownValue]);

  const sanitizedDiffHtml = useMemo(
    () => DOMPurify.sanitize(diffHtml || ""),
    [diffHtml]
  );

  const previewMarkdownHtml = useMemo(() => {
    if (!previewMarkdown) return "";
    try {
      const html = marked.parse(previewMarkdown);
      return DOMPurify.sanitize(html);
    } catch (error) {
      console.error("渲染 Markdown 预览失败:", error);
      return DOMPurify.sanitize(`<pre>${previewMarkdown}</pre>`);
    }
  }, [previewMarkdown]);

  const emitMetadataChange = useCallback(
    (updates) => {
      if (!socket || !updates || typeof updates !== "object") {
        return;
      }
      socket.emit("documentMetadataChange", {
        documentId,
        updates,
      });
    },
    [socket, documentId]
  );

  const fetchDocument = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get(`/documents/${documentId}`);
      const doc = response.data;
      setTitle(doc.title);

      let initialContent = { ops: [{ insert: "\n" }] };
      if (doc.content) {
        try {
          if (typeof doc.content === "string") {
            initialContent = JSON.parse(doc.content);
          } else if (typeof doc.content === "object" && doc.content.ops) {
            initialContent = doc.content;
          }
        } catch (e) {
          console.error("解析文档内容失败:", e);
        }
      }
      const clonedContent = cloneDelta(initialContent);
      setContent(clonedContent);

      setCategory(doc.category || "");
      const incomingTags = toArray(doc.tags);
      setTagsInput(incomingTags.length > 0 ? incomingTags.join(", ") : "");

      const format = doc.content_format || "rich";
      setContentFormat(format);
      setMarkdownValue(doc.markdown_content || "");
      setShowMarkdownPreview(false);

      const locked = !!doc.is_locked;
      setIsLocked(locked);
      setLockedBy(doc.lockedBy || null);

      const canEdit =
        doc.userRoleForDoc === "owner" || doc.userRoleForDoc === "editor";
      const lockedByOther =
        locked &&
        doc.lockedBy &&
        doc.lockedBy.id !== user.id &&
        user.role !== "admin";
      const editable = canEdit && !lockedByOther;
      setIsEditor(editable);
      if (lockedByOther) {
        const lockerName =
          doc.lockedBy?.full_name ||
          doc.lockedBy?.email ||
          `用户${doc.lockedBy?.id || ""}`;
        setSaveStatus(`已锁定（${lockerName}）`);
      } else {
        setSaveStatus(editable ? "已同步" : "查看模式");
      }

      // 确保内容始终被设置，即使文档被锁定
      // 内容同步到编辑器将在 useEffect 中处理
    } catch (error) {
      console.error("获取文档失败", error);
      setSaveStatus("加载失败或无权限");
      setIsEditor(false);
      // 即使出错，也设置一个默认内容，确保编辑器可以显示
      setContent({ ops: [{ insert: "\n" }] });
    }
  }, [documentId, user]);

  const fetchVersions = useCallback(async () => {
    if (!user) return;
    try {
      setVersionsLoading(true);
      setVersionError("");
      const response = await api.get(`/documents/${documentId}/versions`);
      setVersions(response.data);
    } catch (error) {
      console.error("获取版本历史失败", error);
      setVersionError(error.response?.data?.message || "加载版本历史失败");
    } finally {
      setVersionsLoading(false);
    }
  }, [documentId, user]);

  // --- Effect 1: Socket 连接、加载数据、设置监听器 ---
  useEffect(() => {
    if (!user) return;

    const s = io("http://localhost:5000");
    setSocket(s);

    fetchDocument();

    s.emit("joinDocument", { documentId, user });

    const receiveChangeHandler = (delta) => {
      if (quillRef.current) {
        quillRef.current.getEditor().updateContents(delta, "silent");
      }
    };
    const updateUserListHandler = (users) => setOnlineUsers(users);

    s.on("receiveChange", receiveChangeHandler);
    s.on("updateUserList", updateUserListHandler);

    return () => {
      s.off("receiveChange", receiveChangeHandler);
      s.off("updateUserList", updateUserListHandler);
      s.disconnect();
    };
  }, [documentId, user, fetchDocument]);

  useEffect(() => {
    if (!socket) return;

    const handleMetadata = (updates) => {
      if (!updates || typeof updates !== "object") {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(updates, "title")) {
        setTitle((prev) =>
          updates.title !== undefined && prev !== updates.title
            ? updates.title
            : prev
        );
      }

      if (Object.prototype.hasOwnProperty.call(updates, "category")) {
        setCategory(updates.category ? updates.category : "");
      }

      if (Object.prototype.hasOwnProperty.call(updates, "tags")) {
        const incomingTags = Array.isArray(updates.tags)
          ? updates.tags
          : [];
        setTagsInput(
          incomingTags.length > 0 ? incomingTags.join(", ") : ""
        );
      } else if (
        Object.prototype.hasOwnProperty.call(updates, "tagsInput") &&
        typeof updates.tagsInput === "string"
      ) {
        setTagsInput(updates.tagsInput);
      }

      // 处理内容格式和 Markdown 内容
      if (Object.prototype.hasOwnProperty.call(updates, "content_format")) {
        setContentFormat(updates.content_format || "rich");
      }

      if (Object.prototype.hasOwnProperty.call(updates, "markdown_content")) {
        setMarkdownValue(updates.markdown_content || "");
      }

      // 处理锁定状态
      if (Object.prototype.hasOwnProperty.call(updates, "lockedBy")) {
        setLockedBy(updates.lockedBy);
      }

      if (Object.prototype.hasOwnProperty.call(updates, "is_locked")) {
        setIsLocked(!!updates.is_locked);
      }

      // 如果是强制刷新（锁定/解锁/版本恢复），直接更新内容
      if (updates.forceRefresh) {
        // 如果有内容更新，直接设置内容
        if (Object.prototype.hasOwnProperty.call(updates, "content") && updates.content) {
          setContent(cloneDelta(updates.content));
        }
        if (Object.prototype.hasOwnProperty.call(updates, "markdown_content")) {
          setMarkdownValue(updates.markdown_content || "");
        }
        if (Object.prototype.hasOwnProperty.call(updates, "content_format")) {
          setContentFormat(updates.content_format || "rich");
        }
        // 重新获取文档以获取完整的权限信息（但不覆盖已设置的内容）
        fetchDocument();
      } else {
        // 普通更新，只在必要时刷新
        const shouldRefresh =
          Object.prototype.hasOwnProperty.call(updates, "is_locked") ||
          Object.prototype.hasOwnProperty.call(updates, "lockedBy");
        
        if (shouldRefresh) {
          fetchDocument();
        }
      }
    };

    socket.on("receiveMetadata", handleMetadata);

    return () => {
      socket.off("receiveMetadata", handleMetadata);
    };
  }, [socket, fetchDocument]);

  // 同步内容到编辑器，确保锁定状态变化时也能正确显示
  useEffect(() => {
    if (contentFormat !== "rich") {
      return;
    }

    const syncContent = () => {
      if (!quillRef.current) {
        setTimeout(syncContent, 100);
        return;
      }

      try {
        const quillElement = quillRef.current;
        if (!quillElement || !quillElement.getEditor) {
          return;
        }

        const editorInstance = quillElement.getEditor();
        if (!editorInstance) {
          return;
        }

        // 同步内容
        if (content && content.ops) {
          const current = editorInstance.getContents();
          if (!deltasEqual(current, content)) {
            editorInstance.setContents(cloneDelta(content), "silent");
          }
        }

        // 确保编辑器元素可见（如果存在）
        try {
          const container = quillElement.querySelector ? quillElement.querySelector('.ql-container') : null;
          const editor = quillElement.querySelector ? quillElement.querySelector('.ql-editor') : null;
          const toolbar = quillElement.querySelector ? quillElement.querySelector('.ql-toolbar') : null;

          if (container) {
            container.style.display = "block";
            container.style.visibility = "visible";
          }
          if (editor) {
            editor.style.display = "block";
            editor.style.visibility = "visible";
          }
          if (toolbar) {
            toolbar.style.display = isEditor ? "block" : "none";
            toolbar.style.visibility = "visible";
          }
        } catch (domError) {
          // DOM 操作可能失败，忽略
        }
      } catch (error) {
        // 编辑器可能还在初始化，忽略错误
      }
    };

    // 延迟执行，确保编辑器已完全初始化
    const timer = setTimeout(syncContent, 300);
    return () => clearTimeout(timer);
  }, [contentFormat, content, isEditor, isLocked, lockedBy]);

  // 自动保存
  useEffect(() => {
    if (!isEditor || !content) return;
    if (isLocked && lockedBy && lockedBy.id !== user?.id) {
      return;
    }
    const handler = setTimeout(() => {
      setSaveStatus("正在保存...");
      const sanitizedTags = parseTagsInput(tagsInput);
      const payload = {
        title,
        category: category ? category.trim() : null,
        tags: sanitizedTags,
      };

      if (contentFormat === "markdown") {
        payload.contentFormat = "markdown";
        payload.markdownContent = markdownValue;
      } else {
        payload.content = content;
        payload.contentFormat = "rich";
      }

      api
        .put(`/documents/${documentId}`, payload)
        .then(() => setSaveStatus("已同步"))
        .catch((err) =>
          setSaveStatus(err.response?.data?.message || "保存失败")
        );
    }, SAVE_INTERVAL_MS);
    return () => clearTimeout(handler);
  }, [
    documentId,
    title,
    content,
    isEditor,
    category,
    tagsInput,
    contentFormat,
    markdownValue,
    isLocked,
    lockedBy,
    user?.id,
  ]);

  // --- (最终版) handleQuillChange ---
  const handleQuillChange = (value, delta, source, editor) => {
    if (contentFormat === "markdown") {
      return;
    }
    const fullContent = editor.getContents();
    setContent(cloneDelta(fullContent));

    if (source === "user" && isEditor && socket) {
      setSaveStatus("正在输入...");
      socket.emit("documentChange", { documentId, delta });
    }
  };

  const handleTitleChange = (event) => {
    if (!isEditor) {
      return;
    }
    const newValue = event.target.value;
    setTitle(newValue);
    emitMetadataChange({ title: newValue });
  };

  const handleCategoryChange = (event) => {
    if (!isEditor) {
      return;
    }
    const newValue = event.target.value;
    setCategory(newValue);
    emitMetadataChange({ category: newValue });
  };

  const handleTagsInputChange = (event) => {
    if (!isEditor) {
      return;
    }
    const newValue = event.target.value;
    setTagsInput(newValue);
    const sanitizedTags = parseTagsInput(newValue);
    emitMetadataChange({ tags: sanitizedTags, tagsInput: newValue });
  };

  const handleMarkdownChange = (event) => {
    if (!isEditor) {
      return;
    }
    const value = event.target.value;
    setMarkdownValue(value);
    setSaveStatus("正在输入...");
    emitMetadataChange({ markdown_content: value });
  };

  const handleSaveVersion = async () => {
    if (!isEditor) return;

    const summary = window.prompt("为该版本添加备注（可选）", "");
    try {
      await api.post(`/documents/${documentId}/versions`, {
        summary: summary ? summary.trim() : null,
      });
      alert("已保存当前版本");
      await fetchVersions();
      await fetchDocument();
    } catch (error) {
      console.error("保存版本失败", error);
      alert(error.response?.data?.message || "保存版本失败，请稍后再试。");
    }
  };

  const openVersionModal = async () => {
    setShowVersionModal(true);
    await fetchVersions();
    setPreviewVersion(null);
    setPreviewContent(null);
    setPreviewMarkdown("");
    setCompareFrom(null);
    setCompareTo(null);
    setDiffHtml("");
    setDiffError("");
  };

  const closeVersionModal = () => {
    setShowVersionModal(false);
    setPreviewVersion(null);
    setPreviewContent(null);
    setPreviewMarkdown("");
  };

  const handlePreviewVersion = async (versionId) => {
    try {
      const response = await api.get(
        `/documents/${documentId}/versions/${versionId}`
      );
      const version = response.data;
      const parsedContent = (() => {
        if (!version.content) {
          return { ops: [{ insert: "\n" }] };
        }
        if (typeof version.content === "string") {
          try {
            return JSON.parse(version.content);
          } catch (error) {
            console.error("解析版本内容失败", error);
            return { ops: [{ insert: "\n" }] };
          }
        }
        return version.content;
      })();

      const versionFormat = version.content_format || "rich";
      setPreviewVersion({
        ...version,
        tags: Array.isArray(version.tags) ? version.tags : [],
        content_format: versionFormat,
      });
      if (versionFormat === "markdown") {
        // Markdown 版本：设置 Markdown 内容用于预览
        const markdownContent = version.markdown_content || "";
        setPreviewMarkdown(markdownContent);
        setPreviewContent(null);
      } else {
        // 富文本版本：设置 Delta 内容
        setPreviewMarkdown("");
        setPreviewContent(parsedContent);
      }
    } catch (error) {
      console.error("加载版本详情失败", error);
      alert(error.response?.data?.message || "加载版本详情失败");
    }
  };

  const handleRestoreVersion = async (versionId) => {
    if (!isEditor) return;
    if (!window.confirm("确定要恢复到该版本吗？当前内容将被覆盖。")) {
      return;
    }

    try {
      await api.post(
        `/documents/${documentId}/versions/${versionId}/restore`
      );
      await fetchDocument();
      await fetchVersions();
      emitMetadataChange({ forceRefresh: true, restoredVersionId: versionId });
      alert("已恢复对应版本");
    } catch (error) {
      console.error("恢复版本失败", error);
      alert(error.response?.data?.message || "恢复版本失败，请稍后再试。");
    }
  };

  const handleLockToggle = async () => {
    if (lockProcessing) return;
    try {
      setLockProcessing(true);
      const lockingSelf = isLocked && lockedBy && lockedBy.id === user?.id;
      const adminOverride = isLocked && !lockingSelf && user?.role === "admin";
      let endpoint;
      if (isLocked) {
        if (lockingSelf || adminOverride) {
          endpoint = "/unlock";
        } else {
          alert("文档已被其他用户锁定");
          setLockProcessing(false);
          return;
        }
      } else {
        endpoint = "/lock";
      }
      await api.post(`/documents/${documentId}${endpoint}`);
      await fetchDocument();
      emitMetadataChange({
        is_locked: endpoint === "/lock",
        lockedBy:
          endpoint === "/lock"
            ? {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
              }
            : null,
        forceRefresh: true,
      });
    } catch (error) {
      alert(error.response?.data?.message || "锁定/解锁失败");
    } finally {
      setLockProcessing(false);
    }
  };

  const handleCompareVersions = async () => {
    if (!compareFrom || !compareTo) {
      setDiffError("请先选择对比的两个版本");
      return;
    }
    setDiffLoading(true);
    setDiffError("");
    try {
      const response = await api.get(
        `/documents/${documentId}/versions/compare`,
        { params: { from: compareFrom, to: compareTo } }
      );
      setDiffHtml(response.data.diffHtml || "");
    } catch (error) {
      console.error("生成版本对比失败", error);
      setDiffError(error.response?.data?.message || "生成对比失败");
    } finally {
      setDiffLoading(false);
    }
  };

  const lockingSelf = isLocked && lockedBy && lockedBy.id === user?.id;
  const canUnlock = isLocked && (lockingSelf || user?.role === "admin");
  const lockButtonLabel = isLocked
    ? canUnlock
      ? "解除锁定"
      : "已锁定"
    : "锁定文档";
  const lockButtonDisabled = lockProcessing || (isLocked && !canUnlock);

  const isMarkdownMode = contentFormat === "markdown";

  const handleSaveAsTemplate = async () => {
    if (!isEditor || !content) {
      return;
    }

    const templateName = window.prompt(
      "请输入模板名称",
      title || "未命名模板"
    );

    if (!templateName || !templateName.trim()) {
      return;
    }

    const descriptionInput = window.prompt("模板描述（可选）", "");
    const sanitizedTags = parseTagsInput(tagsInput);

    setTemplateSaving(true);
    try {
      await api.post("/documents/templates", {
        name: templateName.trim(),
        description: descriptionInput ? descriptionInput.trim() : null,
        category: category ? category.trim() : null,
        tags: sanitizedTags,
        content,
      });
      alert("模板已保存，可在仪表盘中使用。");
    } catch (error) {
      console.error("保存模板失败:", error);
      alert(error.response?.data?.message || "保存模板失败，请稍后再试。");
    } finally {
      setTemplateSaving(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link to="/" className="button-like">
          &larr; 返回
        </Link>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          readOnly={!isEditor}
          style={{
            fontSize: "1.5em",
            fontWeight: "bold",
            border: "none",
            outline: "none",
            textAlign: "center",
            width: "50%",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: "1rem",
            width: "50%",
            marginTop: "0.75rem",
          }}
        >
          <input
            type="text"
            value={category}
            onChange={handleCategoryChange}
            readOnly={!isEditor}
            placeholder="分类（例如：会议纪要）"
            style={{
              flex: 1,
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              backgroundColor: isEditor ? "white" : "#f5f5f5",
            }}
          />
          <input
            type="text"
            value={tagsInput}
            onChange={handleTagsInputChange}
            readOnly={!isEditor}
            placeholder="标签，逗号分隔"
            style={{
              flex: 1,
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              backgroundColor: isEditor ? "white" : "#f5f5f5",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={handleLockToggle}
            style={{
              marginRight: "15px",
              padding: "8px 12px",
              cursor: lockButtonDisabled ? "not-allowed" : "pointer",
              backgroundColor: isLocked ? "#ff9f43" : "#1677ff",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
            disabled={lockButtonDisabled}
          >
            {lockProcessing ? "处理中..." : lockButtonLabel}
          </button>
          {isLocked && lockedBy && (
            <span style={{ marginRight: "15px", color: "#d46b08" }}>
              锁定人：
              {lockedBy.full_name || lockedBy.email || `用户${lockedBy.id}`}
            </span>
          )}
          {isEditor && (
            <button
              onClick={handleSaveAsTemplate}
              style={{
                marginRight: "15px",
                padding: "8px 12px",
                cursor: "pointer",
              }}
              disabled={templateSaving}
            >
              {templateSaving ? "保存中..." : "保存为模板"}
            </button>
          )}
          {isEditor && (
            <button
              onClick={handleSaveVersion}
              style={{
                marginRight: "15px",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              保存版本
            </button>
          )}
          <button
            onClick={openVersionModal}
            style={{
              marginRight: "15px",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            版本历史
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              marginRight: "15px",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            分享
          </button>
          <div
            style={{ display: "flex", position: "relative", height: "30px" }}
          >
            {onlineUsers.map((u, index) => (
              (() => {
                const identifier =
                  u.full_name || u.email || u.phone || `用户${u.id}`;
                const colorSeed = u.email || u.phone || identifier;
                const label = identifier.substring(0, 1).toUpperCase();
                return (
                  <div
                    key={u.id}
                    title={identifier}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      backgroundColor: stringToColor(colorSeed),
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      color: "white",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      border: "2px solid white",
                      position: "absolute",
                      left: `${index * 20}px`,
                    }}
                  >
                    {label}
                  </div>
                );
              })()
            ))}
          </div>
          <span
            style={{
              color: "#666",
              fontStyle: "italic",
              marginLeft: `${onlineUsers.length * 20 + 15}px`,
            }}
          >
            {saveStatus}
          </span>
        </div>
      </div>
      <div 
        style={{ 
          border: "3px solid #1890ff", 
          marginTop: "20px", 
          minHeight: "500px",
          maxHeight: "calc(100vh - 300px)",
          backgroundColor: "#fff",
          borderRadius: "4px",
          position: "relative",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 模式提示 */}
        <div style={{ 
          position: "absolute", 
          top: "10px", 
          right: "10px", 
          padding: "6px 12px", 
          backgroundColor: isMarkdownMode ? "#52c41a" : "#1890ff", 
          color: "white", 
          fontSize: "12px",
          borderRadius: "4px",
          zIndex: 1000,
          fontWeight: "bold",
        }}>
          {isMarkdownMode ? "📝 Markdown 模式" : "✏️ 富文本编辑器"}
        </div>
        {isMarkdownMode ? (
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            height: "100%",
            minHeight: "500px",
            backgroundColor: "#fff",
          }}>
            {/* 工具栏 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid #e8e8e8",
                backgroundColor: "#fafafa",
              }}
            >
              <span style={{ color: "#666", fontSize: "14px" }}>
                Markdown 编辑模式（自动保存）
              </span>
              <button
                type="button"
                onClick={() => setShowMarkdownPreview((prev) => !prev)}
                style={{
                  padding: "6px 16px",
                  backgroundColor: showMarkdownPreview ? "#1890ff" : "#fff",
                  color: showMarkdownPreview ? "#fff" : "#1890ff",
                  border: "1px solid #1890ff",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!showMarkdownPreview) {
                    e.target.style.backgroundColor = "#e6f7ff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showMarkdownPreview) {
                    e.target.style.backgroundColor = "#fff";
                  }
                }}
              >
                {showMarkdownPreview ? "隐藏预览" : "预览 Markdown"}
              </button>
            </div>
            
            {/* 编辑器和预览区域 */}
            <div style={{ 
              display: "flex", 
              flex: 1, 
              overflow: "hidden",
              minHeight: 0,
            }}>
              {/* 编辑器区域 */}
              <div style={{ 
                flex: showMarkdownPreview ? "1" : "1",
                display: "flex",
                flexDirection: "column",
                borderRight: showMarkdownPreview ? "1px solid #e8e8e8" : "none",
              }}>
                <textarea
                  value={markdownValue}
                  onChange={handleMarkdownChange}
                  readOnly={!isEditor || (isLocked && lockedBy && lockedBy.id !== user?.id)}
                  placeholder="# 标题\n\n支持使用 Markdown 语法进行排版：\n- **加粗文本**\n- *斜体文本*\n- [链接](https://example.com)\n- 列表项"
                  style={{
                    flex: 1,
                    width: "100%",
                    padding: "16px",
                    borderRadius: 0,
                    border: "none",
                    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    backgroundColor: isEditor ? "#fff" : "#fafafa",
                    color: "#333",
                    resize: "none",
                    outline: "none",
                    minHeight: "400px",
                  }}
                />
              </div>
              
              {/* 预览区域 */}
              {showMarkdownPreview && (
                <div style={{ 
                  flex: "1",
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "#fff",
                  overflow: "hidden",
                }}>
                  <div style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #e8e8e8",
                    backgroundColor: "#fafafa",
                    fontSize: "13px",
                    color: "#666",
                  }}>
                    预览
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: "16px",
                      overflowY: "auto",
                      backgroundColor: "#fff",
                      fontSize: "14px",
                      lineHeight: "1.8",
                    }}
                    dangerouslySetInnerHTML={{ __html: markdownPreviewHtml }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div 
            style={{ 
              padding: "1.5rem", 
              paddingTop: "3rem",
              backgroundColor: "#fafafa",
              minHeight: "500px",
            }}
            data-testid="rich-text-editor-container"
          >
            {/* ReactQuill 编辑器容器 */}
            <div 
              style={{ 
                width: "100%", 
                backgroundColor: "#fff",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                overflow: "visible",
                minHeight: "450px",
              }}
              className="quill-wrapper"
            >
              <ReactQuill
                key={`quill-${documentId}-${isEditor}`}
                ref={(el) => {
                  if (el) {
                    quillRef.current = el;
                    // 延迟检查，确保编辑器完全初始化
                    setTimeout(() => {
                      try {
                        if (el && el.getEditor) {
                          const editor = el.getEditor();
                          if (editor) {
                            // 使用 querySelector 安全地查找 DOM 元素
                            const quillContainer = el.querySelector ? el.querySelector('.ql-container') : null;
                            const quillEditor = el.querySelector ? el.querySelector('.ql-editor') : null;
                            const quillToolbar = el.querySelector ? el.querySelector('.ql-toolbar') : null;
                            
                            // 强制显示所有元素（如果存在）
                            if (quillContainer) {
                              quillContainer.style.display = "block";
                              quillContainer.style.visibility = "visible";
                              quillContainer.style.minHeight = "350px";
                            }
                            if (quillEditor) {
                              quillEditor.style.display = "block";
                              quillEditor.style.visibility = "visible";
                              quillEditor.style.minHeight = "350px";
                            }
                            if (quillToolbar) {
                              quillToolbar.style.display = isEditor ? "block" : "none";
                              quillToolbar.style.visibility = "visible";
                            }
                          }
                        }
                      } catch (err) {
                        // 静默处理错误，避免控制台噪音
                        // 编辑器可能还在初始化中
                      }
                    }, 800);
                  }
                }}
                theme="snow"
                value={content && content.ops ? content : { ops: [{ insert: "\n" }] }}
                onChange={handleQuillChange}
                readOnly={!isEditor}
                placeholder={isEditor ? "开始输入..." : "您没有编辑权限"}
                modules={
                  isEditor
                    ? {
                        toolbar: [
                          [{ header: [1, 2, 3, false] }],
                          ["bold", "italic", "underline", "strike"],
                          [{ list: "ordered" }, { list: "bullet" }],
                          [{ color: [] }, { background: [] }],
                          ["link", "image"],
                          ["clean"],
                        ],
                      }
                    : { toolbar: false }
                }
                style={{ 
                  backgroundColor: "#fff",
                  height: "auto",
                }}
                formats={[
                  "header",
                  "bold",
                  "italic",
                  "underline",
                  "strike",
                  "list",
                  "bullet",
                  "color",
                  "background",
                  "link",
                  "image",
                ]}
              />
            </div>
            {/* 状态信息 */}
            <div style={{ 
              marginTop: "15px", 
              padding: "10px", 
              backgroundColor: "#e6f7ff", 
              fontSize: "13px", 
              color: "#0050b3", 
              borderRadius: "4px",
              border: "1px solid #91d5ff",
            }}>
              <strong>编辑器状态：</strong>
              <span style={{ marginLeft: "10px" }}>
                格式: {contentFormat} | 
                模式: {isMarkdownMode ? "Markdown" : "富文本"} | 
                权限: {isEditor ? "可编辑" : "只读"} | 
                内容: {content && content.ops ? `${content.ops.length} 个操作` : "无"}
              </span>
            </div>
          </div>
        )}
      </div>
      {showShareModal && (
        <ShareModal
          documentId={documentId}
          onClose={() => setShowShareModal(false)}
        />
      )}
      {showVersionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1200,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              width: "90%",
              maxWidth: "1000px",
              maxHeight: "85vh",
              borderRadius: "10px",
              padding: "24px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ margin: 0 }}>版本历史</h3>
              <button onClick={closeVersionModal} style={{ fontSize: "1.2rem" }}>
                &times;
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "280px 1fr",
                gap: "1.5rem",
                flex: 1,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  borderRight: "1px solid #eee",
                  paddingRight: "1rem",
                  overflowY: "auto",
                }}
              >
                {versionsLoading && <p>正在加载版本...</p>}
                {versionError && <p style={{ color: "red" }}>{versionError}</p>}
                {!versionsLoading && !versionError && versions.length === 0 && (
                  <p>暂无版本记录。使用“保存版本”可创建快照。</p>
                )}
                {!versionsLoading && !versionError && versions.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {versions.map((version) => {
                      const isActive =
                        previewVersion && previewVersion.id === version.id;
                      return (
                        <li
                          key={version.id}
                          style={{
                            border: "1px solid #e5e5e5",
                            borderRadius: "8px",
                            marginBottom: "10px",
                            padding: "12px",
                            backgroundColor: isActive ? "#f5f9ff" : "white",
                          }}
                        >
                          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                            {new Date(version.created_at).toLocaleString()}
                          </div>
                          <div style={{ color: "#555", fontSize: "0.9em" }}>
                            {version.created_by_name || version.created_by_email ||
                              "未知用户"}
                          </div>
                          {version.summary && (
                            <div style={{ marginTop: "6px", color: "#666" }}>
                              备注：{version.summary}
                            </div>
                          )}
                          <div
                            style={{
                              marginTop: "8px",
                              display: "flex",
                              gap: "0.5rem",
                              flexWrap: "wrap",
                              fontSize: "0.85em",
                            }}
                          >
                            <label>
                              <input
                                type="radio"
                                name="compareFrom"
                                checked={compareFrom === version.id}
                                onChange={() => setCompareFrom(version.id)}
                              />
                              基准A
                            </label>
                            <label>
                              <input
                                type="radio"
                                name="compareTo"
                                checked={compareTo === version.id}
                                onChange={() => setCompareTo(version.id)}
                              />
                              对比B
                            </label>
                          </div>
                          <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                            <button
                              onClick={() => handlePreviewVersion(version.id)}
                              style={{ flex: 1 }}
                            >
                              预览
                            </button>
                            {isEditor && (
                              <button
                                onClick={() => handleRestoreVersion(version.id)}
                                style={{ flex: 1 }}
                              >
                                恢复
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div
                style={{
                  overflowY: "auto",
                  padding: "0 0.5rem",
                }}
              >
                {previewVersion ? (
                  <>
                    <div style={{ marginBottom: "0.75rem" }}>
                      <h4 style={{ margin: "0 0 0.5rem" }}>
                        {previewVersion.title || "未命名文档"}
                      </h4>
                      <div style={{ color: "#666", fontSize: "0.9em" }}>
                        保存于 {new Date(previewVersion.created_at).toLocaleString()}
                      </div>
                      <div style={{ color: "#666", fontSize: "0.9em" }}>
                        分类：{previewVersion.category || "未分类"}
                      </div>
                      <div style={{ color: "#666", fontSize: "0.9em" }}>
                        标签：
                        {previewVersion.tags && previewVersion.tags.length > 0
                          ? previewVersion.tags.join("、")
                          : "无"}
                      </div>
                    </div>
                    {previewVersion.content_format === "markdown" && previewMarkdown ? (
                      <div
                        style={{
                          minHeight: "300px",
                          border: "1px solid #eee",
                          borderRadius: "6px",
                          padding: "1rem",
                          backgroundColor: "white",
                          maxHeight: "600px",
                          overflowY: "auto",
                        }}
                        dangerouslySetInnerHTML={{ __html: previewMarkdownHtml }}
                      />
                    ) : previewContent ? (
                      <ReactQuill
                        value={previewContent}
                        readOnly
                        theme="bubble"
                        modules={{ toolbar: false }}
                        style={{ minHeight: "300px" }}
                      />
                    ) : (
                      <div style={{ color: "#666", padding: "2rem", textAlign: "center" }}>
                        该版本没有内容
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      color: "#666",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px dashed #ccc",
                      borderRadius: "8px",
                    }}
                  >
                    选择左侧版本以查看详情
                  </div>
                )}
              </div>
              <div
                style={{
                  borderTop: "1px solid #eee",
                  marginTop: "1rem",
                  paddingTop: "1rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.5rem" }}>版本对比</h4>
                <p style={{ color: "#666", fontSize: "0.85em" }}>
                  选择两个版本分别作为基准 A 与对比 B，生成差异对比。
                </p>
                <div style={{ marginBottom: "0.75rem", color: "#666" }}>
                  已选择：A={compareFrom || "未选择"}，B={compareTo || "未选择"}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <button
                    onClick={handleCompareVersions}
                    disabled={diffLoading || !compareFrom || !compareTo}
                    className="button-like"
                  >
                    {diffLoading ? "生成中..." : "生成对比"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompareFrom(null);
                      setCompareTo(null);
                      setDiffHtml("");
                    }}
                  >
                    清空选择
                  </button>
                </div>
                {diffError && <p style={{ color: "red" }}>{diffError}</p>}
                {!diffLoading && sanitizedDiffHtml && (
                  <div
                    style={{
                      border: "1px solid #eee",
                      borderRadius: "6px",
                      padding: "1rem",
                      maxHeight: "400px",
                      overflowY: "auto",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <style>{`
                      .diff-added {
                        background-color: #d4edda;
                        color: #155724;
                        padding: 2px 4px;
                        text-decoration: none;
                      }
                      .diff-removed {
                        background-color: #f8d7da;
                        color: #721c24;
                        padding: 2px 4px;
                        text-decoration: line-through;
                      }
                      .diff-unchanged {
                        color: #333;
                      }
                      .markdown-diff {
                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        line-height: 1.6;
                        font-size: 13px;
                      }
                      .markdown-diff .diff-added {
                        background-color: #d4edda;
                        color: #155724;
                      }
                      .markdown-diff .diff-removed {
                        background-color: #f8d7da;
                        color: #721c24;
                        text-decoration: line-through;
                      }
                    `}</style>
                    <div dangerouslySetInnerHTML={{ __html: sanitizedDiffHtml }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorPage;
