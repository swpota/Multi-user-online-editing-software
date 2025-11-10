import { useEffect, useRef, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import "../styles/components/VideoConferencePanel.css";

const VideoConferencePanel = ({ documentId, user, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [participantCount, setParticipantCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false); // 控制帮助提示的显示
  const apiRef = useRef(null);

  // 生成会议房间名称（基于文档ID和用户信息）
  const roomName = `document-${documentId}`;
  
  // 生成用户显示名称
  const displayName = user?.full_name || user?.email || "用户";

  // Jitsi配置选项 - 优化用户体验
  const configOverwrite = {
    // 默认设置 - 允许用户选择是否开启音视频
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    // 禁用欢迎页面和关闭页面，直接进入会议
    enableWelcomePage: false,
    enableClosePage: false,
    disableDeepLinking: true,
    // 启用屏幕共享
    enableScreenSharing: true,
    // 禁用录制功能（避免额外权限）
    enableRecording: false,
    // 允许在没有摄像头的情况下加入会议
    disableInitialGUM: false,
    // 强制请求媒体权限
    enableNoAudioDetection: false,
    // 允许用户手动选择设备
    enableNoisyMicDetection: false,
    // 禁用预加入页面，直接进入会议
    prejoinPageEnabled: false,
    // 允许所有用户成为主持人（解决"等待主持人"问题）
    enableLayerSuspension: true,
    // 禁用需要登录的限制
    requireDisplayName: false,
    // 允许匿名用户加入
    enableLobbyChat: false,
    // 禁用大厅等待
    enableLobby: false,
    // 界面配置
    toolbarButtons: [
      "microphone",
      "camera",
      "closedcaptions",
      "desktop", // 屏幕共享
      "fullscreen",
      "fodeviceselection",
      "hangup",
      "profile",
      "chat",
      "settings",
      "videoquality",
      "filmstrip",
      "feedback",
      "stats",
      "shortcuts",
      "tileview",
      "videobackgroundblur",
      "download",
      "help",
      "mute-everyone",
      "security",
    ],
    // 视频质量设置
    videoQuality: {
      maxBitrate: 2000, // 限制最大比特率，提高性能
      minBitrate: 200,
      idealBitrate: 1000,
    },
    // 性能优化
    p2p: {
      enabled: true, // 启用P2P，减少服务器负载
      stunServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    },
    // 允许在没有媒体设备的情况下加入
    constraints: {
      video: {
        height: { ideal: 720, max: 1080, min: 240 },
        width: { ideal: 1280, max: 1920, min: 320 },
      },
    },
  };

  // 接口配置 - 优化界面
  const interfaceConfigOverwrite = {
    // 工具栏按钮配置
    TOOLBAR_BUTTONS: [
      "microphone",
      "camera",
      "closedcaptions",
      "desktop", // 屏幕共享
      "fullscreen",
      "fodeviceselection",
      "hangup",
      "profile",
      "chat",
      "settings",
      "videoquality",
      "filmstrip",
      "feedback",
      "stats",
      "shortcuts",
      "tileview",
      "videobackgroundblur",
      "download",
      "help",
      "mute-everyone",
      "security",
    ],
    // 设置部分
    SETTINGS_SECTIONS: [
      "devices",
      "language",
      "moderator",
      "profile",
      "calendar",
      "sounds",
    ],
    // 隐藏不必要的元素
    HIDE_INVITE_MORE_HEADER: true,
    DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
    DISABLE_FOCUS_INDICATOR: false,
    DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
    // 界面优化
    INITIAL_TOOLBAR_TIMEOUT: 20000,
    TOOLBAR_TIMEOUT: 4000,
    // 启用视频背景模糊
    VIDEO_BACKGROUND_BLUR: true,
    // 启用视频背景替换
    VIDEO_BACKGROUND_REPLACEMENT: true,
  };

  // 组件加载时自动请求麦克风权限（针对meet.jit.si域名）
  useEffect(() => {
    const requestMicrophonePermission = async () => {
      // 检查浏览器是否支持媒体设备API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("浏览器不支持媒体设备API");
        return;
      }

      // 注意：由于跨域限制，我们无法直接为meet.jit.si请求权限
      // Jitsi Meet会在iframe加载时自动请求权限
      // 这里我们只是确保本地权限正常
      try {
        // 检查本地权限状态（localhost:5173）
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        console.log("当前麦克风权限状态:", permissionStatus.state);
        
        // 如果本地权限是"prompt"，请求本地权限
        if (permissionStatus.state === 'prompt') {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("✅ 本地麦克风权限已获取");
            stream.getTracks().forEach(track => track.stop());
          } catch (error) {
            console.warn("请求本地麦克风权限失败:", error);
          }
        }
      } catch (error) {
        // 某些浏览器可能不支持 permissions.query API
        console.log("无法查询权限状态:", error);
      }
    };

    // 延迟请求，确保组件已完全加载
    const timer = setTimeout(() => {
      requestMicrophonePermission();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // 处理API就绪
  const handleApiReady = (api) => {
    apiRef.current = api;
    setIsLoading(false);
    setConnectionStatus("connected");
    console.log("Jitsi API 已就绪");

    // Jitsi Meet会自动请求媒体权限
    // 注意：由于跨域限制，我们无法直接为meet.jit.si请求权限
    // Jitsi Meet会在iframe内部自动处理权限请求
    // 当用户首次使用Jitsi Meet时，浏览器会弹出权限请求弹窗
    // 如果未弹出，用户可以在Jitsi Meet界面中点击麦克风图标触发权限请求

    // 更新参与者数量的辅助函数
    const updateParticipantCount = () => {
      try {
        // 使用 getNumberOfParticipants 获取参与者数量（包括自己）
        const count = api.getNumberOfParticipants();
        setParticipantCount(count);
      } catch (error) {
        // 如果方法不可用，尝试使用 getParticipantsInfo
        try {
          const participants = api.getParticipantsInfo();
          setParticipantCount((participants?.length || 0) + 1);
        } catch (e) {
          console.warn("无法获取参与者数量:", e);
        }
      }
    };

    // 监听事件
    api.addEventListener("videoConferenceJoined", (event) => {
      console.log("已加入视频会议", event);
      setConnectionStatus("joined");
      setError(null); // 清除错误状态
      // 延迟更新参与者数量，确保API已完全初始化
      setTimeout(updateParticipantCount, 1000);
    });

    api.addEventListener("videoConferenceLeft", (event) => {
      console.log("已离开视频会议", event);
      // 检查是否是错误导致的离开
      if (event?.error) {
        console.error("会议连接错误:", event.error);
        setError("会议连接失败，请重试");
        setConnectionStatus("error");
      } else {
        setConnectionStatus("left");
      }
      setParticipantCount(0);
    });

    // 监听连接失败事件
    api.addEventListener("connectionFailed", (event) => {
      console.error("连接失败:", event);
      setError("网络连接失败，请检查网络后重试");
      setConnectionStatus("error");
    });

    // 监听会议错误
    api.addEventListener("conferenceError", (error) => {
      console.error("会议错误:", error);
      if (error?.error?.message?.includes("moderator") || error?.error?.message?.includes("lobby")) {
        // 如果是等待主持人的问题，尝试自动成为主持人
        console.log("检测到等待主持人问题，尝试自动成为主持人");
        try {
          // 尝试关闭大厅模式
          api.executeCommand("toggleLobby", false);
          // 尝试成为主持人
          setTimeout(() => {
            try {
              api.executeCommand("toggleAudio");
              api.executeCommand("toggleVideo");
            } catch (e) {
              console.warn("无法切换音视频:", e);
            }
          }, 1000);
        } catch (e) {
          console.warn("无法自动成为主持人:", e);
          setError("等待主持人加入...");
        }
      } else {
        setError(error?.error?.message || "会议连接失败");
        setConnectionStatus("error");
      }
    });

    api.addEventListener("participantJoined", (participant) => {
      console.log("参与者加入:", participant);
      // 更新参与者数量
      setTimeout(updateParticipantCount, 500);
    });

    api.addEventListener("participantLeft", (participant) => {
      console.log("参与者离开:", participant);
      // 更新参与者数量
      setTimeout(updateParticipantCount, 500);
    });

    api.addEventListener("screenSharingStatusChanged", (status) => {
      console.log("屏幕共享状态变更:", status);
    });

    // 监听错误事件
    api.addEventListener("readyToClose", () => {
      console.log("准备关闭");
      onClose();
    });

    // 监听设备错误
    api.addEventListener("deviceListChanged", (devices) => {
      console.log("设备列表变更:", devices);
      // 检查是否有可用的音频输出设备
      const audioOutputs = devices.filter(device => device.kind === "audiooutput");
      if (audioOutputs.length === 0) {
        console.warn("未检测到音频输出设备（扬声器/耳机）");
      } else {
        console.log(`检测到 ${audioOutputs.length} 个音频输出设备:`, audioOutputs.map(d => d.label));
      }
    });

    // 监听音频/视频状态变化
    api.addEventListener("audioMuteStatusChanged", (status) => {
      console.log("音频静音状态变更:", status);
      // 如果麦克风被系统静音，给出提示
      if (status.muted && status.mutedBy === "system") {
        console.warn("麦克风被系统静音，请检查系统设置");
      }
    });

    // 监听音频输出变化
    api.addEventListener("audioOutputDeviceChanged", (device) => {
      console.log("音频输出设备变更:", device);
    });

    api.addEventListener("videoMuteStatusChanged", (status) => {
      console.log("视频静音状态变更:", status);
    });
  };

  // 处理错误
  const handleError = (error) => {
    console.error("Jitsi 错误:", error);
    const errorMessage = error?.message || error?.toString() || "视频会议连接失败";
    
    // 根据错误类型提供更具体的错误信息
    let userFriendlyMessage = "视频会议连接失败";
    if (errorMessage.includes("network") || errorMessage.includes("connection")) {
      userFriendlyMessage = "网络连接失败，请检查网络连接后重试";
    } else if (errorMessage.includes("timeout")) {
      userFriendlyMessage = "连接超时，请重试";
    } else if (errorMessage.includes("moderator")) {
      userFriendlyMessage = "等待主持人加入...";
    }
    
    setError(userFriendlyMessage);
    setIsLoading(false);
    setConnectionStatus("error");
  };

  // 处理离开会议
  const handleLeave = () => {
    if (apiRef.current) {
      try {
        apiRef.current.executeCommand("hangup");
      } catch (error) {
        console.error("离开会议失败:", error);
      }
    }
    onClose();
  };

  return (
    <div className="video-conference-panel">
      {/* 头部 - 优化设计 */}
      <div className="video-conference-header">
        <div className="video-conference-header-left">
          <div className="video-conference-header-content">
            <div className="video-conference-icon">
              📹
            </div>
            <div>
              <h3 className="video-conference-title">
                视频会议
              </h3>
              <div className="video-conference-status">
                <span className="video-conference-status-item">
                  <span
                    className={`video-conference-status-dot ${
                      connectionStatus === "joined"
                        ? "video-conference-status-dot-joined"
                        : connectionStatus === "connecting"
                        ? "video-conference-status-dot-connecting"
                        : "video-conference-status-dot-error"
                    }`}
                  />
                  {connectionStatus === "joined"
                    ? "已连接"
                    : connectionStatus === "connecting"
                    ? "连接中"
                    : connectionStatus === "error"
                    ? "连接失败"
                    : "未连接"}
                </span>
                {participantCount > 0 && (
                  <span className="video-conference-participant-count">
                    {participantCount} 人在线
                  </span>
                )}
                <span className="video-conference-room-name">
                  房间: {roomName}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={handleLeave}
          className="video-conference-leave-btn"
        >
          <span>离开会议</span>
        </button>
      </div>

      {/* 简洁的状态栏和帮助按钮 */}
      <div className="video-conference-status-bar">
        <div className="video-conference-status-bar-left">
          <span className="video-conference-status-bar-item">
            {connectionStatus === "joined" ? "✅ 已连接" : connectionStatus === "connecting" ? "⏳ 连接中..." : "❌ 连接失败"}
          </span>
          {participantCount > 0 && (
            <span className="video-conference-status-bar-item">
              👥 {participantCount} 人在线
            </span>
          )}
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="video-conference-help-btn"
        >
          {showHelp ? "隐藏帮助" : "显示帮助"}
        </button>
      </div>

      {/* 可折叠的帮助内容 */}
      {showHelp && (
        <div className="video-conference-help-content">
          <div className="video-conference-help-title">
            💡 使用帮助
          </div>
          <div className="video-conference-help-item">
            <strong>麦克风权限：</strong>Jitsi Meet会自动请求权限，请在浏览器弹出的权限请求中点击"允许"。如果未弹出，请在会议中点击麦克风图标触发权限请求。
          </div>
          <div className="video-conference-help-item">
            <strong>听不到声音：</strong>在会议中点击"设置" → "设备" → 选择正确的"音频输出"设备，并检查系统音量。
          </div>
          <div className="video-conference-help-item">
            <strong>单机测试：</strong>使用无痕模式（Ctrl+Shift+N）打开另一个窗口，或使用手机加入同一文档。
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div className="video-conference-content">
        {error ? (
          <div className="video-conference-error">
            <div className="video-conference-error-icon">
              ⚠️
            </div>
            <h3 className="video-conference-error-title">
              加载失败
            </h3>
            <p className="video-conference-error-message">
              {error}
            </p>
            <div className="video-conference-error-actions">
              <button
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  setConnectionStatus("connecting");
                  window.location.reload();
                }}
                className="video-conference-retry-btn"
              >
                重试
              </button>
              <button
                onClick={onClose}
                className="video-conference-close-btn"
              >
                关闭
              </button>
            </div>
          </div>
        ) : (
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={roomName}
            configOverwrite={configOverwrite}
            interfaceConfigOverwrite={interfaceConfigOverwrite}
            userInfo={{
              displayName: displayName,
              email: user?.email || "",
            }}
            onApiReady={handleApiReady}
            onError={handleError}
            getIFrameRef={(iframeRef) => {
              if (iframeRef) {
                iframeRef.style.height = "100%";
                iframeRef.style.width = "100%";
                iframeRef.style.border = "none";
                
                // 当iframe加载完成后，Jitsi Meet会自动请求权限
                // 浏览器会弹出权限请求弹窗（针对meet.jit.si域名）
                iframeRef.onload = () => {
                  console.log("Jitsi iframe 已加载，等待用户授权权限");
                  // Jitsi Meet会在内部自动请求媒体权限
                  // 浏览器会弹出权限请求弹窗，用户需要点击"允许"
                };
              }
            }}
            className="video-conference-jitsi-container"
          />
        )}

        {isLoading && !error && (
          <div className="video-conference-loading video-conference-loading-overlay">
            <div className="video-conference-loading-content">
              <div className="video-conference-loading-spinner" />
              <p className="video-conference-loading-title">
                正在加载视频会议...
              </p>
              <p className="video-conference-loading-subtitle">
                首次加载可能需要几秒钟
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default VideoConferencePanel;
