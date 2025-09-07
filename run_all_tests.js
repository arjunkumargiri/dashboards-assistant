#!/usr/bin/env node
/**
 * Comprehensive Test Runner for Contextual Chat System
 * Runs all test suites and generates a complete test report
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class ComprehensiveTestRunner {
  constructor() {
    this.testSuites = [
      {
        name: 'Basic Integration Tests',
        file: 'test_non_streaming_integration.js',
        description: 'Tests basic chat functionality and API integration'
      },
      {
        name: 'Contextual Integration Tests',
        file: 'test_contextual_integration.js',
        description: 'Tests full contextual chat flow with UI context extraction'
      },
      {
        name: 'Security & Permission Tests',
        file: 'test_security_permissions.js',
        description: 'Tests security boundaries, permissions, and data sanitization'
      },
      {
        name: 'Performance & Scalability Tests',
        file: 'test_performance_scalability.js',
        description: 'Tests system performance under various load conditions'
      }
    ];
    
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Contextual Chat Test Suite');
    console.log('====================================================\n');
    
    this.startTime = performance.now();
    
    // Check if OpenSearch Dashboards is running
    await this.checkSystemReadiness();
    
    // Run each test suite
    for (const suite of this.testSuites) {
      console.log(`\n📋 Running ${suite.name}...`);
      console.log(`Description: ${suite.description}`);
      console.log('─'.repeat(60));
      
      const suiteResult = await this.runTestSuite(suite);
      this.results.push(suiteResult);
      
      console.log(`\n${suite.name} completed: ${suiteResult.status}`);
      if (suiteResult.status === 'failed') {
        console.log(`Error: ${suiteResult.error}`);
      }
    }
    
    this.endTime = performance.now();
    
    // Generate comprehensive report
    await this.generateTestReport();
    
    // Print summary
    this.printTestSummary();
    
    // Exit with appropriate code
    const hasFailures = this.results.some(r => r.status === 'failed');
    process.exit(hasFailures ? 1 : 0);
  }

  async checkSystemReadiness() {
    console.log('🔍 Checking system readiness...');
    
    try {
      // Check if OpenSearch Dashboards is running
      const response = await this.makeHealthCheck();
      console.log('✅ OpenSearch Dashboards is running');
      
      // Check if contextual chat endpoints are available
      await this.checkContextualChatEndpoints();
      console.log('✅ Contextual chat endpoints are available');
      
    } catch (error) {
      console.error('❌ System readiness check failed:', error.message);
      console.log('\n📝 Prerequisites:');
      console.log('1. OpenSearch Dashboards must be running on localhost:5601');
      console.log('2. Dashboards Assistant plugin must be installed and enabled');
      console.log('3. Contextual chat service must be configured');
      process.exit(1);
    }
  }

  async makeHealthCheck() {
    const http = require('http');
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5601,
        path: '/api/status',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Health check failed: HTTP ${res.statusCode}`));
        }
      });
      
      req.on('error', (error) => {
        reject(new Error(`Cannot connect to OpenSearch Dashboards: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Health check timeout'));
      });
      
      req.end();
    });
  }

  async checkContextualChatEndpoints() {
    const http = require('http');
    
    return new Promise((resolve, reject) => {
      const testPayload = {
        conversationId: undefined,
        messages: [],
        input: {
          type: 'input',
          context: { appId: 'test', content: 'test' },
          content: 'test',
          contentType: 'text'
        }
      };
      
      const postData = JSON.stringify(testPayload);
      
      const req = http.request({
        hostname: 'localhost',
        port: 5601,
        path: '/api/assistant/contextual_chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'osd-xsrf': 'true'
        },
        timeout: 10000
      }, (res) => {
        // Any response (even error) means the endpoint exists
        resolve();
      });
      
      req.on('error', (error) => {
        if (error.code === 'ECONNREFUSED') {
          reject(new Error('Contextual chat endpoint not available'));
        } else {
          resolve(); // Other errors are acceptable for this check
        }
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Contextual chat endpoint timeout'));
      });
      
      req.write(postData);
      req.end();
    });
  }

  async runTestSuite(suite) {
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      const testProcess = spawn('node', [suite.file], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      testProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output); // Real-time output
      });
      
      testProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output); // Real-time error output
      });
      
      testProcess.on('close', (code) => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        const result = {
          suite: suite.name,
          file: suite.file,
          description: suite.description,
          status: code === 0 ? 'passed' : 'failed',
          exitCode: code,
          duration: duration,
          stdout: stdout,
          stderr: stderr,
          timestamp: new Date().toISOString()
        };
        
        if (code !== 0) {
          result.error = `Test suite exited with code ${code}`;
        }
        
        resolve(result);
      });
      
      testProcess.on('error', (error) => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        resolve({
          suite: suite.name,
          file: suite.file,
          description: suite.description,
          status: 'failed',
          exitCode: -1,
          duration: duration,
          stdout: stdout,
          stderr: stderr,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  async generateTestReport() {
    console.log('\n📊 Generating comprehensive test report...');
    
    const totalDuration = this.endTime - this.startTime;
    const passedSuites = this.results.filter(r => r.status === 'passed').length;
    const failedSuites = this.results.filter(r => r.status === 'failed').length;
    
    const report = {
      testRun: {
        timestamp: new Date().toISOString(),
        duration: totalDuration,
        totalSuites: this.testSuites.length,
        passedSuites: passedSuites,
        failedSuites: failedSuites,
        successRate: (passedSuites / this.testSuites.length) * 100
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      },
      testSuites: this.results,
      summary: {
        overallStatus: failedSuites === 0 ? 'PASSED' : 'FAILED',
        recommendations: this.generateRecommendations()
      }
    };
    
    // Write detailed JSON report
    const reportPath = path.join(__dirname, 'test_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Write human-readable HTML report
    const htmlReport = this.generateHTMLReport(report);
    const htmlReportPath = path.join(__dirname, 'test_report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);
    
    // Write markdown summary
    const markdownReport = this.generateMarkdownReport(report);
    const markdownReportPath = path.join(__dirname, 'TEST_RESULTS.md');
    fs.writeFileSync(markdownReportPath, markdownReport);
    
    console.log(`✅ Test reports generated:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
    console.log(`   Markdown: ${markdownReportPath}`);
  }

  generateRecommendations() {
    const recommendations = [];
    
    const failedSuites = this.results.filter(r => r.status === 'failed');
    
    if (failedSuites.length === 0) {
      recommendations.push('🎉 All test suites passed! The contextual chat system is ready for production.');
      recommendations.push('📈 Consider running performance tests regularly to monitor system health.');
      recommendations.push('🔒 Ensure security tests are run after any configuration changes.');
    } else {
      recommendations.push('❌ Some test suites failed. Review the detailed results below.');
      
      failedSuites.forEach(suite => {
        if (suite.suite.includes('Integration')) {
          recommendations.push('🔧 Check OpenSearch Dashboards configuration and plugin installation.');
        }
        if (suite.suite.includes('Security')) {
          recommendations.push('🛡️ Review security configurations and permission settings.');
        }
        if (suite.suite.includes('Performance')) {
          recommendations.push('⚡ Consider optimizing system resources or scaling infrastructure.');
        }
      });
    }
    
    return recommendations;
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contextual Chat Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; }
        .metric-label { font-size: 0.9em; color: #666; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .suite-passed { border-left: 4px solid #28a745; }
        .suite-failed { border-left: 4px solid #dc3545; }
        .recommendations { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .log-output { background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 0.9em; max-height: 300px; overflow-y: auto; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Contextual Chat Test Report</h1>
            <p class="${report.summary.overallStatus === 'PASSED' ? 'status-passed' : 'status-failed'}">
                Overall Status: ${report.summary.overallStatus}
            </p>
            <p>Generated: ${new Date(report.testRun.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="metrics">
            <div class="metric">
                <div class="metric-value">${report.testRun.totalSuites}</div>
                <div class="metric-label">Total Suites</div>
            </div>
            <div class="metric">
                <div class="metric-value status-passed">${report.testRun.passedSuites}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value status-failed">${report.testRun.failedSuites}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.testRun.successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(report.testRun.duration / 1000).toFixed(1)}s</div>
                <div class="metric-label">Total Duration</div>
            </div>
        </div>
        
        <div class="recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${report.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        
        <h2>Test Suite Results</h2>
        ${report.testSuites.map(suite => `
            <div class="suite ${suite.status === 'passed' ? 'suite-passed' : 'suite-failed'}">
                <h3>${suite.suite} - <span class="status-${suite.status}">${suite.status.toUpperCase()}</span></h3>
                <p><strong>Description:</strong> ${suite.description}</p>
                <p><strong>Duration:</strong> ${(suite.duration / 1000).toFixed(2)}s</p>
                <p><strong>Exit Code:</strong> ${suite.exitCode}</p>
                ${suite.error ? `<p><strong>Error:</strong> ${suite.error}</p>` : ''}
                
                ${suite.stdout ? `
                    <details>
                        <summary>Standard Output</summary>
                        <div class="log-output">
                            <pre>${suite.stdout}</pre>
                        </div>
                    </details>
                ` : ''}
                
                ${suite.stderr ? `
                    <details>
                        <summary>Error Output</summary>
                        <div class="log-output">
                            <pre>${suite.stderr}</pre>
                        </div>
                    </details>
                ` : ''}
            </div>
        `).join('')}
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em;">
            <p>Environment: Node.js ${report.environment.nodeVersion} on ${report.environment.platform} ${report.environment.arch}</p>
            <p>Memory Usage: ${(report.environment.memory.heapUsed / 1024 / 1024).toFixed(2)}MB heap used</p>
        </div>
    </div>
</body>
</html>`;
  }

  generateMarkdownReport(report) {
    return `# Contextual Chat Test Report

**Overall Status:** ${report.summary.overallStatus === 'PASSED' ? '✅ PASSED' : '❌ FAILED'}  
**Generated:** ${new Date(report.testRun.timestamp).toLocaleString()}  
**Duration:** ${(report.testRun.duration / 1000).toFixed(1)}s

## Summary

| Metric | Value |
|--------|-------|
| Total Suites | ${report.testRun.totalSuites} |
| Passed | ${report.testRun.passedSuites} |
| Failed | ${report.testRun.failedSuites} |
| Success Rate | ${report.testRun.successRate.toFixed(1)}% |

## Recommendations

${report.summary.recommendations.map(rec => `- ${rec}`).join('\n')}

## Test Suite Results

${report.testSuites.map(suite => `
### ${suite.suite} ${suite.status === 'passed' ? '✅' : '❌'}

**Status:** ${suite.status.toUpperCase()}  
**Description:** ${suite.description}  
**Duration:** ${(suite.duration / 1000).toFixed(2)}s  
**Exit Code:** ${suite.exitCode}  
${suite.error ? `**Error:** ${suite.error}  ` : ''}

${suite.stdout && suite.stdout.trim() ? `
<details>
<summary>Standard Output</summary>

\`\`\`
${suite.stdout.trim()}
\`\`\`

</details>
` : ''}

${suite.stderr && suite.stderr.trim() ? `
<details>
<summary>Error Output</summary>

\`\`\`
${suite.stderr.trim()}
\`\`\`

</details>
` : ''}
`).join('\n')}

## Environment

- **Node.js:** ${report.environment.nodeVersion}
- **Platform:** ${report.environment.platform} ${report.environment.arch}
- **Memory Usage:** ${(report.environment.memory.heapUsed / 1024 / 1024).toFixed(2)}MB heap used

---
*Report generated by Contextual Chat Test Runner*`;
  }

  printTestSummary() {
    console.log('\n🎯 COMPREHENSIVE TEST SUMMARY');
    console.log('==============================');
    
    const totalDuration = this.endTime - this.startTime;
    const passedSuites = this.results.filter(r => r.status === 'passed').length;
    const failedSuites = this.results.filter(r => r.status === 'failed').length;
    const successRate = (passedSuites / this.testSuites.length) * 100;
    
    console.log(`📊 Test Results:`);
    console.log(`   Total Suites: ${this.testSuites.length}`);
    console.log(`   ✅ Passed: ${passedSuites}`);
    console.log(`   ❌ Failed: ${failedSuites}`);
    console.log(`   📈 Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   ⏱️ Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    
    console.log(`\n📋 Suite Breakdown:`);
    this.results.forEach(result => {
      const status = result.status === 'passed' ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(1);
      console.log(`   ${status} ${result.suite} (${duration}s)`);
    });
    
    if (failedSuites > 0) {
      console.log(`\n❌ Failed Suites:`);
      this.results
        .filter(r => r.status === 'failed')
        .forEach(result => {
          console.log(`   - ${result.suite}: ${result.error || 'Unknown error'}`);
        });
    }
    
    console.log(`\n🎯 Overall Status: ${failedSuites === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (failedSuites === 0) {
      console.log('\n🎉 Congratulations! The contextual chat system has passed all tests.');
      console.log('   The system is ready for production deployment.');
    } else {
      console.log('\n🔧 Please review the failed tests and address any issues before deployment.');
    }
  }
}

// Run all tests
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  runner.runAllTests().catch((error) => {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { ComprehensiveTestRunner };