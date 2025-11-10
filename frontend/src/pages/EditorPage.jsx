import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "react-quill/dist/quill.bubble.css";
import io from "socket.io-client";
import ShareModal from "../components/ShareModal";
import CommentsPanel from "../components/CommentsPanel";
import TasksPanel from "../components/TasksPanel";
import ChatPanel from "../components/ChatPanel";
import FilePanel from "../components/FilePanel";
import NotificationsPanel from "../components/NotificationsPanel";
import VideoConferencePanel from "../components/VideoConferencePanel";
import DOMPurify from "dompurify";
import { marked } from "marked";
import "../styles/pages/EditorPage.css";

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
  // 光标位置相关状态
  const [remoteCursors, setRemoteCursors] = useState(new Map()); // 其他用户的光标位置

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

  // --- Effect 1: Socket 连接、加载数据、设置监听器 ---
  useEffect(() => {
    if (!user) return;

    const s = io("http://localhost:5000");
    setSocket(s);

    fetchDocument();
    fetchComments();
    fetchTasks();

    s.emit("joinDocument", { documentId, user });

    const receiveChangeHandler = (delta) => {
      if (quillRef.current) {
        quillRef.current.getEditor().updateContents(delta, "silent");
      }
    };
    const updateUserListHandler = (users) => setOnlineUsers(users);

    // 接收其他用户的光标位置
    const receiveCursorHandler = ({ range, user: cursorUser }) => {
      if (!cursorUser || cursorUser.id === user.id) {
        return; // 忽略自己的光标
      }
      
      setRemoteCursors((prev) => {
        const newCursors = new Map(prev);
        if (range && range.index !== undefined) {
          // 确保 range 有有效的 index
          newCursors.set(cursorUser.id, { 
            range: {
              index: range.index,
              length: range.length || 0,
            }, 
            user: cursorUser 
          });
        } else {
          // 如果 range 为空或无效，移除该用户的光标
          newCursors.delete(cursorUser.id);
        }
        return newCursors;
      });
    };

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

    const commentUpdatedHandler = (comment) => {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === comment.id) {
            return comment;
          }
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === comment.id ? comment : r
              ),
            };
          }
          return c;
        })
      );
    };

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
    s.on("receiveCursor", receiveCursorHandler);
    s.on("newComment", newCommentHandler);
    s.on("commentUpdated", commentUpdatedHandler);
    s.on("commentDeleted", commentDeletedHandler);
    s.on("newTask", newTaskHandler);
    s.on("taskUpdated", taskUpdatedHandler);
    s.on("taskDeleted", taskDeletedHandler);

    return () => {
      s.off("receiveChange", receiveChangeHandler);
      s.off("updateUserList", updateUserListHandler);
      s.off("receiveCursor", receiveCursorHandler);
      s.off("newComment", newCommentHandler);
      s.off("commentUpdated", commentUpdatedHandler);
      s.off("commentDeleted", commentDeletedHandler);
      s.off("newTask", newTaskHandler);
      s.off("taskUpdated", taskUpdatedHandler);
      s.off("taskDeleted", taskDeletedHandler);
      s.disconnect();
    };
  }, [documentId, user, fetchDocument, fetchComments, fetchTasks]);


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

  // 更新远程光标显示（使用 DOM 叠加方式）
  useEffect(() => {
    if (contentFormat !== "rich") {
      return;
    }

    let isActive = true;
    let animationFrameId = null;
    let updateInterval = null;
    let retryCount = 0;
    const maxRetries = 30;

    // 获取容器和编辑器的辅助函数
    const getContainerAndEditor = () => {
      try {
        if (!quillRef.current) {
          return { container: null, editor: null };
        }
        
        const editor = quillRef.current.getEditor();
        if (!editor) {
          return { container: null, editor: null };
        }
        
        // editor.container 就是 ql-container 本身
        let container = editor.container;
        
        // 如果 container 不存在，尝试从 DOM 查找
        if (!container) {
          const possibleContainer = document.querySelector('.quill-wrapper .ql-container');
          if (possibleContainer) {
            container = possibleContainer;
          }
        }
        
        return { container, editor };
      } catch (error) {
        return { container: null, editor: null };
      }
    };

    // 使用 requestAnimationFrame 确保在 DOM 更新后执行
    const updateCursors = () => {
      if (!isActive) {
        return;
      }

      try {
        const { container, editor } = getContainerAndEditor();
        
        if (!container || !editor) {
          // 如果容器或编辑器还没准备好，延迟重试
          if (retryCount < maxRetries && isActive) {
            retryCount++;
            animationFrameId = requestAnimationFrame(() => {
              setTimeout(updateCursors, 150);
            });
          }
          return;
        }
        
        // 重置重试计数
        retryCount = 0;

        // 清除所有光标标记
        const existingCursors = container.querySelectorAll('.remote-cursor-marker');
        existingCursors.forEach((cursor) => {
          const timeoutId = cursor.dataset.timeoutId;
          if (timeoutId) clearTimeout(parseInt(timeoutId));
          cursor.remove();
        });
        const existingLabels = container.querySelectorAll('.remote-cursor-label');
        existingLabels.forEach((label) => label.remove());

        if (remoteCursors.size === 0) {
          return;
        }

        // 为每个远程光标创建视觉标记
        remoteCursors.forEach(({ range, user: cursorUser }, userId) => {
          if (!range || range.index === undefined) {
            return;
          }

          try {
            // 获取编辑器内容的边界信息
            // getBounds 返回的位置是相对于 .ql-editor 的，但我们需要相对于 .ql-container
            const bounds = editor.getBounds(range.index, range.length || 0);
            if (!bounds) {
              // getBounds 可能返回 null，这通常发生在索引超出范围时
              // 这种情况下，移除该用户的光标（可能内容已变化）
              return;
            }
            
            // 获取编辑器的内容区域（ql-editor）
            const editorElement = container.querySelector('.ql-editor');
            if (!editorElement) {
              return;
            }
            
            const color = stringToColor(
              cursorUser.email || cursorUser.full_name || `user${userId}`
            );
            const name = cursorUser.full_name || cursorUser.email || `用户${userId}`;

            // 创建光标标记元素
            const cursorMarker = document.createElement('div');
            cursorMarker.className = 'remote-cursor-marker';
            cursorMarker.setAttribute('data-user-id', userId);
            
            if (range.length === 0) {
              // 光标位置（没有选择文本）- 显示为竖线
              cursorMarker.style.cssText = `
                position: absolute;
                left: ${bounds.left}px;
                top: ${bounds.top}px;
                width: 2px;
                height: ${Math.max(bounds.height || 20, 18)}px;
                background-color: ${color};
                pointer-events: none;
                z-index: 1000;
                animation: blink 1s infinite;
              `;
            } else {
              // 选择范围（有选择文本）- 显示为高亮背景
              cursorMarker.style.cssText = `
                position: absolute;
                left: ${bounds.left}px;
                top: ${bounds.top}px;
                width: ${bounds.width}px;
                height: ${Math.max(bounds.height || 20, 18)}px;
                background-color: ${color}40;
                border: 1px solid ${color};
                pointer-events: none;
                z-index: 999;
                border-radius: 2px;
              `;
            }

            // 创建用户名称标签
            const label = document.createElement('div');
            label.className = 'remote-cursor-label';
            label.textContent = name;
            label.setAttribute('data-user-id', userId);
            label.style.cssText = `
              position: absolute;
              left: ${bounds.left}px;
              top: ${Math.max(bounds.top - 22, 0)}px;
              background-color: ${color};
              color: white;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 11px;
              white-space: nowrap;
              pointer-events: none;
              z-index: 1001;
              font-weight: 500;
              box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            `;

            // 确保容器有相对定位
            const containerStyle = getComputedStyle(container);
            if (containerStyle.position === 'static') {
              container.style.position = 'relative';
            }
            
            // 移除该用户的旧光标（如果存在）
            const oldMarker = container.querySelector(`.remote-cursor-marker[data-user-id="${userId}"]`);
            const oldLabel = container.querySelector(`.remote-cursor-label[data-user-id="${userId}"]`);
            if (oldMarker) {
              const oldTimeoutId = oldMarker.dataset.timeoutId;
              if (oldTimeoutId) clearTimeout(parseInt(oldTimeoutId));
              oldMarker.remove();
            }
            if (oldLabel) {
              oldLabel.remove();
            }
            
            container.appendChild(cursorMarker);
            container.appendChild(label);

            // 5秒后自动移除标记（如果光标没有更新）
            const markerTimeoutId = setTimeout(() => {
              if (cursorMarker.parentNode) {
                cursorMarker.remove();
              }
              if (label.parentNode) {
                label.remove();
              }
            }, 5000);

            // 存储 timeout ID
            cursorMarker.dataset.timeoutId = markerTimeoutId.toString();
          } catch (error) {
            // 静默处理错误，避免控制台噪音
            console.debug('[Cursor] Failed to render cursor for user', userId, error.message);
          }
        });
      } catch (error) {
        console.warn('[Cursor] Failed to update remote cursors', error);
      }
    };

    // 清理函数
    const cleanup = () => {
      try {
        // 清理所有光标标记
        const allMarkers = document.querySelectorAll('.remote-cursor-marker');
        allMarkers.forEach((cursor) => {
          const timeoutId = cursor.dataset.timeoutId;
          if (timeoutId) clearTimeout(parseInt(timeoutId));
          cursor.remove();
        });
        const allLabels = document.querySelectorAll('.remote-cursor-label');
        allLabels.forEach((label) => label.remove());
      } catch (error) {
        // 忽略清理错误
      }
    };

    // 启动更新循环
    // 立即尝试一次更新
    animationFrameId = requestAnimationFrame(() => {
      updateCursors();
    });

    // 设置定期更新（每 100ms 更新一次，确保光标位置跟随内容变化）
    updateInterval = setInterval(() => {
      if (isActive) {
        animationFrameId = requestAnimationFrame(updateCursors);
      }
    }, 100);

    // 返回清理函数
    return () => {
      isActive = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      cleanup();
    };
  }, [remoteCursors, contentFormat]); // 当 remoteCursors 变化时重新渲染光标

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

  // 处理光标位置变化
  const handleQuillSelectionChange = useCallback(
    (range, oldRange, source) => {
      if (!socket || !isEditor || contentFormat === "markdown") {
        return;
      }

      // 节流处理，避免过于频繁地发送光标位置更新
      // 只在用户主动操作时发送（source === 'user'）
      if (source !== 'user' && source !== 'api') {
        return;
      }

      // 发送光标位置到服务器
      try {
        socket.emit("cursorChange", {
          documentId,
          range: range ? {
            index: range.index,
            length: range.length || 0,
          } : null,
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
          },
        });
      } catch (error) {
        console.debug('[Cursor] Failed to emit cursor change:', error.message);
      }
    },
    [socket, documentId, user, isEditor, contentFormat]
  );

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
    <div className="editor-page">
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
            <input
              type="text"
              value={category}
              onChange={handleCategoryChange}
              readOnly={!isEditor}
              placeholder="分类（例如：会议纪要）"
              className={`editor-meta-input ${!isEditor ? "readonly" : ""}`}
            />
            <input
              type="text"
              value={tagsInput}
              onChange={handleTagsInputChange}
              readOnly={!isEditor}
              placeholder="标签，逗号分隔"
              className={`editor-meta-input ${!isEditor ? "readonly" : ""}`}
            />
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-container">
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
            <button
              onClick={handleSaveVersion}
              className="editor-btn editor-btn-secondary"
            >
              保存版本
            </button>
          )}
          <button
            onClick={openVersionModal}
            className="editor-btn editor-btn-secondary"
          >
            版本历史
          </button>
          <button
            onClick={() => {
              if (showComments) {
                setShowComments(false);
              } else {
                setShowTasks(false);
                setShowFiles(false);
                setShowNotifications(false);
                setShowChat(false);
                setShowComments(true);
                fetchComments();
              }
            }}
            className={`editor-btn ${showComments ? "editor-btn-active" : "editor-btn-secondary"}`}
          >
            💬 评论 {comments.length > 0 && `(${comments.length})`}
          </button>
          <button
            onClick={() => {
              if (showTasks) {
                setShowTasks(false);
              } else {
                setShowComments(false);
                setShowFiles(false);
                setShowNotifications(false);
                setShowChat(false);
                setShowTasks(true);
                fetchTasks();
              }
            }}
            className={`editor-btn ${showTasks ? "editor-btn-active" : "editor-btn-secondary"}`}
          >
            ✅ 任务 {tasks.length > 0 && `(${tasks.length})`}
          </button>
          <button
            onClick={() => {
              if (showChat) {
                setShowChat(false);
              } else {
                setShowComments(false);
                setShowTasks(false);
                setShowFiles(false);
                setShowNotifications(false);
                setShowChat(true);
              }
            }}
            className={`editor-btn ${showChat ? "editor-btn-active" : "editor-btn-secondary"}`}
          >
            💬 聊天
          </button>
          <button
            onClick={() => {
              if (showFiles) {
                setShowFiles(false);
              } else {
                setShowComments(false);
                setShowTasks(false);
                setShowChat(false);
                setShowNotifications(false);
                setShowFiles(true);
              }
            }}
            className={`editor-btn ${showFiles ? "editor-btn-active" : "editor-btn-secondary"}`}
          >
            📁 文件
          </button>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
            }}
            className={`editor-btn ${showNotifications ? "editor-btn-active" : "editor-btn-secondary"}`}
          >
            🔔 通知
          </button>
          <button
            onClick={() => {
              setShowVideoConference(!showVideoConference);
            }}
            className={`editor-btn ${showVideoConference ? "editor-btn-active" : "editor-btn-secondary"}`}
          >
            📹 视频会议
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="editor-btn editor-btn-secondary"
          >
            🔗 分享
          </button>
          <div className="editor-status-group">
            <span className="editor-save-status">
              {saveStatus}
            </span>
            {onlineUsers.length > 0 && (
              <div className="editor-online-users">
                <span className="editor-online-users-label">在线：</span>
                <div className="editor-online-users-list">
                  {onlineUsers.map((u, index) => {
                    const identifier =
                      u.full_name || u.email || u.phone || `用户${u.id}`;
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
      </div>

      {/* 编辑器内容区域 */}
      <div className="editor-content-area">
        <div className="editor-container">
          {/* 模式提示 */}
          <div className={`editor-mode-badge ${isMarkdownMode ? "markdown" : "rich"}`}>
            {isMarkdownMode ? "📝 Markdown 模式" : "✏️ 富文本编辑器"}
          </div>
          {isMarkdownMode ? (
          <div className="editor-markdown-wrapper">
            {/* 工具栏 */}
            <div className="editor-markdown-toolbar">
              <span className="editor-markdown-toolbar-label">
                Markdown 编辑模式（自动保存）
              </span>
              <button
                type="button"
                onClick={() => setShowMarkdownPreview((prev) => !prev)}
                className={`editor-markdown-preview-btn ${showMarkdownPreview ? "active" : ""}`}
              >
                {showMarkdownPreview ? "隐藏预览" : "预览 Markdown"}
              </button>
            </div>
            
            {/* 编辑器和预览区域 */}
            <div className="editor-markdown-editor-area">
              {/* 编辑器区域 */}
              <div className={`editor-markdown-editor ${!showMarkdownPreview ? "no-preview" : ""}`}>
                <textarea
                  value={markdownValue}
                  onChange={handleMarkdownChange}
                  readOnly={!isEditor || (isLocked && lockedBy && lockedBy.id !== user?.id)}
                  placeholder="# 标题\n\n支持使用 Markdown 语法进行排版：\n- **加粗文本**\n- *斜体文本*\n- [链接](https://example.com)\n- 列表项"
                  className={`editor-markdown-textarea ${!isEditor || (isLocked && lockedBy && lockedBy.id !== user?.id) ? "readonly" : ""}`}
                />
              </div>
              
              {/* 预览区域 */}
              {showMarkdownPreview && (
                <div className="editor-markdown-preview">
                  <div className="editor-markdown-preview-header">
                    预览
                  </div>
                  <div
                    className="editor-markdown-preview-content"
                    dangerouslySetInnerHTML={{ __html: markdownPreviewHtml }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div 
            className="editor-rich-wrapper"
            data-testid="rich-text-editor-container"
          >
            {/* ReactQuill 编辑器容器 */}
            <div 
              className="editor-rich-container quill-wrapper"
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

                            // 添加光标位置监听（仅富文本模式且可编辑时）
                            if (contentFormat === "rich" && isEditor && socket) {
                              // 统一处理 selection-change 事件
                              const selectionChangeHandler = (range, oldRange, source) => {
                                // 1. 发送光标位置（用于实时协作）
                                handleQuillSelectionChange(range, oldRange, source);
                                
                                // 2. 检查是否有文本被选中（用于评论功能）
                                if (range && range.length > 0) {
                                  try {
                                    const selectedTextValue = editor.getText(range.index, range.length);
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
            {/* 状态信息 */}
            <div className="editor-rich-status">
              <strong>编辑器状态：</strong>
              <span>
                格式: {contentFormat} | 
                模式: {isMarkdownMode ? "Markdown" : "富文本"} | 
                权限: {isEditor ? "可编辑" : "只读"} | 
                内容: {content && content.ops ? `${content.ops.length} 个操作` : "无"}
              </span>
            </div>
          </div>
        )}
        </div>
      </div>
      {showShareModal && (
        <ShareModal
          documentId={documentId}
          onClose={() => setShowShareModal(false)}
        />
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
                      const isActive =
                        previewVersion && previewVersion.id === version.id;
                      return (
                        <li
                          key={version.id}
                          className={`editor-version-item ${isActive ? "active" : ""}`}
                        >
                          <div className="editor-version-item-date">
                            {new Date(version.created_at).toLocaleString()}
                          </div>
                          <div className="editor-version-item-author">
                            {version.created_by_name || version.created_by_email ||
                              "未知用户"}
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
                      <div className="editor-version-preview-empty">
                        该版本没有内容
                      </div>
                    )}
                  </>
                ) : (
                  <div className="editor-version-preview-placeholder">
                    选择左侧版本以查看详情
                  </div>
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
      {showComments && (
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
                    replies: c.replies.map((r) =>
                      r.id === comment.id ? comment : r
                    ),
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
                    replies: c.replies.map((r) =>
                      r.id === comment.id ? comment : r
                    ),
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
      )}

      {/* 任务面板 */}
      {showTasks && (
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
      )}

      {/* 聊天面板 */}
      {showChat && (
        <ChatPanel
          documentId={documentId}
          user={user}
          socket={socket}
          onlineUsers={onlineUsers}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* 文件面板 */}
      {showFiles && (
        <FilePanel
          documentId={documentId}
          user={user}
          socket={socket}
          onClose={() => setShowFiles(false)}
        />
      )}

      {/* 通知面板 */}
      {showNotifications && (
        <NotificationsPanel
          user={user}
          socket={socket}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* 视频会议面板 */}
      {showVideoConference && (
        <VideoConferencePanel
          documentId={documentId}
          user={user}
          onClose={() => setShowVideoConference(false)}
        />
      )}
    </div>
  );
}

export default EditorPage;
