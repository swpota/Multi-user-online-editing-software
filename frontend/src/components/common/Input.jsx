/**
 * Input 输入框组件
 * 统一的输入框样式
 */
import React from "react";
import "../../styles/components/common/Input.css";

function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  label,
  helperText,
  prefix,
  suffix,
  className = "",
  ...props
}) {
  const inputClass = `
    input-field
    ${error ? "input-error" : ""}
    ${disabled ? "input-disabled" : ""}
    ${prefix ? "input-with-prefix" : ""}
    ${suffix ? "input-with-suffix" : ""}
    ${className}
  `.trim().replace(/\s+/g, " ");

  return (
    <div className="input-container">
      {label && (
        <label className="input-label">
          {label}
          {props.required && <span className="input-required">*</span>}
        </label>
      )}
      <div className="input-wrapper">
        {prefix && <span className="input-prefix">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClass}
          {...props}
        />
        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>
      {error && <p className="input-error-text">{error}</p>}
      {helperText && !error && <p className="input-helper-text">{helperText}</p>}
    </div>
  );
}

export default Input;
