import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/pages/AdminDashboardPage.css";

// 导入标签页组件
import UserManagementTab from "../components/admin/UserManagementTab";
import AnalyticsTab from "../components/admin/AnalyticsTab";
import SettingsTab from "../components/admin/SettingsTab";
import SurveysTab from "../components/admin/SurveysTab";
import MonitoringTab from "../components/admin/MonitoringTab";

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
  const [surveyForm, setSurveyForm] = useState({
    rating: 5,
    feedback: "",
    category: "overall",
  });

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
      // 转换为扁平格式
      const flatSettings = {};
      Object.keys(response.data).forEach((key) => {
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
      await api.put("/admin/settings", { settings });
      alert("设置保存成功！");
      fetchSettings();
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

  // 处理角色更改
  const handleRoleChange = useCallback(async (userId, newRole) => {
    if (!window.confirm(`你确定要将该用户的角色更改为 "${newRole}" 吗？`)) {
      return;
    }
    try {
      const response = await api.put(`/admin/users/${userId}/role`, {
        role: newRole,
      });
      setUsers(users.map((user) => (user.id === userId ? response.data : user)));
    } catch (err) {
      alert("更新角色失败: " + (err.response?.data?.message || "未知错误"));
    }
  }, [users]);

  // 处理设置更改
  const handleSettingChange = useCallback((key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Effect hooks
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

  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-container">
        {/* 头部 */}
        <div className="admin-dashboard-header">
          <div className="admin-dashboard-header-left">
            <h2 className="admin-dashboard-title">🔐 后台管理面板</h2>
            <p className="admin-dashboard-subtitle">
              系统监控、用户管理与参数配置
            </p>
          </div>
          <Link to="/" className="admin-dashboard-back-link">
            ← 返回仪表盘
          </Link>
        </div>

        {/* 标签页导航 */}
        <div className="admin-dashboard-tabs">
          <button
            className={`admin-dashboard-tab ${
              activeTab === "users" ? "active" : ""
            }`}
            onClick={() => setActiveTab("users")}
          >
            👥 用户管理
          </button>
          <button
            className={`admin-dashboard-tab ${
              activeTab === "analytics" ? "active" : ""
            }`}
            onClick={() => setActiveTab("analytics")}
          >
            📊 用户分析
          </button>
          <button
            className={`admin-dashboard-tab ${
              activeTab === "settings" ? "active" : ""
            }`}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ 系统配置
          </button>
          <button
            className={`admin-dashboard-tab ${
              activeTab === "surveys" ? "active" : ""
            }`}
            onClick={() => setActiveTab("surveys")}
          >
            ⭐ 满意度调查
          </button>
          <button
            className={`admin-dashboard-tab ${
              activeTab === "monitoring" ? "active" : ""
            }`}
            onClick={() => setActiveTab("monitoring")}
          >
            📈 系统监控
          </button>
        </div>

        {/* 内容区域 */}
        <div className="admin-dashboard-content">
          {/* 用户管理标签页 */}
          {activeTab === "users" && (
            <UserManagementTab
              users={users}
              usersLoading={usersLoading}
              usersError={usersError}
              loggedInUser={loggedInUser}
              onRoleChange={handleRoleChange}
            />
          )}

          {/* 用户行为分析标签页 */}
          {activeTab === "analytics" && (
            <AnalyticsTab
              analytics={analytics}
              analyticsLoading={analyticsLoading}
              analyticsPeriod={analyticsPeriod}
              onPeriodChange={setAnalyticsPeriod}
            />
          )}

          {/* 系统配置标签页 */}
          {activeTab === "settings" && (
            <SettingsTab
              settings={settings}
              settingsLoading={settingsLoading}
              settingsSaving={settingsSaving}
              onSettingChange={handleSettingChange}
              onSaveSettings={saveSettings}
            />
          )}

          {/* 满意度调查标签页 */}
          {activeTab === "surveys" && (
            <SurveysTab
              surveys={surveys}
              surveyStats={surveyStats}
              surveysLoading={surveysLoading}
              showSurveyForm={showSurveyForm}
              surveyForm={surveyForm}
              onToggleForm={() => setShowSurveyForm(!showSurveyForm)}
              onFormChange={setSurveyForm}
              onSubmitSurvey={submitSurvey}
            />
          )}

          {/* 系统监控标签页 */}
          {activeTab === "monitoring" && (
            <MonitoringTab
              monitoring={monitoring}
              monitoringLoading={monitoringLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
