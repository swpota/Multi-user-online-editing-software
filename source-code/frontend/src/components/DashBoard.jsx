/**
 * 文档管理仪表盘 - 用户的主工作界面
 *
 * 这是用户登录后看到的主页面，可以在这里管理所有文档。
 *
 * 主要功能：
 * - 文档列表：支持网格/列表两种视图，可以搜索、按分类筛选、排序
 * - 创建文档：可以新建空白文档，也可以从模板创建
 * - 批量操作：选中多个文档后可以批量删除或导出
 * - 导入导出：支持JSON、Markdown、Word格式
 *
 * 权限说明：
 * - 普通用户只能看到自己的文档和被分享的文档
 * - 管理员可以看到所有文档，还能按文档所有者筛选
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/components/DashBoard-modern.css";
import "../styles/components/dashboard/CreateDocForm.css";
import "../styles/components/dashboard/VirtualizedDocumentList.css";

// 子组件
import FilterBar from "./dashboard/FilterBar"; // 顶部搜索和筛选栏
import BulkActions from "./dashboard/BulkActions"; // 批量操作工具栏
import TemplateSelector from "./dashboard/TemplateSelector"; // 模板选择面板
import Modal from "./common/Modal";
import ShareModal from "./ShareModal";
import EmptyState from "./EmptyState"; // 空状态提示
import { useToast } from "./ToastContainer";
import SkeletonScreen from "./common/SkeletonScreen"; // 加载骨架屏
import DocumentCard from "./dashboard/DocumentCard"; // 网格视图的文档卡片
import DocumentListItem from "./dashboard/DocumentListItem"; // 列表视图的文档行

// 工具函数
import { toArray, dedupe } from "../utils";
import { formatRelativeTime, formatFullTime } from "../utils/timeUtils";

const EXPORT_FORMAT_OPTIONS = [
  { value: "json", label: "JSON (.json)" },
  { value: "markdown", label: "Markdown (.md)" },
  { value: "pdf", label: "PDF (.pdf)" },
  { value: "docx", label: "Word (.docx)" },
];

const sanitizeFileName = (value = "") => {
  const safe = value
    ? value
        .toString()
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim()
    : "";
  const compact = safe.replace(/\s+/g, "_");
  return compact.substring(0, 100) || "document";
};

const extractFileNameFromDisposition = (header) => {
  if (!header) return null;
  const filenameStarMatch = header.match(/filename\*=([^;]+)/i);
  if (filenameStarMatch) {
    const value = filenameStarMatch[1].trim();
    const parts = value.split("''");
    const encoded = parts.length === 2 ? parts[1] : parts[0];
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ""));
    } catch (_error) {
      return encoded.replace(/^"|"$/g, "");
    }
  }
  const filenameMatch = header.match(/filename="?([^";]+)"?/i);
  if (filenameMatch) {
    return filenameMatch[1];
  }
  return null;
};

function Dashboard({ user }) {
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  const importInputRef = useRef(null); // 用于重置文件选择器

  // ============ 文档列表状态 ============
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 选中的文档ID列表，用于批量操作，会持久化到localStorage
  const [selectedDocs, setSelectedDocs] = useState(() => {
    try {
      const saved = localStorage.getItem("selectedDocs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ============ 模板状态 ============
  // 模板列表，用于"从模板创建"功能
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateError, setTemplateError] = useState("");

  // ============ 筛选和排序 ============
  const [searchTerm, setSearchTerm] = useState(""); // 搜索关键词
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [sortBy, setSortBy] = useState("updated_at_desc"); // 格式: 字段_排序方向
  const [activeFilters, setActiveFilters] = useState({}); // 当前生效的筛选条件，用于刷新列表

  // 高级筛选（时间范围、所有者等）
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [ownerFilter, setOwnerFilter] = useState(""); // 仅管理员可用
  const [ownerOptions, setOwnerOptions] = useState([]); // 所有者下拉选项
  const [lockedFilter, setLockedFilter] = useState("");

  // ============ 视图和分页 ============
  // 视图模式会持久化到localStorage，下次打开还是上次的选择
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("dashboardViewMode") || "grid";
    } catch {
      return "grid";
    }
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 模态框状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isTemplatePanelOpen, setTemplatePanelOpen] = useState(false);

  // 新建文档表单
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocCategory, setNewDocCategory] = useState("");
  const [newDocTags, setNewDocTags] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newDocFormat, setNewDocFormat] = useState("rich");
  const [newDocMarkdown, setNewDocMarkdown] = useState("");

  // 导入导出
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [exportFormat, setExportFormat] = useState(() => {
    try {
      return localStorage.getItem("singleExportFormat") || "json";
    } catch {
      return "json";
    }
  });
  const [bulkExportFormat, setBulkExportFormat] = useState(() => {
    try {
      return localStorage.getItem("bulkExportFormat") || "json";
    } catch {
      return "json";
    }
  });
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkExportMessage, setBulkExportMessage] = useState("");

  // ============ 数据加载 ============

  // 加载文档列表，支持多条件筛选
  const loadDocuments = useCallback(
    async (filters = {}) => {
      const normalizedFilters = {
        sort: filters.sort || "updated_at",
        order: filters.order || "desc",
      };

      // 添加可选筛选条件
      if (filters.q) normalizedFilters.q = filters.q;
      if (filters.category) normalizedFilters.category = filters.category;
      if (filters.tag) normalizedFilters.tag = filters.tag;
      if (filters.createdFrom) normalizedFilters.createdFrom = filters.createdFrom;
      if (filters.createdTo) normalizedFilters.createdTo = filters.createdTo;
      if (filters.updatedFrom) normalizedFilters.updatedFrom = filters.updatedFrom;
      if (filters.updatedTo) normalizedFilters.updatedTo = filters.updatedTo;
      if (filters.locked) normalizedFilters.locked = filters.locked;
      if (filters.owner && isAdmin) normalizedFilters.owner = filters.owner;

      try {
        // 开始加载
        setLoading(true);
        const response = await api.get("/documents", { params: normalizedFilters });
        const docs = response.data.map((doc) => ({ ...doc, tags: toArray(doc.tags) }));
        setDocuments(docs);
        setError("");
        setActiveFilters(normalizedFilters);

        // 管理员模式：收集文档所有者信息
        if (isAdmin) {
          const ownerMap = new Map();
          docs.forEach((doc) => {
            if (doc.owner_id && !ownerMap.has(doc.owner_id)) {
              ownerMap.set(doc.owner_id, {
                id: doc.owner_id,
                label: doc.owner_name || doc.owner_email || `用户${doc.owner_id}`,
              });
            }
          });
          setOwnerOptions(Array.from(ownerMap.values()));
        }

        // 清理无效的选中项
        setSelectedDocs((prev) => {
          const filtered = prev.filter((id) => docs.some((doc) => doc.id === id));
          try {
            localStorage.setItem("selectedDocs", JSON.stringify(filtered));
          } catch (err) {
            console.warn("保存选中状态失败:", err);
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

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const response = await api.get("/documents/templates");
      const normalized = response.data.map((t) => ({ ...t, tags: toArray(t.tags) }));
      setTemplates(normalized.sort((a, b) => a.id - b.id));
      setTemplateError("");
    } catch (err) {
      console.error("获取模板列表失败:", err);
      setTemplateError("无法加载模板库，请稍后重试。");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // ============ 生命周期 ============
  // 初始加载文档和模板
  useEffect(() => {
    loadDocuments({ sort: "updated_at", order: "desc" });
  }, [loadDocuments]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 导入模态框关闭时重置状态
  useEffect(() => {
    if (!showImportModal) {
      setImportStatus("");
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [showImportModal]);

  // 创建文档模态框关闭时重置表单
  useEffect(() => {
    if (!showCreateModal) setTemplatePanelOpen(false);
  }, [showCreateModal]);

  // 视图模式变化时持久化到localStorage
  useEffect(() => {
    try {
      localStorage.setItem("dashboardViewMode", viewMode);
    } catch (err) {
      console.warn("保存视图模式失败:", err);
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem("singleExportFormat", exportFormat);
    } catch (err) {
      console.warn("保存导出格式失败:", err);
    }
  }, [exportFormat]);

  useEffect(() => {
    try {
      localStorage.setItem("bulkExportFormat", bulkExportFormat);
    } catch (err) {
      console.warn("保存批量导出格式失败:", err);
    }
  }, [bulkExportFormat]);

  // 搜索防抖处理
  useEffect(() => {
    // 搜索词使用更长的防抖时间，其他筛选立即执行
    const delay = searchTerm ? 800 : 200;
    const timer = setTimeout(() => {
      setCurrentPage(1);
      // 正确解析排序字段和顺序（例如 "updated_at_desc" -> field: "updated_at", order: "desc"）
      const lastUnderscoreIndex = sortBy.lastIndexOf("_");
      const field = sortBy.substring(0, lastUnderscoreIndex) || "updated_at";
      const order = sortBy.substring(lastUnderscoreIndex + 1) || "desc";

      loadDocuments({
        q: searchTerm,
        category: selectedCategory,
        tag: selectedTag,
        sort: field,
        order: order,
        createdFrom,
        createdTo,
        updatedFrom,
        updatedTo,
        locked: lockedFilter,
        owner: ownerFilter,
      });
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchTerm,
    selectedCategory,
    selectedTag,
    sortBy,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    lockedFilter,
    ownerFilter,
  ]);

  // ============ 计算属性 ============
  // 处理搜索栏变化
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  // 处理分类筛选变化
  const handleCategoryChange = useCallback((value) => {
    setSelectedCategory(value);
  }, []);

  // 处理排序变化
  const handleSortChange = useCallback((value) => {
    setSortBy(value);
  }, []);

  // 处理视图变化
  const handleViewModeChange = useCallback((value) => {
    setViewMode(value);
  }, []);

  // 计算所有分类和标签，用于筛选下拉框
  const categories = useMemo(() => {
    return dedupe([
      ...documents.map((d) => d.category).filter(Boolean),
      ...templates.map((t) => t.category).filter(Boolean),
    ]);
  }, [documents, templates]);

  const tags = useMemo(() => {
    const tagPool = [];
    documents.forEach((d) => toArray(d.tags).forEach((tag) => tagPool.push(tag)));
    templates.forEach((t) => toArray(t.tags).forEach((tag) => tagPool.push(tag)));
    return dedupe(tagPool);
  }, [documents, templates]);

  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return documents.slice(startIndex, startIndex + pageSize);
  }, [documents, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(documents.length / pageSize);
  }, [documents.length, pageSize]);

  const allSelected = documents.length > 0 && selectedDocs.length === documents.length;

  // ============ 事件处理 ============
  const handleSearch = useCallback(() => {
    // 正确解析排序字段和顺序
    const lastUnderscoreIndex = sortBy.lastIndexOf("_");
    const field = sortBy.substring(0, lastUnderscoreIndex) || "updated_at";
    const order = sortBy.substring(lastUnderscoreIndex + 1) || "desc";

    loadDocuments({
      q: searchTerm,
      category: selectedCategory,
      tag: selectedTag,
      sort: field,
      order: order,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      locked: lockedFilter,
      owner: ownerFilter,
    });
  }, [
    searchTerm,
    selectedCategory,
    selectedTag,
    sortBy,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    lockedFilter,
    ownerFilter,
    loadDocuments,
  ]);

  // 处理单个文档选中/取消选中
  const handleSelectDoc = useCallback((docId) => {
    setSelectedDocs((prev) => {
      const newSelection = prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId];
      try {
        localStorage.setItem("selectedDocs", JSON.stringify(newSelection));
      } catch (err) {
        console.warn("保存选中状态失败:", err);
      }
      return newSelection;
    });
  }, []);

  // 处理全选/取消全选
  const handleSelectAllDocs = useCallback(
    (checked) => {
      const newSelection = checked ? documents.map((d) => d.id) : [];
      setSelectedDocs(newSelection);
      try {
        localStorage.setItem("selectedDocs", JSON.stringify(newSelection));
      } catch (err) {
        console.warn("保存选中状态失败:", err);
      }
    },
    [documents]
  );

  // 处理删除文档
  const handleDeleteDoc = useCallback(
    async (docId) => {
      if (!confirm("确定要删除这个文档吗？")) return;

      try {
        await api.delete(`/documents/${docId}`);
        toast.success("文档已删除");
        loadDocuments(activeFilters);
      } catch (err) {
        console.error("删除文档失败:", err);
        toast.error("删除文档失败");
      }
    },
    [activeFilters, toast]
  );

  // 处理批量删除
  const handleBulkDelete = useCallback(async () => {
    if (selectedDocs.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedDocs.length} 个文档吗？`)) return;

    try {
      await Promise.all(selectedDocs.map((id) => api.delete(`/documents/${id}`)));
      toast.success(`成功删除 ${selectedDocs.length} 个文档`);
      setSelectedDocs([]);
      localStorage.removeItem("selectedDocs");
      loadDocuments(activeFilters);
    } catch (err) {
      console.error("批量删除失败:", err);
      toast.error("批量删除失败");
    }
  }, [selectedDocs, activeFilters, toast]);

  // 处理单个文档导出
  const handleExportDoc = useCallback(
    async (docId, format = "json") => {
      try {
        const response = await api.get(`/documents/${docId}/export`, {
          params: { format },
          responseType: "blob",
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;

        const targetDoc = documents.find((doc) => doc.id === docId);
        const fallbackBase = sanitizeFileName(targetDoc?.title || `document_${docId}`);
        const fallbackFileName = `${fallbackBase}.${format}`;
        const disposition =
          response.headers?.["content-disposition"] || response.headers?.["Content-Disposition"];
        const resolvedFileName = extractFileNameFromDisposition(disposition) || fallbackFileName;

        link.setAttribute("download", resolvedFileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("文档导出成功");
      } catch (err) {
        console.error("导出文档失败:", err);
        toast.error(err.response?.data?.message || "导出文档失败");
      }
    },
    [documents, toast]
  );

  // 处理批量导出
  const handleBulkExport = useCallback(async () => {
    if (selectedDocs.length === 0) return;

    const ids = selectedDocs
      .map((id) => (typeof id === "number" ? id : parseInt(id, 10)))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (ids.length === 0) {
      toast.error("请选择有效的文档进行导出");
      return;
    }

    setBulkExporting(true);
    setBulkExportMessage("正在打包文档...");

    try {
      const response = await api.post(
        "/documents/export/bulk",
        { ids, format: bulkExportFormat },
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const disposition =
        response.headers?.["content-disposition"] || response.headers?.["Content-Disposition"];
      const bulkFileName =
        extractFileNameFromDisposition(disposition) || `documents_${Date.now()}.zip`;
      link.setAttribute("download", bulkFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`成功导出 ${ids.length} 个文档`);
      setBulkExportMessage("");
    } catch (err) {
      console.error("批量导出失败:", err);
      toast.error(err.response?.data?.message || "批量导出失败");
      setBulkExportMessage("");
    } finally {
      setBulkExporting(false);
    }
  }, [selectedDocs, bulkExportFormat, toast]);

  // 处理创建文档
  const handleCreateDoc = async () => {
    if (!newDocTitle.trim()) {
      toast.error("请输入文档标题");
      return;
    }

    try {
      const payload = {
        title: newDocTitle.trim(),
        category: newDocCategory,
        tags: newDocTags
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
        contentFormat: newDocFormat,
      };

      if (selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      }

      if (newDocFormat === "markdown") {
        payload.markdownContent = newDocMarkdown || "";
      }

      const response = await api.post("/documents", payload);
      toast.success("文档创建成功");
      setShowCreateModal(false);

      // 重置表单
      setNewDocTitle("");
      setNewDocCategory("");
      setNewDocTags("");
      setSelectedTemplateId("");
      setNewDocMarkdown("");

      loadDocuments(activeFilters);
    } catch (err) {
      console.error("创建文档失败:", err);
      toast.error("创建文档失败");
    }
  };

  // 处理选择模板
  const handleSelectTemplate = useCallback(
    (template) => {
      // 模板 API 返回的字段名是 name，不是 title
      const templateName = template.name || template.title || "未命名模板";
      setSelectedTemplateId(template.id);
      setNewDocTitle(templateName);
      setNewDocCategory(template.category || "");
      setNewDocTags((toArray(template.tags) || []).join(", "));
      setNewDocFormat(template.format || template.editorType || "rich");
      setTemplatePanelOpen(false);
      toast.success(`已选择模板：${templateName}`);
    },
    [toast]
  );

  // 处理导入文档
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus("正在导入文档...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post("/documents/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("文档导入成功");
      setShowImportModal(false);
      loadDocuments(activeFilters);
    } catch (err) {
      console.error("导入文档失败:", err);
      setImportStatus("导入失败，请检查文件格式");
      toast.error("导入文档失败");
    } finally {
      setImporting(false);
    }
  };

  // ============ 渲染 ============
  if (loading && documents.length === 0) {
    return (
      <div className="dashboard-container">
        <SkeletonScreen type="dashboard" />
      </div>
    );
  }

  return (
    <div className="dashboard-container fade-in-up">
      {/* 头部操作栏 */}
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <h1 className="dashboard-title text-gradient">我的文档</h1>
          <p className="dashboard-subtitle">
            {searchTerm ? `找到 ${documents.length} 个文档` : `共 ${documents.length} 个文档`}
          </p>
        </div>
        <div className="dashboard-header-right">
          <button className="dashboard-btn" onClick={() => setShowImportModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            导入
          </button>
          <button
            className="dashboard-btn-primary shimmer-effect"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建文档
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <FilterBar
        searchQuery={searchTerm}
        onSearchChange={handleSearchChange}
        categoryFilter={selectedCategory}
        onCategoryChange={handleCategoryChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        categories={categories}
      />

      {/* 错误提示 */}
      {error && <div className="dashboard-error">{error}</div>}

      {/* 文档列表 */}
      {documents.length === 0 ? (
        <EmptyState
          icon={searchTerm ? "🔍" : "📝"}
          title={searchTerm ? "没有找到相关文档" : "还没有文档"}
          description={
            searchTerm
              ? `搜索 "${searchTerm}" 没有结果，试试其他关键词`
              : "创建你的第一个文档开始协作吧"
          }
          action={
            !searchTerm
              ? {
                  text: "新建文档",
                  onClick: () => setShowCreateModal(true),
                }
              : null
          }
        />
      ) : (
        <div className={viewMode === "grid" ? "dashboard-grid-view" : "dashboard-list-view"}>
          {viewMode === "grid"
            ? paginatedDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  isSelected={selectedDocs.includes(doc.id)}
                  onSelect={handleSelectDoc}
                  onDelete={handleDeleteDoc}
                  onExport={handleExportDoc}
                />
              ))
            : paginatedDocuments.map((doc) => (
                <DocumentListItem
                  key={doc.id}
                  doc={doc}
                  isSelected={selectedDocs.includes(doc.id)}
                  onSelect={handleSelectDoc}
                  onDelete={handleDeleteDoc}
                  onExport={handleExportDoc}
                />
              ))}
        </div>
      )}

      {/* 分页 */}
      {documents.length > 0 && totalPages > 1 && (
        <div className="dashboard-pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage((p) => p - 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            上一页
          </button>
          <span>
            第 {currentPage} / {totalPages} 页
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => {
              setCurrentPage((p) => p + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            下一页
          </button>
        </div>
      )}

      {/* 批量操作工具栏 */}
      <BulkActions
        selectedCount={selectedDocs.length}
        onExport={handleBulkExport}
        onDelete={handleBulkDelete}
        onDeselectAll={() => {
          setSelectedDocs([]);
          localStorage.removeItem("selectedDocs");
        }}
        exportFormat={bulkExportFormat}
        onFormatChange={setBulkExportFormat}
        exporting={bulkExporting}
        exportOptions={EXPORT_FORMAT_OPTIONS}
        statusMessage={bulkExportMessage}
      />

      {/* 创建文档模态框 */}
      <Modal
        visible={showCreateModal}
        title="新建文档"
        onClose={() => setShowCreateModal(false)}
        width="700px"
      >
        {isTemplatePanelOpen ? (
          <TemplateSelector
            templates={templates}
            loading={templatesLoading}
            error={templateError}
            onSelect={handleSelectTemplate}
            onClose={() => setTemplatePanelOpen(false)}
          />
        ) : (
          <div className="create-doc-form">
            {/* 已选择模板提示 */}
            {selectedTemplateId && (
              <div className="form-group template-selected-info">
                <div className="template-info-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  已选择模板：{newDocTitle || "未命名"}
                  <button
                    type="button"
                    className="template-clear-btn"
                    onClick={() => {
                      setSelectedTemplateId("");
                      setNewDocTitle("");
                      setNewDocCategory("");
                      setNewDocTags("");
                      toast.info("已清除模板选择");
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>文档标题 *</label>
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="请输入文档标题"
              />
            </div>
            <div className="form-group">
              <label>分类</label>
              <div className="category-input-group">
                <input
                  type="text"
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value)}
                  placeholder="输入或选择分类"
                  list="category-options"
                />
                <datalist id="category-options">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="form-group">
              <label>标签</label>
              <input
                type="text"
                value={newDocTags}
                onChange={(e) => setNewDocTags(e.target.value)}
                placeholder="多个标签用逗号分隔"
              />
            </div>
            <div className="form-group">
              <label>编辑器类型</label>
              <select value={newDocFormat} onChange={(e) => setNewDocFormat(e.target.value)}>
                <option value="rich">富文本</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setTemplatePanelOpen(true)}>
                从模板创建
              </button>
              <button className="btn-primary" onClick={handleCreateDoc}>
                创建
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 导入文档模态框 */}
      <Modal visible={showImportModal} title="导入文档" onClose={() => setShowImportModal(false)}>
        <div className="import-doc-form">
          <p>选择要导入的文档文件（支持 JSON、Markdown、Word 格式）</p>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,.md,.docx"
            onChange={handleImport}
            disabled={importing}
          />
          {importStatus && <p className="import-status">{importStatus}</p>}
        </div>
      </Modal>
    </div>
  );
}

export default Dashboard;
