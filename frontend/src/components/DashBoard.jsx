/**
 * Dashboard - 文档管理仪表盘组件（重构版）
 * 
 * 功能概述：
 * 这是应用的主要工作界面，提供完整的文档管理功能
 * 
 * 核心功能：
 * 1. 文档列表展示（支持网格/列表视图切换）
 * 2. 文档创建（支持从模板创建、富文本/Markdown格式）
 * 3. 文档搜索和筛选（多条件组合筛选）
 * 4. 批量操作（批量删除、批量导出）
 * 5. 文档导入导出（支持JSON/Markdown/PDF/Word格式）
 * 6. 模板管理（模板选择器面板）
 * 7. 分页和排序
 * 8. 文档分享（通过ShareModal）
 * 
 * 状态管理：
 * - 文档列表和加载状态
 * - 模板列表和加载状态
 * - 搜索词、分类、标签筛选
 * - 高级筛选（创建/更新时间范围、所有者、锁定状态）
 * - 排序方式（按更新时间/创建时间/标题）
 * - 视图模式（网格/列表）
 * - 分页状态
 * - 选中的文档列表（用于批量操作）
 * - 各种模态框显示状态
 * - 新建文档表单数据
 * - 导入导出状态
 * 
 * 子组件：
 * - FilterBar: 顶部筛选栏（搜索、分类、标签、排序、视图切换）
 * - BulkActions: 批量操作工具栏
 * - TemplateSelector: 模板选择器面板
 * - DocumentCard: 网格视图下的文档卡片
 * - DocumentListItem: 列表视图下的文档列表项
 * - Modal: 通用模态框（创建文档、导入文档）
 * - ShareModal: 分享文档模态框
 * - EmptyState: 空状态提示
 * - SkeletonScreen: 骨架屏加载动画
 * 
 * 持久化存储：
 * - selectedDocs: 选中的文档ID列表（localStorage）
 * - dashboardViewMode: 视图模式（localStorage）
 * - documentExportFormats: 每个文档的导出格式偏好（localStorage）
 * 
 * 性能优化：
 * - 使用useMemo缓存计算结果（分类列表、标签列表、分页数据）
 * - 使用useCallback缓存回调函数，避免子组件不必要的重新渲染
 * - 防抖搜索（避免频繁请求）
 * 
 * 权限管理：
 * - 管理员：可以查看所有用户的文档，可以按所有者筛选
 * - 普通用户：只能查看自己的文档和被分享的文档
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.user - 当前登录用户对象
 * @param {string} props.user.id - 用户ID
 * @param {string} props.user.role - 用户角色（admin/user）
 * @param {string} props.user.email - 用户邮箱
 * @param {string} props.user.full_name - 用户全名
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/components/DashBoard-modern.css";
import "../styles/components/dashboard/CreateDocForm.css";
import "../styles/components/dashboard/VirtualizedDocumentList.css";

// 导入子组件
import FilterBar from "./dashboard/FilterBar";
import BulkActions from "./dashboard/BulkActions";
import TemplateSelector from "./dashboard/TemplateSelector";
import Modal from "./common/Modal";
import ShareModal from "./ShareModal";
import EmptyState from "./EmptyState";
import { useToast } from "./ToastContainer";
import SkeletonScreen from "./common/SkeletonScreen";
import DocumentCard from "./dashboard/DocumentCard";
import DocumentListItem from "./dashboard/DocumentListItem";

// 导入工具函数
import { toArray, dedupe } from "../utils";
import { formatRelativeTime, formatFullTime } from "../utils/timeUtils";

function Dashboard({ user }) {
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  const importInputRef = useRef(null);

  // ==================== 状态管理 ====================
  // 文档相关
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDocs, setSelectedDocs] = useState(() => {
    try {
      const saved = localStorage.getItem("selectedDocs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 模板相关
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateError, setTemplateError] = useState("");

  // 筛选和排序
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [sortBy, setSortBy] = useState("updated_at_desc");
  const [activeFilters, setActiveFilters] = useState({});

  // 高级筛选
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [lockedFilter, setLockedFilter] = useState("");

  // 视图和分页
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
  const [exportFormat, setExportFormat] = useState("json");
  const [bulkExportFormat, setBulkExportFormat] = useState("json");
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkExportMessage, setBulkExportMessage] = useState("");
  const [documentExportFormats, setDocumentExportFormats] = useState(() => {
    try {
      const saved = localStorage.getItem("documentExportFormats");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // ==================== 数据加载 ====================
  /**
   * 加载文档列表
   * 
   * 功能：从后端API获取文档列表，支持多条件筛选和排序
   * 
   * @param {Object} filters - 筛选条件对象
   * @param {string} [filters.q] - 搜索关键词（搜索标题、分类、标签）
   * @param {string} [filters.category] - 分类筛选
   * @param {string} [filters.tag] - 标签筛选
   * @param {string} [filters.sort='updated_at'] - 排序字段（updated_at/created_at/title）
   * @param {string} [filters.order='desc'] - 排序方向（asc/desc）
   * @param {string} [filters.createdFrom] - 创建时间起始
   * @param {string} [filters.createdTo] - 创建时间结束
   * @param {string} [filters.updatedFrom] - 更新时间起始
   * @param {string} [filters.updatedTo] - 更新时间结束
   * @param {string} [filters.locked] - 锁定状态筛选（true/false）
   * @param {string} [filters.owner] - 所有者筛选（仅管理员可用）
   * 
   * 副作用：
   * - 更新documents状态
   * - 更新loading状态
   * - 更新error状态
   * - 保存activeFilters用于刷新列表
   * - 重置当前页码为1
   * - 如果是管理员，还会更新ownerOptions（所有者选项列表）
   */
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

  /**
   * 加载文档模板列表
   * 
   * 功能：从后端API获取所有可用的文档模板
   * 
   * 模板用途：
   * - 用户创建新文档时可以选择模板
   * - 模板包含预定义的内容、分类、标签和格式
   * - 支持公开模板和私有模板
   * 
   * 副作用：
   * - 更新templates状态
   * - 更新templatesLoading状态
   * - 更新templateError状态
   * - 标准化模板的tags字段为数组格式
   */
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

  // ==================== 生命周期 ====================
  useEffect(() => {
    loadDocuments({ sort: "updated_at", order: "desc" });
  }, [loadDocuments]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!showImportModal) {
      setImportStatus("");
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [showImportModal]);

  useEffect(() => {
    if (!showCreateModal) setTemplatePanelOpen(false);
  }, [showCreateModal]);

  useEffect(() => {
    try {
      localStorage.setItem("dashboardViewMode", viewMode);
    } catch (err) {
      console.warn("保存视图模式失败:", err);
    }
  }, [viewMode]);

  // 搜索和筛选的统一处理 - 优化防抖避免过度触发
  useEffect(() => {
    // 搜索词使用更长的防抖时间，其他筛选立即执行
    const delay = searchTerm ? 800 : 200;
    const timer = setTimeout(() => {
      setCurrentPage(1);
      // 修复：正确解析排序字段和顺序（例如 "updated_at_desc" -> field: "updated_at", order: "desc"）
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
  }, [searchTerm, selectedCategory, selectedTag, sortBy, createdFrom, createdTo, updatedFrom, updatedTo, lockedFilter, ownerFilter]);

  // ==================== 计算属性 ====================
  // \u7f13\u5b58\u56de\u8c03\u51fd\u6570\uff0c\u907f\u514d FilterBar \u4e0d\u5fc5\u8981\u7684\u91cd\u65b0\u6e32\u67d3
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  const handleCategoryChange = useCallback((value) => {
    setSelectedCategory(value);
  }, []);

  const handleSortChange = useCallback((value) => {
    setSortBy(value);
  }, []);

  const handleViewModeChange = useCallback((value) => {
    setViewMode(value);
  }, []);

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

  // ==================== 事件处理 ====================
  const handleSearch = useCallback(() => {
    // 修复：正确解析排序字段和顺序
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

  // 删除了重复的 useEffect

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

  const handleSelectAllDocs = useCallback((checked) => {
    const newSelection = checked ? documents.map((d) => d.id) : [];
    setSelectedDocs(newSelection);
    try {
      localStorage.setItem("selectedDocs", JSON.stringify(newSelection));
    } catch (err) {
      console.warn("保存选中状态失败:", err);
    }
  }, [documents]);

  const handleDeleteDoc = useCallback(async (docId) => {
    if (!confirm("确定要删除这个文档吗？")) return;

    try {
      await api.delete(`/documents/${docId}`);
      toast.success("文档已删除");
      loadDocuments(activeFilters);
    } catch (err) {
      console.error("删除文档失败:", err);
      toast.error("删除文档失败");
    }
  }, [activeFilters, toast]);

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

  const handleExportDoc = useCallback(async (docId) => {
    const format = documentExportFormats[docId] || exportFormat;
    try {
      const response = await api.post(
        `/documents/${docId}/export`,
        { format },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `document_${docId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("文档导出成功");
    } catch (err) {
      console.error("导出文档失败:", err);
      toast.error("导出文档失败");
    }
  }, [documentExportFormats, exportFormat, toast]);

  const handleBulkExport = useCallback(async () => {
    if (selectedDocs.length === 0) return;

    setBulkExporting(true);
    setBulkExportMessage("正在打包文档...");

    try {
      const response = await api.post(
        "/documents/export/bulk",
        { documentIds: selectedDocs, format: bulkExportFormat },
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `documents_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`成功导出 ${selectedDocs.length} 个文档`);
      setBulkExportMessage("");
    } catch (err) {
      console.error("批量导出失败:", err);
      toast.error("批量导出失败");
      setBulkExportMessage("");
    } finally {
      setBulkExporting(false);
    }
  }, [selectedDocs, exportFormat, toast]);

  const handleCreateDoc = async () => {
    if (!newDocTitle.trim()) {
      toast.error("请输入文档标题");
      return;
    }

    try {
      const payload = {
        title: newDocTitle,
        category: newDocCategory,
        tags: newDocTags.split(",").map((t) => t.trim()).filter(Boolean),
        editorType: newDocFormat,
      };

      if (selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      }

      if (newDocFormat === "markdown" && newDocMarkdown) {
        payload.content = newDocMarkdown;
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

  const handleSelectTemplate = useCallback((template) => {
    // 模板 API 返回的字段名是 name，不是 title
    const templateName = template.name || template.title || "未命名模板";
    setSelectedTemplateId(template.id);
    setNewDocTitle(templateName);
    setNewDocCategory(template.category || "");
    setNewDocTags((toArray(template.tags) || []).join(", "));
    setNewDocFormat(template.format || template.editorType || "rich");
    setTemplatePanelOpen(false);
    toast.success(`已选择模板：${templateName}`);
  }, [toast]);

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

  // ==================== 渲染部分 ====================
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
          <p className="dashboard-subtitle">共 {documents.length} 个文档</p>
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
          <button className="dashboard-btn-primary shimmer-effect" onClick={() => setShowCreateModal(true)}>
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
          description={searchTerm ? `搜索 "${searchTerm}" 没有结果，试试其他关键词` : "创建你的第一个文档开始协作吧"}
          action={!searchTerm ? {
            text: "新建文档",
            onClick: () => setShowCreateModal(true)
          } : null}
        />
      ) : (
        <div className={viewMode === 'grid' ? 'dashboard-grid-view' : 'dashboard-list-view'}>
          {viewMode === 'grid' ? (
            paginatedDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isSelected={selectedDocs.includes(doc.id)}
                onSelect={handleSelectDoc}
                onDelete={handleDeleteDoc}
                onExport={handleExportDoc}
              />
            ))
          ) : (
            paginatedDocuments.map((doc) => (
              <DocumentListItem
                key={doc.id}
                doc={doc}
                isSelected={selectedDocs.includes(doc.id)}
                onSelect={handleSelectDoc}
                onDelete={handleDeleteDoc}
                onExport={handleExportDoc}
              />
            ))
          )}
        </div>
      )}

      {/* 分页 */}
      {documents.length > 0 && totalPages > 1 && (
        <div className="dashboard-pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            上一页
          </button>
          <span>
            第 {currentPage} / {totalPages} 页
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
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
              <select value={newDocCategory} onChange={(e) => setNewDocCategory(e.target.value)}>
                <option value="">选择分类</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
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
      <Modal
        visible={showImportModal}
        title="导入文档"
        onClose={() => setShowImportModal(false)}
      >
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
