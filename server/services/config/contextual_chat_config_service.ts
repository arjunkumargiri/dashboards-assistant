/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { ConfigSchema } from '../../../common/types/config';

export interface ContextualChatFeatureFlags {
  enabled: boolean;
  contentExtraction: boolean;
  domObservation: boolean;
  contextualPrompts: boolean;
  performanceOptimization: boolean;
  securityValidation: boolean;
  adminInterface: boolean;
  analytics: boolean;
}

export interface ContextualChatRuntimeConfig {
  maxVisualizations: number;
  contextCacheTTL: number;
  extractionTimeout: number;
  debounceMs: number;
  maxContentElements: number;
  enableLazyLoading: boolean;
  respectPermissions: boolean;
  auditAccess: boolean;
}

export interface ContextualChatConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ContextualChatConfigService {
  private config: ConfigSchema['contextualChat'];
  private featureFlags: ContextualChatFeatureFlags;
  private logger: Logger;

  constructor(config: ConfigSchema['contextualChat'], logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.featureFlags = this.initializeFeatureFlags();
  }

  private initializeFeatureFlags(): ContextualChatFeatureFlags {
    return {
      enabled: this.config.enabled,
      contentExtraction: this.config.enabled,
      domObservation: this.config.enabled,
      contextualPrompts: this.config.enabled,
      performanceOptimization: this.config.performance.enableLazyLoading,
      securityValidation: this.config.security.respectPermissions,
      adminInterface: this.config.enabled,
      analytics: this.config.security.auditAccess,
    };
  }

  public getFeatureFlags(): ContextualChatFeatureFlags {
    return { ...this.featureFlags };
  }

  public getRuntimeConfig(): ContextualChatRuntimeConfig {
    return {
      maxVisualizations: this.config.maxVisualizations,
      contextCacheTTL: this.config.contextCacheTTL,
      extractionTimeout: this.config.extractionTimeout,
      debounceMs: this.config.performance.debounceMs,
      maxContentElements: this.config.performance.maxContentElements,
      enableLazyLoading: this.config.performance.enableLazyLoading,
      respectPermissions: this.config.security.respectPermissions,
      auditAccess: this.config.security.auditAccess,
    };
  }

  public updateFeatureFlag(flag: keyof ContextualChatFeatureFlags, value: boolean): void {
    this.logger.info(`Updating feature flag ${flag} to ${value}`);
    this.featureFlags[flag] = value;
  }

  public updateRuntimeConfig(updates: Partial<ContextualChatRuntimeConfig>): void {
    this.logger.info('Updating runtime configuration', updates);
    
    // Update internal config object
    if (updates.maxVisualizations !== undefined) {
      this.config.maxVisualizations = updates.maxVisualizations;
    }
    if (updates.contextCacheTTL !== undefined) {
      this.config.contextCacheTTL = updates.contextCacheTTL;
    }
    if (updates.extractionTimeout !== undefined) {
      this.config.extractionTimeout = updates.extractionTimeout;
    }
    if (updates.debounceMs !== undefined) {
      this.config.performance.debounceMs = updates.debounceMs;
    }
    if (updates.maxContentElements !== undefined) {
      this.config.performance.maxContentElements = updates.maxContentElements;
    }
    if (updates.enableLazyLoading !== undefined) {
      this.config.performance.enableLazyLoading = updates.enableLazyLoading;
    }
    if (updates.respectPermissions !== undefined) {
      this.config.security.respectPermissions = updates.respectPermissions;
    }
    if (updates.auditAccess !== undefined) {
      this.config.security.auditAccess = updates.auditAccess;
    }
  }

  public validateConfiguration(): ContextualChatConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate numeric ranges
    if (this.config.maxVisualizations < 1 || this.config.maxVisualizations > 100) {
      errors.push('maxVisualizations must be between 1 and 100');
    }

    if (this.config.contextCacheTTL < 60 || this.config.contextCacheTTL > 3600) {
      warnings.push('contextCacheTTL should be between 60 and 3600 seconds for optimal performance');
    }

    if (this.config.extractionTimeout < 1000 || this.config.extractionTimeout > 30000) {
      errors.push('extractionTimeout must be between 1000 and 30000 milliseconds');
    }

    if (this.config.performance.debounceMs < 100 || this.config.performance.debounceMs > 2000) {
      warnings.push('debounceMs should be between 100 and 2000 milliseconds for optimal UX');
    }

    if (this.config.performance.maxContentElements < 10 || this.config.performance.maxContentElements > 200) {
      warnings.push('maxContentElements should be between 10 and 200 for optimal performance');
    }

    // Validate feature dependencies
    if (this.featureFlags.enabled && !this.featureFlags.contentExtraction) {
      errors.push('contentExtraction must be enabled when contextual chat is enabled');
    }

    if (this.featureFlags.contextualPrompts && !this.featureFlags.contentExtraction) {
      errors.push('contentExtraction must be enabled when contextualPrompts is enabled');
    }

    if (this.featureFlags.analytics && !this.config.security.auditAccess) {
      warnings.push('auditAccess should be enabled when analytics feature is enabled');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public isFeatureEnabled(feature: keyof ContextualChatFeatureFlags): boolean {
    return this.featureFlags[feature];
  }

  public getConfigSummary(): Record<string, any> {
    return {
      featureFlags: this.featureFlags,
      runtimeConfig: this.getRuntimeConfig(),
      validation: this.validateConfiguration(),
    };
  }
}