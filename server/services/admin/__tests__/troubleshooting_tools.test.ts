/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';
import { TroubleshootingTools } from '../troubleshooting_tools';
import { ContextualChatConfigService } from '../../config/contextual_chat_config_service';
import { PerformanceMonitoringService } from '../performance_monitoring_service';

describe('TroubleshootingTools', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockSavedObjectsClient: jest.Mocked<SavedObjectsClientContract>;
  let mockConfigService: jest.Mocked<ContextualChatConfigService>;
  let mockPerformanceService: jest.Mocked<PerformanceMonitoringService>;
  let troubleshootingTools: TroubleshootingTools;

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

    mockConfigService = {
      validateConfiguration: jest.fn(),
      getFeatureFlags: jest.fn(),
      getRuntimeConfig: jest.fn(),
    } as any;

    mockPerformanceService = {
      getDashboard: jest.fn(),
    } as any;

    troubleshootingTools = new TroubleshootingTools(
      mockConfigService,
      mockPerformanceService,
      mockSavedObjectsClient,
      mockLogger
    );
  });

  describe('diagnostic tests', () => {
    beforeEach(() => {
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockPerformanceService.getDashboard.mockResolvedValue({
        realTimeMetrics: {},
        alerts: [],
        trends: {
          extractionTime: [],
          memoryUsage: [],
          cacheHitRate: [],
          errorRate: [],
        },
        systemHealth: {
          status: 'healthy',
          score: 95,
          issues: [],
        },
      });

      mockSavedObjectsClient.create.mockResolvedValue({} as any);
      mockSavedObjectsClient.delete.mockResolvedValue({} as any);
    });

    it('should run all diagnostic tests successfully', async () => {
      const report = await troubleshootingTools.runDiagnostics();

      expect(report.overallStatus).toBe('healthy');
      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.summary.passed).toBe(report.summary.totalTests);
      expect(report.summary.errors).toBe(0);
      expect(report.summary.warnings).toBe(0);
      expect(report.results.length).toBe(report.summary.totalTests);
    });

    it('should run specific diagnostic tests', async () => {
      const report = await troubleshootingTools.runDiagnostics(['Configuration Validation']);

      expect(report.summary.totalTests).toBe(1);
      expect(report.results[0].test).toBe('Configuration Validation');
    });

    it('should handle configuration validation failures', async () => {
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: false,
        errors: ['Invalid setting'],
        warnings: ['Suboptimal setting'],
      });

      const report = await troubleshootingTools.runDiagnostics(['Configuration Validation']);

      expect(report.overallStatus).toBe('critical');
      expect(report.summary.errors).toBe(1);
      expect(report.results[0].result.passed).toBe(false);
      expect(report.results[0].result.message).toContain('1 errors');
    });

    it('should handle performance issues', async () => {
      mockPerformanceService.getDashboard.mockResolvedValue({
        realTimeMetrics: {},
        alerts: [],
        trends: {
          extractionTime: [],
          memoryUsage: [],
          cacheHitRate: [],
          errorRate: [],
        },
        systemHealth: {
          status: 'warning',
          score: 65,
          issues: ['High extraction time', 'Low cache hit rate'],
        },
      });

      const report = await troubleshootingTools.runDiagnostics(['Performance Metrics Check']);

      expect(report.overallStatus).toBe('issues');
      expect(report.summary.warnings).toBe(1);
      expect(report.results[0].result.passed).toBe(false);
      expect(report.results[0].result.details.issues).toHaveLength(2);
    });

    it('should test saved objects connectivity', async () => {
      const report = await troubleshootingTools.runDiagnostics(['Saved Objects Connectivity']);

      expect(report.results[0].result.passed).toBe(true);
      expect(mockSavedObjectsClient.create).toHaveBeenCalledWith(
        'contextual-chat-diagnostic-test',
        { test: true },
        { id: expect.stringMatching(/test-\d+/) }
      );
      expect(mockSavedObjectsClient.delete).toHaveBeenCalled();
    });

    it('should handle saved objects connectivity failures', async () => {
      mockSavedObjectsClient.create.mockRejectedValue(new Error('Connection failed'));

      const report = await troubleshootingTools.runDiagnostics(['Saved Objects Connectivity']);

      expect(report.overallStatus).toBe('critical');
      expect(report.results[0].result.passed).toBe(false);
      expect(report.results[0].result.message).toContain('Connection failed');
      expect(report.results[0].result.suggestions).toContain('Check OpenSearch cluster connectivity');
    });

    it('should check memory usage', async () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
      });

      const report = await troubleshootingTools.runDiagnostics(['Memory Usage Check']);

      expect(report.results[0].result.passed).toBe(true);
      expect(report.results[0].result.message).toContain('50.0MB');
      expect(report.results[0].result.message).toContain('(Normal)');

      process.memoryUsage = originalMemoryUsage;
    });

    it('should detect high memory usage', async () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 250 * 1024 * 1024, // 250MB (very high)
        heapTotal: 300 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 320 * 1024 * 1024,
      });

      const report = await troubleshootingTools.runDiagnostics(['Memory Usage Check']);

      expect(report.results[0].result.passed).toBe(false);
      expect(report.results[0].result.message).toContain('(Very High)');
      expect(report.results[0].result.suggestions).toContain('Consider restarting the service');

      process.memoryUsage = originalMemoryUsage;
    });

    it('should check feature flag consistency', async () => {
      mockConfigService.getFeatureFlags.mockReturnValue({
        enabled: true,
        contentExtraction: false, // Inconsistent!
        domObservation: true,
        contextualPrompts: true,
        performanceOptimization: true,
        securityValidation: true,
        adminInterface: true,
        analytics: true,
      });

      const report = await troubleshootingTools.runDiagnostics(['Feature Flags Consistency']);

      expect(report.results[0].result.passed).toBe(false);
      expect(report.results[0].result.details.issues).toContain(
        'Contextual chat is enabled but content extraction is disabled'
      );
      expect(report.results[0].result.details.issues).toContain(
        'Contextual prompts are enabled but content extraction is disabled'
      );
    });

    it('should test context extraction functionality', async () => {
      const report = await troubleshootingTools.runDiagnostics(['Context Extraction Test']);

      // This test uses mock extraction, so it should pass
      expect(report.results[0].result.passed).toBe(true);
      expect(report.results[0].result.message).toContain('passed');
      expect(report.results[0].result.details.extractionTime).toBeDefined();
    });

    it('should handle test execution errors', async () => {
      // Add a test that throws an error
      troubleshootingTools.addDiagnosticTest({
        name: 'Failing Test',
        description: 'A test that always fails',
        category: 'configuration',
        severity: 'error',
        run: async () => {
          throw new Error('Test execution failed');
        },
      });

      const report = await troubleshootingTools.runDiagnostics(['Failing Test']);

      expect(report.overallStatus).toBe('critical');
      expect(report.results[0].result.passed).toBe(false);
      expect(report.results[0].result.message).toContain('Test execution failed');
    });
  });

  describe('system information', () => {
    beforeEach(() => {
      mockConfigService.getFeatureFlags.mockReturnValue({
        enabled: true,
        contentExtraction: true,
        domObservation: false,
        contextualPrompts: true,
        performanceOptimization: true,
        securityValidation: true,
        adminInterface: false,
        analytics: true,
      });

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
    });

    it('should return comprehensive system information', async () => {
      const systemInfo = await troubleshootingTools.getSystemInfo();

      expect(systemInfo.version).toBeDefined();
      expect(systemInfo.environment).toBeDefined();
      expect(systemInfo.configuration).toHaveProperty('featureFlags');
      expect(systemInfo.configuration).toHaveProperty('runtimeConfig');
      expect(systemInfo.runtime).toHaveProperty('uptime');
      expect(systemInfo.runtime).toHaveProperty('memoryUsage');
      expect(systemInfo.runtime).toHaveProperty('nodeVersion');
      expect(systemInfo.features).toHaveProperty('enabled');
      expect(systemInfo.features).toHaveProperty('disabled');

      expect(systemInfo.features.enabled).toContain('enabled');
      expect(systemInfo.features.enabled).toContain('contentExtraction');
      expect(systemInfo.features.disabled).toContain('domObservation');
      expect(systemInfo.features.disabled).toContain('adminInterface');
    });
  });

  describe('report management', () => {
    it('should save diagnostic reports', async () => {
      mockSavedObjectsClient.create.mockResolvedValue({} as any);

      const report = await troubleshootingTools.runDiagnostics();

      expect(mockSavedObjectsClient.create).toHaveBeenCalledWith(
        'contextual-chat-diagnostic-reports',
        report,
        { id: `report-${report.timestamp}` }
      );
    });

    it('should get report history', async () => {
      const mockReports = [
        {
          timestamp: Date.now() - 1000,
          overallStatus: 'healthy',
          summary: { totalTests: 5, passed: 5, warnings: 0, errors: 0 },
          results: [],
          recommendations: [],
        },
        {
          timestamp: Date.now() - 2000,
          overallStatus: 'issues',
          summary: { totalTests: 5, passed: 3, warnings: 2, errors: 0 },
          results: [],
          recommendations: [],
        },
      ];

      mockSavedObjectsClient.find.mockResolvedValue({
        saved_objects: mockReports.map(report => ({ attributes: report })),
        total: 2,
        per_page: 10,
        page: 1,
      });

      const history = await troubleshootingTools.getReportHistory();

      expect(history).toHaveLength(2);
      expect(history[0].overallStatus).toBe('healthy');
      expect(history[1].overallStatus).toBe('issues');
    });

    it('should handle report history errors', async () => {
      mockSavedObjectsClient.find.mockRejectedValue(new Error('Database error'));

      const history = await troubleshootingTools.getReportHistory();

      expect(history).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get report history',
        expect.any(Error)
      );
    });
  });

  describe('diagnostic data export', () => {
    beforeEach(() => {
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

      mockPerformanceService.getDashboard.mockResolvedValue({
        realTimeMetrics: {},
        alerts: [],
        trends: {
          extractionTime: [],
          memoryUsage: [],
          cacheHitRate: [],
          errorRate: [],
        },
        systemHealth: {
          status: 'healthy',
          score: 95,
          issues: [],
        },
      });

      mockSavedObjectsClient.find.mockResolvedValue({
        saved_objects: [
          {
            attributes: {
              timestamp: Date.now(),
              overallStatus: 'healthy',
              summary: { totalTests: 5, passed: 5, warnings: 0, errors: 0 },
              results: [],
              recommendations: [],
            },
          },
        ],
        total: 1,
        per_page: 1,
        page: 1,
      });
    });

    it('should export comprehensive diagnostic data', async () => {
      const exportData = await troubleshootingTools.exportDiagnosticData();

      expect(exportData).toHaveProperty('systemInfo');
      expect(exportData).toHaveProperty('latestReport');
      expect(exportData).toHaveProperty('performanceDashboard');
      expect(exportData).toHaveProperty('recentLogs');

      expect(exportData.systemInfo.version).toBeDefined();
      expect(exportData.latestReport).toBeDefined();
      expect(exportData.latestReport!.overallStatus).toBe('healthy');
      expect(exportData.performanceDashboard.systemHealth.status).toBe('healthy');
      expect(Array.isArray(exportData.recentLogs)).toBe(true);
    });

    it('should handle export errors', async () => {
      mockConfigService.getFeatureFlags.mockImplementation(() => {
        throw new Error('Config error');
      });

      await expect(troubleshootingTools.exportDiagnosticData()).rejects.toThrow('Config error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to export diagnostic data',
        expect.any(Error)
      );
    });
  });

  describe('custom diagnostic tests', () => {
    it('should allow adding custom diagnostic tests', () => {
      const customTest = {
        name: 'Custom Test',
        description: 'A custom diagnostic test',
        category: 'configuration' as const,
        severity: 'warning' as const,
        run: async () => ({
          passed: true,
          message: 'Custom test passed',
          duration: 100,
        }),
      };

      troubleshootingTools.addDiagnosticTest(customTest);

      expect(mockLogger.debug).toHaveBeenCalledWith('Added diagnostic test: Custom Test');
    });

    it('should allow removing diagnostic tests', () => {
      troubleshootingTools.removeDiagnosticTest('Configuration Validation');

      expect(mockLogger.debug).toHaveBeenCalledWith('Removed diagnostic test: Configuration Validation');
    });

    it('should run custom diagnostic tests', async () => {
      const customTest = {
        name: 'Custom Test',
        description: 'A custom diagnostic test',
        category: 'configuration' as const,
        severity: 'info' as const,
        run: async () => ({
          passed: true,
          message: 'Custom test passed',
          duration: 100,
        }),
      };

      troubleshootingTools.addDiagnosticTest(customTest);

      const report = await troubleshootingTools.runDiagnostics(['Custom Test']);

      expect(report.results).toHaveLength(1);
      expect(report.results[0].test).toBe('Custom Test');
      expect(report.results[0].result.passed).toBe(true);
      expect(report.results[0].result.message).toBe('Custom test passed');
    });
  });

  describe('recommendations generation', () => {
    it('should generate appropriate recommendations based on test results', async () => {
      // Set up failing tests
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: false,
        errors: ['Invalid setting'],
        warnings: [],
      });

      mockPerformanceService.getDashboard.mockResolvedValue({
        realTimeMetrics: {},
        alerts: [],
        trends: {
          extractionTime: [],
          memoryUsage: [],
          cacheHitRate: [],
          errorRate: [],
        },
        systemHealth: {
          status: 'warning',
          score: 65,
          issues: ['Performance issue'],
        },
      });

      mockSavedObjectsClient.create.mockRejectedValue(new Error('Connection failed'));

      const report = await troubleshootingTools.runDiagnostics();

      expect(report.recommendations).toContain(
        'Review and update configuration settings to resolve validation errors'
      );
      expect(report.recommendations).toContain(
        'Consider adjusting performance settings or scaling resources'
      );
      expect(report.recommendations).toContain(
        'Check network connectivity and service dependencies'
      );
    });

    it('should recommend restart for multiple failures', async () => {
      // Create multiple failing tests by mocking failures
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: false,
        errors: ['Error 1'],
        warnings: [],
      });

      mockPerformanceService.getDashboard.mockResolvedValue({
        realTimeMetrics: {},
        alerts: [],
        trends: {
          extractionTime: [],
          memoryUsage: [],
          cacheHitRate: [],
          errorRate: [],
        },
        systemHealth: {
          status: 'critical',
          score: 30,
          issues: ['Multiple issues'],
        },
      });

      mockSavedObjectsClient.create.mockRejectedValue(new Error('Connection failed'));

      // Add more failing tests
      troubleshootingTools.addDiagnosticTest({
        name: 'Failing Test 1',
        description: 'Test 1',
        category: 'data',
        severity: 'error',
        run: async () => ({ passed: false, message: 'Failed', duration: 100 }),
      });

      troubleshootingTools.addDiagnosticTest({
        name: 'Failing Test 2',
        description: 'Test 2',
        category: 'data',
        severity: 'error',
        run: async () => ({ passed: false, message: 'Failed', duration: 100 }),
      });

      const report = await troubleshootingTools.runDiagnostics();

      expect(report.recommendations).toContain(
        'Consider restarting the contextual chat service'
      );
    });

    it('should provide positive recommendation for healthy system', async () => {
      const report = await troubleshootingTools.runDiagnostics();

      expect(report.recommendations).toContain(
        'System is operating normally - no immediate action required'
      );
    });
  });
});