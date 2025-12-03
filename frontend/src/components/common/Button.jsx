/**
 * Button 按钮组件
 * 统一的按钮样式和交互
 */
import React from "react";
import "../../styles/components/common/Button-modern.css";

function Button({
  children,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  icon,
  onClick,
  type = "button",
  className = "",
  ...props
}) {
  const buttonClass = `
    button
    button-${variant}
    button-${size}
    ${disabled ? "button-disabled" : ""}
    ${loading ? "button-loading" : ""}
    ${className}
  `.trim().replace(/\s+/g, " ");

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="button-spinner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
          </svg>
        </span>
      )}
      {icon && !loading && <span className="button-icon">{icon}</span>}
      <span className="button-text">{children}</span>
    </button>
  );
}

export default Button;
