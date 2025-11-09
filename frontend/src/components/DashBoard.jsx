import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Link } from "react-router-dom";
import api from "../api";

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

const dedupe = (items) => Array.from(new Set(items));

function Dashboard({ user }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateError, setTemplateError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [activeFilters, setActiveFilters] = useState({
    sort: "updated_at",
    order: "desc",
  });
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [selectedDocs, setSelectedDocs] = useState(() => {
    try {
      const saved = localStorage.getItem("selectedDocs");
      if (saved) {
        const parsed = JSON.parse(saved);
        // 确保返回的是数组
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (error) {
      console.warn("加载选中状态失败:", error);
      return [];
    }
  });
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [lockedFilter, setLockedFilter] = useState("");
  const [exportFormat, setExportFormat] = useState("json");
  // 为每个文档存储选择的导出格式
  const [documentExportFormats, setDocumentExportFormats] = useState(() => {
    try {
      const saved = localStorage.getItem("documentExportFormats");
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      return {};
    }
  });
  // 批量导出格式
  const [bulkExportFormat, setBulkExportFormat] = useState("json");

  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocCategory, setNewDocCategory] = useState("");
  const [newDocTags, setNewDocTags] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isTemplatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [newDocFormat, setNewDocFormat] = useState("rich");
  const [newDocMarkdown, setNewDocMarkdown] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const importInputRef = useRef(null);

  const isAdmin = user?.role === "admin";
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkExportMessage, setBulkExportMessage] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const allSelected = documents.length > 0 && selectedDocs.length === documents.length;

  const loadDocuments = useCallback(
    async (filters = {}) => {
      const normalizedFilters = {
        sort: filters.sort || "updated_at",
        order: filters.order || "desc",
      };

      if (filters.q) {
        normalizedFilters.q = filters.q;
      }
      if (filters.category) {
        normalizedFilters.category = filters.category;
      }
      if (filters.tag) {
        normalizedFilters.tag = filters.tag;
      }
      if (filters.createdFrom) {
        normalizedFilters.createdFrom = filters.createdFrom;
      }
      if (filters.createdTo) {
        normalizedFilters.createdTo = filters.createdTo;
      }
      if (filters.updatedFrom) {
        normalizedFilters.updatedFrom = filters.updatedFrom;
      }
      if (filters.updatedTo) {
        normalizedFilters.updatedTo = filters.updatedTo;
      }
      if (filters.locked) {
        normalizedFilters.locked = filters.locked;
      }
      if (filters.owner && isAdmin) {
        normalizedFilters.owner = filters.owner;
      }

      try {
        setLoading(true);
        const response = await api.get("/documents", {
          params: normalizedFilters,
        });
        const docs = response.data.map((doc) => ({
          ...doc,
          tags: toArray(doc.tags),
        }));
        setDocuments(docs);
        setError("");
        setActiveFilters(normalizedFilters);
        if (isAdmin) {
          const ownerMap = new Map();
          docs.forEach((doc) => {
            if (!doc.owner_id) return;
            if (!ownerMap.has(doc.owner_id)) {
              ownerMap.set(doc.owner_id, {
                id: doc.owner_id,
                label: doc.owner_name || doc.owner_email || `用户${doc.owner_id}`,
              });
            }
          });
          setOwnerOptions(Array.from(ownerMap.values()));
        }
        setSelectedDocs((prev) => {
          const filtered = prev.filter((id) => docs.some((doc) => doc.id === id));
          try {
            localStorage.setItem("selectedDocs", JSON.stringify(filtered));
          } catch (error) {
            console.warn("保存选中状态失败:", error);
          }
          return filtered;
        });
      } catch (err) {
        console.error("获取文档列表失败:", err);
        setError("无法加载文档列表，请稍后再试。");
      } finally {
        setLoading(false);
      }
    },
    [isAdmin]
  );

  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const response = await api.get("/documents/templates");
      const normalized = response.data.map((template) => ({
        ...template,
        tags: toArray(template.tags),
      }));
      setTemplates(normalized);
      setTemplateError("");
    } catch (err) {
      console.error("获取模板列表失败:", err);
      setTemplateError("无法加载模板库，请稍后重试。");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments({ sort: "updated_at", order: "desc" });
  }, [loadDocuments]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!showImportModal) {
      setImportStatus("");
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }, [showImportModal]);

  useEffect(() => {
    if (!showCreateModal) {
      setTemplatePanelOpen(false);
    }
  }, [showCreateModal]);

  const categories = useMemo(() => {
    return dedupe([
      ...documents.map((doc) => doc.category).filter(Boolean),
      ...templates.map((template) => template.category).filter(Boolean),
    ]);
  }, [documents, templates]);

  const tags = useMemo(() => {
    const tagPool = [];
    documents.forEach((doc) => {
      toArray(doc.tags).forEach((tag) => tagPool.push(tag));
    });
    templates.forEach((template) => {
      toArray(template.tags).forEach((tag) => tagPool.push(tag));
    });
    return dedupe(tagPool);
  }, [documents, templates]);

  const groupedDocuments = useMemo(() => {
    const groups = new Map();
    documents.forEach((doc) => {
      const key = doc.category || "未分类";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(doc);
    });
    return groups;
  }, [documents]);

  const renderListView = () => (
    <>
      {documents.length > 0 && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.75rem",
            color: "#666",
          }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => handleSelectAllDocs(e.target.checked)}
          />
          全选（{selectedDocs.length}/{documents.length}）
        </label>
      )}
      {documents.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            minHeight: "240px",
            transition: "min-height 0.2s ease",
          }}
        >
          {documents.map((doc) => {
            const isSelected = selectedDocs.includes(doc.id);
            const lockedLabel =
              doc.locked_by_name ||
              doc.locked_by_email ||
              (doc.locked_by ? `用户${doc.locked_by}` : "未知");
            return (
              <li
                key={doc.id}
                style={{
                  border: isSelected ? "2px solid #1890ff" : "1px solid #e8e8e8",
                  padding: "16px",
                  marginBottom: "12px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  backgroundColor: isSelected ? "#e6f7ff" : "#fff",
                  transition: "all 0.2s",
                  boxShadow: isSelected ? "0 2px 8px rgba(24, 144, 255, 0.2)" : "0 1px 4px rgba(0,0,0,0.04)",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#1890ff";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#e8e8e8";
                    e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
                  }
                }}
              >
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleDocumentSelection(doc.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ cursor: "pointer", flexShrink: 0 }}
                  />
                  <Link
                    to={`/documents/${doc.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                    onClick={(e) => {
                      // 如果点击的是链接本身，允许导航
                      if (e.target === e.currentTarget || e.target.tagName === "STRONG") {
                        return;
                      }
                      // 如果点击的是链接内的其他元素（如标签），也允许导航
                      if (e.target.closest("span") || e.target.closest("div")) {
                        return;
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        cursor: "pointer",
                        color: "#333",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.color = "#1890ff")}
                      onMouseLeave={(e) => (e.target.style.color = "#333")}
                    >
                      {doc.title}
                    </strong>
                      {doc.content_format === "markdown" && (
                        <span
                          style={{
                            backgroundColor: "#1677ff",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.75em",
                          }}
                        >
                          Markdown
                        </span>
                      )}
                      {doc.is_locked && (
                        <span
                          style={{
                            backgroundColor: "#ff9f43",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.75em",
                          }}
                        >
                          🔒 锁定
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#666", fontSize: "0.9em" }}>
                      <span style={{ marginRight: "1rem" }}>
                        更新：{new Date(doc.updated_at).toLocaleString()}
                      </span>
                      <span style={{ marginRight: "1rem" }}>
                        分类：{doc.category || "未分类"}
                      </span>
                      <span>
                        标签：
                        {doc.tags && doc.tags.length > 0
                          ? doc.tags.join("、")
                          : "无"}
                      </span>
                    </div>
                    <div style={{ color: "#888", fontSize: "0.85em" }}>
                      所有者：
                      {doc.owner_name || doc.owner_email || "未知"}
                    </div>
                    {doc.is_locked && (
                      <div style={{ color: "#d46b08", fontSize: "0.85em" }}>
                        锁定人：{lockedLabel}
                      </div>
                    )}
                  </Link>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "center" }}>
                  <select
                    value={getDocumentExportFormat(doc.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDocumentExportFormat(doc.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #d9d9d9",
                      fontSize: "0.85em",
                      cursor: "pointer",
                      backgroundColor: "white",
                    }}
                  >
                    <option value="json">JSON</option>
                    <option value="markdown">Markdown</option>
                    <option value="docx">Word</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportDocument(doc.id, null, e);
                    }}
                    style={{
                      backgroundColor: "#1677ff",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.9em",
                    }}
                    title="使用选择的格式导出"
                  >
                    导出
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id, e);
                    }}
                    style={{
                      backgroundColor: "#ff4d4f",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.9em",
                    }}
                  >
                    删除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>没有符合条件的文档。试试调整筛选条件或创建新的文档吧。</p>
      )}
    </>
  );

  const renderKanbanView = () => (
    <div
      style={{
        display: "flex",
        gap: "1.5rem",
        overflowX: "auto",
        paddingBottom: "0.5rem",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      {Array.from(groupedDocuments.entries()).map(([group, docs]) => (
        <div
          key={group}
          style={{
            minWidth: "260px",
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: "8px",
            padding: "1rem",
          }}
        >
          <h4>
            {group} ({docs.length})
          </h4>
          {docs.map((doc) => {
            const isSelected = selectedDocs.includes(doc.id);
            const lockedLabel =
              doc.locked_by_name ||
              doc.locked_by_email ||
              (doc.locked_by ? `用户${doc.locked_by}` : "未知");
            return (
              <div
                key={doc.id}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  padding: "12px",
                  marginBottom: "10px",
                  backgroundColor: isSelected ? "#e6f7ff" : "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleDocumentSelection(doc.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ cursor: "pointer", flexShrink: 0 }}
                  />
                  <Link
                    to={`/documents/${doc.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ cursor: "pointer" }}>{doc.title}</strong>
                    {doc.content_format === "markdown" && (
                      <span
                        style={{
                          backgroundColor: "#1677ff",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.75em",
                        }}
                      >
                        Markdown
                      </span>
                    )}
                    {doc.is_locked && (
                      <span
                        style={{
                          backgroundColor: "#ff9f43",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.75em",
                        }}
                      >
                        🔒 锁定
                      </span>
                    )}
                  </Link>
                </div>
                <div style={{ color: "#666", fontSize: "0.9em", marginTop: "0.5rem" }}>
                  更新：{new Date(doc.updated_at).toLocaleString()}
                </div>
                <div style={{ color: "#666", fontSize: "0.85em" }}>
                  标签：
                  {doc.tags && doc.tags.length > 0
                    ? doc.tags.join("、")
                    : "无"}
                </div>
                <div style={{ color: "#888", fontSize: "0.85em" }}>
                  所有者：{doc.owner_name || doc.owner_email || "未知"}
                </div>
                {doc.is_locked && (
                  <div style={{ color: "#d46b08", fontSize: "0.85em" }}>
                    锁定人：{lockedLabel}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={getDocumentExportFormat(doc.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDocumentExportFormat(doc.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #d9d9d9",
                      fontSize: "0.85em",
                      cursor: "pointer",
                      backgroundColor: "white",
                      flex: "1",
                      minWidth: "100px",
                    }}
                  >
                    <option value="json">JSON</option>
                    <option value="markdown">Markdown</option>
                    <option value="docx">Word</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportDocument(doc.id, null, e);
                    }}
                    style={{
                      backgroundColor: "#1677ff",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.85em",
                      flex: "1",
                    }}
                    title="使用选择的格式导出"
                  >
                    导出
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id, e);
                    }}
                    style={{
                      backgroundColor: "#ff4d4f",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.85em",
                      flex: "1",
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    await loadDocuments({
      q: searchTerm.trim() || undefined,
      category: selectedCategory || undefined,
      tag: selectedTag || undefined,
      sort: sortBy,
      order: sortOrder,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
      updatedFrom: updatedFrom || undefined,
      updatedTo: updatedTo || undefined,
      owner: isAdmin && ownerFilter ? ownerFilter : undefined,
      locked: lockedFilter || undefined,
    });
  };

  const handleClearFilters = async () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedTag("");
    setSortBy("updated_at");
    setSortOrder("desc");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setOwnerFilter("");
    setLockedFilter("");
    await loadDocuments({ sort: "updated_at", order: "desc" });
  };

  const handleCreateDocument = async (event) => {
    event.preventDefault();

    if (!newDocTitle.trim()) {
      alert("请填写文档标题");
      return;
    }

    const resolvedCategory =
      newDocCategory.trim() || selectedCategory || "";

    const parsedTags = newDocTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (parsedTags.length === 0 && selectedTag) {
      parsedTags.push(selectedTag);
    }

    const uniqueTags = Array.from(new Set(parsedTags));

    const payload = {
      title: newDocTitle.trim(),
      category: resolvedCategory ? resolvedCategory : null,
      tags: uniqueTags,
      contentFormat: newDocFormat,
    };

    if (selectedTemplateId) {
      payload.templateId = Number(selectedTemplateId);
    }

    if (newDocFormat === "markdown") {
      payload.markdownContent = newDocMarkdown;
    }

    try {
      await api.post("/documents", payload);
      await loadDocuments({ ...activeFilters, sort: sortBy, order: sortOrder });
      setNewDocTitle("");
      setNewDocCategory("");
      setNewDocTags("");
      setSelectedTemplateId("");
      setNewDocFormat("rich");
      setNewDocMarkdown("");
      await handleClearFilters();
      setShowCreateModal(false);
      setTemplatePanelOpen(false);
    } catch (err) {
      console.error("创建文档失败:", err);
      alert("创建文档时出错，请稍后再试。");
    }
  };

  const toggleTemplatePanel = () => {
    setTemplatePanelOpen((prev) => !prev);
  };

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId((prev) =>
      prev === String(templateId) ? "" : String(templateId)
    );

    const template = templates.find((item) => item.id === templateId);
    if (template) {
      if (!newDocTitle.trim()) {
        setNewDocTitle(template.name);
      }
      if (!newDocCategory.trim() && template.category) {
        setNewDocCategory(template.category);
      }
      if (!newDocTags.trim() && template.tags && template.tags.length > 0) {
        setNewDocTags(template.tags.join(", "));
      }
    }
  };

  const handleDeleteDocument = async (documentId, event) => {
    event.preventDefault();
    event.stopPropagation();

    if (window.confirm("你确定要永久删除这个文档吗？")) {
      try {
        await api.delete(`/documents/${documentId}`);
        setSelectedDocs((prev) => {
          const filtered = prev.filter((id) => id !== documentId);
          try {
            localStorage.setItem("selectedDocs", JSON.stringify(filtered));
          } catch (error) {
            console.warn("保存选中状态失败:", error);
          }
          return filtered;
        });
        await loadDocuments(activeFilters);
      } catch (err) {
        console.error("删除文档失败:", err);
        alert("删除文档时出错，请重试。");
      }
    }
  };

  // 更新文档的导出格式
  const updateDocumentExportFormat = (documentId, format) => {
    setDocumentExportFormats((prev) => {
      const newFormats = { ...prev, [documentId]: format };
      try {
        localStorage.setItem("documentExportFormats", JSON.stringify(newFormats));
      } catch (error) {
        console.warn("保存文档导出格式失败:", error);
      }
      return newFormats;
    });
  };

  // 获取文档的导出格式
  const getDocumentExportFormat = (documentId) => {
    return documentExportFormats[documentId] || exportFormat;
  };

  const handleExportDocument = async (documentId, format, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // 使用传入的格式，如果没有则使用文档的格式，最后回退到全局格式
    const formatToUse = format || getDocumentExportFormat(documentId) || exportFormat;
    try {
      const response = await api.get(`/documents/${documentId}/export`, {
        params: { format: formatToUse },
        responseType: "arraybuffer",
      });
      const contentType = response.headers["content-type"] || "application/octet-stream";
      const disposition = response.headers["content-disposition"];
      let fileName = `document-${documentId}.${
        formatToUse === "markdown"
          ? "md"
          : formatToUse === "json"
          ? "json"
          : formatToUse
      }`;
      if (disposition) {
        // 优先解析 RFC 5987 格式：filename*=UTF-8''encoded
        // 匹配 filename*=UTF-8'' 后面的所有字符（直到分号、逗号或字符串结束）
        const utf8Match = /filename\*=UTF-8''([^;,\s"']+)/i.exec(disposition);
        if (utf8Match && utf8Match[1]) {
          try {
            fileName = decodeURIComponent(utf8Match[1]);
          } catch (e) {
            console.warn("解析 UTF-8 文件名失败:", e, utf8Match[1]);
            // 如果解码失败，尝试使用标准格式
            const standardMatch = /filename=["']?([^"';,\s]+)["']?/i.exec(disposition);
            if (standardMatch && standardMatch[1]) {
              fileName = standardMatch[1];
            }
          }
        } else {
          // 回退到标准格式：filename="name" 或 filename=name
          const standardMatch = /filename=["']?([^"';,\s]+)["']?/i.exec(disposition);
          if (standardMatch && standardMatch[1]) {
            fileName = standardMatch[1];
          }
        }
      }
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("导出文档失败:", error);
      alert(error.response?.data?.message || "导出文档失败，请稍后再试。");
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImportStatus("");
    setImporting(true);
    try {
      const text = await file.text();
      const extension = file.name.split(".").pop()?.toLowerCase();
      let response;

      if (extension === "md") {
        const inferredTitle = file.name.replace(/\.[^/.]+$/, "") || "未命名文档";
        response = await api.post("/documents/import", {
          title: inferredTitle,
          format: "markdown",
          markdown: text,
          category: newDocCategory || null,
          tags: newDocTags ? newDocTags.split(",").map((t) => t.trim()) : [],
        });
      } else {
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (error) {
          throw new Error("导入失败：文件不是有效的 JSON 或 Markdown");
        }

        if (Array.isArray(parsed)) {
          response = await api.post("/documents/import/bulk", {
            documents: parsed,
          });
        } else if (parsed && Array.isArray(parsed.documents)) {
          response = await api.post("/documents/import/bulk", {
            documents: parsed.documents,
          });
        } else {
          response = await api.post("/documents/import", parsed);
        }
      }

      if (response?.data?.results) {
        const successCount = response.data.results.filter(
          (item) => item.status === "success"
        ).length;
        setImportStatus(
          `批量导入完成：成功 ${successCount}/${response.data.total} 篇文档`
        );
      } else {
        setImportStatus("导入成功，文档已创建。");
      }
      await handleClearFilters();
      await loadDocuments({ sort: "updated_at", order: "desc" });
    } catch (error) {
      console.error("导入文档失败:", error);
      setImportStatus(
        error.response?.data?.message || error.message || "导入失败，请检查文件格式"
      );
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  const toggleDocumentSelection = (documentId) => {
    setSelectedDocs((prev) => {
      const newSelection = prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId];
      try {
        localStorage.setItem("selectedDocs", JSON.stringify(newSelection));
      } catch (error) {
        console.warn("保存选中状态失败:", error);
      }
      return newSelection;
    });
  };

  const handleSelectAllDocs = (checked) => {
    const newSelection = checked ? documents.map((doc) => doc.id) : [];
    setSelectedDocs(newSelection);
    try {
      localStorage.setItem("selectedDocs", JSON.stringify(newSelection));
    } catch (error) {
      console.warn("保存选中状态失败:", error);
    }
  };

  const handleBulkExport = async (customIds, format) => {
    try {
      // 使用传入的格式，如果没有则使用批量导出格式，最后回退到全局格式
      const exportFormatToUse = format || bulkExportFormat || exportFormat;
      
      // 强制转换为数组，处理各种可能的情况
      let rawIds;
      if (customIds !== undefined && customIds !== null) {
        // 如果提供了 customIds，使用它
        rawIds = Array.isArray(customIds) ? customIds : [customIds].filter((id) => id != null);
      } else {
        // 否则使用 selectedDocs - 直接从状态读取最新值
        // 如果 selectedDocs 不是数组，尝试从 localStorage 读取
        if (Array.isArray(selectedDocs) && selectedDocs.length > 0) {
          rawIds = selectedDocs;
        } else {
          // 尝试从 localStorage 重新读取
          try {
            const saved = localStorage.getItem("selectedDocs");
            if (saved) {
              const parsed = JSON.parse(saved);
              rawIds = Array.isArray(parsed) ? parsed : [];
            } else {
              rawIds = [];
            }
          } catch (e) {
            console.warn("从 localStorage 读取选中状态失败:", e);
            rawIds = [];
          }
        }
      }

      // 调试信息
      console.log("批量导出调试:", {
        customIds,
        selectedDocs,
        rawIds,
        rawIdsType: typeof rawIds,
        isArray: Array.isArray(rawIds),
      });

      // 确保 rawIds 是数组
      if (!Array.isArray(rawIds)) {
        console.error("无法将 selectedDocs 转换为数组:", selectedDocs, typeof selectedDocs);
        rawIds = [];
      }

      // 转换并过滤 ID
      const idsToExport = rawIds
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
      
      console.log("转换后的 ID 列表:", idsToExport);
      
      if (idsToExport.length === 0) {
        alert("请先选择至少一个文档（勾选文档前面的复选框）");
        return;
      }

      if (idsToExport.length === 1) {
        await handleExportDocument(idsToExport[0], exportFormatToUse);
        return;
      }

      setBulkExporting(true);
      setBulkExportMessage("");
      
      const response = await api.post(
        "/documents/export/bulk",
        { ids: idsToExport, format: exportFormatToUse },
        { responseType: "blob" }
      );
      
      const blob = new Blob([response.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "documents-export.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setBulkExportMessage(`已成功导出 ${idsToExport.length} 篇文档`);
    } catch (error) {
      console.error("批量导出失败:", error);
      const errorMessage = error.response?.data?.message || error.message || "批量导出失败，请稍后再试";
      setBulkExportMessage(errorMessage);
      alert(errorMessage);
    } finally {
      setBulkExporting(false);
    }
  };

  const Modal = ({ visible, title, onClose, width = "640px", children }) => {
    if (!visible) return null;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "10px",
            width: "100%",
            maxWidth: width,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 18px 48px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.5rem",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <h3 style={{ margin: 0 }}>{title}</h3>
            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "1.5rem",
                cursor: "pointer",
                lineHeight: 1,
              }}
              aria-label="关闭"
            >
              ×
            </button>
          </div>
          <div
            style={{
              padding: "1.5rem",
              overflowY: "auto",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* 头部区域 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 600,
              color: "#333",
              marginBottom: "8px",
            }}
          >
            我的文档
          </h2>
          <p
            style={{
              margin: 0,
              color: "#666",
              fontSize: "14px",
            }}
          >
            欢迎回来, {user.full_name || user.email || user.phone}!
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {user && user.role === "admin" && (
            <Link
              to="/admin"
              style={{
                padding: "8px 16px",
                backgroundColor: "#fff",
                border: "1px solid #d9d9d9",
                borderRadius: "6px",
                textDecoration: "none",
                color: "#333",
                fontSize: "14px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = "#1890ff";
                e.target.style.color = "#1890ff";
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = "#d9d9d9";
                e.target.style.color = "#333";
              }}
            >
              后台管理
            </Link>
          )}
          <Link
            to="/profile"
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
              textDecoration: "none",
              color: "#333",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#1890ff";
              e.target.style.color = "#1890ff";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "#d9d9d9";
              e.target.style.color = "#333";
            }}
          >
            个人资料
          </Link>
        </div>
      </div>

      {/* 搜索与筛选 */}
      <section
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e8e8e8",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "16px",
            fontSize: "16px",
            fontWeight: 600,
            color: "#333",
          }}
        >
          快速查找
        </h3>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "1 1 260px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              关键字
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="标题 / 作者 / 分类 / 标签"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "14px",
                border: "1px solid #d9d9d9",
                borderRadius: "6px",
                transition: "all 0.2s",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#1890ff";
                e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d9d9d9";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              分类
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="">全部</option>
              {categories.map((categoryOption) => (
                <option key={categoryOption} value={categoryOption}>
                  {categoryOption}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              标签
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="">全部</option>
              {tags.map((tagOption) => (
                <option key={tagOption} value={tagOption}>
                  {tagOption}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              排序字段
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="updated_at">按更新时间</option>
              <option value="created_at">按创建时间</option>
              <option value="title">按标题</option>
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              排序方式
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </div>
          {isAdmin && (
            <div style={{ flex: "1 1 220px" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                文档所有者
              </label>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">全部</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              锁定状态
            </label>
            <select
              value={lockedFilter}
              onChange={(e) => setLockedFilter(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="">全部</option>
              <option value="true">已锁定</option>
              <option value="false">未锁定</option>
            </select>
          </div>
          <div style={{ flex: "1 1 320px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              创建时间
            </label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.85em", color: "#666" }}>起</label>
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                  style={{ padding: "8px" }}
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.85em", color: "#666" }}>止</label>
                <input
                  type="date"
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                  style={{ padding: "8px" }}
                />
              </div>
            </div>
          </div>
          <div style={{ flex: "1 1 320px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              更新时间
            </label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.85em", color: "#666" }}>起</label>
                <input
                  type="date"
                  value={updatedFrom}
                  onChange={(e) => setUpdatedFrom(e.target.value)}
                  style={{ padding: "8px" }}
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.85em", color: "#666" }}>止</label>
                <input
                  type="date"
                  value={updatedTo}
                  onChange={(e) => setUpdatedTo(e.target.value)}
                  style={{ padding: "8px" }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flex: "1 1 240px", alignItems: "flex-end" }}>
            <button type="submit" className="button-like" style={{ flex: 1 }}>
              应用筛选
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              style={{ flex: 1 }}
            >
              重置
            </button>
          </div>
          {/* 批量导出选项移到筛选区域 */}
          <div style={{ display: "flex", gap: "0.5rem", flex: "1 1 300px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: "1 1 150px" }}>
              <span style={{ fontSize: "0.9em" }}>批量导出格式</span>
              <select
                value={bulkExportFormat}
                onChange={(e) => setBulkExportFormat(e.target.value)}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #d9d9d9",
                  fontSize: "0.9em",
                  cursor: "pointer",
                  backgroundColor: "white",
                }}
              >
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
                <option value="docx">Word</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: "1 1 150px" }}>
              <button
                type="button"
                onClick={() => handleBulkExport(null, bulkExportFormat)}
                disabled={bulkExporting || !Array.isArray(selectedDocs) || selectedDocs.length === 0}
                style={{ 
                  padding: "8px",
                  backgroundColor: (!Array.isArray(selectedDocs) || selectedDocs.length === 0) ? "#d9d9d9" : "#1677ff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: (!Array.isArray(selectedDocs) || selectedDocs.length === 0) ? "not-allowed" : "pointer",
                  fontSize: "0.9em",
                }}
                title={(!Array.isArray(selectedDocs) || selectedDocs.length === 0) ? "请先选择要导出的文档" : `批量导出 ${selectedDocs.length} 个文档为 ${bulkExportFormat.toUpperCase()} 格式（ZIP 压缩包）`}
              >
                {bulkExporting ? "导出中..." : `批量导出 (${Array.isArray(selectedDocs) ? selectedDocs.length : 0})`}
              </button>
              {bulkExportMessage && (
                <span style={{ color: "#666", fontSize: "0.85em" }}>{bulkExportMessage}</span>
              )}
            </div>
          </div>
        </form>
      </section>

      {/* 操作工具栏 */}
      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          padding: "1rem",
          backgroundColor: "#fafafa",
          borderRadius: "8px",
          border: "1px solid #e0e0e0",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#1890ff",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#40a9ff";
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 4px 12px rgba(24, 144, 255, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#1890ff";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
          >
            ➕ 新建文档
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#fff",
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
              color: "#333",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#1890ff";
              e.target.style.color = "#1890ff";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "#d9d9d9";
              e.target.style.color = "#333";
            }}
          >
            📥 导入文档
          </button>
          <span style={{ color: "#666", padding: "0.5rem 1rem", backgroundColor: "white", borderRadius: "4px", border: "1px solid #e0e0e0" }}>
            已选 {selectedDocs.length}/{documents.length} 篇
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#666", fontSize: "14px" }}>视图：</span>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              backgroundColor: viewMode === "list" ? "#1890ff" : "#fff",
              color: viewMode === "list" ? "white" : "#333",
              border: viewMode === "list" ? "none" : "1px solid #d9d9d9",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (viewMode !== "list") {
                e.target.style.borderColor = "#1890ff";
                e.target.style.color = "#1890ff";
              }
            }}
            onMouseLeave={(e) => {
              if (viewMode !== "list") {
                e.target.style.borderColor = "#d9d9d9";
                e.target.style.color = "#333";
              }
            }}
          >
            列表
          </button>
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              backgroundColor: viewMode === "kanban" ? "#1890ff" : "#fff",
              color: viewMode === "kanban" ? "white" : "#333",
              border: viewMode === "kanban" ? "none" : "1px solid #d9d9d9",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (viewMode !== "kanban") {
                e.target.style.borderColor = "#1890ff";
                e.target.style.color = "#1890ff";
              }
            }}
            onMouseLeave={(e) => {
              if (viewMode !== "kanban") {
                e.target.style.borderColor = "#d9d9d9";
                e.target.style.color = "#333";
              }
            }}
          >
            看板
          </button>
        </div>
      </section>

      <section>
      <h3>我的文档</h3>
      {loading && <p>正在加载文档...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

        {!loading && !error &&
          (viewMode === "kanban" ? renderKanbanView() : renderListView())}
      </section>

      <Modal
        visible={showCreateModal}
        title="创建新文档"
        onClose={() => setShowCreateModal(false)}
        width="600px"
      >
        <form
          onSubmit={handleCreateDocument}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              标题
            </label>
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="请输入文档标题"
              required
              style={{ width: "100%", padding: "10px" }}
            />
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                分类
              </label>
              <input
                type="text"
                value={newDocCategory}
                onChange={(e) => setNewDocCategory(e.target.value)}
                placeholder="例如：产品、策划、会议纪要"
                style={{ width: "100%", padding: "10px" }}
              />
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                标签（逗号分隔）
              </label>
              <input
                type="text"
                value={newDocTags}
                onChange={(e) => setNewDocTags(e.target.value)}
                placeholder="需求, Sprint, 优先级"
                style={{ width: "100%", padding: "10px" }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              内容格式
            </label>
            <select
              value={newDocFormat}
              onChange={(e) => setNewDocFormat(e.target.value)}
              style={{ width: "100%", padding: "10px" }}
            >
              <option value="rich">富文本</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>
          {newDocFormat === "markdown" && (
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Markdown 内容（可选）
              </label>
              <textarea
                value={newDocMarkdown}
                onChange={(e) => setNewDocMarkdown(e.target.value)}
                placeholder="# 标题\n在此处使用 Markdown 语法书写文档内容"
                rows={6}
                style={{ width: "100%", padding: "10px", resize: "vertical" }}
              />
            </div>
          )}
          <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
                  }}
                >
                  <div>
              <strong>当前模板：</strong>
              {selectedTemplateId ? `ID ${selectedTemplateId}` : "默认空白文档"}
              {selectedTemplateId && (
                  <button
                  type="button"
                  onClick={() => setSelectedTemplateId("")}
                    style={{
                    marginLeft: "0.5rem",
                    padding: "4px 8px",
                    fontSize: "0.85em",
                    border: "1px solid #d9d9d9",
                      borderRadius: "4px",
                    background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                  清除
                  </button>
              )}
            </div>
            <button type="button" onClick={toggleTemplatePanel}>
              {isTemplatePanelOpen ? "收起模板库" : "选择模板"}
            </button>
          </div>
          {isTemplatePanelOpen && (
            <div
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: "8px",
                padding: "1rem",
                maxHeight: "240px",
                overflowY: "auto",
              }}
            >
              {templatesLoading && <p>正在加载模板...</p>}
              {templateError && <p style={{ color: "#d9363e" }}>{templateError}</p>}
              {!templatesLoading && !templateError && templates.length === 0 && (
                <p>暂无模板，可在文档编辑页将文档保存为模板。</p>
              )}
              {!templatesLoading && !templateError && templates.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "0.75rem",
                  }}
                >
                  {templates.map((template) => {
                    const isSelected =
                      String(template.id) === selectedTemplateId;
                    return (
                      <label
                        key={template.id}
                        style={{
                          border: isSelected
                            ? "2px solid #1677ff"
                            : "1px solid #e0e0e0",
                          borderRadius: "6px",
                          padding: "0.75rem",
                          cursor: "pointer",
                          display: "block",
                          backgroundColor: isSelected ? "#f0f7ff" : "white",
                        }}
                      >
                        <div style={{ marginBottom: "0.5rem" }}>
                          <strong>{template.name}</strong>
                        </div>
                        {template.description && (
                          <p style={{ margin: "0 0 0.5rem", color: "#666" }}>
                            {template.description}
                          </p>
                        )}
                        <p style={{ margin: "0", fontSize: "0.85em", color: "#999" }}>
                          标签：
                          {template.tags && template.tags.length > 0
                            ? template.tags.join("、")
                            : "无"}
                        </p>
                        <div style={{ marginTop: "0.75rem" }}>
                          <input
                            type="radio"
                            name="template"
                            value={template.id}
                            checked={isSelected}
                            onChange={() => handleSelectTemplate(template.id)}
                          />
                          <span style={{ marginLeft: "0.5rem" }}>
                            {isSelected ? "已选择" : "选择模板"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button type="button" onClick={() => setShowCreateModal(false)}>
              取消
            </button>
            <button type="submit" className="button-like">
              创建文档
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        visible={showImportModal}
        title="导入文档"
        onClose={() => setShowImportModal(false)}
        width="520px"
      >
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          支持导入系统导出的 JSON 文件，或 Markdown (.md) 文件。导入后将自动匹配分类和标签。
        </p>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json,.md,text/markdown"
          onChange={handleImportFile}
          disabled={importing}
          style={{ width: "100%", marginBottom: "0.75rem" }}
        />
        {importing && <p>正在导入，请稍候...</p>}
        {importStatus && (
          <p style={{ color: importStatus.includes("成功") ? "#389e0d" : "#d9363e" }}>
            {importStatus}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button type="button" onClick={() => setShowImportModal(false)}>
            关闭
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default Dashboard;
