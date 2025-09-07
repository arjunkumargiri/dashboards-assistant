/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { ConfigValidator } from '../config_validator';
import { ConfigSchema } from '../../../../common/types/config';

describe('ConfigValidator', () => {
  let mockLogger: jest.Mocked<Logger>;
  let validator: ConfigValidator;
  let validConfig: ConfigSchema['contextualChat'];

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

    validator = new ConfigValidator(mockLogger);

    validConfig = {
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
  });

  describe('valid configuration', () => {
    it('should validate correct configuration without errors', () => {
      const report = validator.validateConfig(validConfig);

      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Configuration validation completed',
        expect.objectContaining({
          isValid: true,
          errorCount: 0,
        })
      );
    });
  });

  describe('basic field validation', () => {
    it('should detect invalid enabled field', () => {
      const config = { ...validConfig, enabled: 'true' as any };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'enabled',
          message: 'enabled must be a boolean value',
          severity: 'error',
        })
      );
    });

    it('should detect invalid maxVisualizations', () => {
      const config = { ...validConfig, maxVisualizations: 0 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'maxVisualizations',
          message: 'maxVisualizations must be at least 1',
          severity: 'error',
        })
      );
    });

    it('should detect maxVisualizations exceeding limit', () => {
      const config = { ...validConfig, maxVisualizations: 150 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'maxVisualizations',
          message: 'maxVisualizations cannot exceed 100',
          severity: 'error',
        })
      );
    });

    it('should warn about high maxVisualizations', () => {
      const config = { ...validConfig, maxVisualizations: 75 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(true);
      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'maxVisualizations',
          message: 'maxVisualizations > 50 may impact performance',
          severity: 'warning',
        })
      );
    });
  });

  describe('timeout validation', () => {
    it('should detect invalid extractionTimeout', () => {
      const config = { ...validConfig, extractionTimeout: 500 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'extractionTimeout',
          message: 'extractionTimeout must be at least 1000ms',
          severity: 'error',
        })
      );
    });

    it('should detect extractionTimeout exceeding limit', () => {
      const config = { ...validConfig, extractionTimeout: 35000 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'extractionTimeout',
          message: 'extractionTimeout cannot exceed 30000ms',
          severity: 'error',
        })
      );
    });

    it('should warn about high extractionTimeout', () => {
      const config = { ...validConfig, extractionTimeout: 15000 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(true);
      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'extractionTimeout',
          message: 'extractionTimeout > 10s may cause poor user experience',
          severity: 'warning',
        })
      );
    });
  });

  describe('cache TTL validation', () => {
    it('should detect invalid contextCacheTTL', () => {
      const config = { ...validConfig, contextCacheTTL: 15 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'contextCacheTTL',
          message: 'contextCacheTTL must be at least 30 seconds',
          severity: 'error',
        })
      );
    });

    it('should warn about low contextCacheTTL', () => {
      const config = { ...validConfig, contextCacheTTL: 45 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(true);
      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'contextCacheTTL',
          message: 'contextCacheTTL < 60 seconds may cause frequent cache misses',
          severity: 'warning',
        })
      );
    });

    it('should warn about high contextCacheTTL', () => {
      const config = { ...validConfig, contextCacheTTL: 8000 };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(true);
      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'contextCacheTTL',
          message: 'contextCacheTTL > 2 hours may consume excessive memory',
          severity: 'warning',
        })
      );
    });
  });

  describe('performance validation', () => {
    it('should detect invalid debounceMs', () => {
      const config = {
        ...validConfig,
        performance: { ...validConfig.performance, debounceMs: 25 },
      };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'performance.debounceMs',
          message: 'performance.debounceMs must be at least 50ms',
          severity: 'error',
        })
      );
    });

    it('should warn about high debounceMs', () => {
      const config = {
        ...validConfig,
        performance: { ...validConfig.performance, debounceMs: 1500 },
      };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(true);
      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'performance.debounceMs',
          message: 'performance.debounceMs > 1s may feel unresponsive',
          severity: 'warning',
        })
      );
    });

    it('should detect invalid maxContentElements', () => {
      const config = {
        ...validConfig,
        performance: { ...validConfig.performance, maxContentElements: 2 },
      };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'performance.maxContentElements',
          message: 'performance.maxContentElements must be at least 5',
          severity: 'error',
        })
      );
    });
  });

  describe('security validation', () => {
    it('should detect invalid respectPermissions type', () => {
      const config = {
        ...validConfig,
        security: { ...validConfig.security, respectPermissions: 'true' as any },
      };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(false);
      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'security.respectPermissions',
          message: 'security.respectPermissions must be a boolean',
          severity: 'error',
        })
      );
    });

    it('should warn about disabled permission checks', () => {
      const config = {
        ...validConfig,
        security: { ...validConfig.security, respectPermissions: false },
      };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(true);
      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'security.respectPermissions',
          message: 'Disabling permission checks may expose unauthorized data',
          severity: 'warning',
        })
      );
    });
  });

  describe('cross-field validation', () => {
    it('should warn about lazy loading with low maxContentElements', () => {
      const config = {
        ...validConfig,
        performance: {
          ...validConfig.performance,
          enableLazyLoading: true,
          maxContentElements: 15,
        },
      };
      const report = validator.validateConfig(config);

      expect(report.isValid).toBe(true);
      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'performance',
          message: 'Lazy loading is most effective with higher maxContentElements',
          severity: 'warning',
        })
      );
    });

    it('should warn about cache TTL shorter than extraction timeout', () => {
      const config = {
        ...validConfig,
        contextCacheTTL: 3, // 3 seconds
        extractionTimeout: 5000, // 5 seconds
      };
      const report = validator.validateConfig(config);

      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'contextCacheTTL',
          message: 'Cache TTL is shorter than extraction timeout',
          severity: 'warning',
        })
      );
    });

    it('should warn about inconsistent security settings', () => {
      const config = {
        ...validConfig,
        security: {
          respectPermissions: false,
          auditAccess: true,
        },
      };
      const report = validator.validateConfig(config);

      expect(report.warnings).toContainEqual(
        expect.objectContaining({
          field: 'security',
          message: 'Audit access is enabled but permission checks are disabled',
          severity: 'warning',
        })
      );
    });
  });

  describe('custom rules', () => {
    it('should allow adding custom validation rules', () => {
      validator.addCustomRule({
        field: 'customField',
        validator: (value) => ({
          isValid: value === 'expected',
          message: 'Custom validation failed',
        }),
        severity: 'error',
      });

      const configWithCustomField = { ...validConfig, customField: 'wrong' } as any;
      const report = validator.validateConfig(configWithCustomField);

      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'customField',
          message: 'Custom validation failed',
          severity: 'error',
        })
      );
    });

    it('should allow removing validation rules', () => {
      validator.removeRule('enabled');

      const config = { ...validConfig, enabled: 'invalid' as any };
      const report = validator.validateConfig(config);

      // Should not have error for 'enabled' field since rule was removed
      const enabledErrors = report.errors.filter(e => e.field === 'enabled');
      expect(enabledErrors).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', () => {
      validator.addCustomRule({
        field: 'problematicField',
        validator: () => {
          throw new Error('Validation function error');
        },
        severity: 'error',
      });

      const configWithProblematicField = { ...validConfig, problematicField: 'value' } as any;
      const report = validator.validateConfig(configWithProblematicField);

      expect(report.errors).toContainEqual(
        expect.objectContaining({
          field: 'problematicField',
          message: 'Validation error: Validation function error',
          severity: 'error',
        })
      );
    });
  });

  describe('suggestions', () => {
    it('should provide suggestions for common validation failures', () => {
      const config = { ...validConfig, maxVisualizations: 0 };
      const report = validator.validateConfig(config);

      const error = report.errors.find(e => e.field === 'maxVisualizations');
      expect(error?.suggestion).toBe('Recommended range: 10-30 for optimal performance');
    });
  });
});