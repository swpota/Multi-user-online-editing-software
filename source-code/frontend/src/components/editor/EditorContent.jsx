import React, { useRef, useEffect, useMemo, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * EditorContent 组件
 * 编辑器主体，支持富文本和 Markdown 两种模式
 */
function EditorContent({
  // 内容相关
  content,
  contentFormat,
  markdownValue,
  onContentChange,
  onMarkdownChange,
  onSelectionChange,
  
  // 状态
  isEditor,
  
  // Quill 引用
  quillRef,
  
  // 预览相关
  showMarkdownPreview,
}) {
  const [localMarkdown, setLocalMarkdown] = useState(markdownValue);
  const editorRef = useRef(null);

  // Quill 编辑器配置
  const modules = useMemo(() => ({
    toolbar: false, // 使用自定义工具栏
    clipboard: {
      matchVisual: false
    }
  }), []);

  const formats = useMemo(() => [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'video',
    'color', 'background',
    'align', 'code-block'
  ], []);

  // Markdown 预览 HTML
  const markdownPreviewHtml = useMemo(() => {
    if (!showMarkdownPreview) return '';
    try {
      const raw = marked.parse(localMarkdown || '');
      return DOMPurify.sanitize(raw);
    } catch (error) {
      console.error('渲染 Markdown 失败:', error);
      return DOMPurify.sanitize(`<pre>${localMarkdown}</pre>`);
    }
  }, [showMarkdownPreview, localMarkdown]);

  // 同步外部 markdown 值
  useEffect(() => {
    setLocalMarkdown(markdownValue);
  }, [markdownValue]);

  // 处理富文本变化
  const handleQuillChange = (value, delta, source, editor) => {
    if (source === 'user' && isEditor) {
      const newContent = editor.getContents();
      onContentChange(newContent, delta);
    }
  };

  // 处理选择变化
  const handleQuillSelectionChange = (range, oldRange, source) => {
    if (source === 'user' && onSelectionChange) {
      onSelectionChange(range);
    }
  };

  // 处理 Markdown 输入
  const handleMarkdownInputChange = (e) => {
    const value = e.target.value;
    setLocalMarkdown(value);
    if (onMarkdownChange) {
      onMarkdownChange(value);
    }
  };

  // 渲染富文本编辑器
  if (contentFormat === 'rich') {
    return (
      <div className="editor-content-wrapper">
        <ReactQuill
          ref={quillRef}
          value={content}
          onChange={handleQuillChange}
          onChangeSelection={handleQuillSelectionChange}
          modules={modules}
          formats={formats}
          readOnly={!isEditor}
          theme="snow"
          placeholder={isEditor ? '开始编写...' : ''}
          className="editor-quill"
        />
      </div>
    );
  }

  // 渲染 Markdown 编辑器
  if (contentFormat === 'markdown') {
    return (
      <div className="editor-markdown-wrapper">
        <div className="markdown-editor-container">
          {/* Markdown 输入区 */}
          <div className={`markdown-input-area ${showMarkdownPreview ? 'split-view' : ''}`}>
            <textarea
              ref={editorRef}
              value={localMarkdown}
              onChange={handleMarkdownInputChange}
              readOnly={!isEditor}
              placeholder={isEditor ? '使用 Markdown 语法编写...' : ''}
              className="markdown-textarea"
            />
          </div>
          
          {/* Markdown 预览区 */}
          {showMarkdownPreview && (
            <div className="markdown-preview-area">
              <div 
                className="markdown-preview-content"
                dangerouslySetInnerHTML={{ __html: markdownPreviewHtml }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default React.memo(EditorContent);
