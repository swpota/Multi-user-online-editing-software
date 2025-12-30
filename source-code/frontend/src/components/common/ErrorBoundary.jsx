/**
 * ErrorBoundary 错误边界组件
 * 捕获子组件中的 JavaScript 错误，防止整个应用崩溃
 */
import React, { Component } from "react";
import "../../styles/components/common/ErrorBoundary.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 记录错误信息
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // 可以将错误日志上报给服务器
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // 这里可以集成错误监控服务（如 Sentry）
    // 暂时只在控制台记录
    console.log("Error logged:", {
      message: error.toString(),
      stack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // 如果提供了重置回调，执行它
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // 自定义的错误 UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h2 className="error-boundary-title">
              {this.props.title || "抱歉，出现了一些问题"}
            </h2>
            <p className="error-boundary-message">
              {this.props.message || "我们正在努力修复这个问题。您可以尝试刷新页面或返回首页。"}
            </p>
            
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="error-boundary-details">
                <summary>错误详情（仅开发环境）</summary>
                <pre className="error-boundary-stack">
                  {this.state.error.toString()}
                  {"\n\n"}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="error-boundary-actions">
              <button 
                className="error-boundary-btn error-boundary-btn-primary"
                onClick={this.handleReset}
              >
                重新尝试
              </button>
              <button 
                className="error-boundary-btn error-boundary-btn-secondary"
                onClick={() => window.location.href = "/"}
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
