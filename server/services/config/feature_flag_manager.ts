/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';

export interface FeatureFlagDefinition {
  key: string;
  name: string;
  description: string;
  defaultValue: boolean;
  category: 'core' | 'performance' | 'security' | 'ui' | 'experimental';
  dependencies?: string[];
  rolloutPercentage?: number;
}

export interface FeatureFlagOverride {
  key: string;
  value: boolean;
  reason: string;
  timestamp: number;
  userId?: string;
}

export class FeatureFlagManager {
  private flags: Map<string, FeatureFlagDefinition> = new Map();
  private overrides: Map<string, FeatureFlagOverride> = new Map();
  private logger: Logger;
  private savedObjectsClient?: SavedObjectsClientContract;

  constructor(logger: Logger, savedObjectsClient?: SavedObjectsClientContract) {
    this.logger = logger;
    this.savedObjectsClient = savedObjectsClient;
    this.initializeDefaultFlags();
  }

  private initializeDefaultFlags(): void {
    const defaultFlags: FeatureFlagDefinition[] = [
      {
        key: 'contextual_chat_enabled',
        name: 'Contextual Chat',
        description: 'Enable contextual chat functionality',
        defaultValue: true,
        category: 'core',
      },
      {
        key: 'content_extraction_enabled',
        name: 'Content Extraction',
        description: 'Enable DOM content extraction',
        defaultValue: true,
        category: 'core',
        dependencies: ['contextual_chat_enabled'],
      },
      {
        key: 'dom_observation_enabled',
        name: 'DOM Observation',
        description: 'Enable real-time DOM change observation',
        defaultValue: true,
        category: 'performance',
        dependencies: ['content_extraction_enabled'],
      },
      {
        key: 'contextual_prompts_enabled',
        name: 'Contextual Prompts',
        description: 'Enable context-aware prompt enhancement',
        defaultValue: true,
        category: 'core',
        dependencies: ['content_extraction_enabled'],
      },
      {
        key: 'performance_optimization_enabled',
        name: 'Performance Optimization',
        description: 'Enable performance optimization features',
        defaultValue: true,
        category: 'performance',
      },
      {
        key: 'security_validation_enabled',
        name: 'Security Validation',
        description: 'Enable security validation and permission checks',
        defaultValue: true,
        category: 'security',
      },
      {
        key: 'admin_interface_enabled',
        name: 'Admin Interface',
        description: 'Enable administrative interface for contextual chat',
        defaultValue: false,
        category: 'ui',
        rolloutPercentage: 10,
      },
      {
        key: 'analytics_enabled',
        name: 'Analytics',
        description: 'Enable usage analytics and reporting',
        defaultValue: false,
        category: 'experimental',
        rolloutPercentage: 25,
      },
    ];

    defaultFlags.forEach((flag) => {
      this.flags.set(flag.key, flag);
    });
  }

  public async loadOverrides(): Promise<void> {
    if (!this.savedObjectsClient) {
      this.logger.warn('SavedObjectsClient not available, skipping override loading');
      return;
    }

    try {
      const response = await this.savedObjectsClient.find({
        type: 'contextual-chat-feature-flags',
        perPage: 100,
      });

      response.saved_objects.forEach((obj) => {
        const override = obj.attributes as FeatureFlagOverride;
        this.overrides.set(override.key, override);
      });

      this.logger.info(`Loaded ${this.overrides.size} feature flag overrides`);
    } catch (error) {
      this.logger.error('Failed to load feature flag overrides', error);
    }
  }

  public async saveOverride(override: FeatureFlagOverride): Promise<void> {
    if (!this.savedObjectsClient) {
      this.logger.warn('SavedObjectsClient not available, cannot save override');
      return;
    }

    try {
      await this.savedObjectsClient.create('contextual-chat-feature-flags', override, {
        id: override.key,
        overwrite: true,
      });

      this.overrides.set(override.key, override);
      this.logger.info(`Saved feature flag override for ${override.key}`);
    } catch (error) {
      this.logger.error(`Failed to save feature flag override for ${override.key}`, error);
      throw error;
    }
  }

  public isEnabled(flagKey: string, userId?: string): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      this.logger.warn(`Unknown feature flag: ${flagKey}`);
      return false;
    }

    // Check for override first
    const override = this.overrides.get(flagKey);
    if (override) {
      return override.value;
    }

    // Check rollout percentage if specified
    if (flag.rolloutPercentage !== undefined && userId) {
      const hash = this.hashUserId(userId);
      const userPercentage = hash % 100;
      if (userPercentage >= flag.rolloutPercentage) {
        return false;
      }
    }

    // Check dependencies
    if (flag.dependencies) {
      for (const dependency of flag.dependencies) {
        if (!this.isEnabled(dependency, userId)) {
          return false;
        }
      }
    }

    return flag.defaultValue;
  }

  public setOverride(flagKey: string, value: boolean, reason: string, userId?: string): void {
    const override: FeatureFlagOverride = {
      key: flagKey,
      value,
      reason,
      timestamp: Date.now(),
      userId,
    };

    this.overrides.set(flagKey, override);
    this.logger.info(`Set feature flag override: ${flagKey} = ${value} (${reason})`);
  }

  public removeOverride(flagKey: string): void {
    this.overrides.delete(flagKey);
    this.logger.info(`Removed feature flag override for ${flagKey}`);
  }

  public getAllFlags(): FeatureFlagDefinition[] {
    return Array.from(this.flags.values());
  }

  public getAllOverrides(): FeatureFlagOverride[] {
    return Array.from(this.overrides.values());
  }

  public getFlagStatus(userId?: string): Record<string, boolean> {
    const status: Record<string, boolean> = {};

    this.flags.forEach((flag, key) => {
      status[key] = this.isEnabled(key, userId);
    });

    return status;
  }

  public validateDependencies(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    this.flags.forEach((flag, key) => {
      if (flag.dependencies) {
        for (const dependency of flag.dependencies) {
          if (!this.flags.has(dependency)) {
            errors.push(`Flag ${key} depends on non-existent flag ${dependency}`);
          }
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
