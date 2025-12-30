/**
 * 编辑器主页面 - 多人实时协作文档编辑
 *
 * 这是整个系统最核心的页面，实现了完整的在线文档编辑功能。
 *
 * 核心技术：
 * - 富文本编辑：使用Quill编辑器，内容用Delta格式存储
 * - 实时协作：通过Socket.io实现，多人同时编辑时能看到彼此的修改
 * - 光标同步：能看到其他在线用户的光标位置
 *
 * 主要功能：
 * - 支持富文本和Markdown两种编辑模式
 * - 版本历史：可以查看、对比、恢复历史版本
 * - 文档锁定：防止编辑冲突，锁定后其他人只能查看
 * - 协作功能：评论、任务分配、实时聊天、文件共享、视频会议
 *
 * 权限控制：
 * - viewer：只能查看，不能编辑
 * - editor：可以编辑内容
 * - owner：文档所有者，可以管理权限和删除文档
 * - admin：管理员，拥有所有权限
 */
import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import "../styles/pages/EditorPage.css";
import api from "../api";
import io from "socket.io-client";
import DOMPurify from "dompurify"; // 防XSS攻击，净化HTML
import { marked } from "marked"; // Markdown转HTML
import EditorSkeleton from "../components/EditorSkeleton";
import ShareModal from "../components/ShareModal";
import LoadingSpinner from "../components/common/LoadingSpinner";

// 自定义链接格式：自动补全协议并在新窗口打开
const LinkBlot = Quill.import("formats/link");
class CustomLink extends LinkBlot {
  static create(value) {
    const node = super.create(value);
    let href = value;
    // 自动补全 http:// 协议
    if (href && !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !/^tel:/i.test(href)) {
      href = "http://" + href;
    }
    node.setAttribute("href", href);
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
    return node;
  }

  static sanitize(url) {
    // 自动补全协议
    if (url && !/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !/^tel:/i.test(url)) {
      url = "http://" + url;
    }
    return super.sanitize(url);
  }
}
CustomLink.blotName = "link";
CustomLink.tagName = "A";
Quill.register(CustomLink, true);

// 懒加载侧边面板组件
// 这些面板不是每次都用到，懒加载可以加快首屏速度
const CommentsPanel = lazy(() => import("../components/CommentsPanel"));
const TasksPanel = lazy(() => import("../components/TasksPanel"));
const ChatPanel = lazy(() => import("../components/ChatPanel"));
const FilePanel = lazy(() => import("../components/FilePanel"));
const NotificationsPanel = lazy(() => import("../components/NotificationsPanel"));
const VideoConferencePanel = lazy(() => import("../components/VideoConferencePanel"));

// 导入工具函数
import { cloneDelta, deltasEqual } from "../utils/objectUtils";
import { toArray, parseTagsInput } from "../utils/arrayUtils";
import { stringToColor } from "../utils/stringUtils";
import { EditorToolbar, EditorStatusBar, EditorSidebar } from "../components/editor";

// 自动保存间隔：用户停止输入2秒后触发保存
const SAVE_INTERVAL_MS = 2000;

// 预加载面板：鼠标悬停在按钮上时提前加载对应组件
// 这样用户点击时组件已经加载好了，体验更流畅
const preloadPanel = (panelName) => {
  switch (panelName) {
    case "comments":
      import("../components/CommentsPanel");
      break;
    case "tasks":
      import("../components/TasksPanel");
      break;
    case "chat":
      import("../components/ChatPanel");
      break;
    case "files":
      import("../components/FilePanel");
      break;
    case "notifications":
      import("../components/NotificationsPanel");
      break;
    case "video":
      import("../components/VideoConferencePanel");
      break;
  }
};

function EditorPage({ user }) {
  const { documentId } = useParams(); // 从URL获取文档ID

  // ===== 文档内容状态 =====
  const [title, setTitle] = useState("");
  const [content, setContent] = useState({ ops: [{ insert: "\n" }] }); // Quill用的Delta格式
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState(""); // 标签输入框，逗号分隔
  const [contentFormat, setContentFormat] = useState("rich"); // "rich"富文本 或 "markdown"
  const [markdownValue, setMarkdownValue] = useState("");
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  // ===== 实时协作状态 =====
  const [socket, setSocket] = useState(null); // Socket.io连接实例
  const [onlineUsers, setOnlineUsers] = useState([]); // 当前在线的协作者

  // ===== 权限和锁定状态 =====
  const [isEditor, setIsEditor] = useState(false); // 当前用户是否有编辑权限
  const [isLocked, setIsLocked] = useState(false); // 文档是否被锁定
  const [lockedBy, setLockedBy] = useState(null); // 锁定者信息
  const [lockProcessing, setLockProcessing] = useState(false);

  // ===== 界面状态 =====
  const [saveStatus, setSaveStatus] = useState("连接中...");
  const [documentLoading, setDocumentLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  // ===== 版本历史状态 =====
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [previewVersion, setPreviewVersion] = useState(null); // 正在预览的版本
  const [previewContent, setPreviewContent] = useState(null); // 预览版本的内容
  const [previewMarkdown, setPreviewMarkdown] = useState("");

  const quillRef = useRef(null); // Quill编辑器实例引用
  const skipContentSyncRef = useRef(false); // 避免本地输入时重复同步
  const scrollLockOffsetRef = useRef(0); // 记录滚动条位置用于解锁还原
  const scrollLockedRef = useRef(false); // 标记当前是否已锁定滚动

  // 统计文档字数，根据编辑模式用不同的计算方式
  const wordCount = useMemo(() => {
    if (contentFormat === "markdown") {
      const text = markdownValue.replace(/[#*\-_`>\[\]()]/g, "").trim();
      return text.length;
    } else {
      if (!content || !content.ops) return 0;
      return content.ops.reduce((count, op) => {
        if (typeof op.insert === "string") {
          return count + op.insert.replace(/\n/g, "").length;
        }
        return count;
      }, 0);
    }
  }, [contentFormat, markdownValue, content]);

  // 版本对比相关状态
  const [compareFrom, setCompareFrom] = useState(null);
  const [compareTo, setCompareTo] = useState(null);
  const [diffHtml, setDiffHtml] = useState("");
  const [diffError, setDiffError] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  // 评论相关状态
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedText, setSelectedText] = useState(null); // 选中的文本用于创建评论
  // 任务相关状态
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  // 聊天相关状态
  const [showChat, setShowChat] = useState(false);
  // 文件相关状态
  const [showFiles, setShowFiles] = useState(false);
  // 通知相关状态
  const [showNotifications, setShowNotifications] = useState(false);
  // 视频会议相关状态
  const [showVideoConference, setShowVideoConference] = useState(false);
  // 功能开关设置，默认都启用
  const [featureSettings, setFeatureSettings] = useState({
    enable_chat: true,
    enable_comments: true,
    enable_tasks: true,
    enable_notifications: true,
    enable_video_conference: true,
  });

  // Markdown预览HTML
  const markdownPreviewHtml = useMemo(() => {
    if (!showMarkdownPreview) return "";
    const raw = marked.parse(markdownValue || "");
    return DOMPurify.sanitize(raw);
  }, [showMarkdownPreview, markdownValue]);

  // 版本对比的Diff HTML，净化过以防XSS
  const sanitizedDiffHtml = useMemo(() => DOMPurify.sanitize(diffHtml || ""), [diffHtml]);

  // 预览版本的Markdown渲染HTML
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

  const closeAllPanels = useCallback(() => {
    setShowComments(false);
    setShowTasks(false);
    setShowChat(false);
    setShowFiles(false);
    setShowNotifications(false);
    setShowVideoConference(false);
  }, []);

  const sidePanelOpen =
    showComments || showTasks || showChat || showFiles || showNotifications || showVideoConference;
  const overlayActive = showVersionModal || sidePanelOpen;
  const overlayLocked = overlayActive || showShareModal;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const body = document.body;
    if (!body) return undefined;

    const lockScroll = () => {
      if (scrollLockedRef.current) return;
      const currentScroll =
        typeof window !== "undefined" ? window.scrollY || window.pageYOffset : 0;
      scrollLockOffsetRef.current = currentScroll;
      body.style.top = `-${currentScroll}px`;
      body.style.position = "fixed";
      body.style.width = "100%";
      body.style.left = "0";
      body.style.right = "0";
      body.style.overscrollBehavior = "none";
      scrollLockedRef.current = true;
    };

    const unlockScroll = () => {
      if (!scrollLockedRef.current) return;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overscrollBehavior = "";
      body.style.height = "100%";
      body.style.height = "";
      const restoreY = scrollLockOffsetRef.current || 0;
      if (typeof window !== "undefined") {
        window.scrollTo(0, restoreY);
      }
      scrollLockedRef.current = false;
    };

    if (overlayLocked) {
      body.classList.add("editor-overlay-open");
      lockScroll();
      return () => {
        body.classList.remove("editor-overlay-open");
        unlockScroll();
      };
    }

    body.classList.remove("editor-overlay-open");
    unlockScroll();
    return undefined;
  }, [overlayLocked]);

  // 发送文档元数据更新（标题、分类、标签等）
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

  // 加载文档数据，包括内容、权限、锁定状态等
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

      // 检查编辑权限：使用后端返回的 canEdit 字段，或者检查 role 是否为 owner/editor
      // 管理员用户始终可以编辑（除非被其他用户锁定且不是管理员自己锁定的）
      const canEdit =
        doc.canEdit !== undefined
          ? doc.canEdit
          : doc.role === "owner" || doc.role === "editor" || user?.role === "admin";

      const lockedByOther =
        locked && doc.lockedBy && doc.lockedBy.id !== user.id && user.role !== "admin";

      // 管理员即使文档被锁定也可以编辑（除非是自己锁定的，那就不算"被锁定"）
      const editable = canEdit && !lockedByOther;
      setIsEditor(editable);
      if (lockedByOther) {
        const lockerName =
          doc.lockedBy?.full_name || doc.lockedBy?.email || `用户${doc.lockedBy?.id || ""}`;
        setSaveStatus(`已锁定（${lockerName}）`);
      } else {
        setSaveStatus(editable ? "已同步" : "查看模式");
      }

      // 确保内容始终被设置，即使文档被锁定
      // 内容同步到编辑器将在 useEffect 中处理

      // 文档加载完成
      setDocumentLoading(false);
    } catch (error) {
      setDocumentLoading(false);
      console.error("获取文档失败", error);

      // 区分不同的错误类型
      if (error.response) {
        if (error.response.status === 404) {
          setSaveStatus("文档不存在");
          alert("文档不存在，可能已被删除");
          window.location.href = "/";
          return;
        } else if (error.response.status === 403) {
          setSaveStatus("无权访问此文档");
        } else {
          setSaveStatus("加载失败");
        }
      } else {
        setSaveStatus("网络错误");
      }

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

  // 获取评论列表
  const fetchComments = useCallback(async () => {
    if (!user) return;
    try {
      setCommentsLoading(true);
      const response = await api.get(`/documents/${documentId}/comments`);
      setComments(response.data || []);
    } catch (error) {
      console.error("获取评论失败", error);
    } finally {
      setCommentsLoading(false);
    }
  }, [documentId, user]);

  // 获取任务列表
  const fetchTasks = useCallback(async () => {
    if (!user) return;
    try {
      setTasksLoading(true);
      const response = await api.get(`/documents/${documentId}/tasks`);
      setTasks(response.data || []);
    } catch (error) {
      console.error("获取任务失败", error);
    } finally {
      setTasksLoading(false);
    }
  }, [documentId, user]);

  // --- Effect 0: 获取功能开关设置 ---
  useEffect(() => {
    const fetchFeatureSettings = async () => {
      try {
        const response = await api.get("/admin/settings/public");
        setFeatureSettings(response.data);
      } catch (error) {
        console.error("获取功能设置失败:", error);
        // 如果获取失败，使用默认值（所有功能启用）
      }
    };
    fetchFeatureSettings();
  }, []);

  // 切换文档时滚动到顶部
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 100);

    return () => clearTimeout(timer);
  }, [documentId]);

  // Socket连接和数据加载
  useEffect(() => {
    if (!user) return;

    console.log("建立 Socket 连接 - documentId:", documentId);
    const s = io("http://localhost:5000");
    setSocket(s);

    // 直接在这里加载数据，而不是依赖外部函数
    const loadData = async () => {
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
          doc.canEdit !== undefined
            ? doc.canEdit
            : doc.role === "owner" || doc.role === "editor" || user?.role === "admin";

        const lockedByOther =
          locked && doc.lockedBy && doc.lockedBy.id !== user.id && user.role !== "admin";

        const editable = canEdit && !lockedByOther;
        setIsEditor(editable);
        if (lockedByOther) {
          const lockerName =
            doc.lockedBy?.full_name || doc.lockedBy?.email || `用户${doc.lockedBy?.id || ""}`;
          setSaveStatus(`已锁定（${lockerName}）`);
        } else {
          setSaveStatus(editable ? "已同步" : "查看模式");
        }

        setDocumentLoading(false);
      } catch (error) {
        setDocumentLoading(false);
        console.error("获取文档失败", error);

        // 区分不同的错误类型
        if (error.response) {
          if (error.response.status === 404) {
            setSaveStatus("文档不存在");
            alert("文档不存在，可能已被删除");
            window.location.href = "/";
            return;
          } else if (error.response.status === 403) {
            setSaveStatus("无权访问此文档");
          } else {
            setSaveStatus("加载失败");
          }
        } else {
          setSaveStatus("网络错误");
        }

        setIsEditor(false);
        setContent({ ops: [{ insert: "\n" }] });
      }

      // 加载评论和任务
      if (featureSettings.enable_comments) {
        try {
          setCommentsLoading(true);
          const response = await api.get(`/documents/${documentId}/comments`);
          setComments(response.data || []);
        } catch (error) {
          console.error("获取评论失败", error);
        } finally {
          setCommentsLoading(false);
        }
      }

      if (featureSettings.enable_tasks) {
        try {
          setTasksLoading(true);
          const response = await api.get(`/documents/${documentId}/tasks`);
          setTasks(response.data || []);
        } catch (error) {
          console.error("获取任务失败", error);
        } finally {
          setTasksLoading(false);
        }
      }
    };

    loadData();

    s.emit("joinDocument", { documentId, user });

    const receiveChangeHandler = (delta) => {
      if (quillRef.current) {
        quillRef.current.getEditor().updateContents(delta, "silent"); // 静默更新，避免触发本地变更事件
      }
    };
    const updateUserListHandler = (users) => setOnlineUsers(users);

    // 接收评论相关事件
    const newCommentHandler = (comment) => {
      // 确保 parentId 字段存在（处理可能的字段名不一致）
      const parentId = comment.parentId || comment.parent_id || null;

      // 确保时间字段正确（处理可能的格式问题）
      const normalizedComment = {
        ...comment,
        createdAt: comment.createdAt || comment.created_at || comment.CreatedAt || null,
        updatedAt: comment.updatedAt || comment.updated_at || comment.UpdatedAt || null,
        resolvedAt: comment.resolvedAt || comment.resolved_at || comment.ResolvedAt || null,
      };

      setComments((prev) => {
        // 如果是回复（有 parentId）
        if (parentId) {
          // 查找父评论并添加回复
          let found = false;
          const updated = prev.map((c) => {
            if (c.id === parentId) {
              found = true;
              // 检查回复是否已存在（避免重复）
              const existingReplies = c.replies || [];
              if (existingReplies.some((r) => r.id === normalizedComment.id)) {
                return c;
              }
              // 确保回复对象有正确的字段名和结构
              const reply = {
                ...normalizedComment,
                parentId: parentId, // 确保使用 camelCase
                replies: [], // 回复本身没有子回复（目前只支持一级回复）
              };
              return { ...c, replies: [...existingReplies, reply] };
            }
            return c;
          });

          // 如果找到了父评论，返回更新后的列表
          if (found) {
            return updated;
          }

          // 如果没有找到父评论（可能父评论还没加载），先作为根评论添加
          // 这种情况应该很少见，但为了健壮性还是处理一下
          if (prev.some((c) => c.id === normalizedComment.id)) {
            return prev;
          }
          const rootComment = {
            ...normalizedComment,
            parentId: null, // 临时设置为 null，等待父评论加载
            replies: [],
          };
          return [...prev, rootComment];
        }

        // 如果是根评论（没有 parentId）
        // 检查根评论是否已存在（避免重复）
        if (prev.some((c) => c.id === normalizedComment.id)) {
          return prev;
        }
        // 添加到根评论列表，确保字段名正确
        const rootComment = {
          ...normalizedComment,
          parentId: null, // 确保根评论没有 parentId
          replies: normalizedComment.replies || [], // 保留已有的 replies（如果有）
        };
        return [...prev, rootComment];
      });
    };

    // 接收评论更新事件
    const commentUpdatedHandler = (comment) => {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === comment.id) {
            return comment;
          }
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) => (r.id === comment.id ? comment : r)),
            };
          }
          return c;
        })
      );
    };

    // 接收评论删除事件
    const commentDeletedHandler = ({ commentId }) => {
      setComments((prev) =>
        prev
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== commentId),
          }))
      );
    };

    // 接收任务相关事件
    const newTaskHandler = (task) => {
      setTasks((prev) => {
        if (prev.some((t) => t.id === task.id)) {
          return prev;
        }
        return [...prev, task];
      });
    };

    const taskUpdatedHandler = (task) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    };

    const taskDeletedHandler = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };

    s.on("receiveChange", receiveChangeHandler);
    s.on("updateUserList", updateUserListHandler);
    // 只在功能启用时才监听相关事件
    if (featureSettings.enable_comments) {
      s.on("newComment", newCommentHandler);
      s.on("commentUpdated", commentUpdatedHandler);
      s.on("commentDeleted", commentDeletedHandler);
    }
    if (featureSettings.enable_tasks) {
      s.on("newTask", newTaskHandler);
      s.on("taskUpdated", taskUpdatedHandler);
      s.on("taskDeleted", taskDeletedHandler);
    }

    return () => {
      s.off("receiveChange", receiveChangeHandler);
      s.off("updateUserList", updateUserListHandler);
      if (featureSettings.enable_comments) {
        s.off("newComment", newCommentHandler);
        s.off("commentUpdated", commentUpdatedHandler);
        s.off("commentDeleted", commentDeletedHandler);
      }
      if (featureSettings.enable_tasks) {
        s.off("newTask", newTaskHandler);
        s.off("taskUpdated", taskUpdatedHandler);
        s.off("taskDeleted", taskDeletedHandler);
      }
      s.disconnect();
      console.log("断开 Socket 连接 - documentId:", documentId);
    };
  }, [documentId, user?.id, featureSettings.enable_comments, featureSettings.enable_tasks]); // 只依赖真正变化的值

  // 监听元数据更新（标题、分类、标签、锁定状态等）
  useEffect(() => {
    if (!socket) return;

    const handleMetadata = (updates) => {
      if (!updates || typeof updates !== "object") {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(updates, "title")) {
        setTitle((prev) =>
          updates.title !== undefined && prev !== updates.title ? updates.title : prev
        );
      }

      if (Object.prototype.hasOwnProperty.call(updates, "category")) {
        setCategory(updates.category ? updates.category : "");
      }

      if (Object.prototype.hasOwnProperty.call(updates, "tags")) {
        const incomingTags = Array.isArray(updates.tags) ? updates.tags : [];
        setTagsInput(incomingTags.length > 0 ? incomingTags.join(", ") : "");
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

        const editorRoot = editorInstance.root;
        const scrollContainer =
          editorRoot && editorRoot.parentElement ? editorRoot.parentElement : null;

        const shouldSkipContentSync = skipContentSyncRef.current;
        if (shouldSkipContentSync) {
          skipContentSyncRef.current = false;
        }

        // 同步内容（本地输入时跳过，避免光标跳动）
        if (!shouldSkipContentSync && content && content.ops) {
          const current = editorInstance.getContents();
          if (!deltasEqual(current, content)) {
            const previousSelection = editorInstance.getSelection();
            const previousScrollTop = scrollContainer ? scrollContainer.scrollTop : null;

            editorInstance.setContents(cloneDelta(content), "silent");

            if (previousSelection) {
              const documentLength = Math.max(0, editorInstance.getLength() - 1);
              const safeIndex = Math.min(previousSelection.index, documentLength);
              const safeLength = Math.max(
                0,
                Math.min(previousSelection.length || 0, editorInstance.getLength() - safeIndex)
              );
              editorInstance.setSelection(
                {
                  index: safeIndex,
                  length: safeLength,
                },
                "silent"
              );
            }

            if (previousScrollTop !== null && typeof previousScrollTop === "number") {
              scrollContainer.scrollTop = previousScrollTop;
            }
          }
        }

        // 确保编辑器元素可见（如果存在）
        try {
          const container = quillElement.querySelector
            ? quillElement.querySelector(".ql-container")
            : null;
          const editor = quillElement.querySelector
            ? quillElement.querySelector(".ql-editor")
            : null;
          const toolbar = quillElement.querySelector
            ? quillElement.querySelector(".ql-toolbar")
            : null;

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
        .catch((err) => setSaveStatus(err.response?.data?.message || "保存失败"));
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

  // 在离开页面前强制保存
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isEditor || !content) return;

      // 立即保存
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

      // 立即同步保存（不等待响应）
      try {
        api.put(`/documents/${documentId}`, payload);
      } catch (error) {
        console.error("保存失败:", error);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [documentId, title, content, isEditor, category, tagsInput, contentFormat, markdownValue]);

  // 处理内容变化
  const handleQuillChange = (value, delta, source, editor) => {
    if (contentFormat === "markdown") {
      return;
    }
    if (source === "user") {
      skipContentSyncRef.current = true;
    }
    const fullContent = editor.getContents();
    setContent(cloneDelta(fullContent));

    if (source === "user" && isEditor && socket) {
      setSaveStatus("正在输入...");
      socket.emit("documentChange", { documentId, delta });
    }
  };

  // 光标位置变化处理（已禁用远程同步）
  const handleQuillSelectionChange = useCallback((range, oldRange, source) => {
    // 远程光标功能已禁用，不进行任何处理
    return;
  }, []);

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

  // 处理 Markdown 内容变化
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
    if (summary === null) {
      return; // 用户选择取消
    }

    try {
      await api.post(`/documents/${documentId}/versions`, {
        summary: summary.trim() || null,
      });
      alert("已保存当前版本");
      await fetchVersions();
      await fetchDocument();
    } catch (error) {
      console.error("保存版本失败", error);
      alert(error.response?.data?.message || "保存版本失败，请稍后再试。");
    }
  };

  // 打开版本管理模态框
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
      // 获取版本详情
      const response = await api.get(`/documents/${documentId}/versions/${versionId}`);
      const version = response.data;
      const parsedContent = (() => {
        if (!version.content) {
          return { ops: [{ insert: "\n" }] };
        }
        if (typeof version.content === "string") {
          // 富文本内容通常是字符串形式的 JSON
          try {
            return JSON.parse(version.content); // 解析为 Delta 对象
          } catch (error) {
            console.error("解析版本内容失败", error);
            return { ops: [{ insert: "\n" }] };
          }
        }
        return version.content;
      })();

      const versionFormat = version.content_format || "rich"; // 默认富文本格式
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
      await api.post(`/documents/${documentId}/versions/${versionId}/restore`);
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
      const response = await api.get(`/documents/${documentId}/versions/compare`, {
        params: { from: compareFrom, to: compareTo },
      });
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
  const lockButtonLabel = isLocked ? (canUnlock ? "解除锁定" : "已锁定") : "锁定文档";
  const lockButtonDisabled = lockProcessing || (isLocked && !canUnlock);

  const isMarkdownMode = contentFormat === "markdown";

  const handleSaveAsTemplate = async () => {
    if (!isEditor || !content) {
      return;
    }

    const templateName = window.prompt("请输入模板名称", title || "未命名模板");

    if (!templateName || !templateName.trim()) {
      return;
    }

    const descriptionInput = window.prompt("模板描述（可选）", "");
    const sanitizedTags = parseTagsInput(tagsInput);

    setTemplateSaving(true);
    try {
      const payload = {
        name: templateName.trim(),
        description: descriptionInput ? descriptionInput.trim() : null,
        category: category ? category.trim() : null,
        tags: sanitizedTags,
        format: contentFormat, // 添加格式字段：'markdown' 或 'rich'
        isPublic: false, // 默认设置为私有模板
      };

      // 根据格式保存正确的内容
      if (contentFormat === "markdown") {
        // Markdown格式：保存markdown字符串
        payload.content = markdownValue;
      } else {
        // 富文本格式：保存Delta对象
        payload.content = content;
      }

      await api.post("/documents/templates", payload);
      alert("模板已保存，可在仪表盘中使用。");
    } catch (error) {
      console.error("保存模板失败:", error);
      alert(error.response?.data?.message || "保存模板失败，请稍后再试。");
    } finally {
      setTemplateSaving(false);
    }
  };

  // 如果文档正在加载，显示骨架屏
  if (documentLoading) {
    return <EditorSkeleton />;
  }

  return (
    <div className={`editor-page ${overlayActive ? "editor-page-overlay-active" : ""}`}>
      {/* 头部导航栏 */}
      <div className="editor-header">
        <div className="editor-header-container">
          <Link to="/" className="editor-back-link">
            &larr; 返回
          </Link>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            readOnly={!isEditor}
            className={`editor-title-input ${!isEditor ? "readonly" : ""}`}
          />
          <div className="editor-meta-input-group">
            <label className="editor-meta-label">
              <span className="editor-meta-label-text">分类</span>
              <input
                type="text"
                value={category}
                onChange={handleCategoryChange}
                readOnly={!isEditor}
                placeholder="例如：会议纪要"
                className={`editor-meta-input ${!isEditor ? "readonly" : ""}`}
              />
            </label>
            <label className="editor-meta-label">
              <span className="editor-meta-label-text">标签</span>
              <input
                type="text"
                value={tagsInput}
                onChange={handleTagsInputChange}
                readOnly={!isEditor}
                placeholder="用逗号分隔"
                className={`editor-meta-input ${!isEditor ? "readonly" : ""}`}
              />
            </label>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-container">
          <div className="editor-toolbar-main">
            <div className="editor-primary-actions">
              <button
                onClick={handleLockToggle}
                className={`editor-btn editor-btn-primary ${isLocked ? "editor-btn-lock" : ""}`}
                disabled={lockButtonDisabled}
              >
                {lockProcessing ? "处理中..." : lockButtonLabel}
              </button>
              {isLocked && lockedBy && (
                <span className="editor-lock-badge">
                  🔒 锁定人：{lockedBy.full_name || lockedBy.email || `用户${lockedBy.id}`}
                </span>
              )}
              {isEditor && (
                <button
                  onClick={handleSaveAsTemplate}
                  className="editor-btn editor-btn-secondary"
                  disabled={templateSaving}
                >
                  {templateSaving ? "保存中..." : "保存为模板"}
                </button>
              )}
              {isEditor && (
                <button onClick={handleSaveVersion} className="editor-btn editor-btn-secondary">
                  保存版本
                </button>
              )}
              <button onClick={openVersionModal} className="editor-btn editor-btn-secondary">
                版本历史
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="editor-btn editor-btn-secondary"
              >
                🔗 分享
              </button>
            </div>
            <div className="editor-status-group">
              <span className="editor-save-status">{saveStatus}</span>
              <span className="editor-save-status">{wordCount} 字</span>
              {onlineUsers.length > 0 && (
                <div className="editor-online-users">
                  <span className="editor-online-users-label">在线：</span>
                  <div className="editor-online-users-list">
                    {onlineUsers.map((u, index) => {
                      const identifier = u.full_name || u.email || u.phone || `用户${u.id}`;
                      const colorSeed = u.email || u.phone || identifier;
                      const label = identifier.substring(0, 1).toUpperCase();
                      return (
                        <div
                          key={u.id}
                          title={identifier}
                          className="editor-online-user-avatar"
                          style={{
                            backgroundColor: stringToColor(colorSeed),
                          }}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="editor-feature-actions" aria-label="协作功能">
            {featureSettings.enable_comments && (
              <button
                onClick={() => {
                  if (showComments) {
                    setShowComments(false);
                  } else {
                    closeAllPanels();
                    setShowComments(true);
                    fetchComments();
                  }
                }}
                onMouseEnter={() => preloadPanel("comments")}
                className={`editor-btn editor-btn-chip ${showComments ? "editor-btn-active" : ""}`}
                title="评论"
              >
                <span className="btn-icon">💬</span>
                <span className="btn-text">
                  评论{comments.length > 0 ? ` (${comments.length})` : ""}
                </span>
              </button>
            )}
            {featureSettings.enable_tasks && (
              <button
                onClick={() => {
                  if (showTasks) {
                    setShowTasks(false);
                  } else {
                    closeAllPanels();
                    setShowTasks(true);
                    fetchTasks();
                  }
                }}
                onMouseEnter={() => preloadPanel("tasks")}
                className={`editor-btn editor-btn-chip ${showTasks ? "editor-btn-active" : ""}`}
                title="任务"
              >
                <span className="btn-icon">✅</span>
                <span className="btn-text">任务{tasks.length > 0 ? ` (${tasks.length})` : ""}</span>
              </button>
            )}
            {featureSettings.enable_chat && (
              <button
                onClick={() => {
                  if (showChat) {
                    setShowChat(false);
                  } else {
                    closeAllPanels();
                    setShowChat(true);
                  }
                }}
                onMouseEnter={() => preloadPanel("chat")}
                className={`editor-btn editor-btn-chip ${showChat ? "editor-btn-active" : ""}`}
                title="聊天"
              >
                <span className="btn-icon">🗨️</span>
                <span className="btn-text">聊天</span>
              </button>
            )}
            <button
              onClick={() => {
                if (showFiles) {
                  setShowFiles(false);
                } else {
                  closeAllPanels();
                  setShowFiles(true);
                }
              }}
              onMouseEnter={() => preloadPanel("files")}
              className={`editor-btn editor-btn-chip ${showFiles ? "editor-btn-active" : ""}`}
              title="文件"
            >
              <span className="btn-icon">📁</span>
              <span className="btn-text">文件</span>
            </button>
            {featureSettings.enable_notifications && (
              <button
                onClick={() => {
                  if (showNotifications) {
                    setShowNotifications(false);
                  } else {
                    closeAllPanels();
                    setShowNotifications(true);
                  }
                }}
                onMouseEnter={() => preloadPanel("notifications")}
                className={`editor-btn editor-btn-chip ${showNotifications ? "editor-btn-active" : ""}`}
                title="通知"
              >
                <span className="btn-icon">🔔</span>
                <span className="btn-text">通知</span>
              </button>
            )}
            {featureSettings.enable_video_conference && (
              <button
                onClick={() => {
                  if (showVideoConference) {
                    setShowVideoConference(false);
                  } else {
                    closeAllPanels();
                    setShowVideoConference(true);
                  }
                }}
                onMouseEnter={() => preloadPanel("video")}
                className={`editor-btn editor-btn-chip ${showVideoConference ? "editor-btn-active" : ""}`}
                title="视频会议"
              >
                <span className="btn-icon">📹</span>
                <span className="btn-text">会议</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 编辑器内容区域 */}
      <div className="editor-content-area">
        {/* 模式提示 */}
        <div className={`editor-mode-badge ${isMarkdownMode ? "markdown" : "rich"}`}>
          {isMarkdownMode ? "📝 Markdown 模式" : "✏️ 富文本编辑器"}
        </div>
        <div className="editor-container">
          {isMarkdownMode ? (
            <div className="editor-markdown-wrapper">
              {/* 工具栏 */}
              <div className="editor-markdown-toolbar">
                <span className="editor-markdown-toolbar-label">
                  {showMarkdownPreview ? "预览模式" : "编辑模式"}
                </span>
                <div className="editor-markdown-toolbar-right">
                  <button
                    type="button"
                    onClick={() => setShowMarkdownPreview((prev) => !prev)}
                    className={`editor-markdown-preview-btn ${showMarkdownPreview ? "active" : ""}`}
                  >
                    {showMarkdownPreview ? "✏️ 返回编辑" : "👁️ 预览"}
                  </button>
                </div>
              </div>

              {/* 编辑器和预览区域 - 移动端切换模式，桌面端可并排 */}
              <div className="editor-markdown-editor-area">
                {/* 编辑器区域 - 预览时在移动端隐藏 */}
                <div
                  className={`editor-markdown-editor ${showMarkdownPreview ? "hide-on-mobile" : ""} ${!showMarkdownPreview ? "no-preview" : ""}`}
                >
                  <textarea
                    value={markdownValue}
                    onChange={handleMarkdownChange}
                    readOnly={!isEditor || (isLocked && lockedBy && lockedBy.id !== user?.id)}
                    placeholder="# 标题\n\n支持使用 Markdown 语法进行排版：\n- **加粗文本**\n- *斜体文本*\n- [链接](https://example.com)\n- 列表项"
                    className={`editor-markdown-textarea ${!isEditor || (isLocked && lockedBy && lockedBy.id !== user?.id) ? "readonly" : ""}`}
                  />
                </div>

                {/* 预览区域 - 编辑时在移动端隐藏 */}
                {showMarkdownPreview && (
                  <div className="editor-markdown-preview show-on-mobile-preview">
                    <div
                      className="editor-markdown-preview-content"
                      dangerouslySetInnerHTML={{ __html: markdownPreviewHtml }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="editor-rich-wrapper" data-testid="rich-text-editor-container">
              {/* ReactQuill 编辑器容器 */}
              <div className="editor-rich-container quill-wrapper">
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
                              const quillContainer = el.querySelector
                                ? el.querySelector(".ql-container")
                                : null;
                              const quillEditor = el.querySelector
                                ? el.querySelector(".ql-editor")
                                : null;
                              const quillToolbar = el.querySelector
                                ? el.querySelector(".ql-toolbar")
                                : null;

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

                                // 修复颜色选择器焦点丢失问题：保存并恢复选区
                                let savedRange = null;
                                const colorPickers = quillToolbar.querySelectorAll(
                                  ".ql-color, .ql-background"
                                );
                                colorPickers.forEach((picker) => {
                                  picker.addEventListener("mousedown", () => {
                                    savedRange = editor.getSelection();
                                  });
                                });
                                // 监听颜色选择面板的点击
                                quillToolbar.addEventListener("click", (e) => {
                                  if (e.target.closest(".ql-picker-options") && savedRange) {
                                    setTimeout(() => {
                                      editor.setSelection(savedRange);
                                    }, 0);
                                  }
                                });
                              }

                              // 添加光标位置监听（仅富文本模式且可编辑时）
                              if (contentFormat === "rich" && isEditor && socket) {
                                // 统一处理 selection-change 事件
                                const selectionChangeHandler = (range, oldRange, source) => {
                                  // 1. 发送光标位置（用于实时协作）
                                  handleQuillSelectionChange(range, oldRange, source);

                                  // 2. 检查是否有文本被选中（用于评论功能）
                                  if (range && range.length > 0) {
                                    try {
                                      const selectedTextValue = editor.getText(
                                        range.index,
                                        range.length
                                      );
                                      if (selectedTextValue && selectedTextValue.trim()) {
                                        const textData = {
                                          text: selectedTextValue.trim(),
                                          index: range.index,
                                          length: range.length,
                                        };
                                        setSelectedText(textData);
                                      }
                                    } catch (error) {
                                      // 忽略获取文本错误
                                    }
                                  }
                                  // 注意：当 range.length === 0 时不清除 selectedText，保持之前的选择状态
                                  // 这样用户可以在选择文本后点击评论按钮，而不丢失选择
                                };

                                editor.on("selection-change", selectionChangeHandler);

                                // 存储清理函数（如果需要的话，可以在组件卸载时调用）
                                // 注意：Quill 编辑器在组件卸载时会自动清理事件监听器
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
                  placeholder={isEditor ? "" : "您没有编辑权限"}
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
                  className="editor-quill"
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
            </div>
          )}
        </div>
      </div>
      {sidePanelOpen && (
        <div className="editor-panel-overlay" role="presentation" onClick={closeAllPanels} />
      )}
      {showShareModal && (
        <ShareModal documentId={documentId} onClose={() => setShowShareModal(false)} />
      )}
      {showVersionModal && (
        <div className="editor-version-modal-overlay">
          <div className="editor-version-modal">
            <div className="editor-version-modal-header">
              <h3 className="editor-version-modal-title">版本历史</h3>
              <button onClick={closeVersionModal} className="editor-version-modal-close">
                &times;
              </button>
            </div>
            <div className="editor-version-modal-content">
              <div className="editor-version-list">
                {versionsLoading && <p>正在加载版本...</p>}
                {versionError && <p className="editor-error-message">{versionError}</p>}
                {!versionsLoading && !versionError && versions.length === 0 && (
                  <p>暂无版本记录。使用“保存版本”可创建快照。</p>
                )}
                {!versionsLoading && !versionError && versions.length > 0 && (
                  <ul>
                    {versions.map((version) => {
                      const isActive = previewVersion && previewVersion.id === version.id;
                      return (
                        <li
                          key={version.id}
                          className={`editor-version-item ${isActive ? "active" : ""}`}
                        >
                          <div className="editor-version-item-date">
                            {new Date(version.created_at).toLocaleString()}
                          </div>
                          <div className="editor-version-item-author">
                            {version.created_by_name || version.created_by_email || "未知用户"}
                          </div>
                          {version.summary && (
                            <div className="editor-version-item-summary">
                              备注：{version.summary}
                            </div>
                          )}
                          <div className="editor-version-item-actions">
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
                          <div className="editor-version-item-buttons">
                            <button
                              onClick={() => handlePreviewVersion(version.id)}
                              className="editor-btn editor-btn-secondary"
                            >
                              预览
                            </button>
                            {isEditor && (
                              <button
                                onClick={() => handleRestoreVersion(version.id)}
                                className="editor-btn editor-btn-secondary"
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
              <div className="editor-version-preview">
                {previewVersion ? (
                  <>
                    <div className="editor-version-preview-header">
                      <h4 className="editor-version-preview-title">
                        {previewVersion.title || "未命名文档"}
                      </h4>
                      <div className="editor-version-preview-meta">
                        保存于 {new Date(previewVersion.created_at).toLocaleString()}
                      </div>
                      <div className="editor-version-preview-meta">
                        分类：{previewVersion.category || "未分类"}
                      </div>
                      <div className="editor-version-preview-meta">
                        标签：
                        {previewVersion.tags && previewVersion.tags.length > 0
                          ? previewVersion.tags.join("、")
                          : "无"}
                      </div>
                    </div>
                    {previewVersion.content_format === "markdown" && previewMarkdown ? (
                      <div
                        className="editor-version-preview-content"
                        dangerouslySetInnerHTML={{ __html: previewMarkdownHtml }}
                      />
                    ) : previewContent ? (
                      <div className="editor-version-preview-content">
                        <ReactQuill
                          value={previewContent}
                          readOnly
                          theme="bubble"
                          modules={{ toolbar: false }}
                        />
                      </div>
                    ) : (
                      <div className="editor-version-preview-empty">该版本没有内容</div>
                    )}
                  </>
                ) : (
                  <div className="editor-version-preview-placeholder">选择左侧版本以查看详情</div>
                )}
              </div>
              <div className="editor-version-compare">
                <h4 className="editor-version-compare-title">版本对比</h4>
                <p className="editor-version-compare-desc">
                  选择两个版本分别作为基准 A 与对比 B，生成差异对比。
                </p>
                <div className="editor-version-compare-selection">
                  已选择：A={compareFrom || "未选择"}，B={compareTo || "未选择"}
                </div>
                <div className="editor-version-compare-buttons">
                  <button
                    onClick={handleCompareVersions}
                    disabled={diffLoading || !compareFrom || !compareTo}
                    className="editor-btn editor-btn-primary"
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
                    className="editor-btn editor-btn-secondary"
                  >
                    清空选择
                  </button>
                </div>
                {diffError && <p className="editor-error-message">{diffError}</p>}
                {!diffLoading && sanitizedDiffHtml && (
                  <div className="editor-version-compare-diff">
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

      {/* 评论面板 */}
      {featureSettings.enable_comments && showComments && (
        <Suspense fallback={<LoadingSpinner size="medium" text="加载评论..." />}>
          <CommentsPanel
            documentId={documentId}
            user={user}
            comments={comments}
            onCommentCreated={(comment) => {
              // 这个回调现在不会被调用，因为 CommentsPanel 中已经移除了回调
              // Socket.IO 的 newCommentHandler 会处理实时更新
            }}
            onCommentUpdated={(comment) => {
              setComments((prev) =>
                prev.map((c) => {
                  if (c.id === comment.id) {
                    return comment;
                  }
                  if (c.replies) {
                    return {
                      ...c,
                      replies: c.replies.map((r) => (r.id === comment.id ? comment : r)),
                    };
                  }
                  return c;
                })
              );
            }}
            onCommentDeleted={(commentId) => {
              setComments((prev) =>
                prev
                  .filter((c) => c.id !== commentId)
                  .map((c) => ({
                    ...c,
                    replies: (c.replies || []).filter((r) => r.id !== commentId),
                  }))
              );
            }}
            onCommentResolved={(comment) => {
              setComments((prev) =>
                prev.map((c) => {
                  if (c.id === comment.id) {
                    return { ...comment, replies: c.replies || [] };
                  }
                  if (c.replies && c.replies.some((r) => r.id === comment.id)) {
                    return {
                      ...c,
                      replies: c.replies.map((r) => (r.id === comment.id ? comment : r)),
                    };
                  }
                  return c;
                })
              );
              // 延迟重新获取评论列表以确保数据同步
              setTimeout(() => {
                fetchComments();
              }, 300);
            }}
            selectedText={selectedText}
            onSelectText={setSelectedText}
            onClose={() => setShowComments(false)}
          />
        </Suspense>
      )}

      {/* 任务面板 */}
      {featureSettings.enable_tasks && showTasks && (
        <Suspense fallback={<LoadingSpinner size="medium" text="加载任务..." />}>
          <TasksPanel
            documentId={documentId}
            user={user}
            tasks={tasks}
            onTaskCreated={(task) => {
              // 这个回调现在不会被调用，因为 TasksPanel 中已经移除了回调
              // Socket.IO 的 newTaskHandler 会处理实时更新
            }}
            onTaskUpdated={(task) => {
              setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
            }}
            onTaskDeleted={(taskId) => {
              setTasks((prev) => prev.filter((t) => t.id !== taskId));
            }}
            selectedText={selectedText}
            onSelectText={setSelectedText}
            onlineUsers={onlineUsers}
            onClose={() => setShowTasks(false)}
          />
        </Suspense>
      )}

      {/* 聊天面板 */}
      {featureSettings.enable_chat && showChat && (
        <Suspense fallback={<LoadingSpinner size="medium" text="加载聊天..." />}>
          <ChatPanel
            documentId={documentId}
            user={user}
            socket={socket}
            onlineUsers={onlineUsers}
            onClose={() => setShowChat(false)}
          />
        </Suspense>
      )}

      {/* 文件面板 */}
      {showFiles && (
        <Suspense fallback={<LoadingSpinner size="medium" text="加载文件..." />}>
          <FilePanel
            documentId={documentId}
            user={user}
            socket={socket}
            onClose={() => setShowFiles(false)}
          />
        </Suspense>
      )}

      {/* 通知面板 */}
      {featureSettings.enable_notifications && showNotifications && (
        <Suspense fallback={<LoadingSpinner size="medium" text="加载通知..." />}>
          <NotificationsPanel
            user={user}
            socket={socket}
            onClose={() => setShowNotifications(false)}
          />
        </Suspense>
      )}

      {/* 视频会议面板 */}
      {featureSettings.enable_video_conference && showVideoConference && (
        <Suspense fallback={<LoadingSpinner size="medium" text="加载视频会议..." />}>
          <VideoConferencePanel
            documentId={documentId}
            user={user}
            onClose={() => setShowVideoConference(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default EditorPage;
