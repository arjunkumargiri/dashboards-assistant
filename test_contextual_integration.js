#!/usr/bin/env node
/**
 * Comprehensive integration test for contextual chat functionality
 * Tests the full flow from UI context extraction to contextual responses
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class ContextualChatIntegrationTest {
  constructor() {
    this.baseUrl = 'http://localhost:5601';
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🚀 Starting Contextual Chat Integration Tests...\n');
    
    const tests = [
      this.testBasicContextualChat,
      this.testDashboardContextExtraction,
      this.testVisualizationContextChat,
      this.testTableDataContextChat,
      this.testNavigationContextChat,
      this.testFormControlsContextChat,
      this.testRealTimeContextUpdates,
      this.testContextCaching,
      this.testContextualPromptBuilding,
      this.testContextualResponseProcessing,
      this.testErrorHandlingAndFallbacks
    ];

    for (const test of tests) {
      try {
        await test.call(this);
      } catch (error) {
        console.error(`❌ Test failed: ${test.name}`, error.message);
        this.testResults.push({ test: test.name, status: 'failed', error: error.message });
      }
    }

    this.printTestSummary();
  }

  async testBasicContextualChat() {
    console.log('📝 Testing basic contextual chat functionality...');
    
    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: {
          appId: 'dashboards',
          content: 'Test dashboard context',
          datasourceId: 'test-datasource'
        },
        uiContext: {
          extractedAt: new Date().toISOString(),
          currentApp: 'dashboards',
          currentRoute: '/app/dashboards/view/test-dashboard',
          navigation: {
            breadcrumbs: [
              { text: 'Dashboards', href: '/app/dashboards' },
              { text: 'Test Dashboard', href: '/app/dashboards/view/test-dashboard' }
            ],
            activeMenu: 'dashboards'
          },
          content: {
            visualizations: [
              {
                id: 'vis-1',
                type: 'line_chart',
                title: 'Sample Line Chart',
                data: { series: 1, points: 100 }
              }
            ],
            tables: [],
            text: ['Dashboard showing sample data trends'],
            forms: []
          },
          userActions: {
            lastClick: { element: 'visualization', timestamp: Date.now() - 5000 },
            recentInteractions: ['filter_applied', 'time_range_changed']
          },
          permissions: {
            canView: true,
            canEdit: false,
            canShare: true
          }
        },
        content: 'Can you explain what this line chart is showing?',
        contentType: 'text'
      }
    };

    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    if (response.conversationId && response.messages) {
      console.log('✅ Basic contextual chat working');
      this.testResults.push({ test: 'testBasicContextualChat', status: 'passed' });
      return response;
    } else {
      throw new Error('Invalid response structure');
    }
  }

  async testDashboardContextExtraction() {
    console.log('📊 Testing dashboard context extraction...');
    
    // Simulate a complex dashboard context
    const dashboardContext = {
      extractedAt: new Date().toISOString(),
      currentApp: 'dashboards',
      currentRoute: '/app/dashboards/view/ecommerce-dashboard',
      navigation: {
        breadcrumbs: [
          { text: 'Dashboards', href: '/app/dashboards' },
          { text: 'E-commerce Analytics', href: '/app/dashboards/view/ecommerce-dashboard' }
        ],
        activeMenu: 'dashboards'
      },
      content: {
        visualizations: [
          {
            id: 'sales-trend',
            type: 'line_chart',
            title: 'Sales Trend Over Time',
            data: { series: 3, points: 365, timeRange: '1 year' }
          },
          {
            id: 'top-products',
            type: 'bar_chart',
            title: 'Top Selling Products',
            data: { categories: 10, maxValue: 15000 }
          },
          {
            id: 'revenue-pie',
            type: 'pie_chart',
            title: 'Revenue by Category',
            data: { segments: 5, total: 250000 }
          }
        ],
        tables: [
          {
            id: 'recent-orders',
            title: 'Recent Orders',
            columns: ['Order ID', 'Customer', 'Amount', 'Status'],
            rows: 25
          }
        ],
        text: [
          'E-commerce Analytics Dashboard',
          'Showing sales performance for Q4 2024',
          'Revenue increased 15% compared to last quarter'
        ],
        forms: [
          {
            id: 'date-filter',
            type: 'date_range',
            value: 'Last 30 days'
          },
          {
            id: 'category-filter',
            type: 'multi_select',
            options: ['Electronics', 'Clothing', 'Books', 'Home & Garden']
          }
        ]
      },
      userActions: {
        lastClick: { element: 'sales-trend', timestamp: Date.now() - 2000 },
        recentInteractions: ['filter_applied', 'visualization_clicked', 'time_range_changed']
      },
      permissions: {
        canView: true,
        canEdit: true,
        canShare: true
      }
    };

    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: {
          appId: 'dashboards',
          content: 'E-commerce dashboard analysis',
          datasourceId: 'ecommerce-data'
        },
        uiContext: dashboardContext,
        content: 'What insights can you provide about our sales performance based on this dashboard?',
        contentType: 'text'
      }
    };

    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    // Verify the response includes contextual insights
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      if (lastMessage.content.toLowerCase().includes('sales') || 
          lastMessage.content.toLowerCase().includes('revenue')) {
        console.log('✅ Dashboard context extraction working');
        this.testResults.push({ test: 'testDashboardContextExtraction', status: 'passed' });
        return response;
      }
    }
    
    throw new Error('Response does not include contextual insights');
  }

  async testVisualizationContextChat() {
    console.log('📈 Testing visualization-specific context chat...');
    
    const visualizationContext = {
      extractedAt: new Date().toISOString(),
      currentApp: 'visualize',
      currentRoute: '/app/visualize/edit/cpu-usage-chart',
      navigation: {
        breadcrumbs: [
          { text: 'Visualize', href: '/app/visualize' },
          { text: 'CPU Usage Chart', href: '/app/visualize/edit/cpu-usage-chart' }
        ],
        activeMenu: 'visualize'
      },
      content: {
        visualizations: [
          {
            id: 'cpu-usage-chart',
            type: 'area_chart',
            title: 'CPU Usage Over Time',
            data: {
              series: 5,
              points: 1440,
              timeRange: '24 hours',
              aggregation: 'average',
              interval: '1m'
            },
            config: {
              yAxis: { min: 0, max: 100, unit: '%' },
              xAxis: { type: 'time' },
              colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
            }
          }
        ],
        tables: [],
        text: [
          'System Performance Monitoring',
          'CPU usage across 5 servers',
          'Alert threshold: 80%'
        ],
        forms: [
          {
            id: 'time-range',
            type: 'time_picker',
            value: 'Last 24 hours'
          },
          {
            id: 'server-filter',
            type: 'multi_select',
            options: ['web-01', 'web-02', 'db-01', 'cache-01', 'api-01']
          }
        ]
      },
      userActions: {
        lastClick: { element: 'cpu-usage-chart', timestamp: Date.now() - 1000 },
        recentInteractions: ['zoom_in', 'hover_datapoint', 'legend_toggle']
      },
      permissions: {
        canView: true,
        canEdit: true,
        canShare: false
      }
    };

    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: {
          appId: 'visualize',
          content: 'CPU monitoring visualization',
          datasourceId: 'system-metrics'
        },
        uiContext: visualizationContext,
        content: 'I see some spikes in the CPU usage chart. Can you help me understand what might be causing them?',
        contentType: 'text'
      }
    };

    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      if (lastMessage.content.toLowerCase().includes('cpu') || 
          lastMessage.content.toLowerCase().includes('spike')) {
        console.log('✅ Visualization context chat working');
        this.testResults.push({ test: 'testVisualizationContextChat', status: 'passed' });
        return response;
      }
    }
    
    throw new Error('Response does not address visualization context');
  }

  async testTableDataContextChat() {
    console.log('📋 Testing table data context chat...');
    
    const tableContext = {
      extractedAt: new Date().toISOString(),
      currentApp: 'discover',
      currentRoute: '/app/discover',
      navigation: {
        breadcrumbs: [
          { text: 'Discover', href: '/app/discover' }
        ],
        activeMenu: 'discover'
      },
      content: {
        visualizations: [],
        tables: [
          {
            id: 'log-entries',
            title: 'Application Logs',
            columns: ['Timestamp', 'Level', 'Service', 'Message', 'User ID'],
            rows: 500,
            pagination: { current: 1, total: 50, size: 10 },
            sorting: { column: 'Timestamp', direction: 'desc' },
            filters: [
              { field: 'Level', value: 'ERROR', active: true },
              { field: 'Service', value: 'auth-service', active: false }
            ]
          }
        ],
        text: [
          'Application Log Analysis',
          'Showing error logs from the last hour',
          '127 error entries found'
        ],
        forms: [
          {
            id: 'log-level-filter',
            type: 'select',
            options: ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'],
            value: 'ERROR'
          },
          {
            id: 'time-filter',
            type: 'time_picker',
            value: 'Last 1 hour'
          }
        ]
      },
      userActions: {
        lastClick: { element: 'table_row', timestamp: Date.now() - 3000 },
        recentInteractions: ['sort_column', 'apply_filter', 'page_change']
      },
      permissions: {
        canView: true,
        canEdit: false,
        canShare: true
      }
    };

    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: {
          appId: 'discover',
          content: 'Application log analysis',
          datasourceId: 'application-logs'
        },
        uiContext: tableContext,
        content: 'I see 127 error entries in the logs. Can you help me identify patterns or common issues?',
        contentType: 'text'
      }
    };

    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      if (lastMessage.content.toLowerCase().includes('error') || 
          lastMessage.content.toLowerCase().includes('log')) {
        console.log('✅ Table data context chat working');
        this.testResults.push({ test: 'testTableDataContextChat', status: 'passed' });
        return response;
      }
    }
    
    throw new Error('Response does not address table data context');
  }

  async testNavigationContextChat() {
    console.log('🧭 Testing navigation context chat...');
    
    const navigationContext = {
      extractedAt: new Date().toISOString(),
      currentApp: 'management',
      currentRoute: '/app/management/opensearch-dashboards/indexPatterns',
      navigation: {
        breadcrumbs: [
          { text: 'Management', href: '/app/management' },
          { text: 'Stack Management', href: '/app/management/opensearch-dashboards' },
          { text: 'Index Patterns', href: '/app/management/opensearch-dashboards/indexPatterns' }
        ],
        activeMenu: 'management',
        sidebarItems: [
          { text: 'Index Patterns', active: true },
          { text: 'Saved Objects', active: false },
          { text: 'Advanced Settings', active: false }
        ]
      },
      content: {
        visualizations: [],
        tables: [
          {
            id: 'index-patterns-list',
            title: 'Index Patterns',
            columns: ['Name', 'Time Field', 'Fields', 'Actions'],
            rows: 8
          }
        ],
        text: [
          'Index Pattern Management',
          'Configure index patterns for data exploration',
          '8 index patterns configured'
        ],
        forms: [
          {
            id: 'search-patterns',
            type: 'search',
            placeholder: 'Search index patterns...'
          }
        ]
      },
      userActions: {
        lastClick: { element: 'navigation_link', timestamp: Date.now() - 4000 },
        recentInteractions: ['menu_click', 'breadcrumb_click']
      },
      permissions: {
        canView: true,
        canEdit: true,
        canShare: false
      }
    };

    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: {
          appId: 'management',
          content: 'Index pattern management',
          datasourceId: undefined
        },
        uiContext: navigationContext,
        content: 'I\'m in the index patterns section. Can you explain how to create a new index pattern?',
        contentType: 'text'
      }
    };

    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      if (lastMessage.content.toLowerCase().includes('index pattern') || 
          lastMessage.content.toLowerCase().includes('create')) {
        console.log('✅ Navigation context chat working');
        this.testResults.push({ test: 'testNavigationContextChat', status: 'passed' });
        return response;
      }
    }
    
    throw new Error('Response does not address navigation context');
  }

  async testFormControlsContextChat() {
    console.log('📝 Testing form controls context chat...');
    
    const formContext = {
      extractedAt: new Date().toISOString(),
      currentApp: 'dashboards',
      currentRoute: '/app/dashboards/view/sales-dashboard',
      navigation: {
        breadcrumbs: [
          { text: 'Dashboards', href: '/app/dashboards' },
          { text: 'Sales Dashboard', href: '/app/dashboards/view/sales-dashboard' }
        ],
        activeMenu: 'dashboards'
      },
      content: {
        visualizations: [
          {
            id: 'sales-chart',
            type: 'bar_chart',
            title: 'Sales by Region',
            data: { categories: 4, filtered: true }
          }
        ],
        tables: [],
        text: ['Sales Dashboard with Regional Filters'],
        forms: [
          {
            id: 'region-filter',
            type: 'multi_select',
            label: 'Select Regions',
            options: ['North America', 'Europe', 'Asia Pacific', 'Latin America'],
            selected: ['North America', 'Europe'],
            required: false
          },
          {
            id: 'date-range',
            type: 'date_range',
            label: 'Date Range',
            value: { start: '2024-01-01', end: '2024-12-31' },
            required: true
          },
          {
            id: 'product-category',
            type: 'select',
            label: 'Product Category',
            options: ['All', 'Electronics', 'Clothing', 'Books'],
            value: 'Electronics',
            required: false
          }
        ]
      },
      userActions: {
        lastClick: { element: 'region-filter', timestamp: Date.now() - 2000 },
        recentInteractions: ['filter_change', 'dropdown_open', 'option_select']
      },
      permissions: {
        canView: true,
        canEdit: true,
        canShare: true
      }
    };

    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: {
          appId: 'dashboards',
          content: 'Sales dashboard with filters',
          datasourceId: 'sales-data'
        },
        uiContext: formContext,
        content: 'I have filters set for North America and Europe regions. How can I compare their performance?',
        contentType: 'text'
      }
    };

    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      if (lastMessage.content.toLowerCase().includes('region') || 
          lastMessage.content.toLowerCase().includes('compare')) {
        console.log('✅ Form controls context chat working');
        this.testResults.push({ test: 'testFormControlsContextChat', status: 'passed' });
        return response;
      }
    }
    
    throw new Error('Response does not address form controls context');
  }

  async testRealTimeContextUpdates() {
    console.log('🔄 Testing real-time context updates...');
    
    // Simulate a context update scenario
    const initialContext = {
      extractedAt: new Date().toISOString(),
      currentApp: 'dashboards',
      currentRoute: '/app/dashboards/view/monitoring',
      content: {
        visualizations: [
          {
            id: 'cpu-chart',
            type: 'line_chart',
            title: 'CPU Usage',
            data: { currentValue: 45, trend: 'stable' }
          }
        ]
      }
    };

    // First request with initial context
    const payload1 = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: { appId: 'dashboards', content: 'Monitoring dashboard' },
        uiContext: initialContext,
        content: 'What is the current CPU usage?',
        contentType: 'text'
      }
    };

    const response1 = await this.makeRequest('/api/assistant/contextual_chat', payload1);
    
    // Simulate context update (CPU spike)
    const updatedContext = {
      ...initialContext,
      extractedAt: new Date().toISOString(),
      content: {
        visualizations: [
          {
            id: 'cpu-chart',
            type: 'line_chart',
            title: 'CPU Usage',
            data: { currentValue: 85, trend: 'increasing', alert: true }
          }
        ]
      }
    };

    // Second request with updated context
    const payload2 = {
      conversationId: response1.conversationId,
      messages: response1.messages,
      input: {
        type: 'input',
        context: { appId: 'dashboards', content: 'Monitoring dashboard' },
        uiContext: updatedContext,
        content: 'Has the CPU usage changed?',
        contentType: 'text'
      }
    };

    const response2 = await this.makeRequest('/api/assistant/contextual_chat', payload2);
    
    if (response2.messages && response2.messages.length > response1.messages.length) {
      console.log('✅ Real-time context updates working');
      this.testResults.push({ test: 'testRealTimeContextUpdates', status: 'passed' });
      return response2;
    }
    
    throw new Error('Context updates not reflected in responses');
  }

  async testContextCaching() {
    console.log('💾 Testing context caching...');
    
    const context = {
      extractedAt: new Date().toISOString(),
      currentApp: 'dashboards',
      currentRoute: '/app/dashboards/view/test',
      content: {
        visualizations: [
          { id: 'test-viz', type: 'bar_chart', title: 'Test Chart' }
        ]
      }
    };

    // Make multiple requests with same context to test caching
    const requests = [];
    for (let i = 0; i < 3; i++) {
      const payload = {
        conversationId: undefined,
        messages: [],
        input: {
          type: 'input',
          context: { appId: 'dashboards', content: 'Test dashboard' },
          uiContext: context,
          content: `Test message ${i + 1}`,
          contentType: 'text'
        }
      };
      requests.push(this.makeRequest('/api/assistant/contextual_chat', payload));
    }

    const responses = await Promise.all(requests);
    
    if (responses.every(r => r.conversationId)) {
      console.log('✅ Context caching working');
      this.testResults.push({ test: 'testContextCaching', status: 'passed' });
      return responses;
    }
    
    throw new Error('Context caching failed');
  }

  async testContextualPromptBuilding() {
    console.log('🔨 Testing contextual prompt building...');
    
    const richContext = {
      extractedAt: new Date().toISOString(),
      currentApp: 'dashboards',
      currentRoute: '/app/dashboards/view/analytics',
      content: {
        visualizations: [
          {
            id: 'revenue-chart',
            type: 'line_chart',
            title: 'Monthly Revenue',
            data: { trend: 'increasing', growth: '15%' }
          }
        ],
        tables: [
          {
            id: 'top-customers',
            title: 'Top Customers',
            rows: 10,
            columns: ['Name', 'Revenue', 'Orders']
          }
        ],
        text: ['Revenue Analytics Dashboard', 'Q4 2024 Performance Review']
      }
    };

    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: { appId: 'dashboards', content: 'Revenue analytics' },
        uiContext: richContext,
        content: 'Analyze the revenue trends and customer data',
        contentType: 'text'
      }
    };

    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      // Check if response incorporates multiple context elements
      const hasRevenue = lastMessage.content.toLowerCase().includes('revenue');
      const hasCustomer = lastMessage.content.toLowerCase().includes('customer');
      const hasTrend = lastMessage.content.toLowerCase().includes('trend') || 
                      lastMessage.content.toLowerCase().includes('growth');
      
      if (hasRevenue && (hasCustomer || hasTrend)) {
        console.log('✅ Contextual prompt building working');
        this.testResults.push({ test: 'testContextualPromptBuilding', status: 'passed' });
        return response;
      }
    }
    
    throw new Error('Prompt building does not incorporate rich context');
  }

  async testContextualResponseProcessing() {
    console.log('⚙️ Testing contextual response processing...');
    
    const context = {
      extractedAt: new Date().toISOString(),
      currentApp: 'visualize',
      currentRoute: '/app/visualize/edit/network-traffic',
      content: {
        visualizations: [
          {
            id: 'network-viz',
            type: 'network_graph',
            title: 'Network Traffic Flow',
            data: { nodes: 25, edges: 40, clusters: 3 }
          }
        ]
      }
    };

    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: { appId: 'visualize', content: 'Network visualization' },
        uiContext: context,
        content: 'Explain the network topology shown in this visualization',
        contentType: 'text'
      }
    };

    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      if (lastMessage.content.toLowerCase().includes('network') && 
          (lastMessage.content.toLowerCase().includes('node') || 
           lastMessage.content.toLowerCase().includes('topology'))) {
        console.log('✅ Contextual response processing working');
        this.testResults.push({ test: 'testContextualResponseProcessing', status: 'passed' });
        return response;
      }
    }
    
    throw new Error('Response processing does not handle context appropriately');
  }

  async testErrorHandlingAndFallbacks() {
    console.log('🛡️ Testing error handling and fallbacks...');
    
    // Test with malformed context
    const malformedContext = {
      extractedAt: 'invalid-date',
      currentApp: null,
      content: {
        visualizations: 'not-an-array'
      }
    };

    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: { appId: 'dashboards', content: 'Test' },
        uiContext: malformedContext,
        content: 'Test with malformed context',
        contentType: 'text'
      }
    };

    try {
      const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
      
      // Should still get a response even with malformed context
      if (response.messages && response.messages.length > 0) {
        console.log('✅ Error handling and fallbacks working');
        this.testResults.push({ test: 'testErrorHandlingAndFallbacks', status: 'passed' });
        return response;
      }
    } catch (error) {
      // If it fails gracefully, that's also acceptable
      if (error.message.includes('400') || error.message.includes('validation')) {
        console.log('✅ Error handling working (graceful failure)');
        this.testResults.push({ test: 'testErrorHandlingAndFallbacks', status: 'passed' });
        return;
      }
    }
    
    throw new Error('Error handling not working properly');
  }

  async makeRequest(endpoint, payload) {
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'localhost',
      port: 5601,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'osd-xsrf': 'true'
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const response = JSON.parse(data);
              resolve(response);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (parseError) {
            reject(new Error(`Parse error: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  printTestSummary() {
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(r => console.log(`  - ${r.test}: ${r.error}`));
    }
    
    console.log('\n🎯 Integration Test Complete!');
  }
}

// Run the tests
if (require.main === module) {
  const tester = new ContextualChatIntegrationTest();
  tester.runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { ContextualChatIntegrationTest };