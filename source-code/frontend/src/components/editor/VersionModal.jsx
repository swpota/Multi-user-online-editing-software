import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';

/**
 * VersionModal 组件
 * 版本历史管理界面
 */
function VersionModal({
  // 显示状态
  show,
  onClose,
  
  // 版本数据
  versions,
  versionsLoading,
  versionError,
  
  // 预览相关
  previewVersion,
  previewContent,
  onPreviewVersion,
  getPreviewMarkdownHtml,
  
  // 对比相关
  compareFrom,
  compareTo,
  onSetCompareFrom,
  onSetCompareTo,
  onCompareVersions,
  getSanitizedDiffHtml,
  diffError,
  diffLoading,
  
  // 操作
  onRestoreVersion,
  onSaveVersion,
  
  // 权限
  isEditor,
}) {
  const [activeTab, setActiveTab] = useState('list'); // list, preview, compare

  // 重置状态
  useEffect(() => {
    if (!show) {
      setActiveTab('list');
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content version-modal" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="modal-header">
          <h2 className="modal-title">版本历史</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* 标签切换 */}
        <div className="version-tabs">
          <button
            className={`version-tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            版本列表
          </button>
          <button
            className={`version-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
            disabled={!previewVersion}
          >
            预览
          </button>
          <button
            className={`version-tab ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            对比
          </button>
        </div>

        {/* 内容区 */}
        <div className="modal-body version-modal-body">
          {/* 版本列表 */}
          {activeTab === 'list' && (
            <div className="version-list-tab">
              {isEditor && (
                <div className="version-actions">
                  <button 
                    className="btn-save-version"
                    onClick={onSaveVersion}
                  >
                    保存当前版本
                  </button>
                </div>
              )}

              {versionsLoading && (
                <div className="version-loading">加载中...</div>
              )}

              {versionError && (
                <div className="version-error">{versionError}</div>
              )}

              {!versionsLoading && versions.length === 0 && (
                <div className="version-empty">暂无历史版本</div>
              )}

              <div className="version-list">
                {versions.map((version) => (
                  <div key={version.id} className="version-item">
                    <div className="version-item-header">
                      <span className="version-number">版本 #{version.version_number}</span>
                      <span className="version-date">
                        {new Date(version.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    
                    {version.summary && (
                      <div className="version-summary">{version.summary}</div>
                    )}

                    <div className="version-item-actions">
                      <button
                        className="btn-preview"
                        onClick={() => {
                          onPreviewVersion(version.id);
                          setActiveTab('preview');
                        }}
                      >
                        预览
                      </button>
                      
                      {isEditor && (
                        <button
                          className="btn-restore"
                          onClick={() => onRestoreVersion(version.id)}
                        >
                          恢复
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 预览标签 */}
          {activeTab === 'preview' && previewVersion && (
            <div className="version-preview-tab">
              <div className="preview-header">
                <h3>版本 #{previewVersion.version_number}</h3>
                <span className="preview-date">
                  {new Date(previewVersion.created_at).toLocaleString('zh-CN')}
                </span>
              </div>

              <div className="preview-content">
                {previewVersion.content_format === 'markdown' ? (
                  <div
                    className="markdown-preview"
                    dangerouslySetInnerHTML={{ __html: getPreviewMarkdownHtml() }}
                  />
                ) : (
                  <ReactQuill
                    value={previewContent}
                    readOnly={true}
                    theme="snow"
                    modules={{ toolbar: false }}
                  />
                )}
              </div>

              {isEditor && (
                <div className="preview-actions">
                  <button
                    className="btn-restore"
                    onClick={() => onRestoreVersion(previewVersion.id)}
                  >
                    恢复到此版本
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 对比标签 */}
          {activeTab === 'compare' && (
            <div className="version-compare-tab">
              <div className="compare-selectors">
                <div className="compare-selector">
                  <label>对比版本（旧）：</label>
                  <select
                    value={compareFrom || ''}
                    onChange={(e) => onSetCompareFrom(e.target.value)}
                  >
                    <option value="">选择版本...</option>
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>
                        版本 #{v.version_number} - {new Date(v.created_at).toLocaleString('zh-CN')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="compare-selector">
                  <label>对比版本（新）：</label>
                  <select
                    value={compareTo || ''}
                    onChange={(e) => onSetCompareTo(e.target.value)}
                  >
                    <option value="">选择版本...</option>
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>
                        版本 #{v.version_number} - {new Date(v.created_at).toLocaleString('zh-CN')}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn-compare"
                  onClick={onCompareVersions}
                  disabled={!compareFrom || !compareTo || diffLoading}
                >
                  {diffLoading ? '对比中...' : '开始对比'}
                </button>
              </div>

              {diffError && (
                <div className="compare-error">{diffError}</div>
              )}

              {getSanitizedDiffHtml() && (
                <div
                  className="compare-result"
                  dangerouslySetInnerHTML={{ __html: getSanitizedDiffHtml() }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(VersionModal);
