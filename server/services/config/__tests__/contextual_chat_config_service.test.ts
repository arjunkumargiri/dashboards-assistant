/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { ContextualChatConfigService } from '../contextual_chat_config_service';
import { ConfigSchema } from '../../../../common/types/config';

describe('ContextualChatConfigService', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockConfig: ConfigSchema['contextualChat'];
  let configService: ContextualChatConfigService;

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

    mockConfig = {
      enabled: true,
      maxVisualizations: 20,
      contextCacheTTL: 300,
      extractionTimeout: 5000,
      security: {
        respectPermissions: true,
        auditAccess: true,
      },
      performance: {
        debounceMs: 500,
        maxContentElements: 50,
        enableLazyLoading: true,
      },
    };

    configService = new ContextualChatConfigService(mockConfig, mockLogger);
  });

  describe('initialization', () => {
    it('should initialize with correct feature flags', () => {
      const flags = configService.getFeatureFlags();

      expect(flags.enabled).toBe(true);
      expect(flags.contentExtraction).toBe(true);
      expect(flags.domObservation).toBe(true);
      expect(flags.contextualPrompts).toBe(true);
      expect(flags.performanceOptimization).toBe(true);
      expect(flags.securityValidation).toBe(true);
      expect(flags.adminInterface).toBe(true);
      expect(flags.analytics).toBe(true);
    });

    it('should initialize with correct runtime config', () => {
      const runtimeConfig = configService.getRuntimeConfig();

      expect(runtimeConfig.maxVisualizations).toBe(20);
      expect(runtimeConfig.contextCacheTTL).toBe(300);
      expect(runtimeConfig.extractionTimeout).toBe(5000);
      expect(runtimeConfig.debounceMs).toBe(500);
      expect(runtimeConfig.maxContentElements).toBe(50);
      expect(runtimeConfig.enableLazyLoading).toBe(true);
      expect(runtimeConfig.respectPermissions).toBe(true);
      expect(runtimeConfig.auditAccess).toBe(true);
    });
  });

  describe('feature flag management', () => {
    it('should update feature flags correctly', () => {
      configService.updateFeatureFlag('contentExtraction', false);
      
      const flags = configService.getFeatureFlags();
      expect(flags.contentExtraction).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Updating feature flag contentExtraction to false');
    });

    it('should check if feature is enabled', () => {
      expect(configService.isFeatureEnabled('enabled')).toBe(true);
      
      configService.updateFeatureFlag('enabled', false);
      expect(configService.isFeatureEnabled('enabled')).toBe(false);
    });
  });

  describe('runtime configuration updates', () => {
    it('should update runtime configuration correctly', () => {
      const updates = {
        maxVisualizations: 30,
        contextCacheTTL: 600,
        debounceMs: 300,
      };

      configService.updateRuntimeConfig(updates);

      const runtimeConfig = configService.getRuntimeConfig();
      expect(runtimeConfig.maxVisualizations).toBe(30);
      expect(runtimeConfig.contextCacheTTL).toBe(600);
      expect(runtimeConfig.debounceMs).toBe(300);
      expect(mockLogger.info).toHaveBeenCalledWith('Updating runtime configuration', updates);
    });

    it('should handle partial updates', () => {
      configService.updateRuntimeConfig({ maxVisualizations: 15 });

      const runtimeConfig = configService.getRuntimeConfig();
      expect(runtimeConfig.maxVisualizations).toBe(15);
      expect(runtimeConfig.contextCacheTTL).toBe(300); // unchanged
    });
  });

  describe('configuration validation', () => {
    it('should validate correct configuration', () => {
      const validation = configService.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid maxVisualizations', () => {
      mockConfig.maxVisualizations = 0;
      configService = new ContextualChatConfigService(mockConfig, mockLogger);

      const validation = configService.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('maxVisualizations must be between 1 and 100');
    });

    it('should detect invalid extractionTimeout', () => {
      mockConfig.extractionTimeout = 500;
      configService = new ContextualChatConfigService(mockConfig, mockLogger);

      const validation = configService.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('extractionTimeout must be between 1000 and 30000 milliseconds');
    });

    it('should generate warnings for suboptimal settings', () => {
      mockConfig.contextCacheTTL = 30;
      configService = new ContextualChatConfigService(mockConfig, mockLogger);

      const validation = configService.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('contextCacheTTL should be between 60 and 3600 seconds for optimal performance');
    });

    it('should validate feature dependencies', () => {
      configService.updateFeatureFlag('enabled', true);
      configService.updateFeatureFlag('contentExtraction', false);

      const validation = configService.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('contentExtraction must be enabled when contextual chat is enabled');
    });

    it('should validate contextual prompts dependency', () => {
      configService.updateFeatureFlag('contextualPrompts', true);
      configService.updateFeatureFlag('contentExtraction', false);

      const validation = configService.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('contentExtraction must be enabled when contextualPrompts is enabled');
    });
  });

  describe('configuration summary', () => {
    it('should provide complete configuration summary', () => {
      const summary = configService.getConfigSummary();

      expect(summary).toHaveProperty('featureFlags');
      expect(summary).toHaveProperty('runtimeConfig');
      expect(summary).toHaveProperty('validation');
      expect(summary.validation.isValid).toBe(true);
    });
  });

  describe('disabled configuration', () => {
    beforeEach(() => {
      mockConfig.enabled = false;
      configService = new ContextualChatConfigService(mockConfig, mockLogger);
    });

    it('should initialize with disabled feature flags when main feature is disabled', () => {
      const flags = configService.getFeatureFlags();

      expect(flags.enabled).toBe(false);
      expect(flags.contentExtraction).toBe(false);
      expect(flags.domObservation).toBe(false);
      expect(flags.contextualPrompts).toBe(false);
      expect(flags.adminInterface).toBe(false);
    });
  });
});