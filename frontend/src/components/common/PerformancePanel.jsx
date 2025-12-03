/**
 * 性能监控面板组件
 * 显示应用性能指标和优化建议
 */
import React, { useState, useEffect } from 'react';
import performanceMonitor from '../../utils/performanceMonitor';
import '../../styles/components/common/PerformancePanel.css';

const PerformancePanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // 仅在开发环境显示
    if (import.meta.env.MODE !== 'development') return;

    // 初始化性能监控
    performanceMonitor.init();

    // 监听快捷键 Ctrl+Shift+P 打开面板
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        if (!isOpen) {
          generateReport();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      performanceMonitor.cleanup();
    };
  }, [isOpen]);

  const generateReport = () => {
    const newReport = performanceMonitor.generateReport();
    setReport(newReport);
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return '优秀';
    if (score >= 75) return '良好';
    if (score >= 50) return '一般';
    return '较差';
  };

  if (import.meta.env.MODE !== 'development' || !isOpen) {
    return null;
  }

  return (
    <div className="performance-panel">
      <div className="performance-panel-header">
        <h3>🚀 性能监控面板</h3>
        <div className="performance-panel-actions">
          <button onClick={generateReport} className="btn-refresh">
            刷新数据
          </button>
          <button onClick={() => setIsOpen(false)} className="btn-close">
            ✕
          </button>
        </div>
      </div>

      <div className="performance-panel-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          总览
        </button>
        <button
          className={activeTab === 'details' ? 'active' : ''}
          onClick={() => setActiveTab('details')}
        >
          详细数据
        </button>
        <button
          className={activeTab === 'suggestions' ? 'active' : ''}
          onClick={() => setActiveTab('suggestions')}
        >
          优化建议
        </button>
      </div>

      <div className="performance-panel-content">
        {!report ? (
          <div className="performance-loading">
            点击"刷新数据"生成性能报告
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="performance-overview">
                <div className="performance-score-card">
                  <div className={`score-circle ${getScoreColor(report.overallScore)}`}>
                    <div className="score-value">{report.overallScore}</div>
                    <div className="score-label">{getScoreLabel(report.overallScore)}</div>
                  </div>
                  <div className="score-subtitle">总体性能评分</div>
                </div>

                <div className="performance-metrics">
                  <div className="metric-card">
                    <div className="metric-label">页面加载</div>
                    <div className={`metric-value ${getScoreColor(report.loadScore)}`}>
                      {report.loadScore}
                    </div>
                    <div className="metric-detail">
                      {report.details.navigation.total}ms
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Web Vitals</div>
                    <div className={`metric-value ${getScoreColor(report.vitalsScore)}`}>
                      {report.vitalsScore}
                    </div>
                    <div className="metric-detail">
                      FCP: {report.details.vitals.fcp || 'N/A'}ms
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">资源加载</div>
                    <div className={`metric-value ${getScoreColor(report.resourceScore)}`}>
                      {report.resourceScore}
                    </div>
                    <div className="metric-detail">
                      {report.details.resources.length} 个资源
                    </div>
                  </div>

                  {report.details.memory && (
                    <div className="metric-card">
                      <div className="metric-label">内存使用</div>
                      <div className="metric-value">
                        {report.details.memory.usage}%
                      </div>
                      <div className="metric-detail">
                        {report.details.memory.used}MB / {report.details.memory.limit}MB
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="performance-details">
                <div className="detail-section">
                  <h4>页面加载时间</h4>
                  <div className="detail-list">
                    {Object.entries(report.details.navigation).map(([key, value]) => (
                      <div key={key} className="detail-item">
                        <span className="detail-key">{key}</span>
                        <span className="detail-value">{value}ms</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Web Vitals</h4>
                  <div className="detail-list">
                    {Object.entries(report.details.vitals).map(([key, value]) => (
                      <div key={key} className="detail-item">
                        <span className="detail-key">{key.toUpperCase()}</span>
                        <span className="detail-value">
                          {typeof value === 'number' ? value.toFixed(3) : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {report.details.network && (
                  <div className="detail-section">
                    <h4>网络信息</h4>
                    <div className="detail-list">
                      <div className="detail-item">
                        <span className="detail-key">网络类型</span>
                        <span className="detail-value">{report.details.network.effectiveType}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-key">下载速度</span>
                        <span className="detail-value">{report.details.network.downlink} Mbps</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-key">往返时间</span>
                        <span className="detail-value">{report.details.network.rtt} ms</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="detail-section">
                  <h4>资源加载 (前10个)</h4>
                  <div className="resource-list">
                    {report.details.resources.slice(0, 10).map((resource, index) => (
                      <div key={index} className="resource-item">
                        <div className="resource-name">{resource.name.split('/').pop()}</div>
                        <div className="resource-meta">
                          <span className="resource-type">{resource.type}</span>
                          <span className="resource-duration">{resource.duration}ms</span>
                          <span className="resource-size">
                            {(resource.size / 1024).toFixed(2)}KB
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'suggestions' && (
              <div className="performance-suggestions">
                {report.suggestions.length === 0 ? (
                  <div className="no-suggestions">
                    ✅ 太棒了！暂无优化建议，性能表现良好！
                  </div>
                ) : (
                  report.suggestions.map((suggestion, index) => (
                    <div key={index} className={`suggestion-card ${suggestion.type}`}>
                      <div className="suggestion-header">
                        <span className="suggestion-icon">
                          {suggestion.type === 'error' ? '❌' : 
                           suggestion.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        <span className="suggestion-category">{suggestion.category}</span>
                      </div>
                      <div className="suggestion-message">{suggestion.message}</div>
                      <div className="suggestion-details">{suggestion.details}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="performance-panel-footer">
        <small>💡 提示：按 Ctrl+Shift+P 打开/关闭面板</small>
      </div>
    </div>
  );
};

export default PerformancePanel;
