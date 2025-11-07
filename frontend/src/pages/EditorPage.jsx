import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import io from "socket.io-client";
import ShareModal from "../components/ShareModal";

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
  const [content, setContent] = useState(null);
  const [socket, setSocket] = useState(null);
  const [saveStatus, setSaveStatus] = useState("连接中...");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const quillRef = useRef(null);

  // --- (最终版) Effect 1: Socket 连接、加载数据、设置监听器 ---
  useEffect(() => {
    if (!user) return;

    const s = io("http://localhost:5000");
    setSocket(s);

    const fetchDocument = async () => {
      try {
        const response = await api.get(`/documents/${documentId}`);
        const doc = response.data;
        setTitle(doc.title);

        // --- (核心修复) 确保将从数据库读取的 content 正确解析 ---
        let initialContent = { ops: [{ insert: "\n" }] }; // 默认是空白
        if (doc.content) {
          try {
            // 如果 doc.content 是一个 JSON 字符串，就解析它
            if (typeof doc.content === "string") {
              initialContent = JSON.parse(doc.content);
            }
            // 如果它已经是-一个对象 (pg 库有时会自动解析)，就直接使用
            else if (typeof doc.content === "object" && doc.content.ops) {
              initialContent = doc.content;
            }
          } catch (e) {
            console.error("解析文档内容失败:", e);
            // 如果解析失败，则保持为空白，防止应用崩溃
          }
        }
        setContent(initialContent);

        const canEdit =
          doc.userRoleForDoc === "owner" || doc.userRoleForDoc === "editor";
        setIsEditor(canEdit);
        setSaveStatus(canEdit ? "已同步" : "查看模式");
      } catch (error) {
        console.error("获取文档失败", error);
        setSaveStatus("加载失败或无权限");
        setIsEditor(false);
      }
    };
    fetchDocument();

    s.emit("joinDocument", { documentId, user });

    const receiveChangeHandler = (delta) => {
      if (quillRef.current) {
        quillRef.current.getEditor().updateContents(delta, "silent");
      }
    };
    const updateUserListHandler = (users) => setOnlineUsers(users);

    s.on("receiveChange", receiveChangeHandler);
    s.on("updateUserList", updateUserListHandler);

    return () => {
      s.off("receiveChange", receiveChangeHandler);
      s.off("updateUserList", updateUserListHandler);
      s.disconnect();
    };
  }, [documentId, user]);

  // --- (最终版) 自动保存 Effect ---
  useEffect(() => {
    if (!isEditor || content === null) return;
    const handler = setTimeout(() => {
      setSaveStatus("正在保存...");
      api
        .put(`/documents/${documentId}`, { title, content })
        .then(() => setSaveStatus("已同步"))
        .catch((err) =>
          setSaveStatus(err.response?.data?.message || "保存失败")
        );
    }, SAVE_INTERVAL_MS);
    return () => clearTimeout(handler);
  }, [documentId, title, content, isEditor]);

  // --- (最终版) handleQuillChange ---
  const handleQuillChange = (value, delta, source, editor) => {
    const fullContent = editor.getContents();
    setContent(fullContent);

    if (source === "user" && isEditor && socket) {
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
          onChange={(e) => {
            if (isEditor) {
              setTitle(e.target.value);
            }
          }}
          readOnly={!isEditor}
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
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              marginRight: "15px",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            分享
          </button>
          <div
            style={{ display: "flex", position: "relative", height: "30px" }}
          >
            {onlineUsers.map((u, index) => (
              (() => {
                const identifier =
                  u.full_name || u.email || u.phone || `用户${u.id}`;
                const colorSeed = u.email || u.phone || identifier;
                const label = identifier.substring(0, 1).toUpperCase();
                return (
                  <div
                    key={u.id}
                    title={identifier}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      backgroundColor: stringToColor(colorSeed),
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
                    {label}
                  </div>
                );
              })()
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
        {content !== null && (
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={handleQuillChange}
            readOnly={!isEditor}
            modules={{ toolbar: isEditor }}
            style={{ minHeight: "400px", backgroundColor: "#fff" }}
          />
        )}
      </div>
      {showShareModal && (
        <ShareModal
          documentId={documentId}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

export default EditorPage;
