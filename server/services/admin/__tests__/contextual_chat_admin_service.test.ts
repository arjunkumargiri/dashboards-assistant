/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';
import { ContextualChatAdminService } from '../contextual_chat_admin_service';
import { ContextualChatConfigService } from '../../config/contextual_chat_config_service';
import { FeatureFlagManager } from '../../config/feature_flag_manager';

describe('ContextualChatAdminService', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockSavedObjectsClient: jest.Mocked<SavedObjectsClientContract>;
  let mockConfigService: jest.Mocked<ContextualChatConfigService>;
  let mockFeatureFlagManager: jest.Mocked<FeatureFlagManager>;
  let adminService: ContextualChatAdminService;

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
      update: jest.fn(),
      get: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockConfigService = {
      getRuntimeConfig: jest.fn(),
      getFeatureFlags: jest.fn(),
      updateFeatureFlag: jest.fn(),
      updateRuntimeConfig: jest.fn(),
      validateConfiguration: jest.fn(),
    } as any;

    mockFeatureFlagManager = {
      getFlagStatus: jest.fn(),
      setOverride: jest.fn(),
      saveOverride: jest.fn(),
      validateDependencies: jest.fn(),
    } as any;

    adminService = new ContextualChatAdminService(
      mockConfigService,
      mockFeatureFlagManager,
      mockSavedObjectsClient,
      mockLogger
    );
  });

  describe('getAdminSettings', () => {
    beforeEach(() => {
      mockConfigService.getRuntimeConfig.mockReturnValue({
        maxVisualizations: 20,
        contextCacheTTL: 300,
        extractionTimeout: 5000,
        debounceMs: 500,
        maxContentElements: 50,
        enableLazyLoading: true,
        respectPermissions: true,
        auditAccess: true,
      });

      mockConfigService.getFeatureFlags.mockReturnValue({
        enabled: true,
        contentExtraction: true,
        domObservation: true,
        contextualPrompts: true,
        performanceOptimization: true,
        securityValidation: true,
        adminInterface: true,
        analytics: true,
      });
    });

    it('should return admin settings with correct structure', async () => {
      const settings = await adminService.getAdminSettings();

      expect(settings).toHaveLength(8);
      expect(settings[0]).toEqual({
        id: 'enabled',
        name: 'Contextual Chat Enabled',
        description: 'Enable or disable contextual chat functionality',
        value: true,
        type: 'boolean',
        category: 'features',
        editable: true,
        requiresRestart: false,
      });
    });

    it('should include all configuration categories', async () => {
      const settings = await adminService.getAdminSettings();
      const categories = [...new Set(settings.map(s => s.category))];

      expect(categories).toContain('features');
      expect(categories).toContain('performance');
      expect(categories).toContain('security');
    });
  });

  describe('updateAdminSetting', () => {
    it('should update feature flag settings', async () => {
      mockSavedObjectsClient.create.mockResolvedValue({} as any);

      await adminService.updateAdminSetting('enabled', false);

      expect(mockConfigService.updateFeatureFlag).toHaveBeenCalledWith('enabled', false);
      expect(mockSavedObjectsClient.create).toHaveBeenCalledWith(
        'contextual-chat-admin-settings',
        expect.objectContaining({
          settingId: 'enabled',
          value: false,
        }),
        { id: 'enabled', overwrite: true }
      );
    });

    it('should update runtime configuration settings', async () => {
      mockSavedObjectsClient.create.mockResolvedValue({} as any);

      await adminService.updateAdminSetting('maxVisualizations', 30);

      expect(mockConfigService.updateRuntimeConfig).toHaveBeenCalledWith({
        maxVisualizations: 30,
      });
    });

    it('should handle unknown settings', async () => {
      await expect(adminService.updateAdminSetting('unknown', 'value'))
        .rejects.toThrow('Unknown setting: unknown');
    });

    it('should handle save errors gracefully', async () => {
      mockSavedObjectsClient.create.mockRejectedValue(new Error('Save failed'));

      // Should not throw even if save fails
      await adminService.updateAdminSetting('enabled', false);

      expect(mockConfigService.updateFeatureFlag).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save setting change for enabled',
        expect.any(Error)
      );
    });
  });

  describe('getSystemHealth', () => {
    beforeEach(() => {
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockFeatureFlagManager.validateDependencies.mockReturnValue({
        isValid: true,
        errors: [],
      });
    });

    it('should return healthy status when all checks pass', async () => {
      // Mock performance metrics
      jest.spyOn(adminService, 'getPerformanceMetrics').mockResolvedValue({
        averageExtractionTime: 1000,
        cacheHitRate: 0.8,
        memoryUsage: 50 * 1024 * 1024,
        activeContexts: 10,
        errorRate: 0.01,
        lastUpdated: Date.now(),
      });

      const health = await adminService.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.checks).toHaveLength(3);
      expect(health.checks[0].name).toBe('Configuration Validation');
      expect(health.checks[0].status).toBe('pass');
    });

    it('should return error status when configuration is invalid', async () => {
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: false,
        errors: ['Invalid setting'],
        warnings: [],
      });

      jest.spyOn(adminService, 'getPerformanceMetrics').mockResolvedValue({
        averageExtractionTime: 1000,
        cacheHitRate: 0.8,
        memoryUsage: 50 * 1024 * 1024,
        activeContexts: 10,
        errorRate: 0.01,
        lastUpdated: Date.now(),
      });

      const health = await adminService.getSystemHealth();

      expect(health.status).toBe('error');
      expect(health.checks[0].status).toBe('fail');
    });

    it('should return warning status when performance issues exist', async () => {
      jest.spyOn(adminService, 'getPerformanceMetrics').mockResolvedValue({
        averageExtractionTime: 8000, // High extraction time
        cacheHitRate: 0.5, // Low cache hit rate
        memoryUsage: 50 * 1024 * 1024,
        activeContexts: 10,
        errorRate: 0.01,
        lastUpdated: Date.now(),
      });

      const health = await adminService.getSystemHealth();

      expect(health.status).toBe('warning');
      expect(health.checks[2].status).toBe('warn');
    });
  });

  describe('updateFeatureFlag', () => {
    it('should update feature flag and save override', async () => {
      mockFeatureFlagManager.saveOverride.mockResolvedValue();

      await adminService.updateFeatureFlag('contextual_chat_enabled', false, 'Testing');

      expect(mockFeatureFlagManager.setOverride).toHaveBeenCalledWith(
        'contextual_chat_enabled',
        false,
        'Testing'
      );
      expect(mockFeatureFlagManager.saveOverride).toHaveBeenCalledWith({
        key: 'contextual_chat_enabled',
        value: false,
        reason: 'Testing',
        timestamp: expect.any(Number),
      });
    });

    it('should handle save errors', async () => {
      mockFeatureFlagManager.saveOverride.mockRejectedValue(new Error('Save failed'));

      await expect(adminService.updateFeatureFlag('test', true, 'reason'))
        .rejects.toThrow('Save failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update feature flag test',
        expect.any(Error)
      );
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return default metrics when no data available', async () => {
      mockSavedObjectsClient.get.mockRejectedValue(new Error('Not found'));

      const metrics = await adminService.getPerformanceMetrics();

      expect(metrics).toEqual({
        averageExtractionTime: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        activeContexts: 0,
        errorRate: 0,
        lastUpdated: expect.any(Number),
      });
    });

    it('should return stored metrics when available', async () => {
      const storedMetrics = {
        averageExtractionTime: 1500,
        cacheHitRate: 0.75,
        memoryUsage: 60 * 1024 * 1024,
        activeContexts: 15,
        errorRate: 0.02,
      };

      mockSavedObjectsClient.get.mockResolvedValue({
        attributes: storedMetrics,
      } as any);

      const metrics = await adminService.getPerformanceMetrics();

      expect(metrics.averageExtractionTime).toBe(1500);
      expect(metrics.cacheHitRate).toBe(0.75);
      expect(metrics.lastUpdated).toBeGreaterThan(0);
    });
  });

  describe('getUsageStatistics', () => {
    it('should return default statistics when no data available', async () => {
      mockSavedObjectsClient.get.mockRejectedValue(new Error('Not found'));

      const stats = await adminService.getUsageStatistics();

      expect(stats).toEqual({
        totalContextExtractions: 0,
        totalChatInteractions: 0,
        averageContextSize: 0,
        mostUsedFeatures: [],
        userEngagement: {
          dailyActiveUsers: 0,
          averageSessionDuration: 0,
        },
        lastUpdated: expect.any(Number),
      });
    });

    it('should return stored statistics when available', async () => {
      const storedStats = {
        totalContextExtractions: 1000,
        totalChatInteractions: 500,
        averageContextSize: 25,
        mostUsedFeatures: [{ feature: 'contextual_prompts', count: 300 }],
        userEngagement: {
          dailyActiveUsers: 50,
          averageSessionDuration: 1200,
        },
      };

      mockSavedObjectsClient.get.mockResolvedValue({
        attributes: storedStats,
      } as any);

      const stats = await adminService.getUsageStatistics();

      expect(stats.totalContextExtractions).toBe(1000);
      expect(stats.mostUsedFeatures).toHaveLength(1);
      expect(stats.userEngagement.dailyActiveUsers).toBe(50);
    });
  });

  describe('getAdminDashboardData', () => {
    it('should return complete dashboard data', async () => {
      // Mock all dependencies
      mockConfigService.getRuntimeConfig.mockReturnValue({
        maxVisualizations: 20,
        contextCacheTTL: 300,
        extractionTimeout: 5000,
        debounceMs: 500,
        maxContentElements: 50,
        enableLazyLoading: true,
        respectPermissions: true,
        auditAccess: true,
      });

      mockConfigService.getFeatureFlags.mockReturnValue({
        enabled: true,
        contentExtraction: true,
        domObservation: true,
        contextualPrompts: true,
        performanceOptimization: true,
        securityValidation: true,
        adminInterface: true,
        analytics: true,
      });

      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockFeatureFlagManager.getFlagStatus.mockReturnValue({
        contextual_chat_enabled: true,
        content_extraction_enabled: true,
      });

      mockFeatureFlagManager.validateDependencies.mockReturnValue({
        isValid: true,
        errors: [],
      });

      mockSavedObjectsClient.get.mockRejectedValue(new Error('Not found'));

      const dashboardData = await adminService.getAdminDashboardData();

      expect(dashboardData).toHaveProperty('settings');
      expect(dashboardData).toHaveProperty('systemHealth');
      expect(dashboardData).toHaveProperty('featureFlags');
      expect(dashboardData).toHaveProperty('performanceMetrics');
      expect(dashboardData).toHaveProperty('usageStatistics');

      expect(dashboardData.settings).toHaveLength(8);
      expect(dashboardData.systemHealth.status).toBeDefined();
      expect(dashboardData.featureFlags).toHaveProperty('contextual_chat_enabled');
    });

    it('should handle errors gracefully', async () => {
      mockConfigService.getRuntimeConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      await expect(adminService.getAdminDashboardData()).rejects.toThrow('Config error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get admin dashboard data',
        expect.any(Error)
      );
    });
  });
});