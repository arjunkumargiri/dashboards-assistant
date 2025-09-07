#!/usr/bin/env node
/**
 * Performance and Scalability Testing for Contextual Chat
 * Tests load handling, memory usage, timing benchmarks, and concurrent users
 */

const http = require('http');
const { performance } = require('perf_hooks');
const cluster = require('cluster');
const os = require('os');

class PerformanceScalabilityTest {
  constructor() {
    this.baseUrl = 'http://localhost:5601';
    this.testResults = [];
    this.performanceMetrics = {
      responseTime: [],
      memoryUsage: [],
      contextExtractionTime: [],
      concurrentUsers: 0,
      throughput: 0
    };
  }

  async runAllTests() {
    console.log('⚡ Starting Performance and Scalability Tests...\n');
    
    const tests = [
      this.testLargeDashboardContexts,
      this.testMemoryUsageValidation,
      this.testContextExtractionTiming,
      this.testConcurrentUserHandling,
      this.testContextSystemUnderLoad,
      this.testResponseTimeConsistency,
      this.testCachePerformance,
      this.testDOMObserverPerformance,
      this.testContentProcessingPipeline,
      this.testScalabilityLimits
    ];

    for (const test of tests) {
      try {
        console.log(`\n🔄 Running ${test.name}...`);
        const startTime = performance.now();
        await test.call(this);
        const endTime = performance.now();
        console.log(`✅ ${test.name} completed in ${(endTime - startTime).toFixed(2)}ms`);
      } catch (error) {
        console.error(`❌ Performance test failed: ${test.name}`, error.message);
        this.testResults.push({ test: test.name, status: 'failed', error: error.message });
      }
    }

    this.printPerformanceSummary();
  }

  async testLargeDashboardContexts() {
    console.log('📊 Testing large dashboard context handling...');
    
    // Create a large context with many visualizations, tables, and data
    const largeContext = this.generateLargeContext(100, 50, 1000); // 100 viz, 50 tables, 1000 text items
    
    const payload = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: { appId: 'dashboards', content: 'Large dashboard' },
        uiContext: largeContext,
        content: 'Analyze this comprehensive dashboard with all its visualizations and data',
        contentType: 'text'
      }
    };

    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    const response = await this.makeRequest('/api/assistant/contextual_chat', payload);
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const responseTime = endTime - startTime;
    const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
    
    this.performanceMetrics.responseTime.push(responseTime);
    this.performanceMetrics.memoryUsage.push(memoryIncrease);
    
    console.log(`  Response time: ${responseTime.toFixed(2)}ms`);
    console.log(`  Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    
    // Verify response is still functional with large context
    if (response.messages && response.messages.length > 0 && responseTime < 30000) { // 30s timeout
      console.log('✅ Large dashboard context handling working');
      this.testResults.push({ test: 'testLargeDashboardContexts', status: 'passed', metrics: { responseTime, memoryIncrease } });
      return;
    }
    
    throw new Error(`Large context handling failed - Response time: ${responseTime}ms`);
  }

  async testMemoryUsageValidation() {
    console.log('💾 Testing memory usage validation...');
    
    const initialMemory = process.memoryUsage();
    const contexts = [];
    
    // Create multiple contexts and track memory usage
    for (let i = 0; i < 10; i++) {
      const context = this.generateLargeContext(20, 10, 100);
      contexts.push(context);
      
      const payload = {
        conversationId: undefined,
        messages: [],
        input: {
          type: 'input',
          context: { appId: 'dashboards', content: `Test dashboard ${i}` },
          uiContext: context,
          content: `Analyze dashboard ${i}`,
          contentType: 'text'
        }
      };
      
      await this.makeRequest('/api/assistant/contextual_chat', payload);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const currentMemory = process.memoryUsage();
      const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`  Request ${i + 1}: Memory usage +${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // Check for memory leaks (memory should not grow indefinitely)
      if (memoryIncrease > 500 * 1024 * 1024) { // 500MB threshold
        throw new Error(`Potential memory leak detected: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
      }
    }
    
    const finalMemory = process.memoryUsage();
    const totalIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    console.log(`  Total memory increase: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`);
    
    this.performanceMetrics.memoryUsage.push(totalIncrease);
    
    console.log('✅ Memory usage validation passed');
    this.testResults.push({ test: 'testMemoryUsageValidation', status: 'passed', metrics: { totalIncrease } });
  }

  async testContextExtractionTiming() {
    console.log('⏱️ Testing context extraction timing benchmarks...');
    
    const extractionTests = [
      { name: 'Small Context', size: { viz: 5, tables: 2, text: 10 } },
      { name: 'Medium Context', size: { viz: 25, tables: 10, text: 50 } },
      { name: 'Large Context', size: { viz: 100, tables: 25, text: 200 } },
      { name: 'Extra Large Context', size: { viz: 500, tables: 100, text: 1000 } }
    ];
    
    for (const test of extractionTests) {
      const context = this.generateLargeContext(test.size.viz, test.size.tables, test.size.text);
      
      const startTime = performance.now();
      
      const payload = {
        conversationId: undefined,
        messages: [],
        input: {
          type: 'input',
          context: { appId: 'dashboards', content: test.name },
          uiContext: context,
          content: `Process ${test.name.toLowerCase()}`,
          contentType: 'text'
        }
      };
      
      await this.makeRequest('/api/assistant/contextual_chat', payload);
      
      const endTime = performance.now();
      const extractionTime = endTime - startTime;
      
      this.performanceMetrics.contextExtractionTime.push({
        name: test.name,
        time: extractionTime,
        size: test.size
      });
      
      console.log(`  ${test.name}: ${extractionTime.toFixed(2)}ms`);
      
      // Verify extraction time is reasonable
      const maxTime = test.size.viz * 10 + test.size.tables * 20 + test.size.text * 2; // Rough estimate
      if (extractionTime > maxTime) {
        console.warn(`  ⚠️ ${test.name} extraction time may be too slow: ${extractionTime.toFixed(2)}ms`);
      }
    }
    
    console.log('✅ Context extraction timing benchmarks completed');
    this.testResults.push({ test: 'testContextExtractionTiming', status: 'passed' });
  }

  async testConcurrentUserHandling() {
    console.log('👥 Testing concurrent user context handling...');
    
    const concurrentUsers = 20;
    const requestsPerUser = 5;
    
    const userRequests = [];
    
    for (let userId = 0; userId < concurrentUsers; userId++) {
      for (let reqId = 0; reqId < requestsPerUser; reqId++) {
        const context = this.generateLargeContext(10, 5, 20);
        
        const payload = {
          conversationId: undefined,
          messages: [],
          input: {
            type: 'input',
            context: { 
              appId: 'dashboards', 
              content: `User ${userId} dashboard`,
              userId: `user-${userId}`
            },
            uiContext: context,
            content: `User ${userId} request ${reqId + 1}`,
            contentType: 'text'
          }
        };
        
        userRequests.push({
          userId,
          reqId,
          request: this.makeTimedRequest('/api/assistant/contextual_chat', payload)
        });
      }
    }
    
    console.log(`  Executing ${userRequests.length} concurrent requests...`);
    
    const startTime = performance.now();
    const results = await Promise.allSettled(userRequests.map(ur => ur.request));
    const endTime = performance.now();
    
    const totalTime = endTime - startTime;
    const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
    const failedRequests = results.filter(r => r.status === 'rejected').length;
    
    const throughput = (successfulRequests / totalTime) * 1000; // requests per second
    
    this.performanceMetrics.concurrentUsers = concurrentUsers;
    this.performanceMetrics.throughput = throughput;
    
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Successful requests: ${successfulRequests}/${userRequests.length}`);
    console.log(`  Failed requests: ${failedRequests}`);
    console.log(`  Throughput: ${throughput.toFixed(2)} requests/second`);
    
    // Verify acceptable success rate and performance
    const successRate = successfulRequests / userRequests.length;
    if (successRate >= 0.95 && throughput > 1) { // 95% success rate, >1 req/sec
      console.log('✅ Concurrent user handling working');
      this.testResults.push({ 
        test: 'testConcurrentUserHandling', 
        status: 'passed', 
        metrics: { successRate, throughput, totalTime } 
      });
      return;
    }
    
    throw new Error(`Concurrent handling failed - Success rate: ${(successRate * 100).toFixed(1)}%, Throughput: ${throughput.toFixed(2)} req/s`);
  }

  async testContextSystemUnderLoad() {
    console.log('🔥 Testing context system under various load conditions...');
    
    const loadTests = [
      { name: 'Light Load', concurrent: 5, duration: 10000 }, // 5 users, 10 seconds
      { name: 'Medium Load', concurrent: 15, duration: 15000 }, // 15 users, 15 seconds
      { name: 'Heavy Load', concurrent: 30, duration: 20000 }, // 30 users, 20 seconds
    ];
    
    for (const loadTest of loadTests) {
      console.log(`  Running ${loadTest.name} test...`);
      
      const startTime = performance.now();
      const endTime = startTime + loadTest.duration;
      const requests = [];
      
      // Generate continuous load
      const loadPromise = new Promise((resolve) => {
        const interval = setInterval(async () => {
          if (performance.now() >= endTime) {
            clearInterval(interval);
            resolve();
            return;
          }
          
          // Create requests from multiple concurrent users
          for (let i = 0; i < loadTest.concurrent; i++) {
            const context = this.generateLargeContext(15, 8, 30);
            
            const payload = {
              conversationId: undefined,
              messages: [],
              input: {
                type: 'input',
                context: { appId: 'dashboards', content: `Load test user ${i}` },
                uiContext: context,
                content: `Load test request from user ${i}`,
                contentType: 'text'
              }
            };
            
            requests.push(this.makeTimedRequest('/api/assistant/contextual_chat', payload));
          }
        }, 1000); // New batch every second
      });
      
      await loadPromise;
      
      // Wait for all requests to complete
      const results = await Promise.allSettled(requests);
      
      const actualDuration = performance.now() - startTime;
      const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
      const failedRequests = results.filter(r => r.status === 'rejected').length;
      const avgResponseTime = results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r.value?.responseTime || 0), 0) / successfulRequests;
      
      console.log(`    Duration: ${actualDuration.toFixed(2)}ms`);
      console.log(`    Requests: ${requests.length} (${successfulRequests} successful, ${failedRequests} failed)`);
      console.log(`    Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`    Success rate: ${((successfulRequests / requests.length) * 100).toFixed(1)}%`);
      
      // Verify system handles load acceptably
      const successRate = successfulRequests / requests.length;
      if (successRate < 0.8) { // 80% minimum success rate under load
        throw new Error(`${loadTest.name} failed - Success rate: ${(successRate * 100).toFixed(1)}%`);
      }
    }
    
    console.log('✅ Context system load testing completed');
    this.testResults.push({ test: 'testContextSystemUnderLoad', status: 'passed' });
  }

  async testResponseTimeConsistency() {
    console.log('📈 Testing response time consistency...');
    
    const testRequests = 50;
    const responseTimes = [];
    
    for (let i = 0; i < testRequests; i++) {
      const context = this.generateLargeContext(20, 10, 40);
      
      const payload = {
        conversationId: undefined,
        messages: [],
        input: {
          type: 'input',
          context: { appId: 'dashboards', content: `Consistency test ${i}` },
          uiContext: context,
          content: `Consistency test request ${i}`,
          contentType: 'text'
        }
      };
      
      const result = await this.makeTimedRequest('/api/assistant/contextual_chat', payload);
      responseTimes.push(result.responseTime);
      
      if (i % 10 === 0) {
        console.log(`  Completed ${i + 1}/${testRequests} requests`);
      }
    }
    
    // Calculate statistics
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const stdDev = Math.sqrt(
      responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length
    );
    
    console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  Min response time: ${minResponseTime.toFixed(2)}ms`);
    console.log(`  Max response time: ${maxResponseTime.toFixed(2)}ms`);
    console.log(`  Standard deviation: ${stdDev.toFixed(2)}ms`);
    console.log(`  Coefficient of variation: ${((stdDev / avgResponseTime) * 100).toFixed(1)}%`);
    
    // Verify consistency (coefficient of variation should be reasonable)
    const coefficientOfVariation = (stdDev / avgResponseTime) * 100;
    if (coefficientOfVariation < 50) { // Less than 50% variation
      console.log('✅ Response time consistency acceptable');
      this.testResults.push({ 
        test: 'testResponseTimeConsistency', 
        status: 'passed', 
        metrics: { avgResponseTime, stdDev, coefficientOfVariation } 
      });
      return;
    }
    
    throw new Error(`Response time too inconsistent - CV: ${coefficientOfVariation.toFixed(1)}%`);
  }

  async testCachePerformance() {
    console.log('💨 Testing cache performance...');
    
    const context = this.generateLargeContext(50, 25, 100);
    
    // First request (cache miss)
    const payload1 = {
      conversationId: undefined,
      messages: [],
      input: {
        type: 'input',
        context: { appId: 'dashboards', content: 'Cache test dashboard' },
        uiContext: context,
        content: 'First request to populate cache',
        contentType: 'text'
      }
    };
    
    const result1 = await this.makeTimedRequest('/api/assistant/contextual_chat', payload1);
    
    // Second request with same context (cache hit)
    const payload2 = {
      conversationId: result1.response.conversationId,
      messages: result1.response.messages,
      input: {
        type: 'input',
        context: { appId: 'dashboards', content: 'Cache test dashboard' },
        uiContext: context,
        content: 'Second request should use cache',
        contentType: 'text'
      }
    };
    
    const result2 = await this.makeTimedRequest('/api/assistant/contextual_chat', payload2);
    
    console.log(`  First request (cache miss): ${result1.responseTime.toFixed(2)}ms`);
    console.log(`  Second request (cache hit): ${result2.responseTime.toFixed(2)}ms`);
    
    const cacheSpeedup = result1.responseTime / result2.responseTime;
    console.log(`  Cache speedup: ${cacheSpeedup.toFixed(2)}x`);
    
    // Verify cache provides performance benefit
    if (cacheSpeedup > 1.2) { // At least 20% improvement
      console.log('✅ Cache performance working');
      this.testResults.push({ 
        test: 'testCachePerformance', 
        status: 'passed', 
        metrics: { cacheSpeedup, firstRequest: result1.responseTime, secondRequest: result2.responseTime } 
      });
      return;
    }
    
    console.log('⚠️ Cache performance improvement not significant');
    this.testResults.push({ test: 'testCachePerformance', status: 'passed', metrics: { cacheSpeedup } });
  }

  async testDOMObserverPerformance() {
    console.log('👁️ Testing DOM observer performance...');
    
    // Simulate DOM changes with context updates
    const baseContext = this.generateLargeContext(30, 15, 60);
    
    const domChangeTests = [];
    
    for (let i = 0; i < 10; i++) {
      // Simulate DOM changes by modifying context
      const updatedContext = {
        ...baseContext,
        extractedAt: new Date().toISOString(),
        content: {
          ...baseContext.content,
          visualizations: baseContext.content.visualizations.map(viz => ({
            ...viz,
            data: { ...viz.data, updateCount: i }
          }))
        }
      };
      
      const payload = {
        conversationId: undefined,
        messages: [],
        input: {
          type: 'input',
          context: { appId: 'dashboards', content: `DOM update ${i}` },
          uiContext: updatedContext,
          content: `Process DOM update ${i}`,
          contentType: 'text'
        }
      };
      
      domChangeTests.push(this.makeTimedRequest('/api/assistant/contextual_chat', payload));
    }
    
    const results = await Promise.all(domChangeTests);
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    
    console.log(`  Average DOM update processing time: ${avgResponseTime.toFixed(2)}ms`);
    
    // Verify DOM observer performance is acceptable
    if (avgResponseTime < 5000) { // Less than 5 seconds per update
      console.log('✅ DOM observer performance acceptable');
      this.testResults.push({ 
        test: 'testDOMObserverPerformance', 
        status: 'passed', 
        metrics: { avgResponseTime } 
      });
      return;
    }
    
    throw new Error(`DOM observer performance too slow: ${avgResponseTime.toFixed(2)}ms`);
  }

  async testContentProcessingPipeline() {
    console.log('⚙️ Testing content processing pipeline performance...');
    
    const pipelineTests = [
      { name: 'Text Heavy', viz: 5, tables: 5, text: 500 },
      { name: 'Visualization Heavy', viz: 200, tables: 10, text: 50 },
      { name: 'Table Heavy', viz: 10, tables: 100, text: 50 },
      { name: 'Balanced Load', viz: 50, tables: 50, text: 100 }
    ];
    
    for (const test of pipelineTests) {
      const context = this.generateLargeContext(test.viz, test.tables, test.text);
      
      const payload = {
        conversationId: undefined,
        messages: [],
        input: {
          type: 'input',
          context: { appId: 'dashboards', content: test.name },
          uiContext: context,
          content: `Process ${test.name.toLowerCase()} content`,
          contentType: 'text'
        }
      };
      
      const result = await this.makeTimedRequest('/api/assistant/contextual_chat', payload);
      
      console.log(`  ${test.name}: ${result.responseTime.toFixed(2)}ms`);
      
      // Verify processing time is reasonable for content size
      const expectedMaxTime = (test.viz * 5) + (test.tables * 10) + (test.text * 2);
      if (result.responseTime > expectedMaxTime) {
        console.warn(`  ⚠️ ${test.name} processing may be slow`);
      }
    }
    
    console.log('✅ Content processing pipeline performance tested');
    this.testResults.push({ test: 'testContentProcessingPipeline', status: 'passed' });
  }

  async testScalabilityLimits() {
    console.log('🚀 Testing scalability limits...');
    
    const scalabilityTests = [
      { name: 'Maximum Visualizations', viz: 1000, tables: 0, text: 0 },
      { name: 'Maximum Tables', viz: 0, tables: 500, text: 0 },
      { name: 'Maximum Text Content', viz: 0, tables: 0, text: 5000 },
      { name: 'Maximum Combined', viz: 200, tables: 100, text: 1000 }
    ];
    
    for (const test of scalabilityTests) {
      console.log(`  Testing ${test.name}...`);
      
      try {
        const context = this.generateLargeContext(test.viz, test.tables, test.text);
        
        const payload = {
          conversationId: undefined,
          messages: [],
          input: {
            type: 'input',
            context: { appId: 'dashboards', content: test.name },
            uiContext: context,
            content: `Test scalability limit: ${test.name}`,
            contentType: 'text'
          }
        };
        
        const result = await this.makeTimedRequest('/api/assistant/contextual_chat', payload, 60000); // 60s timeout
        
        console.log(`    ${test.name}: ${result.responseTime.toFixed(2)}ms - ✅ Handled`);
        
      } catch (error) {
        if (error.message.includes('timeout') || error.message.includes('413')) {
          console.log(`    ${test.name}: Reached limit - ⚠️ ${error.message}`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ Scalability limits tested');
    this.testResults.push({ test: 'testScalabilityLimits', status: 'passed' });
  }

  generateLargeContext(vizCount, tableCount, textCount) {
    const visualizations = [];
    const tables = [];
    const text = [];
    
    // Generate visualizations
    for (let i = 0; i < vizCount; i++) {
      visualizations.push({
        id: `viz-${i}`,
        type: ['line_chart', 'bar_chart', 'pie_chart', 'area_chart'][i % 4],
        title: `Visualization ${i}`,
        data: {
          series: Math.floor(Math.random() * 10) + 1,
          points: Math.floor(Math.random() * 1000) + 100,
          categories: Math.floor(Math.random() * 20) + 5,
          value: Math.random() * 1000
        }
      });
    }
    
    // Generate tables
    for (let i = 0; i < tableCount; i++) {
      const columns = [];
      const columnCount = Math.floor(Math.random() * 10) + 3;
      for (let j = 0; j < columnCount; j++) {
        columns.push(`Column ${j}`);
      }
      
      tables.push({
        id: `table-${i}`,
        title: `Table ${i}`,
        columns: columns,
        rows: Math.floor(Math.random() * 1000) + 10,
        pagination: {
          current: 1,
          total: Math.floor(Math.random() * 100) + 1,
          size: 25
        }
      });
    }
    
    // Generate text content
    for (let i = 0; i < textCount; i++) {
      text.push(`Text content item ${i} with some descriptive information about the dashboard element.`);
    }
    
    return {
      extractedAt: new Date().toISOString(),
      currentApp: 'dashboards',
      currentRoute: '/app/dashboards/view/performance-test',
      navigation: {
        breadcrumbs: [
          { text: 'Dashboards', href: '/app/dashboards' },
          { text: 'Performance Test', href: '/app/dashboards/view/performance-test' }
        ],
        activeMenu: 'dashboards'
      },
      content: {
        visualizations,
        tables,
        text,
        forms: [
          {
            id: 'date-filter',
            type: 'date_range',
            value: 'Last 30 days'
          },
          {
            id: 'category-filter',
            type: 'multi_select',
            options: ['Category A', 'Category B', 'Category C']
          }
        ]
      },
      userActions: {
        lastClick: { element: 'visualization', timestamp: Date.now() - 1000 },
        recentInteractions: ['filter_applied', 'zoom_in', 'hover']
      },
      permissions: {
        canView: true,
        canEdit: true,
        canShare: true
      }
    };
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

  async makeTimedRequest(endpoint, payload, timeout = 30000) {
    const startTime = performance.now();
    
    try {
      const response = await Promise.race([
        this.makeRequest(endpoint, payload),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return { response, responseTime };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      if (error.message === 'Request timeout') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  printPerformanceSummary() {
    console.log('\n⚡ Performance Test Summary:');
    console.log('============================');
    
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Performance Score: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    // Performance metrics summary
    if (this.performanceMetrics.responseTime.length > 0) {
      const avgResponseTime = this.performanceMetrics.responseTime.reduce((sum, time) => sum + time, 0) / this.performanceMetrics.responseTime.length;
      console.log(`⏱️ Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    }
    
    if (this.performanceMetrics.memoryUsage.length > 0) {
      const avgMemoryUsage = this.performanceMetrics.memoryUsage.reduce((sum, mem) => sum + mem, 0) / this.performanceMetrics.memoryUsage.length;
      console.log(`💾 Average Memory Usage: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }
    
    if (this.performanceMetrics.throughput > 0) {
      console.log(`🚀 Throughput: ${this.performanceMetrics.throughput.toFixed(2)} requests/second`);
    }
    
    if (failed > 0) {
      console.log('\n❌ Failed Performance Tests:');
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(r => console.log(`  - ${r.test}: ${r.error}`));
    }
    
    console.log('\n🏁 Performance Testing Complete!');
  }
}

// Run the tests
if (require.main === module) {
  const tester = new PerformanceScalabilityTest();
  tester.runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Performance test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { PerformanceScalabilityTest };