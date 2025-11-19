/**
 * MonitoringTab 系统监控标签页
 * 显示系统健康状态和错误日志
 * 使用 React.memo 优化性能
 */
import React, { memo } from "react";
import "../../styles/components/admin/AdminTabs.css";

function MonitoringTab({ monitoring, monitoringLoading }) {
  return (
    <>
      <h3 className="admin-dashboard-section-title">系统监控</h3>

      {monitoringLoading ? (
        <div className="admin-dashboard-loading">
          <div className="admin-dashboard-loading-spinner" />
          正在加载数据...
        </div>
      ) : monitoring ? (
        <div className="admin-dashboard-monitoring">
          {/* 系统状态统计 */}
          <div className="admin-dashboard-stats-grid">
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">数据库状态</div>
              <div
                className={`admin-dashboard-stat-value ${
                  monitoring.health?.database === "healthy"
                    ? "healthy"
                    : "unhealthy"
                }`}
              >
                {monitoring.health?.database === "healthy" ? "✓ 正常" : "✗ 异常"}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">总用户数</div>
              <div className="admin-dashboard-stat-value">
                {monitoring.userStats?.total_users || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">总文档数</div>
              <div className="admin-dashboard-stat-value">
                {monitoring.documentStats?.total_documents || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">内存使用 (MB)</div>
              <div className="admin-dashboard-stat-value">
                {monitoring.systemResources?.memory?.used || 0} /{" "}
                {monitoring.systemResources?.memory?.total || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">运行时间 (秒)</div>
              <div className="admin-dashboard-stat-value">
                {monitoring.systemResources?.uptime
                  ? Math.round(monitoring.systemResources.uptime)
                  : 0}
              </div>
            </div>
          </div>

          {/* 错误日志 */}
          <div className="admin-dashboard-analytics-section">
            <h4>最近的错误日志</h4>
            <table className="admin-dashboard-table">
              <thead>
                <tr>
                  <th>级别</th>
                  <th>类型</th>
                  <th>消息</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {monitoring.recentErrors?.slice(0, 10).map((log) => (
                  <tr key={log.id}>
                    <td>{log.log_level}</td>
                    <td>{log.log_type}</td>
                    <td>{log.message}</td>
                    <td>{new Date(log.created_at).toLocaleString("zh-CN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="admin-dashboard-empty">暂无数据</div>
      )}
    </>
  );
}

// 使用 React.memo 优化，仅在 props 变化时重渲染
export default memo(MonitoringTab);
