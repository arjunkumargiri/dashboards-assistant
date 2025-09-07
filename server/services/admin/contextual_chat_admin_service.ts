/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';
import { ContextualChatConfigService } from '../config/contextual_chat_config_service';
import { FeatureFlagManager } from '../config/feature_flag_manager';

export interface AdminSettings {
  id: string;
  name: string;
  description: string;
  value: any;
  type: 'boolean' | 'number' | 'string' | 'object';
  category: 'performance' | 'security' | 'features' | 'monitoring';
  editable: boolean;
  requiresRestart: boolean;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'error';
  checks: HealthCheck[];
  lastUpdated: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, any>;
}

export interface AdminDashboardData {
  settings: AdminSettings[];
  systemHealth: SystemHealth;
  featureFlags: Record<string, boolean>;
  performanceMetrics: PerformanceMetrics;
  usageStatistics: UsageStatistics;
}

export interface PerformanceMetrics {
  averageExtractionTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  activeContexts: number;
  errorRate: number;
  lastUpdated: number;
}

export interface UsageStatistics {
  totalContextExtractions: number;
  totalChatInteractions: number;
  averageContextSize: number;
  mostUsedFeatures: Array<{ feature: string; count: number }>;
  userEngagement: {
    dailyActiveUsers: number;
    averageSessionDuration: number;
  };
  lastUpdated: number;
}

export class ContextualChatAdminService {
  private configService: ContextualChatConfigService;
  private featureFlagManager: FeatureFlagManager;
  private savedObjectsClient: SavedObjectsClientContract;
  private logger: Logger;

  constructor(
    configService: ContextualChatConfigService,
    featureFlagManager: FeatureFlagManager,
    savedObjectsClient: SavedObjectsClientContract,
    logger: Logger
  ) {
    this.configService = configService;
    this.featureFlagManager = featureFlagManager;
    this.savedObjectsClient = savedObjectsClient;
    this.logger = logger;
  }

  public async getAdminDashboardData(): Promise<AdminDashboardData> {
    try {
      const [settings, systemHealth, featureFlags, performanceMetrics, usageStatistics] = await Promise.all([
        this.getAdminSettings(),
        this.getSystemHealth(),
        this.getFeatureFlagStatus(),
        this.getPerformanceMetrics(),
        this.getUsageStatistics(),
      ]);

      return {
        settings,
        systemHealth,
        featureFlags,
        performanceMetrics,
        usageStatistics,
      };
    } catch (error) {
      this.logger.error('Failed to get admin dashboard data', error);
      throw error;
    }
  }

  public async getAdminSettings(): Promise<AdminSettings[]> {
    const runtimeConfig = this.configService.getRuntimeConfig();
    const featureFlags = this.configService.getFeatureFlags();

    return [
      {
        id: 'enabled',
        name: 'Contextual Chat Enabled',
        description: 'Enable or disable contextual chat functionality',
        value: featureFlags.enabled,
        type: 'boolean',
        category: 'features',
        editable: true,
        requiresRestart: false,
      },
      {
        id: 'maxVisualizations',
        name: 'Maximum Visualizations',
        description: 'Maximum number of visualizations to extract context from',
        value: runtimeConfig.maxVisualizations,
        type: 'number',
        category: 'performance',
        editable: true,
        requiresRestart: false,
      },
      {
        id: 'contextCacheTTL',
        name: 'Context Cache TTL (seconds)',
        description: 'Time to live for cached context data',
        value: runtimeConfig.contextCacheTTL,
        type: 'number',
        category: 'performance',
        editable: true,
        requiresRestart: false,
      },
      {
        id: 'extractionTimeout',
        name: 'Extraction Timeout (ms)',
        description: 'Maximum time allowed for content extraction',
        value: runtimeConfig.extractionTimeout,
        type: 'number',
        category: 'performance',
        editable: true,
        requiresRestart: false,
      },
      {
        id: 'respectPermissions',
        name: 'Respect User Permissions',
        description: 'Filter context based on user access rights',
        value: runtimeConfig.respectPermissions,
        type: 'boolean',
        category: 'security',
        editable: true,
        requiresRestart: false,
      },
      {
        id: 'auditAccess',
        name: 'Audit Context Access',
        description: 'Log context access for security auditing',
        value: runtimeConfig.auditAccess,
        type: 'boolean',
        category: 'security',
        editable: true,
        requiresRestart: false,
      },
      {
        id: 'enableLazyLoading',
        name: 'Enable Lazy Loading',
        description: 'Load context data on demand to improve performance',
        value: runtimeConfig.enableLazyLoading,
        type: 'boolean',
        category: 'performance',
        editable: true,
        requiresRestart: false,
      },
      {
        id: 'debounceMs',
        name: 'DOM Update Debounce (ms)',
        description: 'Delay before processing DOM changes',
        value: runtimeConfig.debounceMs,
        type: 'number',
        category: 'performance',
        editable: true,
        requiresRestart: false,
      },
    ];
  }

  public async updateAdminSetting(settingId: string, value: any): Promise<void> {
    this.logger.info(`Updating admin setting: ${settingId} = ${value}`);

    try {
      switch (settingId) {
        case 'enabled':
          this.configService.updateFeatureFlag('enabled', value);
          break;
        case 'maxVisualizations':
          this.configService.updateRuntimeConfig({ maxVisualizations: value });
          break;
        case 'contextCacheTTL':
          this.configService.updateRuntimeConfig({ contextCacheTTL: value });
          break;
        case 'extractionTimeout':
          this.configService.updateRuntimeConfig({ extractionTimeout: value });
          break;
        case 'respectPermissions':
          this.configService.updateRuntimeConfig({ respectPermissions: value });
          break;
        case 'auditAccess':
          this.configService.updateRuntimeConfig({ auditAccess: value });
          break;
        case 'enableLazyLoading':
          this.configService.updateRuntimeConfig({ enableLazyLoading: value });
          break;
        case 'debounceMs':
          this.configService.updateRuntimeConfig({ debounceMs: value });
          break;
        default:
          throw new Error(`Unknown setting: ${settingId}`);
      }

      // Save the change to persistent storage
      await this.saveSettingChange(settingId, value);
      
      this.logger.info(`Successfully updated admin setting: ${settingId}`);
    } catch (error) {
      this.logger.error(`Failed to update admin setting ${settingId}`, error);
      throw error;
    }
  }

  public async getSystemHealth(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];

    // Configuration validation check
    const configValidation = this.configService.validateConfiguration();
    checks.push({
      name: 'Configuration Validation',
      status: configValidation.isValid ? 'pass' : 'fail',
      message: configValidation.isValid 
        ? 'Configuration is valid' 
        : `Configuration has ${configValidation.errors.length} errors`,
      details: {
        errors: configValidation.errors,
        warnings: configValidation.warnings,
      },
    });

    // Feature flag dependencies check
    const flagValidation = this.featureFlagManager.validateDependencies();
    checks.push({
      name: 'Feature Flag Dependencies',
      status: flagValidation.isValid ? 'pass' : 'fail',
      message: flagValidation.isValid 
        ? 'All feature flag dependencies are satisfied' 
        : `${flagValidation.errors.length} dependency issues found`,
      details: {
        errors: flagValidation.errors,
      },
    });

    // Performance metrics check
    const performanceMetrics = await this.getPerformanceMetrics();
    const performanceStatus = this.evaluatePerformanceHealth(performanceMetrics);
    checks.push({
      name: 'Performance Metrics',
      status: performanceStatus.status,
      message: performanceStatus.message,
      details: performanceMetrics,
    });

    // Determine overall system status
    const hasFailures = checks.some(check => check.status === 'fail');
    const hasWarnings = checks.some(check => check.status === 'warn');
    
    let overallStatus: SystemHealth['status'];
    if (hasFailures) {
      overallStatus = 'error';
    } else if (hasWarnings) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      checks,
      lastUpdated: Date.now(),
    };
  }

  public async getFeatureFlagStatus(): Promise<Record<string, boolean>> {
    return this.featureFlagManager.getFlagStatus();
  }

  public async updateFeatureFlag(flagKey: string, value: boolean, reason: string): Promise<void> {
    this.logger.info(`Updating feature flag: ${flagKey} = ${value} (${reason})`);

    try {
      this.featureFlagManager.setOverride(flagKey, value, reason);
      await this.featureFlagManager.saveOverride({
        key: flagKey,
        value,
        reason,
        timestamp: Date.now(),
      });

      this.logger.info(`Successfully updated feature flag: ${flagKey}`);
    } catch (error) {
      this.logger.error(`Failed to update feature flag ${flagKey}`, error);
      throw error;
    }
  }

  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      // In a real implementation, these would come from actual metrics collection
      // For now, we'll return mock data that would be collected from the system
      const metricsData = await this.loadMetricsFromStorage();

      return {
        averageExtractionTime: metricsData?.averageExtractionTime || 0,
        cacheHitRate: metricsData?.cacheHitRate || 0,
        memoryUsage: metricsData?.memoryUsage || 0,
        activeContexts: metricsData?.activeContexts || 0,
        errorRate: metricsData?.errorRate || 0,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', error);
      return {
        averageExtractionTime: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        activeContexts: 0,
        errorRate: 0,
        lastUpdated: Date.now(),
      };
    }
  }

  public async getUsageStatistics(): Promise<UsageStatistics> {
    try {
      const usageData = await this.loadUsageFromStorage();

      return {
        totalContextExtractions: usageData?.totalContextExtractions || 0,
        totalChatInteractions: usageData?.totalChatInteractions || 0,
        averageContextSize: usageData?.averageContextSize || 0,
        mostUsedFeatures: usageData?.mostUsedFeatures || [],
        userEngagement: {
          dailyActiveUsers: usageData?.userEngagement?.dailyActiveUsers || 0,
          averageSessionDuration: usageData?.userEngagement?.averageSessionDuration || 0,
        },
        lastUpdated: Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to get usage statistics', error);
      return {
        totalContextExtractions: 0,
        totalChatInteractions: 0,
        averageContextSize: 0,
        mostUsedFeatures: [],
        userEngagement: {
          dailyActiveUsers: 0,
          averageSessionDuration: 0,
        },
        lastUpdated: Date.now(),
      };
    }
  }

  private async saveSettingChange(settingId: string, value: any): Promise<void> {
    try {
      await this.savedObjectsClient.create(
        'contextual-chat-admin-settings',
        {
          settingId,
          value,
          timestamp: Date.now(),
        },
        { id: settingId, overwrite: true }
      );
    } catch (error) {
      this.logger.error(`Failed to save setting change for ${settingId}`, error);
      // Don't throw here as the setting was already updated in memory
    }
  }

  private async loadMetricsFromStorage(): Promise<any> {
    try {
      const response = await this.savedObjectsClient.get(
        'contextual-chat-performance-metrics',
        'current'
      );
      return response.attributes;
    } catch (error) {
      // Return null if not found, which is expected for first run
      return null;
    }
  }

  private async loadUsageFromStorage(): Promise<any> {
    try {
      const response = await this.savedObjectsClient.get(
        'contextual-chat-usage-statistics',
        'current'
      );
      return response.attributes;
    } catch (error) {
      // Return null if not found, which is expected for first run
      return null;
    }
  }

  private evaluatePerformanceHealth(metrics: PerformanceMetrics): { status: HealthCheck['status']; message: string } {
    const issues: string[] = [];

    if (metrics.averageExtractionTime > 5000) {
      issues.push('High extraction time');
    }
    if (metrics.cacheHitRate < 0.7) {
      issues.push('Low cache hit rate');
    }
    if (metrics.errorRate > 0.05) {
      issues.push('High error rate');
    }
    if (metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB
      issues.push('High memory usage');
    }

    if (issues.length === 0) {
      return { status: 'pass', message: 'Performance metrics are within acceptable ranges' };
    } else if (issues.length <= 2) {
      return { status: 'warn', message: `Performance concerns: ${issues.join(', ')}` };
    } else {
      return { status: 'fail', message: `Multiple performance issues: ${issues.join(', ')}` };
    }
  }
}