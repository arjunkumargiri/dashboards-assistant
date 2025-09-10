/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UIContext,
  ContentElement,
  ContentType,
  VisibilityState,
} from '../../../../common/types/ui_context';

describe('Contextual Chat Data Validation Tests', () => {
  describe('UI Context Structure Validation', () => {
    it('should create valid dashboard context structure', () => {
      // Arrange & Act
      const dashboardContext: UIContext = {
        page: {
          url: '/app/dashboards/view/ecommerce-dashboard',
          title: 'E-commerce Analytics Dashboard',
          app: 'dashboard',
          route: '/view/ecommerce-dashboard',
          breadcrumbs: [
            { text: 'Dashboard', href: '/app/dashboards', active: false },
            { text: 'E-commerce Analytics Dashboard', active: true },
          ],
          metadata: { dashboardId: 'ecommerce-dashboard' },
        },
        content: [
          {
            id: 'revenue-chart',
            type: ContentType.VISUALIZATION,
            title: 'Monthly Revenue',
            description: 'Revenue trends over the last 12 months',
            data: {
              chartData: {
                type: 'line',
                values: [
                  { x: '2023-04', y: 45000 },
                  { x: '2023-05', y: 52000 },
                  { x: '2023-06', y: 48000 },
                ],
                trends: { direction: 'increasing', confidence: 0.9, changePercent: 15.2 },
                series: [{ name: 'Revenue', color: '#1f77b4', type: 'line', visible: true }],
              },
            },
            position: { x: 0, y: 0, width: 600, height: 400 },
            visibility: VisibilityState.VISIBLE,
            metadata: {
              embeddableId: 'revenue-chart',
              panelId: 'panel-1',
              visualizationType: 'line',
            },
            relationships: [],
          },
          {
            id: 'top-products-table',
            type: ContentType.DATA_TABLE,
            title: 'Top Selling Products',
            data: {
              tableData: {
                headers: ['Product Name', 'Units Sold', 'Revenue', 'Growth %'],
                rows: [
                  ['Wireless Headphones', '1,247', '$62,350', '+23%'],
                  ['Smart Watch', '892', '$89,200', '+18%'],
                  ['Laptop Stand', '1,156', '$34,680', '+31%'],
                ],
                totalRows: 3,
                pagination: { currentPage: 1, totalPages: 1, pageSize: 10, totalItems: 3 },
              },
            },
            position: { x: 600, y: 0, width: 600, height: 400 },
            visibility: VisibilityState.VISIBLE,
            metadata: {
              embeddableId: 'top-products-table',
              panelId: 'panel-2',
            },
            relationships: [],
          },
        ],
        navigation: {
          currentApp: 'dashboard',
          currentRoute: '/view/ecommerce-dashboard',
          breadcrumbs: [
            { text: 'Dashboard', href: '/app/dashboards', active: false },
            { text: 'E-commerce Analytics Dashboard', active: true },
          ],
          availableApps: [
            { id: 'dashboard', title: 'Dashboard', url: '/app/dashboards' },
            { id: 'discover', title: 'Discover', url: '/app/discover' },
          ],
        },
        filters: [
          {
            field: 'category',
            operator: 'is',
            value: 'Electronics',
            displayName: 'Category: Electronics',
            enabled: true,
          },
        ],
        timeRange: {
          from: '2023-04-01',
          to: '2024-03-31',
          mode: 'absolute',
          displayName: 'Apr 1, 2023 - Mar 31, 2024',
        },
        userActions: [
          {
            type: 'filter',
            timestamp: new Date().toISOString(),
            elementId: 'category-filter',
            details: { field: 'category', value: 'Electronics' },
          },
        ],
        permissions: {
          canViewData: true,
          canModifyDashboard: true,
          canAccessApp: true,
        },
        extractedAt: new Date().toISOString(),
      };

      // Assert
      expect(dashboardContext).toBeDefined();
      expect(dashboardContext.page.app).toBe('dashboard');
      expect(dashboardContext.content).toHaveLength(2);
      expect(dashboardContext.content[0].type).toBe(ContentType.VISUALIZATION);
      expect(dashboardContext.content[0].visibility).toBe(VisibilityState.VISIBLE);
      expect(dashboardContext.content[1].type).toBe(ContentType.DATA_TABLE);
      expect(dashboardContext.filters).toHaveLength(1);
      expect(dashboardContext.permissions.canViewData).toBe(true);
      expect(dashboardContext.extractedAt).toBeDefined();
    });

    it('should create valid discover context structure', () => {
      // Arrange & Act
      const discoverContext: UIContext = {
        page: {
          url: '/app/discover',
          title: 'Discover - Log Analysis',
          app: 'discover',
          route: '/',
          breadcrumbs: [{ text: 'Discover', active: true }],
          metadata: {
            indexPattern: 'logs-*',
            query: 'level:ERROR OR level:WARN',
            columns: ['@timestamp', 'level', 'message', 'host'],
          },
        },
        content: [
          {
            id: 'search-results',
            type: ContentType.SEARCH_RESULTS,
            title: 'Log Search Results',
            data: {
              tableData: {
                headers: ['@timestamp', 'level', 'message', 'host'],
                rows: [
                  [
                    '2024-03-15T14:32:15.123Z',
                    'ERROR',
                    'Database connection failed',
                    'web-server-01',
                  ],
                  [
                    '2024-03-15T14:31:45.892Z',
                    'ERROR',
                    'Failed to process payment',
                    'payment-service-02',
                  ],
                ],
                totalRows: 1247,
                pagination: { currentPage: 1, totalPages: 125, pageSize: 10, totalItems: 1247 },
              },
            },
            position: { x: 0, y: 100, width: 1200, height: 600 },
            visibility: VisibilityState.VISIBLE,
            metadata: {
              indexPattern: 'logs-*',
              totalHits: 1247,
              searchTime: '45ms',
            },
            relationships: [],
          },
        ],
        navigation: {
          currentApp: 'discover',
          currentRoute: '/',
          breadcrumbs: [{ text: 'Discover', active: true }],
          availableApps: [
            { id: 'discover', title: 'Discover', url: '/app/discover' },
            { id: 'dashboard', title: 'Dashboard', url: '/app/dashboards' },
          ],
        },
        filters: [
          {
            field: 'level',
            operator: 'is one of',
            value: ['ERROR', 'WARN'],
            displayName: 'level: ERROR OR WARN',
            enabled: true,
          },
        ],
        timeRange: {
          from: 'now-15m',
          to: 'now',
          mode: 'relative',
          displayName: 'Last 15 minutes',
        },
        userActions: [],
        permissions: {
          canViewData: true,
          canModifyDashboard: true,
          canAccessApp: true,
        },
        extractedAt: new Date().toISOString(),
      };

      // Assert
      expect(discoverContext).toBeDefined();
      expect(discoverContext.page.app).toBe('discover');
      expect(discoverContext.content[0].type).toBe(ContentType.SEARCH_RESULTS);
      expect(discoverContext.content[0].data.tableData?.totalRows).toBe(1247);
      expect(discoverContext.filters[0].field).toBe('level');
      expect(discoverContext.timeRange?.mode).toBe('relative');
    });

    it('should create valid visualize context structure', () => {
      // Arrange & Act
      const visualizeContext: UIContext = {
        page: {
          url: '/app/visualize/edit/vis-123',
          title: 'Edit Visualization',
          app: 'visualize',
          route: '/edit/vis-123',
          breadcrumbs: [
            { text: 'Visualize', href: '/app/visualize', active: false },
            { text: 'Edit Visualization', active: true },
          ],
          metadata: { visualizationId: 'vis-123' },
        },
        content: [
          {
            id: 'main-vis',
            type: ContentType.VISUALIZATION,
            title: 'CPU Usage by Host',
            data: {
              chartData: {
                type: 'bar',
                values: [
                  { x: 'server-1', y: 85 },
                  { x: 'server-2', y: 92 },
                  { x: 'server-3', y: 78 },
                ],
                aggregations: [{ field: 'cpu.percent', value: 85 }],
              },
            },
            position: { x: 200, y: 100, width: 800, height: 400 },
            visibility: VisibilityState.VISIBLE,
            metadata: {
              visualizationType: 'histogram',
              indexPattern: 'metrics-*',
            },
            relationships: [],
          },
        ],
        navigation: {
          currentApp: 'visualize',
          currentRoute: '/edit/vis-123',
          breadcrumbs: [
            { text: 'Visualize', href: '/app/visualize', active: false },
            { text: 'Edit Visualization', active: true },
          ],
          availableApps: [{ id: 'visualize', title: 'Visualize', url: '/app/visualize' }],
        },
        filters: [],
        timeRange: {
          from: 'now-15m',
          to: 'now',
          mode: 'relative',
          displayName: 'Last 15 minutes',
        },
        userActions: [],
        permissions: {
          canViewData: true,
          canModifyDashboard: true,
          canAccessApp: true,
        },
        extractedAt: new Date().toISOString(),
      };

      // Assert
      expect(visualizeContext).toBeDefined();
      expect(visualizeContext.page.app).toBe('visualize');
      expect(visualizeContext.content[0].type).toBe(ContentType.VISUALIZATION);
      expect(visualizeContext.content[0].data.chartData?.type).toBe('bar');
      expect(visualizeContext.content[0].data.chartData?.values).toHaveLength(3);
    });
  });

  describe('Performance and Scalability Validation', () => {
    it('should handle large context structures efficiently', () => {
      // Arrange - Large dashboard context
      const largeContext: UIContext = {
        page: {
          url: '/app/dashboards/view/large-dashboard',
          title: 'Large Dashboard',
          app: 'dashboard',
          route: '/view/large-dashboard',
          breadcrumbs: [],
          metadata: {},
        },
        content: Array.from({ length: 25 }, (_, i) => ({
          id: `vis-${i}`,
          type: ContentType.VISUALIZATION,
          title: `Visualization ${i}`,
          data: {
            chartData: {
              type: 'line',
              values: Array.from({ length: 100 }, (_, j) => ({
                x: j,
                y: Math.random() * 1000,
              })),
            },
          },
          position: {
            x: (i % 5) * 240,
            y: Math.floor(i / 5) * 200,
            width: 220,
            height: 180,
          },
          visibility: i < 8 ? VisibilityState.VISIBLE : VisibilityState.HIDDEN,
          metadata: { embeddableId: `vis-${i}` },
          relationships: [],
        })),
        navigation: {
          currentApp: 'dashboard',
          currentRoute: '/view/large-dashboard',
          breadcrumbs: [],
          availableApps: [],
        },
        filters: [],
        userActions: [],
        permissions: {
          canViewData: true,
          canModifyDashboard: false,
          canAccessApp: true,
        },
        extractedAt: new Date().toISOString(),
      };

      // Act
      const startTime = Date.now();
      const contextSize = JSON.stringify(largeContext).length;
      const endTime = Date.now();

      // Assert
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(100); // Should serialize quickly
      expect(largeContext.content).toHaveLength(25);
      expect(contextSize).toBeGreaterThan(0);

      // Verify visible vs hidden content
      const visibleContent = largeContext.content.filter(
        (c) => c.visibility === VisibilityState.VISIBLE
      );
      const hiddenContent = largeContext.content.filter(
        (c) => c.visibility === VisibilityState.HIDDEN
      );
      expect(visibleContent).toHaveLength(8);
      expect(hiddenContent).toHaveLength(17);
    });

    it('should maintain consistent data structures across different apps', () => {
      const apps = ['dashboard', 'discover', 'visualize'];
      const contexts: UIContext[] = [];

      apps.forEach((app) => {
        const context: UIContext = {
          page: {
            url: `/app/${app}`,
            title: `${app} App`,
            app,
            route: '/',
            breadcrumbs: [{ text: app, active: true }],
            metadata: {},
          },
          content: [
            {
              id: `${app}-content`,
              type: ContentType.VISUALIZATION,
              title: `${app} Content`,
              data: { summary: `Content for ${app}` },
              position: { x: 0, y: 0, width: 400, height: 300 },
              visibility: VisibilityState.VISIBLE,
              metadata: {},
              relationships: [],
            },
          ],
          navigation: {
            currentApp: app,
            currentRoute: '/',
            breadcrumbs: [{ text: app, active: true }],
            availableApps: [],
          },
          filters: [],
          userActions: [],
          permissions: {
            canViewData: true,
            canModifyDashboard: true,
            canAccessApp: true,
          },
          extractedAt: new Date().toISOString(),
        };
        contexts.push(context);
      });

      // Assert all contexts have consistent structure
      contexts.forEach((context, index) => {
        expect(context.page).toBeDefined();
        expect(context.content).toBeDefined();
        expect(context.navigation).toBeDefined();
        expect(context.permissions).toBeDefined();
        expect(context.extractedAt).toBeDefined();

        expect(context.page.app).toBe(apps[index]);
        expect(context.content).toHaveLength(1);
        expect(context.content[0].visibility).toBe(VisibilityState.VISIBLE);
      });
    });
  });

  describe('Content Type and Enum Validation', () => {
    it('should validate all content types are available', () => {
      // Test all content types are valid
      const contentTypes = Object.values(ContentType);
      expect(contentTypes).toContain('visualization');
      expect(contentTypes).toContain('data_table');
      expect(contentTypes).toContain('search_results');
      expect(contentTypes).toContain('text_panel');
      expect(contentTypes).toContain('form');
      expect(contentTypes).toContain('markdown');
      expect(contentTypes).toContain('metric');
      expect(contentTypes).toContain('saved_object');
      expect(contentTypes).toContain('alert');
      expect(contentTypes).toContain('control_panel');
      expect(contentTypes).toContain('navigation_menu');
      expect(contentTypes).toContain('breadcrumb');
      expect(contentTypes).toContain('button');
      expect(contentTypes).toContain('link');
      expect(contentTypes).toContain('other');
    });

    it('should validate all visibility states are available', () => {
      // Test visibility states
      const visibilityStates = Object.values(VisibilityState);
      expect(visibilityStates).toContain('visible');
      expect(visibilityStates).toContain('hidden');
      expect(visibilityStates).toContain('partially_visible');
      expect(visibilityStates).toContain('loading');
    });

    it('should create content elements with all supported types', () => {
      const contentTypes = [
        ContentType.VISUALIZATION,
        ContentType.DATA_TABLE,
        ContentType.SEARCH_RESULTS,
        ContentType.TEXT_PANEL,
        ContentType.MARKDOWN,
        ContentType.METRIC,
        ContentType.FORM,
        ContentType.CONTROL_PANEL,
      ];

      contentTypes.forEach((type, index) => {
        const contentElement: ContentElement = {
          id: `element-${index}`,
          type,
          title: `Test ${type}`,
          data: { summary: `Test data for ${type}` },
          position: { x: 0, y: 0, width: 300, height: 200 },
          visibility: VisibilityState.VISIBLE,
          metadata: { contentType: type },
          relationships: [],
        };

        expect(contentElement.type).toBe(type);
        expect(contentElement.visibility).toBe(VisibilityState.VISIBLE);
        expect(contentElement.id).toBe(`element-${index}`);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle context with minimal required fields', () => {
      // Arrange - Context with only required fields
      const minimalContext: Partial<UIContext> = {
        page: {
          url: '/app/dashboard',
          title: 'Test Dashboard',
          app: 'dashboard',
          route: '/',
          breadcrumbs: [],
          metadata: {},
        },
        content: [],
        navigation: {
          currentApp: 'dashboard',
          currentRoute: '/',
          breadcrumbs: [],
          availableApps: [],
        },
        filters: [],
        userActions: [],
        permissions: {
          canViewData: true,
          canModifyDashboard: false,
          canAccessApp: true,
        },
        extractedAt: new Date().toISOString(),
      };

      // Act & Assert - Should not throw when accessing defined properties
      expect(minimalContext.page?.app).toBe('dashboard');
      expect(minimalContext.content).toHaveLength(0);
      expect(minimalContext.filters).toHaveLength(0);
      expect(minimalContext.permissions?.canViewData).toBe(true);
    });

    it('should handle context with complex nested data', () => {
      // Arrange - Context with deeply nested data structures
      const complexContext: UIContext = {
        page: {
          url: '/app/dashboard/complex',
          title: 'Complex Dashboard',
          app: 'dashboard',
          route: '/complex',
          breadcrumbs: [
            { text: 'Home', href: '/', active: false },
            { text: 'Dashboards', href: '/app/dashboards', active: false },
            { text: 'Complex Dashboard', active: true },
          ],
          metadata: {
            dashboardId: 'complex-dashboard',
            version: '1.0.0',
            tags: ['analytics', 'complex', 'test'],
          },
        },
        content: [
          {
            id: 'complex-vis',
            type: ContentType.VISUALIZATION,
            title: 'Complex Visualization',
            description: 'A visualization with complex nested data',
            data: {
              chartData: {
                type: 'multi-series',
                values: [
                  {
                    x: 'Q1',
                    y: 100,
                    metadata: { quarter: 1, year: 2024, details: { revenue: 50000, costs: 30000 } },
                  },
                  {
                    x: 'Q2',
                    y: 150,
                    metadata: { quarter: 2, year: 2024, details: { revenue: 75000, costs: 45000 } },
                  },
                ],
                series: [
                  { name: 'Revenue', color: '#00ff00', type: 'line', visible: true },
                  { name: 'Costs', color: '#ff0000', type: 'bar', visible: true },
                ],
                trends: {
                  direction: 'increasing',
                  confidence: 0.95,
                  changePercent: 25,
                  anomalies: [{ timestamp: '2024-Q2', value: 150, severity: 'low' }],
                },
              },
            },
            position: { x: 0, y: 0, width: 800, height: 600, zIndex: 1 },
            visibility: VisibilityState.VISIBLE,
            metadata: {
              embeddableId: 'complex-vis',
              panelId: 'panel-complex',
              visualizationType: 'multi-series',
              lastUpdated: new Date().toISOString(),
              dataAttributes: {
                'data-test-id': 'complex-visualization',
                'data-panel-type': 'visualization',
              },
            },
            relationships: [
              { type: 'related', targetId: 'related-table', description: 'Shows related data' },
            ],
          },
        ],
        navigation: {
          currentApp: 'dashboard',
          currentRoute: '/complex',
          breadcrumbs: [
            { text: 'Home', href: '/', active: false },
            { text: 'Dashboards', href: '/app/dashboards', active: false },
            { text: 'Complex Dashboard', active: true },
          ],
          availableApps: [
            { id: 'dashboard', title: 'Dashboard', url: '/app/dashboards' },
            { id: 'discover', title: 'Discover', url: '/app/discover' },
            { id: 'visualize', title: 'Visualize', url: '/app/visualize' },
          ],
        },
        filters: [
          {
            field: 'category',
            operator: 'is one of',
            value: ['electronics', 'software', 'hardware'],
            displayName: 'Category: Electronics, Software, Hardware',
            enabled: true,
            negated: false,
            pinned: true,
          },
        ],
        timeRange: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-12-31T23:59:59Z',
          mode: 'absolute',
          displayName: 'Full Year 2024',
          refreshInterval: { pause: false, value: 30000 },
        },
        userActions: [
          {
            type: 'click',
            timestamp: new Date().toISOString(),
            elementId: 'complex-vis',
            details: {
              coordinates: { x: 400, y: 300 },
              dataPoint: { x: 'Q2', y: 150 },
              seriesName: 'Revenue',
            },
          },
        ],
        permissions: {
          canViewData: true,
          canModifyDashboard: true,
          canAccessApp: true,
          restrictedFields: ['sensitive_data'],
          dataSourcePermissions: {
            'logs-*': true,
            'metrics-*': true,
            'sensitive-*': false,
          },
        },
        extractedAt: new Date().toISOString(),
      };

      // Act & Assert
      expect(complexContext).toBeDefined();
      expect(complexContext.content[0].data.chartData?.trends?.anomalies).toHaveLength(1);
      expect(complexContext.content[0].relationships).toHaveLength(1);
      expect(complexContext.filters[0].value).toHaveLength(3);
      expect(complexContext.permissions.dataSourcePermissions?.['logs-*']).toBe(true);
      expect(complexContext.permissions.dataSourcePermissions?.['sensitive-*']).toBe(false);
      expect(complexContext.timeRange?.refreshInterval?.value).toBe(30000);
    });
  });
});
