import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function Dashboard({ user }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 这个 useEffect 会在组件首次加载时运行，用于获取文档列表
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        // 调用我们刚刚在后端创建的 GET /api/documents 接口
        const response = await axios.get("/api/documents");
        setDocuments(response.data);
        setError("");
      } catch (err) {
        console.error("获取文档列表失败:", err);
        setError("无法加载文档列表，请稍后再试。");
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []); // 空依赖数组意味着这个 effect 只运行一次

  // 处理“创建新文档”按钮的点击事件
  const handleCreateDocument = async () => {
    try {
      // 调用我们创建的 POST /api/documents 接口
      const response = await axios.post("/api/documents", {
        title: "新的文档", // 你可以提供一个默认标题
      });

      // 创建成功后，将新文档添加到现有列表的顶部，立即更新UI
      setDocuments([response.data, ...documents]);
    } catch (err) {
      console.error("创建文档失败:", err);
      alert("创建新文档时出错，请重试。");
    }
  };

  const handleDeleteDocument = async (documentId, event) => {
    // 阻止事件冒泡，防止点击删除按钮时触发外层的 Link 导航
    event.preventDefault();
    event.stopPropagation();

    // 弹窗确认，防止误删
    if (window.confirm("你确定要永久删除这个文档吗？")) {
      try {
        await axios.delete(`/api/documents/${documentId}`);

        // 如果删除成功，从前端的 state 中过滤掉这个文档，实现UI立即更新
        setDocuments(documents.filter((doc) => doc.id !== documentId));
      } catch (err) {
        console.error("删除文档失败:", err);
        alert("删除文档时出错，请重试。");
      }
    }
  };

  return (
    <div>
      <h2>仪表盘</h2>
      <p>欢迎回来, {user.email}!</p>

      <button onClick={handleCreateDocument}>+ 创建新文档</button>

      <hr />

      <h3>我的文档</h3>
      {loading && <p>正在加载文档...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* 文档列表 */}
      {!loading && !error && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {documents.length > 0 ? (
            documents.map((doc) => (
              <Link
                to={`/documents/${doc.id}`}
                key={doc.id}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <li
                  style={{
                    border: "1px solid #ccc",
                    padding: "10px",
                    marginBottom: "10px",
                    borderRadius: "5px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "1.2em" }}>{doc.title}</strong>
                    <br />
                    <small>
                      最后更新于: {new Date(doc.updated_at).toLocaleString()}
                    </small>
                  </div>
                  <button
                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                    style={{
                      backgroundColor: "#ff4d4d",
                      color: "white",
                      border: "none",
                      padding: "5px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    删除
                  </button>
                </li>
              </Link>
            ))
          ) : (
            <p>你还没有任何文档。点击上面的按钮创建一个吧！</p>
          )}
        </ul>
      )}
    </div>
  );
}

export default Dashboard;
