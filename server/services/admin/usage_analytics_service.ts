/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';

export interface UsageEvent {
  eventType: 'context_extraction' | 'chat_interaction' | 'feature_usage' | 'error' | 'performance';
  timestamp: number;
  userId?: string;
  sessionId?: string;
  metadata: Record<string, any>;
}

export interface AnalyticsReport {
  period: {
    start: number;
    end: number;
  };
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    uniqueSessions: number;
  };
  contextExtractions: {
    total: number;
    averageTime: number;
    successRate: number;
    byContentType: Record<string, number>;
  };
  chatInteractions: {
    total: number;
    averageResponseTime: number;
    contextualQueries: number;
    fallbackQueries: number;
  };
  featureUsage: {
    mostUsed: Array<{ feature: string; count: number; percentage: number }>;
    leastUsed: Array<{ feature: string; count: number; percentage: number }>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    criticalErrors: number;
  };
  performance: {
    averageExtractionTime: number;
    cacheHitRate: number;
    memoryUsage: {
      average: number;
      peak: number;
    };
  };
}

export interface TrendData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>;
}

export class UsageAnalyticsService {
  private savedObjectsClient: SavedObjectsClientContract;
  private logger: Logger;
  private eventBuffer: UsageEvent[] = [];
  private bufferSize = 100;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(savedObjectsClient: SavedObjectsClientContract, logger: Logger) {
    this.savedObjectsClient = savedObjectsClient;
    this.logger = logger;
    this.startPeriodicFlush();
  }

  public trackEvent(event: UsageEvent): void {
    this.eventBuffer.push(event);
    
    if (this.eventBuffer.length >= this.bufferSize) {
      this.flushEvents();
    }
  }

  public trackContextExtraction(
    userId: string,
    sessionId: string,
    extractionTime: number,
    contentTypes: string[],
    success: boolean,
    errorMessage?: string
  ): void {
    this.trackEvent({
      eventType: 'context_extraction',
      timestamp: Date.now(),
      userId,
      sessionId,
      metadata: {
        extractionTime,
        contentTypes,
        success,
        errorMessage,
        contentCount: contentTypes.length,
      },
    });
  }

  public trackChatInteraction(
    userId: string,
    sessionId: string,
    responseTime: number,
    hasContext: boolean,
    queryType: 'contextual' | 'fallback',
    contextSize?: number
  ): void {
    this.trackEvent({
      eventType: 'chat_interaction',
      timestamp: Date.now(),
      userId,
      sessionId,
      metadata: {
        responseTime,
        hasContext,
        queryType,
        contextSize,
      },
    });
  }

  public trackFeatureUsage(
    userId: string,
    sessionId: string,
    feature: string,
    action: string,
    metadata?: Record<string, any>
  ): void {
    this.trackEvent({
      eventType: 'feature_usage',
      timestamp: Date.now(),
      userId,
      sessionId,
      metadata: {
        feature,
        action,
        ...metadata,
      },
    });
  }

  public trackError(
    userId: string,
    sessionId: string,
    errorType: string,
    errorMessage: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: Record<string, any>
  ): void {
    this.trackEvent({
      eventType: 'error',
      timestamp: Date.now(),
      userId,
      sessionId,
      metadata: {
        errorType,
        errorMessage,
        severity,
        context,
      },
    });
  }

  public trackPerformance(
    userId: string,
    sessionId: string,
    metric: string,
    value: number,
    unit: string,
    context?: Record<string, any>
  ): void {
    this.trackEvent({
      eventType: 'performance',
      timestamp: Date.now(),
      userId,
      sessionId,
      metadata: {
        metric,
        value,
        unit,
        context,
      },
    });
  }

  public async generateReport(
    startTime: number,
    endTime: number
  ): Promise<AnalyticsReport> {
    try {
      const events = await this.getEventsInRange(startTime, endTime);
      
      return {
        period: { start: startTime, end: endTime },
        summary: this.calculateSummary(events),
        contextExtractions: this.analyzeContextExtractions(events),
        chatInteractions: this.analyzeChatInteractions(events),
        featureUsage: this.analyzeFeatureUsage(events),
        errors: this.analyzeErrors(events),
        performance: this.analyzePerformance(events),
      };
    } catch (error) {
      this.logger.error('Failed to generate analytics report', error);
      throw error;
    }
  }

  public async getTrendData(
    metric: string,
    period: 'hour' | 'day' | 'week' | 'month',
    count: number
  ): Promise<TrendData> {
    try {
      const timeRanges = this.generateTimeRanges(period, count);
      const datasets: TrendData['datasets'] = [];

      switch (metric) {
        case 'context_extractions':
          datasets.push(await this.getContextExtractionTrend(timeRanges));
          break;
        case 'chat_interactions':
          datasets.push(await this.getChatInteractionTrend(timeRanges));
          break;
        case 'error_rate':
          datasets.push(await this.getErrorRateTrend(timeRanges));
          break;
        case 'performance':
          datasets.push(...await this.getPerformanceTrends(timeRanges));
          break;
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }

      return {
        labels: timeRanges.map(range => this.formatTimeLabel(range.start, period)),
        datasets,
      };
    } catch (error) {
      this.logger.error(`Failed to get trend data for ${metric}`, error);
      throw error;
    }
  }

  public async getTopUsers(limit: number = 10): Promise<Array<{
    userId: string;
    eventCount: number;
    lastActivity: number;
    topFeatures: string[];
  }>> {
    try {
      const events = await this.getRecentEvents(7 * 24 * 60 * 60 * 1000); // Last 7 days
      const userStats = new Map<string, {
        eventCount: number;
        lastActivity: number;
        features: Map<string, number>;
      }>();

      events.forEach(event => {
        if (!event.userId) return;

        const stats = userStats.get(event.userId) || {
          eventCount: 0,
          lastActivity: 0,
          features: new Map(),
        };

        stats.eventCount++;
        stats.lastActivity = Math.max(stats.lastActivity, event.timestamp);

        if (event.eventType === 'feature_usage' && event.metadata.feature) {
          const currentCount = stats.features.get(event.metadata.feature) || 0;
          stats.features.set(event.metadata.feature, currentCount + 1);
        }

        userStats.set(event.userId, stats);
      });

      return Array.from(userStats.entries())
        .map(([userId, stats]) => ({
          userId,
          eventCount: stats.eventCount,
          lastActivity: stats.lastActivity,
          topFeatures: Array.from(stats.features.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([feature]) => feature),
        }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get top users', error);
      throw error;
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.savedObjectsClient.create(
        'contextual-chat-usage-events',
        {
          events: eventsToFlush,
          timestamp: Date.now(),
        },
        { id: `events-${Date.now()}` }
      );

      this.logger.debug(`Flushed ${eventsToFlush.length} usage events`);
    } catch (error) {
      this.logger.error('Failed to flush usage events', error);
      // Put events back in buffer to retry later
      this.eventBuffer.unshift(...eventsToFlush);
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);
  }

  private async getEventsInRange(startTime: number, endTime: number): Promise<UsageEvent[]> {
    try {
      const response = await this.savedObjectsClient.find({
        type: 'contextual-chat-usage-events',
        filter: `contextual-chat-usage-events.attributes.timestamp:[${startTime} TO ${endTime}]`,
        perPage: 10000,
      });

      const events: UsageEvent[] = [];
      response.saved_objects.forEach(obj => {
        const eventBatch = obj.attributes as { events: UsageEvent[] };
        events.push(...eventBatch.events.filter(
          event => event.timestamp >= startTime && event.timestamp <= endTime
        ));
      });

      return events;
    } catch (error) {
      this.logger.error('Failed to get events in range', error);
      return [];
    }
  }

  private async getRecentEvents(timeRange: number): Promise<UsageEvent[]> {
    const endTime = Date.now();
    const startTime = endTime - timeRange;
    return this.getEventsInRange(startTime, endTime);
  }

  private calculateSummary(events: UsageEvent[]): AnalyticsReport['summary'] {
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean)).size;
    const uniqueSessions = new Set(events.map(e => e.sessionId).filter(Boolean)).size;

    return {
      totalEvents: events.length,
      uniqueUsers,
      uniqueSessions,
    };
  }

  private analyzeContextExtractions(events: UsageEvent[]): AnalyticsReport['contextExtractions'] {
    const extractions = events.filter(e => e.eventType === 'context_extraction');
    const successful = extractions.filter(e => e.metadata.success);
    const byContentType: Record<string, number> = {};

    let totalTime = 0;
    extractions.forEach(event => {
      totalTime += event.metadata.extractionTime || 0;
      if (event.metadata.contentTypes) {
        event.metadata.contentTypes.forEach((type: string) => {
          byContentType[type] = (byContentType[type] || 0) + 1;
        });
      }
    });

    return {
      total: extractions.length,
      averageTime: extractions.length > 0 ? totalTime / extractions.length : 0,
      successRate: extractions.length > 0 ? successful.length / extractions.length : 0,
      byContentType,
    };
  }

  private analyzeChatInteractions(events: UsageEvent[]): AnalyticsReport['chatInteractions'] {
    const interactions = events.filter(e => e.eventType === 'chat_interaction');
    const contextual = interactions.filter(e => e.metadata.queryType === 'contextual');
    const fallback = interactions.filter(e => e.metadata.queryType === 'fallback');

    let totalResponseTime = 0;
    interactions.forEach(event => {
      totalResponseTime += event.metadata.responseTime || 0;
    });

    return {
      total: interactions.length,
      averageResponseTime: interactions.length > 0 ? totalResponseTime / interactions.length : 0,
      contextualQueries: contextual.length,
      fallbackQueries: fallback.length,
    };
  }

  private analyzeFeatureUsage(events: UsageEvent[]): AnalyticsReport['featureUsage'] {
    const featureEvents = events.filter(e => e.eventType === 'feature_usage');
    const featureCounts = new Map<string, number>();

    featureEvents.forEach(event => {
      const feature = event.metadata.feature;
      if (feature) {
        featureCounts.set(feature, (featureCounts.get(feature) || 0) + 1);
      }
    });

    const sortedFeatures = Array.from(featureCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    const total = featureEvents.length;
    const mostUsed = sortedFeatures.slice(0, 5).map(([feature, count]) => ({
      feature,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));

    const leastUsed = sortedFeatures.slice(-5).reverse().map(([feature, count]) => ({
      feature,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));

    return { mostUsed, leastUsed };
  }

  private analyzeErrors(events: UsageEvent[]): AnalyticsReport['errors'] {
    const errorEvents = events.filter(e => e.eventType === 'error');
    const byType: Record<string, number> = {};
    let criticalErrors = 0;

    errorEvents.forEach(event => {
      const errorType = event.metadata.errorType;
      if (errorType) {
        byType[errorType] = (byType[errorType] || 0) + 1;
      }
      if (event.metadata.severity === 'critical') {
        criticalErrors++;
      }
    });

    return {
      total: errorEvents.length,
      byType,
      criticalErrors,
    };
  }

  private analyzePerformance(events: UsageEvent[]): AnalyticsReport['performance'] {
    const performanceEvents = events.filter(e => e.eventType === 'performance');
    const extractionTimes = performanceEvents
      .filter(e => e.metadata.metric === 'extraction_time')
      .map(e => e.metadata.value);
    
    const cacheHits = performanceEvents.filter(e => e.metadata.metric === 'cache_hit').length;
    const cacheMisses = performanceEvents.filter(e => e.metadata.metric === 'cache_miss').length;
    
    const memoryUsages = performanceEvents
      .filter(e => e.metadata.metric === 'memory_usage')
      .map(e => e.metadata.value);

    return {
      averageExtractionTime: extractionTimes.length > 0 
        ? extractionTimes.reduce((a, b) => a + b, 0) / extractionTimes.length 
        : 0,
      cacheHitRate: (cacheHits + cacheMisses) > 0 
        ? cacheHits / (cacheHits + cacheMisses) 
        : 0,
      memoryUsage: {
        average: memoryUsages.length > 0 
          ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
          : 0,
        peak: memoryUsages.length > 0 
          ? Math.max(...memoryUsages) 
          : 0,
      },
    };
  }

  private generateTimeRanges(period: 'hour' | 'day' | 'week' | 'month', count: number): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    const now = Date.now();
    
    let intervalMs: number;
    switch (period) {
      case 'hour':
        intervalMs = 60 * 60 * 1000;
        break;
      case 'day':
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case 'week':
        intervalMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        intervalMs = 30 * 24 * 60 * 60 * 1000;
        break;
    }

    for (let i = count - 1; i >= 0; i--) {
      const end = now - (i * intervalMs);
      const start = end - intervalMs;
      ranges.push({ start, end });
    }

    return ranges;
  }

  private async getContextExtractionTrend(timeRanges: Array<{ start: number; end: number }>): Promise<TrendData['datasets'][0]> {
    const data: number[] = [];

    for (const range of timeRanges) {
      const events = await this.getEventsInRange(range.start, range.end);
      const extractions = events.filter(e => e.eventType === 'context_extraction');
      data.push(extractions.length);
    }

    return {
      label: 'Context Extractions',
      data,
      color: '#1f77b4',
    };
  }

  private async getChatInteractionTrend(timeRanges: Array<{ start: number; end: number }>): Promise<TrendData['datasets'][0]> {
    const data: number[] = [];

    for (const range of timeRanges) {
      const events = await this.getEventsInRange(range.start, range.end);
      const interactions = events.filter(e => e.eventType === 'chat_interaction');
      data.push(interactions.length);
    }

    return {
      label: 'Chat Interactions',
      data,
      color: '#ff7f0e',
    };
  }

  private async getErrorRateTrend(timeRanges: Array<{ start: number; end: number }>): Promise<TrendData['datasets'][0]> {
    const data: number[] = [];

    for (const range of timeRanges) {
      const events = await this.getEventsInRange(range.start, range.end);
      const totalEvents = events.length;
      const errorEvents = events.filter(e => e.eventType === 'error').length;
      const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
      data.push(errorRate);
    }

    return {
      label: 'Error Rate (%)',
      data,
      color: '#d62728',
    };
  }

  private async getPerformanceTrends(timeRanges: Array<{ start: number; end: number }>): Promise<TrendData['datasets']> {
    const extractionTimeData: number[] = [];
    const cacheHitRateData: number[] = [];

    for (const range of timeRanges) {
      const events = await this.getEventsInRange(range.start, range.end);
      const performanceEvents = events.filter(e => e.eventType === 'performance');
      
      const extractionTimes = performanceEvents
        .filter(e => e.metadata.metric === 'extraction_time')
        .map(e => e.metadata.value);
      
      const avgExtractionTime = extractionTimes.length > 0 
        ? extractionTimes.reduce((a, b) => a + b, 0) / extractionTimes.length 
        : 0;
      
      const cacheHits = performanceEvents.filter(e => e.metadata.metric === 'cache_hit').length;
      const cacheMisses = performanceEvents.filter(e => e.metadata.metric === 'cache_miss').length;
      const cacheHitRate = (cacheHits + cacheMisses) > 0 
        ? (cacheHits / (cacheHits + cacheMisses)) * 100 
        : 0;

      extractionTimeData.push(avgExtractionTime);
      cacheHitRateData.push(cacheHitRate);
    }

    return [
      {
        label: 'Avg Extraction Time (ms)',
        data: extractionTimeData,
        color: '#2ca02c',
      },
      {
        label: 'Cache Hit Rate (%)',
        data: cacheHitRateData,
        color: '#9467bd',
      },
    ];
  }

  private formatTimeLabel(timestamp: number, period: 'hour' | 'day' | 'week' | 'month'): string {
    const date = new Date(timestamp);
    
    switch (period) {
      case 'hour':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case 'day':
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      case 'week':
        return `Week of ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
      case 'month':
        return date.toLocaleDateString([], { year: 'numeric', month: 'short' });
      default:
        return date.toLocaleDateString();
    }
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Flush any remaining events
    this.flushEvents();
  }
}