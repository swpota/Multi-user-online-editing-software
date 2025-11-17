import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/pages/LandingPage.css";
import logo from "../assets/logo.png";

// 导入插图
import heroCollaboration from "../assets/images/hero-collaboration.svg";
import teamWalking from "../assets/images/team-walking.svg";
import teamAnalytics from "../assets/images/team-analytics.svg";
import progressTracking from "../assets/images/progress-tracking.svg";
import documentCollaboration from "../assets/images/document-collaboration.svg";
import workflowTimeline from "../assets/images/workflow-timeline.svg";
import comments from "../assets/images/comments.svg";

// 导入装饰元素
import lineArtRose from "../assets/images/decorations/line-art-rose.png";
import lineArtPortrait from "../assets/images/decorations/line-art-portrait.png";

function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: "people-outline",
      title: "实时协作",
      description: "多人同时编辑，变化即时同步，让团队协作无缝流畅",
      bgColor: "var(--card-mint)",
      illustration: documentCollaboration
    },
    {
      icon: "create-outline",
      title: "Markdown & 富文本",
      description: "支持Markdown和富文本两种编辑模式，满足不同需求",
      bgColor: "var(--card-peach)",
      illustration: progressTracking
    },
    {
      icon: "time-outline",
      title: "版本控制",
      description: "自动保存历史版本，随时回溯，永不丢失重要内容",
      bgColor: "var(--card-lavender)",
      illustration: workflowTimeline
    },
    {
      icon: "folder-outline",
      title: "模板库",
      description: "丰富的文档模板，快速开始，提高工作效率",
      bgColor: "var(--card-cream)",
      illustration: teamWalking
    },
    {
      icon: "shield-checkmark-outline",
      title: "权限管理",
      description: "灵活的协作者权限设置，保护文档安全",
      bgColor: "var(--card-beige)",
      illustration: teamAnalytics
    },
    {
      icon: "chatbubble-outline",
      title: "实时评论",
      description: "在文档中添加评论，讨论更高效",
      bgColor: "var(--card-peach)",
      illustration: comments
    }
  ];

  return (
    <div className="landing-page">
      {/* 导航栏 */}
      <header className="landing-header">
        <div className="landing-header-content">
          <div className="landing-logo">
            <img src={logo} alt="MindFlow" />
            <span>
              <span className="landing-logo-text-m">M</span>ind
              <span className="landing-logo-text-f">F</span>low
            </span>
          </div>
          <nav className="landing-nav">
            <a href="#features">功能</a>
            <a href="#about">关于</a>
            <a href="#pricing">价格</a>
          </nav>
          <div className="landing-auth-buttons">
            <button 
              className="landing-btn landing-btn-ghost"
              onClick={() => navigate("/login")}
            >
              登录
            </button>
            <button 
              className="landing-btn landing-btn-primary"
              onClick={() => navigate("/register")}
            >
              免费注册
            </button>
          </div>
        </div>
      </header>

      {/* 英雄区域 */}
      <section className="landing-hero">
        <div className="landing-hero-background">
          <div className="landing-gradient-orb orb-1"></div>
          <div className="landing-gradient-orb orb-2"></div>
          <div className="landing-gradient-orb orb-3"></div>
        </div>
        
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            协作文档平台
            <br />
            <span className="landing-hero-highlight">让思想流动起来</span>
          </h1>
          <p className="landing-hero-subtitle">
            为现代团队打造的智能文档工具，实时协作、版本管理、安全可靠
          </p>
          <div className="landing-hero-cta">
            <button 
              className="landing-btn landing-btn-large landing-btn-primary"
              onClick={() => navigate("/register")}
            >
              免费开始使用
              <ion-icon name="arrow-forward-outline"></ion-icon>
            </button>
            <button 
              className="landing-btn landing-btn-large landing-btn-secondary"
              onClick={() => navigate("/login")}
            >
              登录账户
            </button>
          </div>

          {/* 主插图 */}
          <div className="landing-hero-image">
            <img 
              src={heroCollaboration} 
              alt="团队协作" 
              className="hero-illustration"
            />
            {/* 装饰元素 */}
            <img 
              src={lineArtRose} 
              alt="" 
              className="decoration-rose"
            />
          </div>
        </div>
      </section>

      {/* 特性区域 */}
      <section id="features" className="landing-features">
        <div className="landing-features-content">
          <h2 className="landing-section-title">
            为<span className="landing-highlight-text">团队协作</span>而生
          </h2>
          <p className="landing-section-subtitle">
            我们专注于构建最好用的文档协作工具，让团队的思想自由流动
          </p>
          
          <div className="landing-features-grid">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="landing-feature-card"
                style={{ backgroundColor: feature.bgColor }}
              >
                <div className="feature-content">
                  <div className="feature-icon">
                    <ion-icon name={feature.icon}></ion-icon>
                  </div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                </div>
                <div className="feature-illustration">
                  <img 
                    src={feature.illustration} 
                    alt={feature.title}
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 价格方案 */}
      <section id="pricing" className="landing-pricing">
        <div className="landing-pricing-content">
          <h2 className="landing-section-title">
            选择适合你的<span className="landing-highlight-text">方案</span>
          </h2>
          <p className="landing-section-subtitle">
            无论个人还是团队，我们都有适合你的方案
          </p>
          
          <div className="landing-pricing-grid">
            <div className="landing-pricing-card">
              <div className="pricing-card-header">
                <h3 className="pricing-card-title">免费版</h3>
                <p className="pricing-card-description">适合个人用户和小团队</p>
              </div>
              <div className="pricing-card-price">
                <span className="price-currency">¥</span>
                <span className="price-amount">0</span>
                <span className="price-period">/月</span>
              </div>
              <ul className="pricing-card-features">
                <li><ion-icon name="checkmark-circle"></ion-icon> 5个协作文档</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 3位团队成员</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 基础版本历史</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 富文本 & Markdown</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 实时评论</li>
              </ul>
              <button 
                className="pricing-card-btn"
                onClick={() => navigate("/register")}
              >
                开始使用
              </button>
            </div>

            <div className="landing-pricing-card featured">
              <div className="pricing-card-badge">推荐</div>
              <div className="pricing-card-header">
                <h3 className="pricing-card-title">专业版</h3>
                <p className="pricing-card-description">适合成长中的团队</p>
              </div>
              <div className="pricing-card-price">
                <span className="price-currency">¥</span>
                <span className="price-amount">29</span>
                <span className="price-period">/月/人</span>
              </div>
              <ul className="pricing-card-features">
                <li><ion-icon name="checkmark-circle"></ion-icon> 无限协作文档</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 无限团队成员</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 完整版本历史</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 高级权限管理</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 视频会议集成</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 优先技术支持</li>
              </ul>
              <button 
                className="pricing-card-btn primary"
                onClick={() => navigate("/register")}
              >
                立即升级
              </button>
            </div>

            <div className="landing-pricing-card">
              <div className="pricing-card-header">
                <h3 className="pricing-card-title">企业版</h3>
                <p className="pricing-card-description">适合大型组织</p>
              </div>
              <div className="pricing-card-price">
                <span className="price-custom">定制方案</span>
              </div>
              <ul className="pricing-card-features">
                <li><ion-icon name="checkmark-circle"></ion-icon> 专业版所有功能</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 单点登录 (SSO)</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 高级安全控制</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 专属客户经理</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> SLA 保障</li>
                <li><ion-icon name="checkmark-circle"></ion-icon> 定制化开发</li>
              </ul>
              <button 
                className="pricing-card-btn"
                onClick={() => window.location.href = "mailto:1452682204@qq.com"}
              >
                联系我们
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 关于我们 */}
      <section id="about" className="landing-about">
        <div className="landing-about-content">
          <h2 className="landing-section-title">
            关于<span className="landing-highlight-text">MindFlow</span>
          </h2>
          
          <div className="landing-about-grid">
            <div className="about-text">
              <h3>我们的愿景</h3>
              <p>
                MindFlow 致力于打造最好用的文档协作平台，让团队的思想自由流动。
                我们相信，好的工具应该让协作变得简单、高效、愉快。
              </p>
              
              <h3>我们的使命</h3>
              <p>
                通过现代化的技术和优雅的设计，帮助团队打破信息壁垒，
                实现真正的实时协作，让每一个想法都能被快速记录、分享和实现。
              </p>

              <h3>开源项目</h3>
              <p>
                MindFlow 是一个开源项目，我们欢迎社区贡献。
                访问我们的 <a href="https://github.com/swpota" target="_blank" rel="noopener noreferrer">GitHub</a> 了解更多。
              </p>
            </div>

            <div className="about-stats">
              <div className="stat-card">
                <div className="stat-number">1000+</div>
                <div className="stat-label">活跃用户</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">5000+</div>
                <div className="stat-label">协作文档</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">99.9%</div>
                <div className="stat-label">服务可用性</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">24/7</div>
                <div className="stat-label">技术支持</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA区域 */}
      <section className="landing-cta">
        {/* 装饰元素 */}
        <img 
          src={lineArtPortrait} 
          alt="" 
          className="decoration-portrait"
        />
        <div className="landing-cta-content">
          <h2 className="landing-cta-title">开始你的协作之旅</h2>
          <p className="landing-cta-subtitle">加入数千个团队，体验更高效的文档协作</p>
          <button 
            className="landing-btn landing-btn-large landing-btn-primary"
            onClick={() => navigate("/register")}
          >
            免费注册
          </button>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-logo">
            <img src={logo} alt="MindFlow" />
            <span>
              <span className="landing-logo-text-m">M</span>ind
              <span className="landing-logo-text-f">F</span>low
            </span>
          </div>
          
          <div className="landing-footer-links">
            <div className="landing-footer-section">
              <h4 className="landing-footer-section-title">产品</h4>
              <a href="#features">功能特性</a>
              <a href="#pricing">定价方案</a>
              <a href="#updates">更新日志</a>
              <a href="#roadmap">产品路线图</a>
            </div>
            
            <div className="landing-footer-section">
              <h4 className="landing-footer-section-title">资源</h4>
              <a href="#docs">文档中心</a>
              <a href="#tutorials">使用教程</a>
              <a href="#api">API 参考</a>
              <a href="#community">社区论坛</a>
            </div>
            
            <div className="landing-footer-section">
              <h4 className="landing-footer-section-title">公司</h4>
              <a href="#about">关于我们</a>
              <a href="mailto:1452682204@qq.com">QQ邮箱</a>
              <a href="mailto:1452682204se@gmail.com">Google邮箱</a>
              <a href="https://github.com/swpota" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
            
            <div className="landing-footer-section">
              <h4 className="landing-footer-section-title">法律</h4>
              <a href="#privacy">隐私政策</a>
              <a href="#terms">服务条款</a>
              <a href="#security">安全说明</a>
              <a href="#compliance">合规性</a>
            </div>
          </div>
          
          <div className="landing-footer-bottom">
            <p className="landing-footer-copyright">
              © 2025 MindFlow. All rights reserved.
            </p>
            <div className="landing-footer-social">
              <a href="https://github.com/swpota" target="_blank" rel="noopener noreferrer" className="landing-footer-social-link" aria-label="GitHub">
                <ion-icon name="logo-github"></ion-icon>
              </a>
              <a href="mailto:1452682204@qq.com" className="landing-footer-social-link" aria-label="QQ Email">
                <ion-icon name="mail-outline"></ion-icon>
              </a>
              <a href="mailto:1452682204se@gmail.com" className="landing-footer-social-link" aria-label="Gmail">
                <ion-icon name="logo-google"></ion-icon>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
