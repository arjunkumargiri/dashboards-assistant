# Contextual Chat Testing Guide

This guide provides comprehensive information about testing the contextual chat system, including test suites, execution instructions, and troubleshooting.

## Overview

The contextual chat system includes four comprehensive test suites that validate different aspects of the system:

1. **Basic Integration Tests** - Core chat functionality and API integration
2. **Contextual Integration Tests** - Full contextual chat flow with UI context extraction
3. **Security & Permission Tests** - Security boundaries, permissions, and data sanitization
4. **Performance & Scalability Tests** - System performance under various load conditions

## Test Suites

### 1. Basic Integration Tests (`test_non_streaming_integration.js`)

Tests the fundamental chat functionality without contextual features.

**What it tests:**
- Basic chat API endpoints
- Message sending and receiving
- Conversation management
- Error handling for basic scenarios

**Usage:**
```bash
node test_non_streaming_integration.js
```

### 2. Contextual Integration Tests (`test_contextual_integration.js`)

Comprehensive tests for the full contextual chat system.

**What it tests:**
- Basic contextual chat functionality
- Dashboard context extraction
- Visualization-specific context chat
- Table data context chat
- Navigation context chat
- Form controls context chat
- Real-time context updates
- Context caching
- Contextual prompt building
- Contextual response processing
- Error handling and fallbacks

**Usage:**
```bash
node test_contextual_integration.js
```

### 3. Security & Permission Tests (`test_security_permissions.js`)

Validates security measures and permission-based access control.

**What it tests:**
- Permission-based content filtering
- Security boundary validation
- Audit trail verification
- Data sanitization validation
- Context access with different user roles
- Sensitive data filtering
- Cross-user context isolation
- Privilege escalation prevention
- Content access logging
- Secure context transmission

**Usage:**
```bash
node test_security_permissions.js
```

### 4. Performance & Scalability Tests (`test_performance_scalability.js`)

Tests system performance and scalability limits.

**What it tests:**
- Large dashboard context handling
- Memory usage validation
- Context extraction timing benchmarks
- Concurrent user handling
- Context system under load
- Response time consistency
- Cache performance
- DOM observer performance
- Content processing pipeline
- Scalability limits

**Usage:**
```bash
node test_performance_scalability.js
```

## Running All Tests

### Comprehensive Test Runner

Use the comprehensive test runner to execute all test suites and generate detailed reports:

```bash
node run_all_tests.js
```

This will:
1. Check system readiness
2. Run all test suites sequentially
3. Generate comprehensive reports (JSON, HTML, Markdown)
4. Provide recommendations based on results

### Prerequisites

Before running tests, ensure:

1. **OpenSearch Dashboards is running** on `localhost:5601`
2. **Dashboards Assistant plugin** is installed and enabled
3. **Contextual chat service** is properly configured
4. **Required dependencies** are installed

### System Readiness Check

The test runner automatically checks:
- OpenSearch Dashboards availability
- Contextual chat endpoints
- Plugin configuration
- Service health

## Test Reports

### Generated Reports

After running the comprehensive test suite, the following reports are generated:

1. **`test_report.json`** - Detailed JSON report with all test data
2. **`test_report.html`** - Human-readable HTML report with interactive elements
3. **`TEST_RESULTS.md`** - Markdown summary for documentation

### Report Contents

Each report includes:
- Overall test status and success rate
- Individual test suite results
- Performance metrics
- Error details and logs
- Environment information
- Recommendations for improvements

## Test Configuration

### Environment Variables

Configure test behavior with environment variables:

```bash
# Test target URL
export TEST_BASE_URL=http://localhost:5601

# Test timeout (milliseconds)
export TEST_TIMEOUT=30000

# Enable verbose logging
export TEST_VERBOSE=true

# Test user credentials
export TEST_ADMIN_TOKEN=your_admin_token
export TEST_VIEWER_TOKEN=your_viewer_token
```

### Custom Test Data

Modify test data by editing the test files:

- **Context sizes**: Adjust visualization, table, and text counts
- **User roles**: Modify permission sets in security tests
- **Load parameters**: Change concurrent user counts and duration
- **Performance thresholds**: Update acceptable response times

## Troubleshooting

### Common Issues

#### 1. Connection Refused
```
Error: Cannot connect to OpenSearch Dashboards
```
**Solution:** Ensure OpenSearch Dashboards is running on localhost:5601

#### 2. Endpoint Not Found
```
Error: Contextual chat endpoint not available
```
**Solution:** Verify the dashboards-assistant plugin is installed and enabled

#### 3. Permission Denied
```
Error: HTTP 403: Access denied
```
**Solution:** Check user authentication and role permissions

#### 4. Timeout Errors
```
Error: Request timeout after 30000ms
```
**Solution:** Increase timeout values or check system performance

#### 5. Memory Issues
```
Error: Potential memory leak detected
```
**Solution:** Monitor memory usage and optimize context sizes

### Debug Mode

Enable debug mode for detailed logging:

```bash
DEBUG=true node test_contextual_integration.js
```

### Performance Tuning

For performance tests, consider:

1. **System Resources**: Ensure adequate CPU and memory
2. **Network Latency**: Run tests on the same machine as OpenSearch Dashboards
3. **Concurrent Limits**: Adjust based on system capabilities
4. **Context Sizes**: Start with smaller contexts and scale up

## Continuous Integration

### GitHub Actions Example

```yaml
name: Contextual Chat Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      opensearch:
        image: opensearchproject/opensearch:latest
        env:
          discovery.type: single-node
        ports:
          - 9200:9200
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Start OpenSearch Dashboards
        run: |
          npm run start:dashboards &
          sleep 30
      
      - name: Run tests
        run: node run_all_tests.js
      
      - name: Upload test reports
        uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: |
            test_report.html
            test_report.json
            TEST_RESULTS.md
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install'
                sh 'docker-compose up -d opensearch opensearch-dashboards'
                sh 'sleep 60' // Wait for services to start
            }
        }
        
        stage('Test') {
            steps {
                sh 'node run_all_tests.js'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: '.',
                        reportFiles: 'test_report.html',
                        reportName: 'Test Report'
                    ])
                    
                    archiveArtifacts artifacts: 'test_report.json,TEST_RESULTS.md'
                }
            }
        }
    }
    
    post {
        always {
            sh 'docker-compose down'
        }
    }
}
```

## Test Development

### Adding New Tests

To add new tests to existing suites:

1. **Identify the appropriate test suite**
2. **Add test method** following naming convention `testNewFeature()`
3. **Update test array** in the `runAllTests()` method
4. **Follow existing patterns** for error handling and reporting

### Creating New Test Suites

To create a new test suite:

1. **Create new test file** following naming convention `test_feature_name.js`
2. **Implement test class** with `runAllTests()` method
3. **Add to comprehensive runner** in `run_all_tests.js`
4. **Update documentation**

### Test Utilities

Common utilities available in test files:

```javascript
// Make HTTP requests
await this.makeRequest('/api/endpoint', payload);

// Timed requests with performance metrics
await this.makeTimedRequest('/api/endpoint', payload);

// Generate test contexts
const context = this.generateLargeContext(vizCount, tableCount, textCount);

// Security test utilities
const secureContext = this.createSecureContext(userRole, content);
await this.makeSecureRequest('/api/endpoint', payload, userRole);
```

## Best Practices

### Test Design

1. **Isolation**: Each test should be independent
2. **Cleanup**: Clean up resources after tests
3. **Assertions**: Use clear, specific assertions
4. **Error Handling**: Handle both success and failure cases
5. **Performance**: Monitor test execution time

### Data Management

1. **Test Data**: Use realistic but safe test data
2. **Sensitive Data**: Never use real sensitive information
3. **Context Sizes**: Scale context sizes appropriately
4. **Cleanup**: Remove test data after execution

### Reporting

1. **Clear Messages**: Provide descriptive test messages
2. **Metrics**: Include relevant performance metrics
3. **Logs**: Capture sufficient logging for debugging
4. **Screenshots**: Consider visual validation for UI tests

## Maintenance

### Regular Tasks

1. **Update test data** to reflect current dashboard structures
2. **Review performance thresholds** based on system improvements
3. **Update security tests** for new permission models
4. **Maintain test documentation** with system changes

### Monitoring

1. **Test execution time** trends
2. **Success rate** over time
3. **Performance regression** detection
4. **Error pattern** analysis

---

For questions or issues with testing, please refer to the main project documentation or create an issue in the project repository.