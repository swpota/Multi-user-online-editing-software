import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import LazyImage from "../components/common/LazyImage";
import "../styles/pages/LandingPage-modern.css";
import "../styles/pages/LandingPage-sections.css";
import "../styles/pages/LandingPage-animations-modern.css";
import logo from "../assets/logo.svg";

// 导入插图
import heroCollaboration from "../assets/images/hero-collaboration.svg";
import teamWalking from "../assets/images/team-walking.svg";
import teamAnalytics from "../assets/images/team-analytics.svg";
import progressTracking from "../assets/images/progress-tracking.svg";
import documentCollaboration from "../assets/images/document-collaboration.svg";
import workflowTimeline from "../assets/images/workflow-timeline.svg";
import comments from "../assets/images/comments.svg";

// 导入装饰元素
// import lineArtRose from "../assets/images/decorations/line-art-rose.png";
// import lineArtPortrait from "../assets/images/decorations/line-art-portrait.png";

function LandingPage() {
  const navigate = useNavigate();
  const statsRef = useRef(null);
  const hasAnimated = useRef(false);

  // 滚动显现动画
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // 数字滚动动画
  useEffect(() => {
    const animateNumbers = () => {
      const numbers = document.querySelectorAll('.stat-number[data-target]');

      numbers.forEach(number => {
        const target = parseInt(number.getAttribute('data-target'));
        const duration = 2000; // 2秒
        const increment = target / (duration / 16); // 60fps
        let current = 0;

        const updateNumber = () => {
          current += increment;
          if (current < target) {
            number.textContent = Math.floor(current);
            requestAnimationFrame(updateNumber);
          } else {
            number.textContent = target;
          }
        };

        updateNumber();
      });
    };

    // 滚动到统计区域时触发动画
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animateNumbers();
        }
      });
    }, { threshold: 0.3 });

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, []);

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

  // 渲染粒子背景
  const renderParticles = () => {
    return (
      <div className="particles-bg">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 20}s`,
              width: `${Math.random() * 10 + 5}px`,
              height: `${Math.random() * 10 + 5}px`,
              opacity: Math.random() * 0.3 + 0.1
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="landing-page">
      {/* 导航栏 */}
      <header className="landing-header glass-effect">
        <div className="landing-header-content">
          <div className="landing-logo">
            <img src={logo} alt="MindFlow" />
            <span>
              <span className="landing-logo-text-m">M</span>ind
              <span className="landing-logo-text-f">F</span>low
            </span>
          </div>
          <nav className="landing-nav">
            <a href="#features" className="hover-glow">功能</a>
            <a href="#community" className="hover-glow">社区</a>
            <a href="#tech" className="hover-glow">技术</a>
            <a href="#about" className="hover-glow">关于</a>
          </nav>
          <div className="landing-auth-buttons">
            <button
              className="landing-btn landing-btn-ghost hover-lift"
              onClick={() => navigate("/login")}
            >
              登录
            </button>
            <button
              className="landing-btn landing-btn-primary hover-lift ripple-effect"
              onClick={() => navigate("/register")}
            >
              免费注册
            </button>
          </div>
        </div>
      </header>

      {/* 英雄区域 */}
      <section className="landing-hero">
        {renderParticles()}
        <div className="landing-hero-background">
          <div className="landing-gradient-orb orb-1"></div>
          <div className="landing-gradient-orb orb-2"></div>
          <div className="landing-gradient-orb orb-3"></div>
        </div>

        <div className="landing-hero-content">
          <h1 className="landing-hero-title scroll-reveal">
            协作文档平台
            <br />
            <span className="landing-hero-highlight text-gradient">让思想流动起来</span>
          </h1>
          <p className="landing-hero-subtitle scroll-reveal" style={{ transitionDelay: '0.2s' }}>
            为现代团队打造的智能文档工具，实时协作、版本管理、安全可靠
          </p>
          {/* 快速特性标签 */}
          <div className="landing-hero-tags scroll-reveal" style={{ transitionDelay: '0.4s' }}>
            <span className="hero-tag">🚀 实时协作</span>
            <span className="hero-tag">📝 双模式编辑</span>
            <span className="hero-tag">🎥 视频会议</span>
            <span className="hero-tag">📊 版本管理</span>
          </div>

          <div className="landing-hero-cta scroll-reveal" style={{ transitionDelay: '0.6s' }}>
            <button
              className="landing-btn landing-btn-large landing-btn-primary hover-lift shimmer-effect"
              onClick={() => navigate("/register")}
            >
              免费开始使用
              <ion-icon name="arrow-forward-outline"></ion-icon>
            </button>
            <button
              className="landing-btn landing-btn-large landing-btn-secondary hover-lift"
              onClick={() => navigate("/login")}
            >
              登录账户
            </button>
          </div>
        </div>
      </section>

      {/* 特性区域 */}
      <section id="features" className="landing-features">
        <div className="landing-features-content">
          <h2 className="landing-section-title scroll-reveal">
            为<span className="landing-highlight-text text-gradient">团队协作</span>而生
          </h2>
          <p className="landing-section-subtitle scroll-reveal" style={{ transitionDelay: '0.2s' }}>
            我们专注于构建最好用的文档协作工具，让团队的思想自由流动
          </p>

          <div className="landing-features-grid">
            {features.map((feature, index) => (
              <div
                key={index}
                className="landing-feature-card hover-lift scroll-reveal"
                style={{
                  backgroundColor: feature.bgColor,
                  transitionDelay: `${0.1 * index}s`
                }}
              >
                <div className="feature-content">
                  <div className="feature-icon">
                    <ion-icon name={feature.icon}></ion-icon>
                  </div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                </div>
                <div className="feature-illustration">
                  <LazyImage
                    src={feature.illustration}
                    alt={feature.title}
                    placeholder="/placeholder.svg"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 开源与贡献 */}
      <section id="community" className="landing-community">
        <div className="landing-community-content">
          <h2 className="landing-section-title scroll-reveal">
            开放<span className="landing-highlight-text text-gradient">源代码</span>
          </h2>
          <p className="landing-section-subtitle scroll-reveal">
            MindFlow 是一个开源项目，我们期待你的参与和贡献
          </p>

          {/* 贡献方式 */}
          <div className="contribute-ways">
            <div className="contribute-card hover-lift scroll-reveal" style={{ transitionDelay: '0.1s' }}>
              <div className="contribute-icon">💻</div>
              <h3>代码贡献</h3>
              <p>提交 PR，帮助改进功能和修复 Bug</p>
            </div>
            <div className="contribute-card hover-lift scroll-reveal" style={{ transitionDelay: '0.2s' }}>
              <div className="contribute-icon">📖</div>
              <h3>文档完善</h3>
              <p>编写和改进项目文档，帮助更多人使用</p>
            </div>
            <div className="contribute-card hover-lift scroll-reveal" style={{ transitionDelay: '0.3s' }}>
              <div className="contribute-icon">🎨</div>
              <h3>设计建议</h3>
              <p>提供 UI/UX 设计建议，提升用户体验</p>
            </div>
            <div className="contribute-card hover-lift scroll-reveal" style={{ transitionDelay: '0.4s' }}>
              <div className="contribute-icon">🐛</div>
              <h3>问题反馈</h3>
              <p>报告 Bug 和提出功能需求</p>
            </div>
          </div>

          <div className="community-cta scroll-reveal">
            <a
              href="https://github.com/swpota"
              target="_blank"
              rel="noopener noreferrer"
              className="github-btn hover-lift ripple-effect"
            >
              <ion-icon name="logo-github"></ion-icon>
              在 GitHub 上查看
            </a>
          </div>
        </div>
      </section>

      {/* 技术栈展示 */}
      <section id="tech" className="landing-tech">
        <div className="landing-tech-content">
          <h2 className="landing-section-title scroll-reveal">
            现代化的<span className="landing-highlight-text text-gradient">技术栈</span>
          </h2>
          <p className="landing-section-subtitle scroll-reveal">
            使用最新的技术构建，性能强劲，易于扩展
          </p>

          <div className="tech-categories">
            <div className="tech-category scroll-reveal" style={{ transitionDelay: '0.1s' }}>
              <h3 className="tech-category-title">前端技术</h3>
              <div className="tech-items">
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #61DAFB 0%, #0088CC 100%)' }}>
                    <span>⚛️</span>
                  </div>
                  <span>React 18</span>
                </div>
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #646CFF 0%, #535FCF 100%)' }}>
                    <span>⚡</span>
                  </div>
                  <span>Vite</span>
                </div>
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%)' }}>
                    <span>🎨</span>
                  </div>
                  <span>CSS3</span>
                </div>
              </div>
            </div>

            <div className="tech-category scroll-reveal" style={{ transitionDelay: '0.2s' }}>
              <h3 className="tech-category-title">后端技术</h3>
              <div className="tech-items">
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #339933 0%, #66CC33 100%)' }}>
                    <span>🐢</span>
                  </div>
                  <span>Node.js</span>
                </div>
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #000000 0%, #404040 100%)' }}>
                    <span>⚡</span>
                  </div>
                  <span>Express 5</span>
                </div>
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #336791 0%, #2E5F8E 100%)' }}>
                    <span>🐘</span>
                  </div>
                  <span>PostgreSQL</span>
                </div>
              </div>
            </div>

            <div className="tech-category scroll-reveal" style={{ transitionDelay: '0.3s' }}>
              <h3 className="tech-category-title">实时通信</h3>
              <div className="tech-items">
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #010101 0%, #3E3E3E 100%)' }}>
                    <span>🔌</span>
                  </div>
                  <span>WebSocket</span>
                </div>
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #25C2A0 0%, #1DA87F 100%)' }}>
                    <span>💬</span>
                  </div>
                  <span>Socket.IO</span>
                </div>
                <div className="tech-item hover-lift">
                  <div className="tech-icon" style={{ background: 'linear-gradient(135deg, #DC382D 0%, #B52E24 100%)' }}>
                    <span>🚀</span>
                  </div>
                  <span>Redis</span>
                </div>
              </div>
            </div>
          </div>

          {/* 特性高亮 */}
          <div className="tech-highlights">
            <div className="tech-highlight-card hover-lift scroll-reveal" style={{ transitionDelay: '0.1s' }}>
              <div className="highlight-badge">⚡ 性能</div>
              <h4>极速响应</h4>
              <p>Vite 构建 + 代码分割，秒开应用</p>
            </div>
            <div className="tech-highlight-card hover-lift scroll-reveal" style={{ transitionDelay: '0.2s' }}>
              <div className="highlight-badge">🔒 安全</div>
              <h4>企业级安全</h4>
              <p>JWT 认证 + HTTPS + SQL 注入防护</p>
            </div>
            <div className="tech-highlight-card hover-lift scroll-reveal" style={{ transitionDelay: '0.3s' }}>
              <div className="highlight-badge">📱 响应式</div>
              <h4>全平台支持</h4>
              <p>完美适配桌面、平板、手机</p>
            </div>
            <div className="tech-highlight-card hover-lift scroll-reveal" style={{ transitionDelay: '0.4s' }}>
              <div className="highlight-badge">🌐 PWA</div>
              <h4>渐进式 Web 应用</h4>
              <p>支持离线使用，可安装到桌面</p>
            </div>
          </div>
        </div>
      </section>

      {/* 关于我们 */}
      <section id="about" className="landing-about">
        <div className="landing-about-content">
          <h2 className="landing-section-title scroll-reveal">
            关于<span className="landing-highlight-text text-gradient">MindFlow</span>
          </h2>

          <div className="landing-about-grid">
            <div className="about-text scroll-reveal">
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

            <div className="about-stats scroll-reveal" style={{ transitionDelay: '0.2s' }}>
              <div className="stat-card hover-lift">
                <div className="stat-number">🚀</div>
                <div className="stat-label">快速部署</div>
              </div>
              <div className="stat-card hover-lift">
                <div className="stat-number">💎</div>
                <div className="stat-label">完全免费</div>
              </div>
              <div className="stat-card hover-lift">
                <div className="stat-number">🔓</div>
                <div className="stat-label">开源透明</div>
              </div>
              <div className="stat-card hover-lift">
                <div className="stat-number">🌱</div>
                <div className="stat-label">持续进化</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA区域 */}
      <section className="landing-cta">
        <div className="landing-cta-content scroll-reveal">
          <h2 className="landing-cta-title">开始你的协作之旅</h2>
          <p className="landing-cta-subtitle">立即注册，开始你的高效协作体验</p>
          <button
            className="landing-btn landing-btn-large landing-btn-primary hover-lift shimmer-effect"
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
              <a href="#features" className="hover-glow">功能特性</a>
              <a href="#community" className="hover-glow">开源社区</a>
              <a href="#tech" className="hover-glow">技术栈</a>
              <a href="#about" className="hover-glow">关于我们</a>
            </div>

            <div className="landing-footer-section">
              <h4 className="landing-footer-section-title">资源</h4>
              <a href="#docs" className="hover-glow">文档中心</a>
              <a href="#tutorials" className="hover-glow">使用教程</a>
              <a href="#api" className="hover-glow">API 参考</a>
              <a href="#community" className="hover-glow">社区论坛</a>
            </div>

            <div className="landing-footer-section">
              <h4 className="landing-footer-section-title">公司</h4>
              <a href="#about" className="hover-glow">关于我们</a>
              <a href="mailto:1452682204@qq.com" className="hover-glow">QQ邮箱</a>
              <a href="mailto:1452682204se@gmail.com" className="hover-glow">Google邮箱</a>
              <a href="https://github.com/swpota" target="_blank" rel="noopener noreferrer" className="hover-glow">GitHub</a>
            </div>

            <div className="landing-footer-section">
              <h4 className="landing-footer-section-title">法律</h4>
              <a href="#privacy" className="hover-glow">隐私政策</a>
              <a href="#terms" className="hover-glow">服务条款</a>
              <a href="#security" className="hover-glow">安全说明</a>
              <a href="#compliance" className="hover-glow">合规性</a>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <p className="landing-footer-copyright">
              © 2025 MindFlow. All rights reserved.
            </p>
            <div className="landing-footer-social">
              <a href="https://github.com/swpota" target="_blank" rel="noopener noreferrer" className="landing-footer-social-link hover-lift" aria-label="GitHub">
                <ion-icon name="logo-github"></ion-icon>
              </a>
              <a href="mailto:1452682204@qq.com" className="landing-footer-social-link hover-lift" aria-label="QQ Email">
                <ion-icon name="mail-outline"></ion-icon>
              </a>
              <a href="mailto:1452682204se@gmail.com" className="landing-footer-social-link hover-lift" aria-label="Gmail">
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
