import { Injectable } from '@nestjs/common';
import { appLogger } from '../../logger/winston.logger';

interface MetricEntry {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

interface Counter {
  value: number;
  labels: Record<string, string>;
}

interface Gauge {
  value: number;
  labels: Record<string, string>;
}

@Injectable()
export class MetricsService {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private startTime: Date = new Date();

  constructor() {
    // Initialize system metrics collection
    this.initializeSystemMetrics();
  }

  /**
   * Increment a counter metric
   */
  public incrementCounter(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.createMetricKey(name, labels);
    const existing = this.counters.get(key);
    
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { value, labels: labels || {} });
    }

    this.logMetric(name, value, labels, 'counter');
  }

  /**
   * Set a gauge metric value
   */
  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.createMetricKey(name, labels);
    this.gauges.set(key, { value, labels: labels || {} });
    
    this.logMetric(name, value, labels, 'gauge');
  }

  /**
   * Add a value to a histogram
   */
  public recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.createMetricKey(name, labels);
    const existing = this.histograms.get(key) || [];
    existing.push(value);
    this.histograms.set(key, existing);

    this.logMetric(name, value, labels, 'histogram');
  }

  /**
   * Record HTTP request metrics
   */
  public recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    const labels = { method, route, status: statusCode.toString() };
    
    // Increment request counter
    this.incrementCounter('http_requests_total', labels);
    
    // Record response time
    this.recordHistogram('http_request_duration_ms', duration, labels);
    
    // Count errors
    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', labels);
    }
  }

  /**
   * Record database query metrics
   */
  public recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean): void {
    const labels = { operation, table, success: success.toString() };
    
    this.incrementCounter('db_queries_total', labels);
    this.recordHistogram('db_query_duration_ms', duration, labels);
    
    if (!success) {
      this.incrementCounter('db_errors_total', labels);
    }
  }

  /**
   * Record CDC event metrics
   */
  public recordCDCEvent(tableName: string, operation: string): void {
    const labels = { table: tableName, operation };
    this.incrementCounter('cdc_events_total', labels);
  }

  /**
   * Record message publishing metrics
   */
  public recordMessagePublished(topic: string, success: boolean, duration: number): void {
    const labels = { topic, success: success.toString() };
    
    this.incrementCounter('messages_published_total', labels);
    this.recordHistogram('message_publish_duration_ms', duration, labels);
    
    if (!success) {
      this.incrementCounter('message_publish_errors_total', labels);
    }
  }

  /**
   * Record user action metrics
   */
  public recordUserAction(action: string, userId?: string): void {
    const labels = { action };
    if (userId) {
      labels['user_type'] = 'authenticated';
    } else {
      labels['user_type'] = 'anonymous';
    }
    
    this.incrementCounter('user_actions_total', labels);
  }

  /**
   * Record authentication metrics
   */
  public recordAuthEvent(event: string, success: boolean, provider?: string): void {
    const labels = { event, success: success.toString() };
    if (provider) {
      labels['provider'] = provider;
    }
    
    this.incrementCounter('auth_events_total', labels);
    
    if (!success) {
      this.incrementCounter('auth_failures_total', labels);
    }
  }

  /**
   * Get current metrics summary
   */
  public getMetrics(): {
    counters: Record<string, Counter>;
    gauges: Record<string, Gauge>;
    histograms: Record<string, { count: number; min: number; max: number; avg: number }>;
    system: any;
  } {
    const countersObj: Record<string, Counter> = {};
    this.counters.forEach((value, key) => {
      countersObj[key] = value;
    });

    const gaugesObj: Record<string, Gauge> = {};
    this.gauges.forEach((value, key) => {
      gaugesObj[key] = value;
    });

    const histogramsObj: Record<string, any> = {};
    this.histograms.forEach((values, key) => {
      if (values.length > 0) {
        histogramsObj[key] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        };
      }
    });

    return {
      counters: countersObj,
      gauges: gaugesObj,
      histograms: histogramsObj,
      system: this.getSystemMetrics(),
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  public reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    
    appLogger.info('Metrics reset', {
      operation: 'metrics_reset',
      component: 'metrics_service',
    });
  }

  /**
   * Get application uptime
   */
  public getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  private createMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `${name}{${labelString}}`;
  }

  private logMetric(name: string, value: number, labels?: Record<string, string>, type?: string): void {
    // Only log metrics in development or when specifically enabled
    if (process.env.NODE_ENV === 'development' || process.env.LOG_METRICS === 'true') {
      appLogger.debug(`Metric recorded: ${name}`, {
        operation: 'metric_recorded',
        component: 'metrics_service',
        metric: name,
        value,
        type,
        labels,
      });
    }

    // Send metrics to Elasticsearch with a different index pattern
    appLogger.info(`Metric: ${name}`, {
      operation: 'application_metric',
      component: 'metrics',
      metric: name,
      value,
      type,
      labels,
      timestamp: new Date().toISOString(),
    });
  }

  private initializeSystemMetrics(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      const memUsage = process.memoryUsage();
      
      this.setGauge('process_memory_rss_bytes', memUsage.rss);
      this.setGauge('process_memory_heap_total_bytes', memUsage.heapTotal);
      this.setGauge('process_memory_heap_used_bytes', memUsage.heapUsed);
      this.setGauge('process_memory_external_bytes', memUsage.external);
      
      const cpuUsage = process.cpuUsage();
      this.setGauge('process_cpu_user_seconds_total', cpuUsage.user / 1000000);
      this.setGauge('process_cpu_system_seconds_total', cpuUsage.system / 1000000);
      
      this.setGauge('process_uptime_seconds', this.getUptime() / 1000);
    }, 30000); // Every 30 seconds

    appLogger.info('System metrics collection initialized', {
      operation: 'metrics_init',
      component: 'metrics_service',
      interval: '30s',
    });
  }

  private getSystemMetrics(): any {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        heapUsedPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: this.getUptime(),
      nodeVersion: process.version,
      platform: process.platform,
    };
  }
}