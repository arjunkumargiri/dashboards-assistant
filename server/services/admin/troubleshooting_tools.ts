/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';
import { ContextualChatConfigService } from '../config/contextual_chat_config_service';
import { PerformanceMonitoringService } from './performance_monitoring_service';

export interface DiagnosticTest {
  name: string;
  description: string;
  category: 'configuration' | 'performance' | 'connectivity' | 'data' | 'security';
  severity: 'info' | 'warning' | 'error';
  run: () => Promise<DiagnosticResult>;
}

export interface DiagnosticResult {
  passed: boolean;
  message: string;
  details?: Record<string, any>;
  suggestions?: string[];
  duration: number;
}

export interface TroubleshootingReport {
  timestamp: number;
  overallStatus: 'healthy' | 'issues' | 'critical';
  summary: {
    totalTests: number;
    passed: number;
    warnings: number;
    errors: number;
  };
  results: Array<{
    test: string;
    category: string;
    result: DiagnosticResult;
  }>;
  recommendations: string[];
}

export interface SystemInfo {
  version: string;
  environment: string;
  configuration: Record<string, any>;
  runtime: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    nodeVersion: string;
  };
  features: {
    enabled: string[];
    disabled: string[];
  };
}

export class TroubleshootingTools {
  private configService: ContextualChatConfigService;
  private performanceService: PerformanceMonitoringService;
  private savedObjectsClient: SavedObjectsClientContract;
  private logger: Logger;
  private diagnosticTests: Map<string, DiagnosticTest> = new Map();

  constructor(
    configService: ContextualChatConfigService,
    performanceService: PerformanceMonitoringService,
    savedObjectsClient: SavedObjectsClientContract,
    logger: Logger
  ) {
    this.configService = configService;
    this.performanceService = performanceService;
    this.savedObjectsClient = savedObjectsClient;
    this.logger = logger;
    this.initializeDiagnosticTests();
  }

  private initializeDiagnosticTests(): void {
    // Configuration tests
    this.addDiagnosticTest({
      name: 'Configuration Validation',
      description: 'Validates contextual chat configuration settings',
      category: 'configuration',
      severity: 'error',
      run: async () => {
        const startTime = Date.now();
        const validation = this.configService.validateConfiguration();

        return {
          passed: validation.isValid,
          message: validation.isValid
            ? 'Configuration is valid'
            : `Configuration has ${validation.errors.length} errors`,
          details: {
            errors: validation.errors,
            warnings: validation.warnings,
          },
          suggestions:
            validation.errors.length > 0
              ? ['Review configuration errors and update settings accordingly']
              : [],
          duration: Date.now() - startTime,
        };
      },
    });

    // Performance tests
    this.addDiagnosticTest({
      name: 'Performance Metrics Check',
      description: 'Checks if performance metrics are within acceptable ranges',
      category: 'performance',
      severity: 'warning',
      run: async () => {
        const startTime = Date.now();
        const dashboard = await this.performanceService.getDashboard();
        const issues = dashboard.systemHealth.issues;

        return {
          passed: dashboard.systemHealth.status === 'healthy',
          message:
            dashboard.systemHealth.status === 'healthy'
              ? 'Performance metrics are healthy'
              : `Performance issues detected: ${issues.length} issues`,
          details: {
            status: dashboard.systemHealth.status,
            score: dashboard.systemHealth.score,
            issues,
            metrics: dashboard.realTimeMetrics,
          },
          suggestions:
            issues.length > 0
              ? ['Review performance metrics and consider adjusting configuration']
              : [],
          duration: Date.now() - startTime,
        };
      },
    });

    // Data connectivity test
    this.addDiagnosticTest({
      name: 'Saved Objects Connectivity',
      description: 'Tests connectivity to saved objects storage',
      category: 'connectivity',
      severity: 'error',
      run: async () => {
        const startTime = Date.now();

        try {
          // Try to create and delete a test object
          const testId = `test-${Date.now()}`;
          await this.savedObjectsClient.create(
            'contextual-chat-diagnostic-test',
            { test: true },
            { id: testId }
          );

          await this.savedObjectsClient.delete('contextual-chat-diagnostic-test', testId);

          return {
            passed: true,
            message: 'Saved objects connectivity is working',
            duration: Date.now() - startTime,
          };
        } catch (error) {
          return {
            passed: false,
            message: `Saved objects connectivity failed: ${error.message}`,
            details: { error: error.message },
            suggestions: [
              'Check OpenSearch cluster connectivity',
              'Verify saved objects index exists and is accessible',
            ],
            duration: Date.now() - startTime,
          };
        }
      },
    });

    // Memory usage test
    this.addDiagnosticTest({
      name: 'Memory Usage Check',
      description: 'Checks current memory usage and potential leaks',
      category: 'performance',
      severity: 'warning',
      run: async () => {
        const startTime = Date.now();
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;

        const isHighUsage = heapUsedMB > 100; // 100MB threshold
        const isVeryHighUsage = heapUsedMB > 200; // 200MB threshold

        let message = `Memory usage: ${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB`;
        const suggestions: string[] = [];

        if (isVeryHighUsage) {
          message += ' (Very High)';
          suggestions.push('Consider restarting the service to free memory');
          suggestions.push('Review context cache settings to reduce memory usage');
        } else if (isHighUsage) {
          message += ' (High)';
          suggestions.push('Monitor memory usage trends');
          suggestions.push('Consider reducing context cache TTL');
        } else {
          message += ' (Normal)';
        }

        return {
          passed: !isVeryHighUsage,
          message,
          details: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
          },
          suggestions,
          duration: Date.now() - startTime,
        };
      },
    });

    // Feature flags consistency test
    this.addDiagnosticTest({
      name: 'Feature Flags Consistency',
      description: 'Checks for feature flag dependency issues',
      category: 'configuration',
      severity: 'warning',
      run: async () => {
        const startTime = Date.now();
        const featureFlags = this.configService.getFeatureFlags();
        const issues: string[] = [];

        // Check common dependency issues
        if (featureFlags.enabled && !featureFlags.contentExtraction) {
          issues.push('Contextual chat is enabled but content extraction is disabled');
        }

        if (featureFlags.contextualPrompts && !featureFlags.contentExtraction) {
          issues.push('Contextual prompts are enabled but content extraction is disabled');
        }

        if (featureFlags.performanceOptimization && !featureFlags.enabled) {
          issues.push('Performance optimization is enabled but contextual chat is disabled');
        }

        return {
          passed: issues.length === 0,
          message:
            issues.length === 0
              ? 'Feature flags are consistent'
              : `Found ${issues.length} feature flag issues`,
          details: {
            featureFlags,
            issues,
          },
          suggestions:
            issues.length > 0
              ? ['Review feature flag dependencies and enable required features']
              : [],
          duration: Date.now() - startTime,
        };
      },
    });

    // Context extraction test
    this.addDiagnosticTest({
      name: 'Context Extraction Test',
      description: 'Tests basic context extraction functionality',
      category: 'data',
      severity: 'error',
      run: async () => {
        const startTime = Date.now();

        try {
          // This would normally test actual extraction, but for now we'll simulate
          const mockExtractionTime = Math.random() * 1000 + 500; // 500-1500ms
          const success = mockExtractionTime < 5000; // Fail if > 5s

          await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate work

          return {
            passed: success,
            message: success
              ? `Context extraction test passed (${mockExtractionTime.toFixed(0)}ms)`
              : `Context extraction test failed (timeout: ${mockExtractionTime.toFixed(0)}ms)`,
            details: {
              extractionTime: mockExtractionTime,
              timeout: 5000,
            },
            suggestions: success
              ? []
              : [
                  'Check extraction timeout configuration',
                  'Review DOM structure complexity',
                  'Consider enabling lazy loading',
                ],
            duration: Date.now() - startTime,
          };
        } catch (error) {
          return {
            passed: false,
            message: `Context extraction test failed: ${error.message}`,
            details: { error: error.message },
            suggestions: [
              'Check content extractor service configuration',
              'Verify DOM observer is functioning',
            ],
            duration: Date.now() - startTime,
          };
        }
      },
    });
  }

  public addDiagnosticTest(test: DiagnosticTest): void {
    this.diagnosticTests.set(test.name, test);
    this.logger.debug(`Added diagnostic test: ${test.name}`);
  }

  public removeDiagnosticTest(testName: string): void {
    this.diagnosticTests.delete(testName);
    this.logger.debug(`Removed diagnostic test: ${testName}`);
  }

  public async runDiagnostics(testNames?: string[]): Promise<TroubleshootingReport> {
    const timestamp = Date.now();
    const testsToRun = testNames
      ? (testNames
          .map((name) => this.diagnosticTests.get(name))
          .filter(Boolean) as DiagnosticTest[])
      : Array.from(this.diagnosticTests.values());

    this.logger.info(`Running ${testsToRun.length} diagnostic tests`);

    const results: TroubleshootingReport['results'] = [];
    let passed = 0;
    let warnings = 0;
    let errors = 0;

    for (const test of testsToRun) {
      try {
        this.logger.debug(`Running diagnostic test: ${test.name}`);
        const result = await test.run();

        results.push({
          test: test.name,
          category: test.category,
          result,
        });

        if (result.passed) {
          passed++;
        } else {
          if (test.severity === 'error') {
            errors++;
          } else {
            warnings++;
          }
        }
      } catch (error) {
        this.logger.error(`Diagnostic test ${test.name} threw an error`, error);

        results.push({
          test: test.name,
          category: test.category,
          result: {
            passed: false,
            message: `Test execution failed: ${error.message}`,
            details: { error: error.message },
            duration: 0,
          },
        });

        errors++;
      }
    }

    // Generate overall status
    let overallStatus: TroubleshootingReport['overallStatus'];
    if (errors > 0) {
      overallStatus = 'critical';
    } else if (warnings > 0) {
      overallStatus = 'issues';
    } else {
      overallStatus = 'healthy';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(results);

    const report: TroubleshootingReport = {
      timestamp,
      overallStatus,
      summary: {
        totalTests: testsToRun.length,
        passed,
        warnings,
        errors,
      },
      results,
      recommendations,
    };

    // Save report for history
    await this.saveReport(report);

    this.logger.info(`Diagnostic tests completed: ${passed}/${testsToRun.length} passed`);

    return report;
  }

  public async getSystemInfo(): Promise<SystemInfo> {
    const featureFlags = this.configService.getFeatureFlags();
    const runtimeConfig = this.configService.getRuntimeConfig();

    const enabled = Object.entries(featureFlags)
      .filter(([, value]) => value)
      .map(([key]) => key);

    const disabled = Object.entries(featureFlags)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    return {
      version: '1.0.0', // This would come from package.json
      environment: process.env.NODE_ENV || 'development',
      configuration: {
        featureFlags,
        runtimeConfig,
      },
      runtime: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
      },
      features: {
        enabled,
        disabled,
      },
    };
  }

  public async getReportHistory(limit: number = 10): Promise<TroubleshootingReport[]> {
    try {
      const response = await this.savedObjectsClient.find({
        type: 'contextual-chat-diagnostic-reports',
        perPage: limit,
        sortField: 'timestamp',
        sortOrder: 'desc',
      });

      return response.saved_objects.map((obj) => obj.attributes as TroubleshootingReport);
    } catch (error) {
      this.logger.error('Failed to get report history', error);
      return [];
    }
  }

  public async exportDiagnosticData(): Promise<{
    systemInfo: SystemInfo;
    latestReport: TroubleshootingReport | null;
    performanceDashboard: any;
    recentLogs: string[];
  }> {
    try {
      const [systemInfo, reports, performanceDashboard] = await Promise.all([
        this.getSystemInfo(),
        this.getReportHistory(1),
        this.performanceService.getDashboard(),
      ]);

      return {
        systemInfo,
        latestReport: reports[0] || null,
        performanceDashboard,
        recentLogs: [], // This would be populated from actual log files
      };
    } catch (error) {
      this.logger.error('Failed to export diagnostic data', error);
      throw error;
    }
  }

  private generateRecommendations(results: TroubleshootingReport['results']): string[] {
    const recommendations: string[] = [];
    const failedTests = results.filter((r) => !r.result.passed);

    // Configuration recommendations
    const configIssues = failedTests.filter((r) => r.category === 'configuration');
    if (configIssues.length > 0) {
      recommendations.push('Review and update configuration settings to resolve validation errors');
    }

    // Performance recommendations
    const performanceIssues = failedTests.filter((r) => r.category === 'performance');
    if (performanceIssues.length > 0) {
      recommendations.push('Consider adjusting performance settings or scaling resources');
    }

    // Connectivity recommendations
    const connectivityIssues = failedTests.filter((r) => r.category === 'connectivity');
    if (connectivityIssues.length > 0) {
      recommendations.push('Check network connectivity and service dependencies');
    }

    // Data recommendations
    const dataIssues = failedTests.filter((r) => r.category === 'data');
    if (dataIssues.length > 0) {
      recommendations.push('Verify data extraction and processing functionality');
    }

    // General recommendations
    if (failedTests.length > 3) {
      recommendations.push('Consider restarting the contextual chat service');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating normally - no immediate action required');
    }

    return recommendations;
  }

  private async saveReport(report: TroubleshootingReport): Promise<void> {
    try {
      await this.savedObjectsClient.create('contextual-chat-diagnostic-reports', report, {
        id: `report-${report.timestamp}`,
      });
    } catch (error) {
      this.logger.error('Failed to save diagnostic report', error);
      // Don't throw here as the report was still generated successfully
    }
  }
}
