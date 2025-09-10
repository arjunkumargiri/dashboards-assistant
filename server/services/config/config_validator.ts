/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { ConfigSchema } from '../../../common/types/config';

export interface ValidationRule {
  field: string;
  validator: (value: any, config: ConfigSchema['contextualChat']) => ValidationResult;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface ConfigValidationReport {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export class ConfigValidator {
  private rules: ValidationRule[] = [];
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeValidationRules();
  }

  private initializeValidationRules(): void {
    this.rules = [
      // Basic enabled validation
      {
        field: 'enabled',
        validator: (value: boolean) => ({
          isValid: typeof value === 'boolean',
          message: 'enabled must be a boolean value',
        }),
        severity: 'error',
      },

      // Max visualizations validation
      {
        field: 'maxVisualizations',
        validator: (value: number) => {
          if (typeof value !== 'number') {
            return { isValid: false, message: 'maxVisualizations must be a number' };
          }
          if (value < 1) {
            return { isValid: false, message: 'maxVisualizations must be at least 1' };
          }
          if (value > 100) {
            return { isValid: false, message: 'maxVisualizations cannot exceed 100' };
          }
          if (value > 50) {
            return { isValid: true, message: 'maxVisualizations > 50 may impact performance' };
          }
          return { isValid: true };
        },
        severity: 'error',
      },

      // Context cache TTL validation
      {
        field: 'contextCacheTTL',
        validator: (value: number) => {
          if (typeof value !== 'number') {
            return { isValid: false, message: 'contextCacheTTL must be a number' };
          }
          if (value < 30) {
            return { isValid: false, message: 'contextCacheTTL must be at least 30 seconds' };
          }
          if (value > 7200) {
            return {
              isValid: true,
              message: 'contextCacheTTL > 2 hours may consume excessive memory',
            };
          }
          if (value < 60) {
            return {
              isValid: true,
              message: 'contextCacheTTL < 60 seconds may cause frequent cache misses',
            };
          }
          return { isValid: true };
        },
        severity: 'warning',
      },

      // Extraction timeout validation
      {
        field: 'extractionTimeout',
        validator: (value: number) => {
          if (typeof value !== 'number') {
            return { isValid: false, message: 'extractionTimeout must be a number' };
          }
          if (value < 1000) {
            return { isValid: false, message: 'extractionTimeout must be at least 1000ms' };
          }
          if (value > 30000) {
            return { isValid: false, message: 'extractionTimeout cannot exceed 30000ms' };
          }
          if (value > 10000) {
            return {
              isValid: true,
              message: 'extractionTimeout > 10s may cause poor user experience',
            };
          }
          return { isValid: true };
        },
        severity: 'warning',
      },

      // Performance debounce validation
      {
        field: 'performance.debounceMs',
        validator: (value: number) => {
          if (typeof value !== 'number') {
            return { isValid: false, message: 'performance.debounceMs must be a number' };
          }
          if (value < 50) {
            return { isValid: false, message: 'performance.debounceMs must be at least 50ms' };
          }
          if (value > 5000) {
            return { isValid: false, message: 'performance.debounceMs cannot exceed 5000ms' };
          }
          if (value > 1000) {
            return { isValid: true, message: 'performance.debounceMs > 1s may feel unresponsive' };
          }
          return { isValid: true };
        },
        severity: 'warning',
      },

      // Max content elements validation
      {
        field: 'performance.maxContentElements',
        validator: (value: number) => {
          if (typeof value !== 'number') {
            return { isValid: false, message: 'performance.maxContentElements must be a number' };
          }
          if (value < 5) {
            return { isValid: false, message: 'performance.maxContentElements must be at least 5' };
          }
          if (value > 500) {
            return { isValid: false, message: 'performance.maxContentElements cannot exceed 500' };
          }
          if (value > 100) {
            return {
              isValid: true,
              message: 'performance.maxContentElements > 100 may impact performance',
            };
          }
          return { isValid: true };
        },
        severity: 'warning',
      },

      // Security validation
      {
        field: 'security.respectPermissions',
        validator: (value: boolean, config) => {
          if (typeof value !== 'boolean') {
            return { isValid: false, message: 'security.respectPermissions must be a boolean' };
          }
          if (!value && config.enabled) {
            return {
              isValid: true,
              message: 'Disabling permission checks may expose unauthorized data',
            };
          }
          return { isValid: true };
        },
        severity: 'warning',
      },

      // Audit access validation
      {
        field: 'security.auditAccess',
        validator: (value: boolean) => ({
          isValid: typeof value === 'boolean',
          message: 'security.auditAccess must be a boolean value',
        }),
        severity: 'error',
      },

      // Lazy loading validation
      {
        field: 'performance.enableLazyLoading',
        validator: (value: boolean) => ({
          isValid: typeof value === 'boolean',
          message: 'performance.enableLazyLoading must be a boolean value',
        }),
        severity: 'error',
      },
    ];
  }

  public validateConfig(config: ConfigSchema['contextualChat']): ConfigValidationReport {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];

    // Run all validation rules
    for (const rule of this.rules) {
      try {
        const fieldValue = this.getNestedValue(config, rule.field);
        const result = rule.validator(fieldValue, config);

        if (!result.isValid || result.message) {
          const issue: ValidationIssue = {
            field: rule.field,
            message: result.message || 'Validation failed',
            severity: result.isValid ? 'info' : rule.severity,
          };

          // Add suggestions based on common issues
          issue.suggestion = this.getSuggestion(rule.field, fieldValue, result);

          switch (issue.severity) {
            case 'error':
              errors.push(issue);
              break;
            case 'warning':
              warnings.push(issue);
              break;
            case 'info':
              info.push(issue);
              break;
          }
        }
      } catch (error) {
        errors.push({
          field: rule.field,
          message: `Validation error: ${error.message}`,
          severity: 'error',
        });
      }
    }

    // Cross-field validations
    this.validateCrossFieldDependencies(config, errors, warnings);

    const report: ConfigValidationReport = {
      isValid: errors.length === 0,
      errors,
      warnings,
      info,
    };

    this.logger.info('Configuration validation completed', {
      isValid: report.isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      infoCount: info.length,
    });

    return report;
  }

  private validateCrossFieldDependencies(
    config: ConfigSchema['contextualChat'],
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): void {
    // Check if performance settings are consistent
    if (config.performance.enableLazyLoading && config.performance.maxContentElements < 20) {
      warnings.push({
        field: 'performance',
        message: 'Lazy loading is most effective with higher maxContentElements',
        severity: 'warning',
        suggestion:
          'Consider increasing maxContentElements to at least 20 when lazy loading is enabled',
      });
    }

    // Check if cache TTL and extraction timeout are balanced
    if (config.contextCacheTTL < config.extractionTimeout / 1000) {
      warnings.push({
        field: 'contextCacheTTL',
        message: 'Cache TTL is shorter than extraction timeout',
        severity: 'warning',
        suggestion: 'Consider setting contextCacheTTL to at least extractionTimeout/1000 seconds',
      });
    }

    // Check security and audit consistency
    if (!config.security.respectPermissions && config.security.auditAccess) {
      warnings.push({
        field: 'security',
        message: 'Audit access is enabled but permission checks are disabled',
        severity: 'warning',
        suggestion: 'Enable respectPermissions for comprehensive security auditing',
      });
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private getSuggestion(field: string, value: any, result: ValidationResult): string | undefined {
    if (result.isValid) return undefined;

    const suggestions: Record<string, string> = {
      maxVisualizations: 'Recommended range: 10-30 for optimal performance',
      contextCacheTTL: 'Recommended range: 300-1800 seconds (5-30 minutes)',
      extractionTimeout: 'Recommended range: 3000-8000ms for good UX',
      'performance.debounceMs': 'Recommended range: 200-800ms for responsive feel',
      'performance.maxContentElements': 'Recommended range: 20-50 for balanced performance',
    };

    return suggestions[field];
  }

  public addCustomRule(rule: ValidationRule): void {
    this.rules.push(rule);
    this.logger.info(`Added custom validation rule for field: ${rule.field}`);
  }

  public removeRule(field: string): void {
    this.rules = this.rules.filter((rule) => rule.field !== field);
    this.logger.info(`Removed validation rule for field: ${field}`);
  }
}
