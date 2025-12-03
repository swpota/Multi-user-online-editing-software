/**
 * 性能监控工具
 * 追踪和分析应用性能指标
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      navigation: {},
      resources: [],
      marks: {},
      measures: {},
      vitals: {},
    };
    this.observers = [];
  }

  /**
   * 初始化性能监控
   */
  init() {
    if (typeof window === 'undefined') return;

    // 监控页面加载性能
    this.measurePageLoad();

    // 监控资源加载
    this.measureResources();

    // 监控 Long Tasks
    this.observeLongTasks();

    // 监控布局偏移
    this.observeLayoutShift();

    // 监控首次内容绘制
    this.observePaint();
  }

  /**
   * 测量页面加载性能
   */
  measurePageLoad() {
    if (!window.performance || !window.performance.timing) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = window.performance.timing;
        const navigation = {
          // DNS 查询时间
          dns: timing.domainLookupEnd - timing.domainLookupStart,
          // TCP 连接时间
          tcp: timing.connectEnd - timing.connectStart,
          // 请求时间
          request: timing.responseStart - timing.requestStart,
          // 响应时间
          response: timing.responseEnd - timing.responseStart,
          // DOM 解析时间
          domParse: timing.domInteractive - timing.responseEnd,
          // 资源加载时间
          resourceLoad: timing.loadEventStart - timing.domContentLoadedEventEnd,
          // 总时间
          total: timing.loadEventEnd - timing.navigationStart,
          // 白屏时间
          whiteScreen: timing.responseStart - timing.navigationStart,
          // 首屏时间
          firstScreen: timing.domContentLoadedEventEnd - timing.navigationStart,
          // DOM Ready 时间
          domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
          // 完全加载时间
          loaded: timing.loadEventEnd - timing.navigationStart,
        };

        this.metrics.navigation = navigation;
        this.log('页面加载性能', navigation);
      }, 0);
    });
  }

  /**
   * 测量资源加载性能
   */
  measureResources() {
    if (!window.performance || !window.performance.getEntriesByType) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const resources = window.performance.getEntriesByType('resource');
        const resourceMetrics = resources.map(resource => ({
          name: resource.name,
          type: resource.initiatorType,
          duration: Math.round(resource.duration),
          size: resource.transferSize || 0,
          startTime: Math.round(resource.startTime),
        }));

        this.metrics.resources = resourceMetrics;

        // 按类型分组统计
        const byType = resourceMetrics.reduce((acc, resource) => {
          if (!acc[resource.type]) {
            acc[resource.type] = {
              count: 0,
              totalSize: 0,
              totalDuration: 0,
            };
          }
          acc[resource.type].count++;
          acc[resource.type].totalSize += resource.size;
          acc[resource.type].totalDuration += resource.duration;
          return acc;
        }, {});

        this.log('资源加载统计', byType);
      }, 0);
    });
  }

  /**
   * 监控长任务（Long Tasks）
   */
  observeLongTasks() {
    if (!window.PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.log('检测到长任务', {
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
          });
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
      this.observers.push(observer);
    } catch (e) {
      // Long Task API 可能不被支持
    }
  }

  /**
   * 监控布局偏移（Layout Shift）
   */
  observeLayoutShift() {
    if (!window.PerformanceObserver) return;

    try {
      let clsScore = 0;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
          }
        }
        this.metrics.vitals.cls = clsScore;
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (e) {
      // Layout Shift API 可能不被支持
    }
  }

  /**
   * 监控首次绘制
   */
  observePaint() {
    if (!window.PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-paint') {
            this.metrics.vitals.fp = Math.round(entry.startTime);
          }
          if (entry.name === 'first-contentful-paint') {
            this.metrics.vitals.fcp = Math.round(entry.startTime);
          }
        }
      });

      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (e) {
      // Paint API 可能不被支持
    }
  }

  /**
   * 自定义性能标记
   */
  mark(name) {
    if (!window.performance || !window.performance.mark) return;

    try {
      window.performance.mark(name);
      this.metrics.marks[name] = Date.now();
    } catch (e) {
      console.warn('性能标记失败', e);
    }
  }

  /**
   * 测量两个标记之间的时间
   */
  measure(name, startMark, endMark) {
    if (!window.performance || !window.performance.measure) return;

    try {
      window.performance.measure(name, startMark, endMark);
      const measure = window.performance.getEntriesByName(name)[0];
      if (measure) {
        this.metrics.measures[name] = Math.round(measure.duration);
        this.log(`性能测量: ${name}`, `${Math.round(measure.duration)}ms`);
      }
    } catch (e) {
      console.warn('性能测量失败', e);
    }
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    if (!window.performance || !window.performance.memory) {
      return null;
    }

    const memory = window.performance.memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      usage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100), // %
    };
  }

  /**
   * 获取网络信息
   */
  getNetworkInfo() {
    if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) {
      return null;
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      effectiveType: connection.effectiveType, // 4g, 3g, 2g, slow-2g
      downlink: connection.downlink, // Mbps
      rtt: connection.rtt, // ms
      saveData: connection.saveData, // boolean
    };
  }

  /**
   * 获取所有性能指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      memory: this.getMemoryUsage(),
      network: this.getNetworkInfo(),
      timestamp: Date.now(),
    };
  }

  /**
   * 生成性能报告
   */
  generateReport() {
    const metrics = this.getMetrics();
    const { navigation, vitals, memory, network } = metrics;

    const report = {
      // 页面加载性能评分
      loadScore: this.calculateLoadScore(navigation),
      
      // Web Vitals 评分
      vitalsScore: this.calculateVitalsScore(vitals),
      
      // 资源加载评分
      resourceScore: this.calculateResourceScore(metrics.resources),
      
      // 总体评分
      overallScore: 0,
      
      // 详细指标
      details: {
        navigation,
        vitals,
        memory,
        network,
        resources: metrics.resources,
      },
      
      // 优化建议
      suggestions: this.generateSuggestions(metrics),
    };

    // 计算总体评分（加权平均）
    report.overallScore = Math.round(
      report.loadScore * 0.4 +
      report.vitalsScore * 0.4 +
      report.resourceScore * 0.2
    );

    return report;
  }

  /**
   * 计算页面加载评分
   */
  calculateLoadScore(navigation) {
    if (!navigation || !navigation.total) return 0;

    const total = navigation.total;
    
    // 评分标准
    if (total < 1000) return 100; // 优秀
    if (total < 2000) return 90;  // 良好
    if (total < 3000) return 75;  // 一般
    if (total < 5000) return 50;  // 较差
    return 25; // 很差
  }

  /**
   * 计算 Web Vitals 评分
   */
  calculateVitalsScore(vitals) {
    if (!vitals) return 0;

    let score = 100;
    
    // FCP (First Contentful Paint)
    if (vitals.fcp) {
      if (vitals.fcp > 3000) score -= 25;
      else if (vitals.fcp > 1800) score -= 15;
    }
    
    // CLS (Cumulative Layout Shift)
    if (vitals.cls) {
      if (vitals.cls > 0.25) score -= 25;
      else if (vitals.cls > 0.1) score -= 15;
    }

    return Math.max(0, score);
  }

  /**
   * 计算资源加载评分
   */
  calculateResourceScore(resources) {
    if (!resources || resources.length === 0) return 100;

    const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
    const avgDuration = resources.reduce((sum, r) => sum + r.duration, 0) / resources.length;

    let score = 100;

    // 根据总大小评分（MB）
    const sizeMB = totalSize / 1048576;
    if (sizeMB > 5) score -= 30;
    else if (sizeMB > 3) score -= 20;
    else if (sizeMB > 2) score -= 10;

    // 根据平均加载时间评分
    if (avgDuration > 500) score -= 20;
    else if (avgDuration > 300) score -= 10;

    return Math.max(0, score);
  }

  /**
   * 生成优化建议
   */
  generateSuggestions(metrics) {
    const suggestions = [];
    const { navigation, resources, memory, vitals } = metrics;

    // 页面加载建议
    if (navigation.total > 3000) {
      suggestions.push({
        type: 'warning',
        category: '页面加载',
        message: '页面加载时间较长，建议优化资源加载',
        details: `当前加载时间: ${navigation.total}ms`,
      });
    }

    // 资源优化建议
    if (resources.length > 50) {
      suggestions.push({
        type: 'info',
        category: '资源优化',
        message: '资源请求数量较多，建议合并资源',
        details: `当前资源数: ${resources.length}`,
      });
    }

    const totalSize = resources.reduce((sum, r) => sum + r.size, 0) / 1048576;
    if (totalSize > 3) {
      suggestions.push({
        type: 'warning',
        category: '资源大小',
        message: '资源总大小较大，建议压缩和优化',
        details: `当前总大小: ${totalSize.toFixed(2)}MB`,
      });
    }

    // 内存使用建议
    if (memory && memory.usage > 80) {
      suggestions.push({
        type: 'error',
        category: '内存使用',
        message: '内存使用率过高，可能存在内存泄漏',
        details: `当前使用率: ${memory.usage}%`,
      });
    }

    // Web Vitals 建议
    if (vitals.fcp > 2500) {
      suggestions.push({
        type: 'warning',
        category: 'Web Vitals',
        message: '首次内容绘制时间较长',
        details: `FCP: ${vitals.fcp}ms (建议 < 1800ms)`,
      });
    }

    if (vitals.cls > 0.1) {
      suggestions.push({
        type: 'warning',
        category: 'Web Vitals',
        message: '布局偏移较大，影响用户体验',
        details: `CLS: ${vitals.cls.toFixed(3)} (建议 < 0.1)`,
      });
    }

    return suggestions;
  }

  /**
   * 日志输出
   */
  log(title, data) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[性能监控] ${title}`, data);
    }
  }

  /**
   * 清理监控器
   */
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// 创建单例
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
