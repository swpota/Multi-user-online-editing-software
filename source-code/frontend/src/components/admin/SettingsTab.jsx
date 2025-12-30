/**
 * SettingsTab 系统配置标签页
 * 系统参数设置和功能开关管理
 * 使用 React.memo 优化性能
 */
import React, { memo } from "react";
import "../../styles/components/admin/AdminTabs.css";

function SettingsTab({ 
  settings, 
  settingsLoading, 
  settingsSaving, 
  onSettingChange, 
  onSaveSettings 
}) {
  return (
    <>
      <h3 className="admin-dashboard-section-title">系统参数设置</h3>

      {settingsLoading ? (
        <div className="admin-dashboard-loading">
          <div className="admin-dashboard-loading-spinner" />
          正在加载设置...
        </div>
      ) : (
        <div className="admin-dashboard-settings">
          {/* 用户注册设置 */}
          <div className="admin-dashboard-settings-group">
            <h4>用户注册设置</h4>
            <div className="admin-dashboard-setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enable_registration || false}
                  onChange={(e) =>
                    onSettingChange("enable_registration", e.target.checked)
                  }
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
                  onChange={(e) =>
                    onSettingChange("password_min_length", parseInt(e.target.value))
                  }
                  className="admin-dashboard-setting-input"
                />
              </label>
            </div>
          </div>

          {/* 功能模块开关 */}
          <div className="admin-dashboard-settings-group">
            <h4>功能模块开关</h4>
            <div className="admin-dashboard-setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enable_chat || false}
                  onChange={(e) =>
                    onSettingChange("enable_chat", e.target.checked)
                  }
                />
                启用聊天功能
              </label>
            </div>
            <div className="admin-dashboard-setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enable_comments || false}
                  onChange={(e) =>
                    onSettingChange("enable_comments", e.target.checked)
                  }
                />
                启用评论功能
              </label>
            </div>
            <div className="admin-dashboard-setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enable_tasks || false}
                  onChange={(e) =>
                    onSettingChange("enable_tasks", e.target.checked)
                  }
                />
                启用任务功能
              </label>
            </div>
            <div className="admin-dashboard-setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enable_notifications || false}
                  onChange={(e) =>
                    onSettingChange("enable_notifications", e.target.checked)
                  }
                />
                启用通知功能
              </label>
            </div>
            <div className="admin-dashboard-setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enable_video_conference || false}
                  onChange={(e) =>
                    onSettingChange("enable_video_conference", e.target.checked)
                  }
                />
                启用视频会议功能
              </label>
            </div>
          </div>

          {/* 其他设置 */}
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
                  onChange={(e) =>
                    onSettingChange("max_file_size_mb", parseInt(e.target.value))
                  }
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
                  onChange={(e) =>
                    onSettingChange("session_timeout_minutes", parseInt(e.target.value))
                  }
                  className="admin-dashboard-setting-input"
                />
              </label>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="admin-dashboard-settings-actions">
            <button
              onClick={onSaveSettings}
              disabled={settingsSaving}
              className="admin-dashboard-button admin-dashboard-button-primary"
            >
              {settingsSaving ? "保存中..." : "保存设置"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// 使用 React.memo 优化，仅在 props 变化时重渲染
export default memo(SettingsTab);
