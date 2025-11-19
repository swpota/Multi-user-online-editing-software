/**
 * AnalyticsTab 用户行为分析标签页
 * 显示活跃用户、文档统计、协作统计等数据
 * 使用 React.memo 优化性能
 */
import React, { memo } from "react";
import "../../styles/components/admin/AdminTabs.css";

function AnalyticsTab({ 
  analytics, 
  analyticsLoading, 
  analyticsPeriod, 
  onPeriodChange 
}) {
  return (
    <>
      <div className="admin-dashboard-section-header">
        <h3 className="admin-dashboard-section-title">用户行为分析</h3>
        <select
          value={analyticsPeriod}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="admin-dashboard-period-select"
        >
          <option value="1d">最近1天</option>
          <option value="7d">最近7天</option>
          <option value="30d">最近30天</option>
          <option value="90d">最近90天</option>
        </select>
      </div>

      {analyticsLoading ? (
        <div className="admin-dashboard-loading">
          <div className="admin-dashboard-loading-spinner" />
          正在加载数据...
        </div>
      ) : analytics ? (
        <div className="admin-dashboard-analytics">
          {/* 统计卡片 */}
          <div className="admin-dashboard-stats-grid">
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">活跃用户</div>
              <div className="admin-dashboard-stat-value">
                {analytics.activeUsers}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">文档创建</div>
              <div className="admin-dashboard-stat-value">
                {analytics.documentStats?.documents_created || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">文档编辑</div>
              <div className="admin-dashboard-stat-value">
                {analytics.documentStats?.documents_edited || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">评论创建</div>
              <div className="admin-dashboard-stat-value">
                {analytics.collaborationStats?.comments_created || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">任务创建</div>
              <div className="admin-dashboard-stat-value">
                {analytics.collaborationStats?.tasks_created || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">任务完成</div>
              <div className="admin-dashboard-stat-value">
                {analytics.collaborationStats?.tasks_completed || 0}
              </div>
            </div>
          </div>

          {/* 活动类型统计 */}
          <div className="admin-dashboard-analytics-section">
            <h4>活动类型统计</h4>
            <table className="admin-dashboard-table">
              <thead>
                <tr>
                  <th>活动类型</th>
                  <th>次数</th>
                </tr>
              </thead>
              <tbody>
                {analytics.activityTypes?.map((item, index) => (
                  <tr key={index}>
                    <td>{item.activity_type}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 最活跃的用户 */}
          <div className="admin-dashboard-analytics-section">
            <h4>最活跃的用户</h4>
            <table className="admin-dashboard-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>活动次数</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topUsers?.map((user) => (
                  <tr key={user.id}>
                    <td>{user.full_name || user.email}</td>
                    <td>{user.activity_count}</td>
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
export default memo(AnalyticsTab);
