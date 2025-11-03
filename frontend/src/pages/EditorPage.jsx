import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import io from "socket.io-client";

// 注意：所有与 Cursors 相关的 import 和 register 都已移除

const stringToColor = (str) => {
  let hash = 0;
  if (!str || str.length === 0) return "#000000";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).substr(-2);
  }
  return color;
};

const SAVE_INTERVAL_MS = 2000;

function EditorPage({ user }) {
  const { documentId } = useParams();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [socket, setSocket] = useState(null);
  const [saveStatus, setSaveStatus] = useState("连接中...");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const quillRef = useRef(null);

  // Effect 1: Socket 连接
  useEffect(() => {
    const s = io("http://localhost:5000");
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  // Effect 2: 加载初始数据 & 加入房间
  useEffect(() => {
    if (!socket || !user) return;
    socket.once("connect", async () => {
      try {
        const response = await axios.get(`/api/documents/${documentId}`);
        if (response.data.content) setContent(response.data.content);
        setTitle(response.data.title);
        setSaveStatus("已同步");
      } catch (error) {
        console.error("获取文档失败", error);
        setSaveStatus("加载失败");
      }
    });
    socket.emit("joinDocument", { documentId, user });
  }, [socket, documentId, user]);

  // Effect 3: 监听服务器广播 (只监听文本和用户列表)
  useEffect(() => {
    if (!socket || !quillRef.current) return;

    const quill = quillRef.current.getEditor();
    const receiveChangeHandler = (delta) => quill.updateContents(delta);
    const updateUserListHandler = (users) => setOnlineUsers(users);
    const documentSavedHandler = (message) => setSaveStatus(message);
    const saveErrorHandler = (message) => setSaveStatus(message);

    socket.on("receiveChange", receiveChangeHandler);
    socket.on("updateUserList", updateUserListHandler);
    socket.on("documentSaved", documentSavedHandler);
    socket.on("saveError", saveErrorHandler);

    return () => {
      socket.off("receiveChange");
      socket.off("updateUserList");
      socket.off("documentSaved");
      socket.off("saveError");
    };
  }, [socket]);

  // Effect 4: 延时自动保存
  useEffect(() => {
    if (!socket || !content || (content.ops && content.ops[0].insert === "\n"))
      return;
    const handler = setTimeout(() => {
      setSaveStatus("正在保存...");
      socket.emit("saveDocument", { documentId, content });
    }, SAVE_INTERVAL_MS);
    return () => clearTimeout(handler);
  }, [socket, documentId, content]);

  // 函数：保存标题
  const handleTitleSave = async () => {
    try {
      await axios.put(`/api/documents/${documentId}`, { title });
      setSaveStatus("已保存");
    } catch (error) {
      console.error("保存标题失败:", error);
      setSaveStatus("标题保存失败");
    }
  };

  // 函数：处理编辑器内容变化
  const handleQuillChange = (newValue, delta, source) => {
    if (source === "user" && socket) {
      setContent(newValue);
      setSaveStatus("正在输入...");
      socket.emit("documentChange", { documentId, delta });
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link to="/" className="button-like">
          &larr; 返回
        </Link>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleSave}
          style={{
            fontSize: "1.5em",
            fontWeight: "bold",
            border: "none",
            outline: "none",
            textAlign: "center",
            width: "50%",
          }}
        />
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{ display: "flex", position: "relative", height: "30px" }}
          >
            {onlineUsers.map((u, index) => (
              <div
                key={u.id}
                title={u.email}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  backgroundColor: stringToColor(u.email),
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "white",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  border: "2px solid white",
                  position: "absolute",
                  left: `${index * 20}px`,
                }}
              >
                {u.email.substring(0, 1)}
              </div>
            ))}
          </div>
          <span
            style={{
              color: "#666",
              fontStyle: "italic",
              marginLeft: `${onlineUsers.length * 20 + 15}px`,
            }}
          >
            {saveStatus}
          </span>
        </div>
      </div>
      <div style={{ border: "1px solid #ccc", marginTop: "20px" }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={content}
          onChange={handleQuillChange}
          modules={{ toolbar: true }} // 移除了 cursors: true
          style={{ minHeight: "400px", backgroundColor: "#fff" }}
        />
      </div>
    </div>
  );
}

export default EditorPage;
