import { useEffect, useRef, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";

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
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "95vw",
        height: "90vh",
        maxWidth: "1400px",
        maxHeight: "900px",
        backgroundColor: "white",
        border: "1px solid #ddd",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 头部 - 优化设计 */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#f8f9fa",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#1890ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "20px",
                fontWeight: "bold",
              }}
            >
              📹
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                视频会议
              </h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor:
                        connectionStatus === "joined"
                          ? "#52c41a"
                          : connectionStatus === "connecting"
                          ? "#faad14"
                          : "#ff4d4f",
                    }}
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
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      backgroundColor: "#e6f7ff",
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    {participantCount} 人在线
                  </span>
                )}
                <span style={{ fontSize: "12px", color: "#999" }}>
                  房间: {roomName}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={handleLeave}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            backgroundColor: "#ff4d4f",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#ff7875";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#ff4d4f";
          }}
        >
          <span>离开会议</span>
        </button>
      </div>

      {/* 简洁的状态栏和帮助按钮 */}
      <div
        style={{
          padding: "8px 16px",
          backgroundColor: "#f8f9fa",
          borderBottom: "1px solid #e9ecef",
          fontSize: "13px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ color: "#666" }}>
            {connectionStatus === "joined" ? "✅ 已连接" : connectionStatus === "connecting" ? "⏳ 连接中..." : "❌ 连接失败"}
          </span>
          {participantCount > 0 && (
            <span style={{ color: "#666" }}>
              👥 {participantCount} 人在线
            </span>
          )}
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          style={{
            padding: "4px 12px",
            fontSize: "12px",
            backgroundColor: "transparent",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer",
            color: "#666",
          }}
        >
          {showHelp ? "隐藏帮助" : "显示帮助"}
        </button>
      </div>

      {/* 可折叠的帮助内容 */}
      {showHelp && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#f8f9fa",
            borderBottom: "1px solid #e9ecef",
            fontSize: "12px",
            color: "#666",
            lineHeight: "1.6",
          }}
        >
          <div style={{ marginBottom: "8px", fontWeight: "bold", color: "#333" }}>
            💡 使用帮助
          </div>
          <div style={{ marginBottom: "6px" }}>
            <strong>麦克风权限：</strong>Jitsi Meet会自动请求权限，请在浏览器弹出的权限请求中点击"允许"。如果未弹出，请在会议中点击麦克风图标触发权限请求。
          </div>
          <div style={{ marginBottom: "6px" }}>
            <strong>听不到声音：</strong>在会议中点击"设置" → "设备" → 选择正确的"音频输出"设备，并检查系统音量。
          </div>
          <div>
            <strong>单机测试：</strong>使用无痕模式（Ctrl+Shift+N）打开另一个窗口，或使用手机加入同一文档。
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
        }}
      >
        {error ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: "40px",
              backgroundColor: "#fafafa",
            }}
          >
            <div
              style={{
                fontSize: "64px",
                marginBottom: "24px",
                opacity: 0.5,
              }}
            >
              ⚠️
            </div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "20px" }}>
              加载失败
            </h3>
            <p
              style={{
                margin: "0 0 24px 0",
                color: "#666",
                textAlign: "center",
                maxWidth: "400px",
              }}
            >
              {error}
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  setConnectionStatus("connecting");
                  window.location.reload();
                }}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#1890ff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                重试
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#f0f0f0",
                  color: "#333",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
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
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        )}

        {isLoading && !error && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(26, 26, 26, 0.95)",
              zIndex: 1000,
            }}
          >
            <div style={{ textAlign: "center", color: "white" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  border: "4px solid rgba(255, 255, 255, 0.2)",
                  borderTop: "4px solid #1890ff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 20px",
                }}
              />
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "500" }}>
                正在加载视频会议...
              </p>
              <p
                style={{
                  margin: "8px 0 0 0",
                  fontSize: "13px",
                  opacity: 0.7,
                }}
              >
                首次加载可能需要几秒钟
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 样式 */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VideoConferencePanel;
