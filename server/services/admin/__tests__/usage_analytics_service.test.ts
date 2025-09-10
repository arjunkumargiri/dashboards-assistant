/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';
import { UsageAnalyticsService } from '../usage_analytics_service';

describe('UsageAnalyticsService', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockSavedObjectsClient: jest.Mocked<SavedObjectsClientContract>;
  let analyticsService: UsageAnalyticsService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      get: jest.fn(),
    } as any;

    mockSavedObjectsClient = {
      create: jest.fn(),
      find: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    analyticsService = new UsageAnalyticsService(mockSavedObjectsClient, mockLogger);
  });

  afterEach(() => {
    analyticsService.destroy();
  });

  describe('event tracking', () => {
    it('should track context extraction events', () => {
      analyticsService.trackContextExtraction(
        'user1',
        'session1',
        1500,
        ['visualization', 'table'],
        true
      );

      // Verify event is buffered (we can't directly access the buffer, but we can test the effect)
      expect(mockLogger.debug).not.toHaveBeenCalled(); // No flush yet
    });

    it('should track chat interaction events', () => {
      analyticsService.trackChatInteraction('user1', 'session1', 2000, true, 'contextual', 5);

      // Event should be buffered
      expect(mockSavedObjectsClient.create).not.toHaveBeenCalled();
    });

    it('should track feature usage events', () => {
      analyticsService.trackFeatureUsage('user1', 'session1', 'contextual_prompts', 'enable', {
        source: 'admin_panel',
      });

      // Event should be buffered
      expect(mockSavedObjectsClient.create).not.toHaveBeenCalled();
    });

    it('should track error events', () => {
      analyticsService.trackError(
        'user1',
        'session1',
        'extraction_timeout',
        'Context extraction timed out',
        'medium',
        { timeout: 5000 }
      );

      // Event should be buffered
      expect(mockSavedObjectsClient.create).not.toHaveBeenCalled();
    });

    it('should track performance events', () => {
      analyticsService.trackPerformance('user1', 'session1', 'extraction_time', 1200, 'ms', {
        contentTypes: ['visualization'],
      });

      // Event should be buffered
      expect(mockSavedObjectsClient.create).not.toHaveBeenCalled();
    });
  });

  describe('report generation', () => {
    beforeEach(() => {
      // Mock events data
      const mockEvents = [
        {
          eventType: 'context_extraction',
          timestamp: Date.now() - 1000,
          userId: 'user1',
          sessionId: 'session1',
          metadata: {
            extractionTime: 1500,
            contentTypes: ['visualization', 'table'],
            success: true,
            contentCount: 2,
          },
        },
        {
          eventType: 'chat_interaction',
          timestamp: Date.now() - 500,
          userId: 'user1',
          sessionId: 'session1',
          metadata: {
            responseTime: 2000,
            hasContext: true,
            queryType: 'contextual',
            contextSize: 5,
          },
        },
        {
          eventType: 'feature_usage',
          timestamp: Date.now() - 300,
          userId: 'user2',
          sessionId: 'session2',
          metadata: {
            feature: 'contextual_prompts',
            action: 'enable',
          },
        },
        {
          eventType: 'error',
          timestamp: Date.now() - 200,
          userId: 'user1',
          sessionId: 'session1',
          metadata: {
            errorType: 'extraction_timeout',
            errorMessage: 'Timeout occurred',
            severity: 'medium',
          },
        },
        {
          eventType: 'performance',
          timestamp: Date.now() - 100,
          userId: 'user1',
          sessionId: 'session1',
          metadata: {
            metric: 'extraction_time',
            value: 1200,
            unit: 'ms',
          },
        },
      ];

      mockSavedObjectsClient.find.mockResolvedValue({
        saved_objects: [
          {
            attributes: { events: mockEvents },
          },
        ],
        total: 1,
        per_page: 10000,
        page: 1,
      });
    });

    it('should generate comprehensive analytics report', async () => {
      const startTime = Date.now() - 2000;
      const endTime = Date.now();

      const report = await analyticsService.generateReport(startTime, endTime);

      expect(report.period.start).toBe(startTime);
      expect(report.period.end).toBe(endTime);
      expect(report.summary.totalEvents).toBe(5);
      expect(report.summary.uniqueUsers).toBe(2);
      expect(report.summary.uniqueSessions).toBe(2);

      expect(report.contextExtractions.total).toBe(1);
      expect(report.contextExtractions.averageTime).toBe(1500);
      expect(report.contextExtractions.successRate).toBe(1);
      expect(report.contextExtractions.byContentType).toEqual({
        visualization: 1,
        table: 1,
      });

      expect(report.chatInteractions.total).toBe(1);
      expect(report.chatInteractions.averageResponseTime).toBe(2000);
      expect(report.chatInteractions.contextualQueries).toBe(1);
      expect(report.chatInteractions.fallbackQueries).toBe(0);

      expect(report.featureUsage.mostUsed).toHaveLength(1);
      expect(report.featureUsage.mostUsed[0].feature).toBe('contextual_prompts');
      expect(report.featureUsage.mostUsed[0].count).toBe(1);

      expect(report.errors.total).toBe(1);
      expect(report.errors.byType).toEqual({
        extraction_timeout: 1,
      });
      expect(report.errors.criticalErrors).toBe(0);

      expect(report.performance.averageExtractionTime).toBe(1200);
    });

    it('should handle empty event data', async () => {
      mockSavedObjectsClient.find.mockResolvedValue({
        saved_objects: [],
        total: 0,
        per_page: 10000,
        page: 1,
      });

      const report = await analyticsService.generateReport(0, Date.now());

      expect(report.summary.totalEvents).toBe(0);
      expect(report.contextExtractions.total).toBe(0);
      expect(report.chatInteractions.total).toBe(0);
      expect(report.featureUsage.mostUsed).toHaveLength(0);
      expect(report.errors.total).toBe(0);
    });

    it('should handle report generation errors', async () => {
      mockSavedObjectsClient.find.mockRejectedValue(new Error('Database error'));

      await expect(analyticsService.generateReport(0, Date.now())).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate analytics report',
        expect.any(Error)
      );
    });
  });

  describe('trend data', () => {
    beforeEach(() => {
      // Mock trend data for multiple time ranges
      mockSavedObjectsClient.find.mockImplementation(({ filter }) => {
        // Simple mock that returns different data based on time range
        const events = [
          {
            eventType: 'context_extraction',
            timestamp: Date.now() - 1000,
            metadata: { success: true },
          },
          {
            eventType: 'chat_interaction',
            timestamp: Date.now() - 500,
            metadata: { queryType: 'contextual' },
          },
        ];

        return Promise.resolve({
          saved_objects: [{ attributes: { events } }],
          total: 1,
          per_page: 10000,
          page: 1,
        });
      });
    });

    it('should generate context extraction trend data', async () => {
      const trendData = await analyticsService.getTrendData('context_extractions', 'hour', 24);

      expect(trendData.labels).toHaveLength(24);
      expect(trendData.datasets).toHaveLength(1);
      expect(trendData.datasets[0].label).toBe('Context Extractions');
      expect(trendData.datasets[0].data).toHaveLength(24);
    });

    it('should generate chat interaction trend data', async () => {
      const trendData = await analyticsService.getTrendData('chat_interactions', 'day', 7);

      expect(trendData.labels).toHaveLength(7);
      expect(trendData.datasets[0].label).toBe('Chat Interactions');
    });

    it('should generate error rate trend data', async () => {
      const trendData = await analyticsService.getTrendData('error_rate', 'day', 7);

      expect(trendData.datasets[0].label).toBe('Error Rate (%)');
    });

    it('should generate performance trend data', async () => {
      const trendData = await analyticsService.getTrendData('performance', 'hour', 12);

      expect(trendData.datasets).toHaveLength(2);
      expect(trendData.datasets[0].label).toBe('Avg Extraction Time (ms)');
      expect(trendData.datasets[1].label).toBe('Cache Hit Rate (%)');
    });

    it('should handle unknown metrics', async () => {
      await expect(analyticsService.getTrendData('unknown_metric', 'day', 7)).rejects.toThrow(
        'Unknown metric: unknown_metric'
      );
    });

    it('should handle trend data errors', async () => {
      mockSavedObjectsClient.find.mockRejectedValue(new Error('Database error'));

      await expect(analyticsService.getTrendData('context_extractions', 'day', 7)).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get trend data for context_extractions',
        expect.any(Error)
      );
    });
  });

  describe('top users', () => {
    beforeEach(() => {
      const mockEvents = [
        {
          eventType: 'context_extraction',
          timestamp: Date.now() - 1000,
          userId: 'user1',
          metadata: { success: true },
        },
        {
          eventType: 'feature_usage',
          timestamp: Date.now() - 500,
          userId: 'user1',
          metadata: { feature: 'contextual_prompts' },
        },
        {
          eventType: 'chat_interaction',
          timestamp: Date.now() - 300,
          userId: 'user2',
          metadata: { queryType: 'contextual' },
        },
        {
          eventType: 'feature_usage',
          timestamp: Date.now() - 200,
          userId: 'user1',
          metadata: { feature: 'contextual_prompts' },
        },
      ];

      mockSavedObjectsClient.find.mockResolvedValue({
        saved_objects: [{ attributes: { events: mockEvents } }],
        total: 1,
        per_page: 10000,
        page: 1,
      });
    });

    it('should return top users with statistics', async () => {
      const topUsers = await analyticsService.getTopUsers(5);

      expect(topUsers).toHaveLength(2);
      expect(topUsers[0].userId).toBe('user1');
      expect(topUsers[0].eventCount).toBe(3);
      expect(topUsers[0].topFeatures).toContain('contextual_prompts');
      expect(topUsers[1].userId).toBe('user2');
      expect(topUsers[1].eventCount).toBe(1);
    });

    it('should limit results correctly', async () => {
      const topUsers = await analyticsService.getTopUsers(1);

      expect(topUsers).toHaveLength(1);
      expect(topUsers[0].userId).toBe('user1');
    });

    it('should handle errors gracefully', async () => {
      mockSavedObjectsClient.find.mockRejectedValue(new Error('Database error'));

      await expect(analyticsService.getTopUsers()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get top users', expect.any(Error));
    });
  });

  describe('event buffering and flushing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should flush events when buffer is full', async () => {
      mockSavedObjectsClient.create.mockResolvedValue({} as any);

      // Fill buffer beyond capacity (100 events)
      for (let i = 0; i < 101; i++) {
        analyticsService.trackEvent({
          eventType: 'feature_usage',
          timestamp: Date.now(),
          metadata: { test: i },
        });
      }

      // Should have flushed automatically
      expect(mockSavedObjectsClient.create).toHaveBeenCalled();
    });

    it('should flush events periodically', async () => {
      mockSavedObjectsClient.create.mockResolvedValue({} as any);

      // Add some events
      analyticsService.trackEvent({
        eventType: 'feature_usage',
        timestamp: Date.now(),
        metadata: { test: 1 },
      });

      // Advance time to trigger periodic flush
      jest.advanceTimersByTime(30000);

      expect(mockSavedObjectsClient.create).toHaveBeenCalled();
    });

    it('should handle flush errors gracefully', async () => {
      mockSavedObjectsClient.create.mockRejectedValue(new Error('Save failed'));

      // Fill buffer to trigger flush
      for (let i = 0; i < 101; i++) {
        analyticsService.trackEvent({
          eventType: 'feature_usage',
          timestamp: Date.now(),
          metadata: { test: i },
        });
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to flush usage events',
        expect.any(Error)
      );
    });
  });
});
