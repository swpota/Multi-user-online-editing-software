/**
 * Modal 通用模态框组件
 * 提供统一的模态框样式和交互
 */
import React from "react";
import "../../styles/components/common/Modal.css";

function Modal({ visible, title, onClose, width = "640px", maxHeight = "80vh", children }) {
  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: width, maxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
