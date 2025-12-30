import React, { useRef, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/pages/EditorPage.css";
import { stringToColor } from "../utils/stringUtils";

// 导入自定义 Hooks
import {
  useDocument,
  useSocket,
  usePanels,
  useLock,
  useVersions,
  useAutoSave
} from "../hooks/editor";

// 导入编辑器组件
import {
  EditorToolbar,
  EditorSidebar,
  EditorStatusBar,
  EditorContent,
  OnlineUsers,
  VersionModal
} from "../components/editor";

// 导入面板组件
import EditorSkeleton from "../components/EditorSkeleton";
import ShareModal from "../components/ShareModal";
import CommentsPanel from "../components/CommentsPanel";
import TasksPanel from "../components/TasksPanel";
import ChatPanel from "../components/ChatPanel";
import FilePanel from "../components/FilePanel";
import NotificationsPanel from "../components/NotificationsPanel";
import VideoConferencePanel from "../components/VideoConferencePanel";

/**
 * EditorPage 重构版本
 * 使用自定义 Hooks 和组件，代码从 2107 行减少到 ~550 行
 */
function EditorPage({ user }) {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const quillRef = useRef(null);

  // ==================== Hooks ====================
  
  // 文档管理 Hook
  const {
    title,
    category,
    tagsInput,
    content,
    contentFormat,
    markdownValue,
    isEditor,
    isLocked,
    lockedBy,
    documentLoading,
    saveStatus,
    fetchDocument,
    saveDocument,
    updateTitle,
    updateCategory,
    updateTags,
    updateContent,
    updateMarkdownValue,
    switchContentFormat,
    updateLockState,
  } = useDocument(documentId, user);

  // Socket 实时协作 Hook
  const {
    socket,
    onlineUsers,
    remoteCursors,
    emitContentChange,
    emitMetadataChange,
    emitCursorPosition,
    registerContentChangeCallback,
    registerMetadataChangeCallback,
  } = useSocket(documentId, user, isEditor);

  // 面板管理 Hook
  const {
    showComments,
    showTasks,
    showChat,
    showFiles,
    showNotifications,
    showVideoConference,
    showShareModal,
    showVersionModal,
    toggleComments,
    toggleTasks,
    toggleChat,
    toggleFiles,
    toggleNotifications,
    toggleVideoConference,
    toggleShareModal,
    toggleVersionModal,
    setShowComments,
    setShowTasks,
    setShowChat,
    setShowFiles,
    setShowNotifications,
    setShowVideoConference,
    setShowShareModal,
    setShowVersionModal,
  } = usePanels();

  // 文档锁定 Hook
  const {
    lockProcessing,
    toggleLock,
  } = useLock(documentId, isEditor);

  // 版本管理 Hook
  const {
    versions,
    versionsLoading,
    versionError,
    previewVersion,
    previewContent,
    fetchVersions,
    saveVersion,
    previewVersionById,
    restoreVersion,
    compareVersions,
    setCompareFrom,
    setCompareTo,
    getPreviewMarkdownHtml,
    getSanitizedDiffHtml,
    compareFrom,
    compareTo,
    diffError,
    diffLoading,
  } = useVersions(documentId, isEditor);

  // 自动保存 Hook
  useAutoSave(
    saveDocument,
    content,
    contentFormat,
    markdownValue,
    isEditor
  );

  // ==================== 状态和计算 ====================
  
  const [showMarkdownPreview, setShowMarkdownPreview] = React.useState(false);
  const [featureSettings] = React.useState({
    enable_chat: true,
    enable_comments: true,
    enable_tasks: true,
    enable_notifications: true,
    enable_video_conference: true
  });

  // 计算字数
  const wordCount = useMemo(() => {
    if (contentFormat === "markdown") {
      const text = markdownValue.replace(/[#*\-_`>\[\]()]/g, '').trim();
      return text.length;
    } else {
      if (!content || !content.ops) return 0;
      return content.ops.reduce((count, op) => {
        if (typeof op.insert === 'string') {
          return count + op.insert.replace(/\n/g, '').length;
        }
        return count;
      }, 0);
    }
  }, [contentFormat, markdownValue, content]);

  // ==================== 事件处理器 ====================
  
  // 处理内容变化
  const handleContentChange = useCallback((newContent, delta) => {
    updateContent(newContent);
    if (socket && delta) {
      emitContentChange(delta);
    }
  }, [updateContent, socket, emitContentChange]);

  // 处理 Markdown 变化
  const handleMarkdownChange = useCallback((value) => {
    updateMarkdownValue(value);
    if (socket) {
      emitMetadataChange({ markdown_content: value });
    }
  }, [updateMarkdownValue, socket, emitMetadataChange]);

  // 处理光标选择变化
  const handleSelectionChange = useCallback((range) => {
    if (range && socket) {
      const userColor = stringToColor(user.username);
      emitCursorPosition(range, userColor);
    }
  }, [socket, user, emitCursorPosition]);

  // 处理标题变化
  const handleTitleChange = useCallback((e) => {
    const newTitle = e.target.value;
    updateTitle(newTitle);
    emitMetadataChange({ title: newTitle });
  }, [updateTitle, emitMetadataChange]);

  // 处理分类变化
  const handleCategoryChange = useCallback((e) => {
    const newCategory = e.target.value;
    updateCategory(newCategory);
    emitMetadataChange({ category: newCategory });
  }, [updateCategory, emitMetadataChange]);

  // 处理标签变化
  const handleTagsChange = useCallback((e) => {
    const newTags = e.target.value;
    updateTags(newTags);
    const sanitizedTags = newTags.split(',').map(t => t.trim()).filter(Boolean);
    emitMetadataChange({ tags: sanitizedTags, tagsInput: newTags });
  }, [updateTags, emitMetadataChange]);

  // 处理格式切换
  const handleFormatSwitch = useCallback((newFormat) => {
    if (!isEditor) return;
    switchContentFormat(newFormat);
  }, [isEditor, switchContentFormat]);

  // 处理锁定切换
  const handleLockToggle = useCallback(() => {
    toggleLock(isLocked, updateLockState);
  }, [toggleLock, isLocked, updateLockState]);

  // 处理保存版本
  const handleSaveVersion = useCallback(async () => {
    const summary = window.prompt("为该版本添加备注（可选）", "");
    if (summary !== null) {
      const success = await saveVersion(summary);
      if (success) {
        alert("版本保存成功！");
      }
    }
  }, [saveVersion]);

  // 处理恢复版本
  const handleRestoreVersion = useCallback(async (versionId) => {
    const success = await restoreVersion(versionId, () => {
      // 恢复成功后重新加载文档
      fetchDocument();
      toggleVersionModal();
    });
  }, [restoreVersion, fetchDocument, toggleVersionModal]);

  // 处理保存为模板
  const handleSaveAsTemplate = useCallback(async () => {
    if (!isEditor || !content) return;
    
    const templateName = window.prompt("请输入模板名称：");
    if (!templateName) return;

    try {
      const payload = {
        name: templateName,
        category: category || '未分类',
        description: `基于文档 "${title}" 创建的模板`,
        content: contentFormat === 'markdown' ? null : JSON.stringify(content),
        markdown_content: contentFormat === 'markdown' ? markdownValue : null,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        content_format: contentFormat
      };

      const api = (await import('../api')).default;
      await api.post('/templates', payload);
      alert('模板保存成功！');
    } catch (error) {
      console.error('保存模板失败:', error);
      alert('保存模板失败');
    }
  }, [isEditor, content, category, title, contentFormat, markdownValue, tagsInput]);

  // ==================== Socket 事件注册 ====================
  
  useEffect(() => {
    // 注册远程内容变更回调
    registerContentChangeCallback((delta) => {
      if (quillRef.current && contentFormat === 'rich') {
        const editor = quillRef.current.getEditor();
        editor.updateContents(delta, 'silent');
      }
    });

    // 注册远程元数据变更回调
    registerMetadataChangeCallback((updates) => {
      if (updates.title !== undefined) updateTitle(updates.title);
      if (updates.category !== undefined) updateCategory(updates.category);
      if (updates.tagsInput !== undefined) updateTags(updates.tagsInput);
      if (updates.markdown_content !== undefined && contentFormat === 'markdown') {
        updateMarkdownValue(updates.markdown_content);
      }
    });
  }, [
    registerContentChangeCallback,
    registerMetadataChangeCallback,
    contentFormat,
    updateTitle,
    updateCategory,
    updateTags,
    updateMarkdownValue
  ]);

  // 打开版本模态框时加载版本
  useEffect(() => {
    if (showVersionModal) {
      fetchVersions();
    }
  }, [showVersionModal, fetchVersions]);

  // ==================== 渲染 ====================
  
  if (documentLoading) {
    return <EditorSkeleton />;
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="editor-page">
      {/* 工具栏 */}
      <EditorToolbar
        title={title}
        onTitleChange={handleTitleChange}
        isEditor={isEditor}
        isLocked={isLocked}
        lockedBy={lockedBy}
        lockProcessing={lockProcessing}
        onLockToggle={handleLockToggle}
        onSave={saveDocument}
        onSaveVersion={handleSaveVersion}
        onToggleVersionModal={toggleVersionModal}
        onSaveAsTemplate={handleSaveAsTemplate}
        onToggleShare={toggleShareModal}
        contentFormat={contentFormat}
        onFormatSwitch={handleFormatSwitch}
        showMarkdownPreview={showMarkdownPreview}
        onToggleMarkdownPreview={() => setShowMarkdownPreview(!showMarkdownPreview)}
      />

      {/* 主内容区 */}
      <div className="editor-main">
        {/* 侧边栏 */}
        <EditorSidebar
          featureSettings={featureSettings}
          showComments={showComments}
          showTasks={showTasks}
          showChat={showChat}
          showFiles={showFiles}
          showNotifications={showNotifications}
          showVideoConference={showVideoConference}
          onToggleComments={toggleComments}
          onToggleTasks={toggleTasks}
          onToggleChat={toggleChat}
          onToggleFiles={toggleFiles}
          onToggleNotifications={toggleNotifications}
          onToggleVideoConference={toggleVideoConference}
        />

        {/* 编辑器内容 */}
        <div className="editor-content-area">
          <EditorContent
            content={content}
            contentFormat={contentFormat}
            markdownValue={markdownValue}
            onContentChange={handleContentChange}
            onMarkdownChange={handleMarkdownChange}
            onSelectionChange={handleSelectionChange}
            isEditor={isEditor}
            quillRef={quillRef}
            showMarkdownPreview={showMarkdownPreview}
          />

          {/* 在线用户 */}
          <OnlineUsers
            onlineUsers={onlineUsers}
            currentUser={user}
            remoteCursors={remoteCursors}
          />
        </div>
      </div>

      {/* 状态栏 */}
      <EditorStatusBar
        saveStatus={saveStatus}
        wordCount={wordCount}
        category={category}
        tagsInput={tagsInput}
        onCategoryChange={handleCategoryChange}
        onTagsChange={handleTagsChange}
        isEditor={isEditor}
      />

      {/* 面板组件 */}
      {showShareModal && (
        <ShareModal
          documentId={documentId}
          onClose={toggleShareModal}
          isOwner={isEditor}
        />
      )}

      {showComments && (
        <CommentsPanel
          documentId={documentId}
          user={user}
          onClose={toggleComments}
        />
      )}

      {showTasks && (
        <TasksPanel
          documentId={documentId}
          user={user}
          onClose={toggleTasks}
        />
      )}

      {showChat && (
        <ChatPanel
          documentId={documentId}
          user={user}
          onClose={toggleChat}
        />
      )}

      {showFiles && (
        <FilePanel
          documentId={documentId}
          user={user}
          onClose={toggleFiles}
        />
      )}

      {showNotifications && (
        <NotificationsPanel
          user={user}
          onClose={toggleNotifications}
        />
      )}

      {showVideoConference && (
        <VideoConferencePanel
          documentId={documentId}
          user={user}
          onClose={toggleVideoConference}
        />
      )}

      {/* 版本历史模态框 */}
      <VersionModal
        show={showVersionModal}
        onClose={toggleVersionModal}
        versions={versions}
        versionsLoading={versionsLoading}
        versionError={versionError}
        previewVersion={previewVersion}
        previewContent={previewContent}
        onPreviewVersion={previewVersionById}
        getPreviewMarkdownHtml={getPreviewMarkdownHtml}
        compareFrom={compareFrom}
        compareTo={compareTo}
        onSetCompareFrom={setCompareFrom}
        onSetCompareTo={setCompareTo}
        onCompareVersions={compareVersions}
        getSanitizedDiffHtml={getSanitizedDiffHtml}
        diffError={diffError}
        diffLoading={diffLoading}
        onRestoreVersion={handleRestoreVersion}
        onSaveVersion={handleSaveVersion}
        isEditor={isEditor}
      />
    </div>
  );
}

export default EditorPage;
