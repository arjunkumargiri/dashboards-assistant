/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  level: 'warning' | 'critical';
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface PerformanceDashboard {
  realTimeMetrics: Record<string, PerformanceMetric>;
  alerts: PerformanceAlert[];
  trends: {
    extractionTime: number[];
    memoryUsage: number[];
    cacheHitRate: number[];
    errorRate: number[];
  };
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
  };
}

export class PerformanceMonitoringService {
  private savedObjectsClient: SavedObjectsClientContract;
  private logger: Logger;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(savedObjectsClient: SavedObjectsClientContract, logger: Logger) {
    this.savedObjectsClient = savedObjectsClient;
    this.logger = logger;
    this.initializeThresholds();
    this.startMonitoring();
  }

  private initializeThresholds(): void {
    const defaultThresholds: PerformanceThreshold[] = [
      {
        metric: 'extraction_time',
        warning: 3000,
        critical: 8000,
        unit: 'ms',
      },
      {
        metric: 'memory_usage',
        warning: 50 * 1024 * 1024, // 50MB
        critical: 100 * 1024 * 1024, // 100MB
        unit: 'bytes',
      },
      {
        metric: 'cache_hit_rate',
        warning: 0.6, // 60%
        critical: 0.4, // 40%
        unit: 'percentage',
      },
      {
        metric: 'error_rate',
        warning: 0.05, // 5%
        critical: 0.1, // 10%
        unit: 'percentage',
      },
      {
        metric: 'active_contexts',
        warning: 100,
        critical: 200,
        unit: 'count',
      },
      {
        metric: 'dom_observation_lag',
        warning: 1000,
        critical: 3000,
        unit: 'ms',
      },
    ];

    defaultThresholds.forEach(threshold => {
      this.thresholds.set(threshold.metric, threshold);
    });
  }

  public recordMetric(
    name: string,
    value: number,
    unit: string,
    context?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      context,
    };

    // Store in memory for real-time access
    const metricHistory = this.metrics.get(name) || [];
    metricHistory.push(metric);
    
    // Keep only last 100 metrics per type
    if (metricHistory.length > 100) {
      metricHistory.shift();
    }
    
    this.metrics.set(name, metricHistory);

    // Check thresholds
    this.checkThresholds(metric);

    // Log significant metrics
    if (this.isSignificantMetric(name, value)) {
      this.logger.info(`Performance metric: ${name} = ${value} ${unit}`, context);
    }
  }

  public recordExtractionTime(time: number, contentTypes: string[], success: boolean): void {
    this.recordMetric('extraction_time', time, 'ms', {
      contentTypes,
      success,
      contentCount: contentTypes.length,
    });
  }

  public recordMemoryUsage(usage: number): void {
    this.recordMetric('memory_usage', usage, 'bytes');
  }

  public recordCacheHit(hit: boolean): void {
    // Calculate hit rate over last 100 cache operations
    const cacheMetrics = this.metrics.get('cache_operations') || [];
    cacheMetrics.push({
      name: 'cache_operations',
      value: hit ? 1 : 0,
      unit: 'boolean',
      timestamp: Date.now(),
    });

    if (cacheMetrics.length > 100) {
      cacheMetrics.shift();
    }

    this.metrics.set('cache_operations', cacheMetrics);

    // Calculate hit rate
    const hits = cacheMetrics.filter(m => m.value === 1).length;
    const hitRate = cacheMetrics.length > 0 ? hits / cacheMetrics.length : 0;
    
    this.recordMetric('cache_hit_rate', hitRate, 'percentage');
  }

  public recordError(errorType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    // Track error rate over time
    const errorMetrics = this.metrics.get('errors') || [];
    errorMetrics.push({
      name: 'errors',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      context: { errorType, severity },
    });

    if (errorMetrics.length > 1000) {
      errorMetrics.shift();
    }

    this.metrics.set('errors', errorMetrics);

    // Calculate error rate over last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentErrors = errorMetrics.filter(m => m.timestamp > oneHourAgo);
    const totalOperations = this.getTotalOperationsLastHour();
    const errorRate = totalOperations > 0 ? recentErrors.length / totalOperations : 0;

    this.recordMetric('error_rate', errorRate, 'percentage', { errorType, severity });
  }

  public recordActiveContexts(count: number): void {
    this.recordMetric('active_contexts', count, 'count');
  }

  public recordDOMObservationLag(lag: number): void {
    this.recordMetric('dom_observation_lag', lag, 'ms');
  }

  public async getDashboard(): Promise<PerformanceDashboard> {
    try {
      const realTimeMetrics = this.getRealTimeMetrics();
      const alerts = Array.from(this.activeAlerts.values());
      const trends = await this.getTrends();
      const systemHealth = this.calculateSystemHealth();

      return {
        realTimeMetrics,
        alerts,
        trends,
        systemHealth,
      };
    } catch (error) {
      this.logger.error('Failed to get performance dashboard', error);
      throw error;
    }
  }

  public getMetricHistory(metricName: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.slice(-limit);
  }

  public async getAlertsHistory(limit: number = 50): Promise<PerformanceAlert[]> {
    try {
      const response = await this.savedObjectsClient.find({
        type: 'contextual-chat-performance-alerts',
        perPage: limit,
        sortField: 'timestamp',
        sortOrder: 'desc',
      });

      return response.saved_objects.map(obj => obj.attributes as PerformanceAlert);
    } catch (error) {
      this.logger.error('Failed to get alerts history', error);
      return [];
    }
  }

  public updateThreshold(metric: string, threshold: Partial<PerformanceThreshold>): void {
    const existing = this.thresholds.get(metric);
    if (existing) {
      this.thresholds.set(metric, { ...existing, ...threshold });
      this.logger.info(`Updated threshold for ${metric}`, threshold);
    } else {
      this.logger.warn(`Attempted to update threshold for unknown metric: ${metric}`);
    }
  }

  public async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      
      try {
        await this.savedObjectsClient.update(
          'contextual-chat-performance-alerts',
          alertId,
          alert
        );
        
        this.activeAlerts.delete(alertId);
        this.logger.info(`Resolved performance alert: ${alertId}`);
      } catch (error) {
        this.logger.error(`Failed to resolve alert ${alertId}`, error);
        throw error;
      }
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name);
    if (!threshold) return;

    let alertLevel: 'warning' | 'critical' | null = null;
    let thresholdValue: number;

    if (metric.name === 'cache_hit_rate') {
      // For cache hit rate, lower values are worse
      if (metric.value < threshold.critical) {
        alertLevel = 'critical';
        thresholdValue = threshold.critical;
      } else if (metric.value < threshold.warning) {
        alertLevel = 'warning';
        thresholdValue = threshold.warning;
      }
    } else {
      // For most metrics, higher values are worse
      if (metric.value > threshold.critical) {
        alertLevel = 'critical';
        thresholdValue = threshold.critical;
      } else if (metric.value > threshold.warning) {
        alertLevel = 'warning';
        thresholdValue = threshold.warning;
      }
    }

    if (alertLevel) {
      this.createAlert(metric, alertLevel, thresholdValue);
    }
  }

  private async createAlert(
    metric: PerformanceMetric,
    level: 'warning' | 'critical',
    threshold: number
  ): Promise<void> {
    const alertId = `${metric.name}-${level}-${Date.now()}`;
    const alert: PerformanceAlert = {
      id: alertId,
      metric: metric.name,
      level,
      value: metric.value,
      threshold,
      timestamp: metric.timestamp,
      resolved: false,
    };

    this.activeAlerts.set(alertId, alert);

    try {
      await this.savedObjectsClient.create(
        'contextual-chat-performance-alerts',
        alert,
        { id: alertId }
      );

      this.logger.warn(
        `Performance alert: ${metric.name} ${level}`,
        {
          value: metric.value,
          threshold,
          unit: metric.unit,
          context: metric.context,
        }
      );
    } catch (error) {
      this.logger.error('Failed to save performance alert', error);
    }
  }

  private getRealTimeMetrics(): Record<string, PerformanceMetric> {
    const realTime: Record<string, PerformanceMetric> = {};

    this.metrics.forEach((metricHistory, name) => {
      if (metricHistory.length > 0) {
        realTime[name] = metricHistory[metricHistory.length - 1];
      }
    });

    return realTime;
  }

  private async getTrends(): Promise<PerformanceDashboard['trends']> {
    const extractionTime = this.getMetricHistory('extraction_time', 24).map(m => m.value);
    const memoryUsage = this.getMetricHistory('memory_usage', 24).map(m => m.value);
    const cacheHitRate = this.getMetricHistory('cache_hit_rate', 24).map(m => m.value);
    const errorRate = this.getMetricHistory('error_rate', 24).map(m => m.value);

    return {
      extractionTime,
      memoryUsage,
      cacheHitRate,
      errorRate,
    };
  }

  private calculateSystemHealth(): PerformanceDashboard['systemHealth'] {
    const issues: string[] = [];
    let score = 100;

    // Check each metric against thresholds
    const realTimeMetrics = this.getRealTimeMetrics();
    
    Object.entries(realTimeMetrics).forEach(([name, metric]) => {
      const threshold = this.thresholds.get(name);
      if (!threshold) return;

      if (name === 'cache_hit_rate') {
        if (metric.value < threshold.critical) {
          issues.push(`Critical: Low cache hit rate (${(metric.value * 100).toFixed(1)}%)`);
          score -= 30;
        } else if (metric.value < threshold.warning) {
          issues.push(`Warning: Cache hit rate below optimal (${(metric.value * 100).toFixed(1)}%)`);
          score -= 15;
        }
      } else {
        if (metric.value > threshold.critical) {
          issues.push(`Critical: High ${name} (${metric.value} ${metric.unit})`);
          score -= 30;
        } else if (metric.value > threshold.warning) {
          issues.push(`Warning: Elevated ${name} (${metric.value} ${metric.unit})`);
          score -= 15;
        }
      }
    });

    // Check for active alerts
    const criticalAlerts = Array.from(this.activeAlerts.values()).filter(a => a.level === 'critical');
    const warningAlerts = Array.from(this.activeAlerts.values()).filter(a => a.level === 'warning');

    score -= criticalAlerts.length * 20;
    score -= warningAlerts.length * 10;

    score = Math.max(0, score);

    let status: PerformanceDashboard['systemHealth']['status'];
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return { status, score, issues };
  }

  private isSignificantMetric(name: string, value: number): boolean {
    const threshold = this.thresholds.get(name);
    if (!threshold) return false;

    // Log if value exceeds warning threshold
    if (name === 'cache_hit_rate') {
      return value < threshold.warning;
    } else {
      return value > threshold.warning;
    }
  }

  private getTotalOperationsLastHour(): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let totalOperations = 0;

    // Count extraction operations
    const extractions = this.metrics.get('extraction_time') || [];
    totalOperations += extractions.filter(m => m.timestamp > oneHourAgo).length;

    // Count cache operations
    const cacheOps = this.metrics.get('cache_operations') || [];
    totalOperations += cacheOps.filter(m => m.timestamp > oneHourAgo).length;

    return totalOperations;
  }

  private startMonitoring(): void {
    // Collect system metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  private collectSystemMetrics(): void {
    // Collect memory usage
    if (process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.recordMemoryUsage(memUsage.heapUsed);
    }

    // Clean up old metrics to prevent memory leaks
    this.cleanupOldMetrics();
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    this.metrics.forEach((metricHistory, name) => {
      const filtered = metricHistory.filter(m => m.timestamp > oneHourAgo);
      this.metrics.set(name, filtered);
    });
  }

  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}