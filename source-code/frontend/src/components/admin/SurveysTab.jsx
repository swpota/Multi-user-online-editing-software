/**
 * SurveysTab 满意度调查标签页
 * 显示和提交用户满意度调查
 * 使用 React.memo 优化性能
 */
import React, { memo } from "react";
import "../../styles/components/admin/AdminTabs.css";

function SurveysTab({
  surveys,
  surveyStats,
  surveysLoading,
  showSurveyForm,
  surveyForm,
  onToggleForm,
  onFormChange,
  onSubmitSurvey,
}) {
  return (
    <>
      <div className="admin-dashboard-section-header">
        <h3 className="admin-dashboard-section-title">满意度调查</h3>
        <button
          onClick={onToggleForm}
          className="admin-dashboard-button admin-dashboard-button-primary"
        >
          {showSurveyForm ? "取消" : "提交调查"}
        </button>
      </div>

      {/* 调查表单 */}
      {showSurveyForm && (
        <form onSubmit={onSubmitSurvey} className="admin-dashboard-survey-form">
          <div className="admin-dashboard-form-group">
            <label>评分（1-5分）：</label>
            <select
              value={surveyForm.rating}
              onChange={(e) =>
                onFormChange({
                  ...surveyForm,
                  rating: parseInt(e.target.value),
                })
              }
              className="admin-dashboard-form-input"
            >
              <option value={1}>1分 - 非常不满意</option>
              <option value={2}>2分 - 不满意</option>
              <option value={3}>3分 - 一般</option>
              <option value={4}>4分 - 满意</option>
              <option value={5}>5分 - 非常满意</option>
            </select>
          </div>
          <div className="admin-dashboard-form-group">
            <label>分类：</label>
            <select
              value={surveyForm.category}
              onChange={(e) =>
                onFormChange({ ...surveyForm, category: e.target.value })
              }
              className="admin-dashboard-form-input"
            >
              <option value="overall">整体</option>
              <option value="usability">易用性</option>
              <option value="performance">性能</option>
              <option value="features">功能</option>
              <option value="support">支持</option>
            </select>
          </div>
          <div className="admin-dashboard-form-group">
            <label>反馈意见：</label>
            <textarea
              value={surveyForm.feedback}
              onChange={(e) =>
                onFormChange({ ...surveyForm, feedback: e.target.value })
              }
              className="admin-dashboard-form-textarea"
              rows="4"
              placeholder="请输入您的反馈意见..."
            />
          </div>
          <button
            type="submit"
            className="admin-dashboard-button admin-dashboard-button-primary"
          >
            提交
          </button>
        </form>
      )}

      {/* 调查数据 */}
      {surveysLoading ? (
        <div className="admin-dashboard-loading">
          <div className="admin-dashboard-loading-spinner" />
          正在加载数据...
        </div>
      ) : surveyStats ? (
        <div className="admin-dashboard-surveys">
          {/* 统计卡片 */}
          <div className="admin-dashboard-stats-grid">
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">总调查数</div>
              <div className="admin-dashboard-stat-value">
                {surveyStats.total_count || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">平均评分</div>
              <div className="admin-dashboard-stat-value">
                {surveyStats.average_rating
                  ? parseFloat(surveyStats.average_rating).toFixed(1)
                  : "0.0"}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">5分</div>
              <div className="admin-dashboard-stat-value">
                {surveyStats.rating_5 || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">4分</div>
              <div className="admin-dashboard-stat-value">
                {surveyStats.rating_4 || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">3分</div>
              <div className="admin-dashboard-stat-value">
                {surveyStats.rating_3 || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">2分</div>
              <div className="admin-dashboard-stat-value">
                {surveyStats.rating_2 || 0}
              </div>
            </div>
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-label">1分</div>
              <div className="admin-dashboard-stat-value">
                {surveyStats.rating_1 || 0}
              </div>
            </div>
          </div>

          {/* 调查列表 */}
          <div className="admin-dashboard-analytics-section">
            <h4>调查列表</h4>
            <table className="admin-dashboard-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>评分</th>
                  <th>分类</th>
                  <th>反馈</th>
                  <th>提交时间</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey) => (
                  <tr key={survey.id}>
                    <td>{survey.full_name || survey.email}</td>
                    <td>{survey.rating}分</td>
                    <td>{survey.category || "-"}</td>
                    <td
                      style={{
                        maxWidth: "400px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={survey.feedback || "-"}
                    >
                      {survey.feedback || "-"}
                    </td>
                    <td>
                      {new Date(survey.created_at).toLocaleString("zh-CN")}
                    </td>
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
export default memo(SurveysTab);
