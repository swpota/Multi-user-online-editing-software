import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/pages/AdminDashboardPage.css";

const AdminDashboardPage = ({ user: loggedInUser }) => {
  // 用户管理状态
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  // 用户行为分析状态
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState("7d");

  // 系统配置状态
  const [settings, setSettings] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // 满意度调查状态
  const [surveys, setSurveys] = useState([]);
  const [surveyStats, setSurveyStats] = useState(null);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [surveyForm, setSurveyForm] = useState({ rating: 5, feedback: "", category: "overall" });

  // 系统监控状态
  const [monitoring, setMonitoring] = useState(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);

  // 当前选中的标签页
  const [activeTab, setActiveTab] = useState("users");

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await api.get("/admin/users");
      setUsers(response.data);
      setUsersError("");
    } catch (err) {
      setUsersError(err.response?.data?.message || "获取用户列表失败");
      console.error("获取用户列表失败:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  // 获取用户行为分析
  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await api.get(`/admin/analytics?period=${analyticsPeriod}`);
      setAnalytics(response.data);
    } catch (err) {
      console.error("获取用户行为分析失败:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // 获取系统设置
  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await api.get("/admin/settings");
      // 转换为扁平格式，方便使用
      const flatSettings = {};
      Object.keys(response.data).forEach(key => {
        flatSettings[key] = response.data[key].value;
      });
      setSettings(flatSettings);
    } catch (err) {
      console.error("获取系统设置失败:", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  // 保存系统设置
  const saveSettings = async () => {
    try {
      setSettingsSaving(true);
      // 转换回API需要的格式
      const settingsToSave = {};
      Object.keys(settings).forEach(key => {
        settingsToSave[key] = settings[key];
      });
      await api.put("/admin/settings", { settings: settingsToSave });
      alert("设置保存成功！");
      fetchSettings(); // 重新获取以确保同步
    } catch (err) {
      alert("保存设置失败: " + (err.response?.data?.message || "未知错误"));
      console.error("保存系统设置失败:", err);
    } finally {
      setSettingsSaving(false);
    }
  };

  // 获取满意度调查
  const fetchSurveys = async () => {
    try {
      setSurveysLoading(true);
      const response = await api.get("/admin/satisfaction-surveys");
      setSurveys(response.data.surveys);
      setSurveyStats(response.data.stats);
    } catch (err) {
      console.error("获取满意度调查失败:", err);
    } finally {
      setSurveysLoading(false);
    }
  };

  // 提交满意度调查
  const submitSurvey = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/satisfaction-surveys", surveyForm);
      alert("调查提交成功！");
      setShowSurveyForm(false);
      setSurveyForm({ rating: 5, feedback: "", category: "overall" });
      fetchSurveys();
    } catch (err) {
      alert("提交调查失败: " + (err.response?.data?.message || "未知错误"));
    }
  };

  // 获取系统监控数据
  const fetchMonitoring = async () => {
    try {
      setMonitoringLoading(true);
      const response = await api.get("/admin/monitoring");
      setMonitoring(response.data);
    } catch (err) {
      console.error("获取系统监控数据失败:", err);
    } finally {
      setMonitoringLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [activeTab, analyticsPeriod]);

  useEffect(() => {
    if (activeTab === "settings") {
      fetchSettings();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "surveys") {
      fetchSurveys();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "monitoring") {
      fetchMonitoring();
      // 每30秒刷新一次监控数据
      const interval = setInterval(fetchMonitoring, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`你确定要将该用户的角色更改为 "${newRole}" 吗？`)) {
      return;
    }
    try {
      const response = await api.put(`/admin/users/${userId}/role`, {
        role: newRole,
      });
      setUsers(
        users.map((user) => (user.id === userId ? response.data : user))
      );
    } catch (err) {
      alert("更新角色失败: " + (err.response?.data?.message || "未知错误"));
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-container">
        {/* 头部 */}
        <div className="admin-dashboard-header">
          <div className="admin-dashboard-header-left">
            <h2 className="admin-dashboard-title">
              🔐 后台管理面板
            </h2>
            <p className="admin-dashboard-subtitle">
              系统监控、用户管理与参数配置
            </p>
          </div>
          <Link
            to="/"
            className="admin-dashboard-back-link"
          >
            ← 返回仪表盘
          </Link>
        </div>

        {/* 标签页导航 */}
        <div className="admin-dashboard-tabs">
          <button
            className={`admin-dashboard-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 用户管理
          </button>
          <button
            className={`admin-dashboard-tab ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            📊 用户分析
          </button>
          <button
            className={`admin-dashboard-tab ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ 系统配置
          </button>
          <button
            className={`admin-dashboard-tab ${activeTab === "surveys" ? "active" : ""}`}
            onClick={() => setActiveTab("surveys")}
          >
            ⭐ 满意度调查
          </button>
          <button
            className={`admin-dashboard-tab ${activeTab === "monitoring" ? "active" : ""}`}
            onClick={() => setActiveTab("monitoring")}
          >
            📈 系统监控
          </button>
        </div>

        {/* 内容区域 */}
        <div className="admin-dashboard-content">
          {/* 用户管理 */}
          {activeTab === "users" && (
            <>
              <h3 className="admin-dashboard-section-title">
                用户管理
              </h3>

              {usersLoading && (
                <div className="admin-dashboard-loading">
                  <div className="admin-dashboard-loading-spinner" />
                  正在加载用户...
                </div>
              )}

              {usersError && (
                <div className="admin-dashboard-error">
                  {usersError}
                </div>
              )}

              {!usersLoading && !usersError && (
                <div className="admin-dashboard-table-wrapper">
                  <table className="admin-dashboard-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>头像</th>
                        <th>邮箱</th>
                        <th>姓名</th>
                        <th>当前角色</th>
                        <th>操作</th>
                        <th>注册时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((userInList) => (
                        <tr key={userInList.id}>
                          <td>{userInList.id}</td>
                          <td>
                            <img
                              src={userInList.avatar_url || "/default-avatar.png"}
                              alt="avatar"
                              className="admin-dashboard-avatar"
                            />
                          </td>
                          <td>{userInList.email}</td>
                          <td>{userInList.full_name || "-"}</td>
                          <td>
                            <span
                              className={`admin-dashboard-role-badge ${
                                userInList.role === "admin"
                                  ? "admin-dashboard-role-badge-admin"
                                  : "admin-dashboard-role-badge-user"
                              }`}
                              style={{
                                backgroundColor:
                                  userInList.role === "admin"
                                    ? "#fff7e6"
                                    : "#e6f7ff",
                                color:
                                  userInList.role === "admin"
                                    ? "#d46b08"
                                    : "#1890ff",
                                border: `1px solid ${
                                  userInList.role === "admin"
                                    ? "#ffd591"
                                    : "#91d5ff"
                                }`,
                              }}
                            >
                              {userInList.role === "admin" ? "管理员" : "编辑者"}
                            </span>
                          </td>
                          <td>
                            {loggedInUser.id === userInList.id ? (
                              <span className="admin-dashboard-self-label">
                                （你自己）
                              </span>
                            ) : userInList.role === "admin" ? (
                              <button
                                onClick={() =>
                                  handleRoleChange(userInList.id, "editor")
                                }
                                className="admin-dashboard-button admin-dashboard-button-danger"
                              >
                                降为编辑者
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleRoleChange(userInList.id, "admin")
                                }
                                className="admin-dashboard-button admin-dashboard-button-primary"
                              >
                                提升为管理员
                              </button>
                            )}
                          </td>
                          <td>
                            {new Date(userInList.created_at).toLocaleString("zh-CN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!usersLoading && !usersError && users.length === 0 && (
                <div className="admin-dashboard-empty">
                  暂无用户数据
                </div>
              )}
            </>
          )}

          {/* 用户行为分析 */}
          {activeTab === "analytics" && (
            <>
              <div className="admin-dashboard-section-header">
                <h3 className="admin-dashboard-section-title">
                  用户行为分析
                </h3>
                <select
                  value={analyticsPeriod}
                  onChange={(e) => setAnalyticsPeriod(e.target.value)}
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
                  <div className="admin-dashboard-stats-grid">
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">活跃用户</div>
                      <div className="admin-dashboard-stat-value">{analytics.activeUsers}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">文档创建</div>
                      <div className="admin-dashboard-stat-value">{analytics.documentStats?.documents_created || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">文档编辑</div>
                      <div className="admin-dashboard-stat-value">{analytics.documentStats?.documents_edited || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">评论创建</div>
                      <div className="admin-dashboard-stat-value">{analytics.collaborationStats?.comments_created || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">任务创建</div>
                      <div className="admin-dashboard-stat-value">{analytics.collaborationStats?.tasks_created || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">任务完成</div>
                      <div className="admin-dashboard-stat-value">{analytics.collaborationStats?.tasks_completed || 0}</div>
                    </div>
                  </div>

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
          )}

          {/* 系统配置 */}
          {activeTab === "settings" && (
            <>
              <h3 className="admin-dashboard-section-title">
                系统参数设置
              </h3>

              {settingsLoading ? (
                <div className="admin-dashboard-loading">
                  <div className="admin-dashboard-loading-spinner" />
                  正在加载设置...
                </div>
              ) : (
                <div className="admin-dashboard-settings">
                  <div className="admin-dashboard-settings-group">
                    <h4>用户注册设置</h4>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.enable_registration || false}
                          onChange={(e) => handleSettingChange("enable_registration", e.target.checked)}
                        />
                        允许用户注册
                      </label>
                    </div>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        密码最小长度：
                        <input
                          type="number"
                          min="6"
                          max="32"
                          value={settings.password_min_length || 6}
                          onChange={(e) => handleSettingChange("password_min_length", parseInt(e.target.value))}
                          className="admin-dashboard-setting-input"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-dashboard-settings-group">
                    <h4>功能模块开关</h4>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.enable_chat || false}
                          onChange={(e) => handleSettingChange("enable_chat", e.target.checked)}
                        />
                        启用聊天功能
                      </label>
                    </div>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.enable_comments || false}
                          onChange={(e) => handleSettingChange("enable_comments", e.target.checked)}
                        />
                        启用评论功能
                      </label>
                    </div>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.enable_tasks || false}
                          onChange={(e) => handleSettingChange("enable_tasks", e.target.checked)}
                        />
                        启用任务功能
                      </label>
                    </div>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.enable_notifications || false}
                          onChange={(e) => handleSettingChange("enable_notifications", e.target.checked)}
                        />
                        启用通知功能
                      </label>
                    </div>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.enable_video_conference || false}
                          onChange={(e) => handleSettingChange("enable_video_conference", e.target.checked)}
                        />
                        启用视频会议功能
                      </label>
                    </div>
                  </div>

                  <div className="admin-dashboard-settings-group">
                    <h4>其他设置</h4>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        最大文件上传大小（MB）：
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={settings.max_file_size_mb || 10}
                          onChange={(e) => handleSettingChange("max_file_size_mb", parseInt(e.target.value))}
                          className="admin-dashboard-setting-input"
                        />
                      </label>
                    </div>
                    <div className="admin-dashboard-setting-item">
                      <label>
                        会话超时时间（分钟）：
                        <input
                          type="number"
                          min="5"
                          max="1440"
                          value={settings.session_timeout_minutes || 60}
                          onChange={(e) => handleSettingChange("session_timeout_minutes", parseInt(e.target.value))}
                          className="admin-dashboard-setting-input"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-dashboard-settings-actions">
                    <button
                      onClick={saveSettings}
                      disabled={settingsSaving}
                      className="admin-dashboard-button admin-dashboard-button-primary"
                    >
                      {settingsSaving ? "保存中..." : "保存设置"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 满意度调查 */}
          {activeTab === "surveys" && (
            <>
              <div className="admin-dashboard-section-header">
                <h3 className="admin-dashboard-section-title">
                  满意度调查
                </h3>
                <button
                  onClick={() => setShowSurveyForm(!showSurveyForm)}
                  className="admin-dashboard-button admin-dashboard-button-primary"
                >
                  {showSurveyForm ? "取消" : "提交调查"}
                </button>
              </div>

              {showSurveyForm && (
                <form onSubmit={submitSurvey} className="admin-dashboard-survey-form">
                  <div className="admin-dashboard-form-group">
                    <label>评分（1-5分）：</label>
                    <select
                      value={surveyForm.rating}
                      onChange={(e) => setSurveyForm({ ...surveyForm, rating: parseInt(e.target.value) })}
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
                      onChange={(e) => setSurveyForm({ ...surveyForm, category: e.target.value })}
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
                      onChange={(e) => setSurveyForm({ ...surveyForm, feedback: e.target.value })}
                      className="admin-dashboard-form-textarea"
                      rows="4"
                      placeholder="请输入您的反馈意见..."
                    />
                  </div>
                  <button type="submit" className="admin-dashboard-button admin-dashboard-button-primary">
                    提交
                  </button>
                </form>
              )}

              {surveysLoading ? (
                <div className="admin-dashboard-loading">
                  <div className="admin-dashboard-loading-spinner" />
                  正在加载数据...
                </div>
              ) : surveyStats ? (
                <div className="admin-dashboard-surveys">
                  <div className="admin-dashboard-stats-grid">
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">总调查数</div>
                      <div className="admin-dashboard-stat-value">{surveyStats.total_count || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">平均评分</div>
                      <div className="admin-dashboard-stat-value">
                        {surveyStats.average_rating ? parseFloat(surveyStats.average_rating).toFixed(1) : "0.0"}
                      </div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">5分</div>
                      <div className="admin-dashboard-stat-value">{surveyStats.rating_5 || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">4分</div>
                      <div className="admin-dashboard-stat-value">{surveyStats.rating_4 || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">3分</div>
                      <div className="admin-dashboard-stat-value">{surveyStats.rating_3 || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">2分</div>
                      <div className="admin-dashboard-stat-value">{surveyStats.rating_2 || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">1分</div>
                      <div className="admin-dashboard-stat-value">{surveyStats.rating_1 || 0}</div>
                    </div>
                  </div>

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
                            <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={survey.feedback || "-"}>
                              {survey.feedback || "-"}
                            </td>
                            <td>{new Date(survey.created_at).toLocaleString("zh-CN")}</td>
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
          )}

          {/* 系统监控 */}
          {activeTab === "monitoring" && (
            <>
              <h3 className="admin-dashboard-section-title">
                系统监控
              </h3>

              {monitoringLoading ? (
                <div className="admin-dashboard-loading">
                  <div className="admin-dashboard-loading-spinner" />
                  正在加载数据...
                </div>
              ) : monitoring ? (
                <div className="admin-dashboard-monitoring">
                  <div className="admin-dashboard-stats-grid">
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">数据库状态</div>
                      <div className={`admin-dashboard-stat-value ${monitoring.health?.database === 'healthy' ? 'healthy' : 'unhealthy'}`}>
                        {monitoring.health?.database === 'healthy' ? '✓ 正常' : '✗ 异常'}
                      </div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">总用户数</div>
                      <div className="admin-dashboard-stat-value">{monitoring.userStats?.total_users || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">总文档数</div>
                      <div className="admin-dashboard-stat-value">{monitoring.documentStats?.total_documents || 0}</div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">内存使用 (MB)</div>
                      <div className="admin-dashboard-stat-value">
                        {monitoring.systemResources?.memory?.used || 0} / {monitoring.systemResources?.memory?.total || 0}
                      </div>
                    </div>
                    <div className="admin-dashboard-stat-card">
                      <div className="admin-dashboard-stat-label">运行时间 (秒)</div>
                      <div className="admin-dashboard-stat-value">
                        {monitoring.systemResources?.uptime ? Math.round(monitoring.systemResources.uptime) : 0}
                      </div>
                    </div>
                  </div>

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
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
