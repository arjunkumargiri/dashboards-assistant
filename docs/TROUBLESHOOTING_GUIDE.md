# Contextual Dashboard Chat Troubleshooting Guide

## Overview

This guide helps administrators and developers diagnose and resolve common issues with the Contextual Dashboard Chat feature in OpenSearch Dashboards.

## Common Issues and Solutions

### 1. Context Not Being Extracted

#### Symptoms
- Chat responses don't reference dashboard content
- Context status shows "No context available"
- Empty context in debug logs

#### Possible Causes and Solutions

**Cause: Feature not enabled**
```yaml
# Check configuration in opensearch_dashboards.yml
assistant:
  contextual_chat:
    enabled: false  # Should be true
```
**Solution:** Set `enabled: true` and restart OpenSearch Dashboards.

**Cause: Permission issues**
```javascript
// Check browser console for permission errors
// Look for: "Context extraction failed: insufficient permissions"
```
**Solution:** Verify user has appropriate dashboard viewing permissions.

**Cause: DOM elements not found**
```javascript
// Check if dashboard elements are properly loaded
console.log(document.querySelectorAll('[data-test-subj*="visualization"]'));
```
**Solution:** Ensure dashboard is fully loaded before attempting context extraction.

**Cause: Extraction timeout**
```yaml
# Increase timeout in configuration
assistant:
  contextual_chat:
    extraction_timeout: 10000  # Increase from default 5000ms
```

#### Debugging Steps

1. **Check feature status:**
```bash
curl -X GET "localhost:5601/api/assistant/contextual-chat/status"
```

2. **Enable debug logging:**
```yaml
assistant:
  contextual_chat:
    monitoring:
      log_level: "debug"
      log_extractions: true
```

3. **Test context extraction manually:**
```javascript
// In browser console
const contextService = window.opensearchDashboards.getService('uiContext');
contextService.getCurrentContext().then(console.log);
```

### 2. Poor Context Quality

#### Symptoms
- Chat responses are generic or irrelevant
- Missing visualization data in responses
- Incorrect data interpretation

#### Possible Causes and Solutions

**Cause: Content prioritization issues**
```yaml
# Adjust relevance threshold
assistant:
  contextual_chat:
    chat:
      relevance_threshold: 0.2  # Lower threshold to include more content
```

**Cause: Insufficient context tokens**
```yaml
# Increase token limit
assistant:
  contextual_chat:
    chat:
      max_context_tokens: 6000  # Increase from default 4000
```

**Cause: Content extraction incomplete**
```yaml
# Enable all content types
assistant:
  contextual_chat:
    extraction:
      visualizations: true
      data_tables: true
      text_content: true
      forms_controls: true
      navigation: true
```

#### Debugging Steps

1. **Inspect extracted context:**
```javascript
// Check context content in browser console
const context = await contextService.getCurrentContext();
console.log('Content elements:', context.content.length);
console.log('Context details:', context);
```

2. **Verify content extraction:**
```javascript
// Test specific element extraction
const element = document.querySelector('[data-test-subj="visualization"]');
const extractor = window.opensearchDashboards.getService('contentExtractor');
const content = await extractor.extractFromElement(element);
console.log('Extracted content:', content);
```

### 3. Performance Issues

#### Symptoms
- Slow dashboard loading
- High memory usage
- Context extraction timeouts
- Browser freezing during extraction

#### Possible Causes and Solutions

**Cause: Too many concurrent extractions**
```yaml
# Reduce concurrent extractions
assistant:
  contextual_chat:
    performance:
      max_concurrent_extractions: 3  # Reduce from default 5
```

**Cause: Large context size**
```yaml
# Limit context size
assistant:
  contextual_chat:
    max_context_size: 5242880  # 5MB instead of 10MB
    max_visualizations: 10     # Reduce from default 20
```

**Cause: Inefficient DOM observation**
```yaml
# Optimize DOM observation
assistant:
  contextual_chat:
    performance:
      dom_update_debounce: 500  # Increase debounce delay
      observe_only_active_tabs: true
```

**Cause: Memory leaks**
```yaml
# Enable aggressive cleanup
assistant:
  contextual_chat:
    performance:
      cache_cleanup_interval: 60  # Clean up every minute
      cache_memory_limit: 50      # Reduce cache size
```

#### Debugging Steps

1. **Monitor memory usage:**
```javascript
// Check memory usage in browser console
console.log('Memory usage:', performance.memory);
```

2. **Profile extraction performance:**
```javascript
// Time context extraction
console.time('context-extraction');
const context = await contextService.getCurrentContext();
console.timeEnd('context-extraction');
```

3. **Check cache statistics:**
```bash
curl -X GET "localhost:5601/api/assistant/contextual-chat/cache/stats"
```

### 4. Chat Integration Issues

#### Symptoms
- Context not appearing in chat responses
- Chat service errors
- Fallback to standard chat not working

#### Possible Causes and Solutions

**Cause: Chat service not properly extended**
```typescript
// Verify contextual chat service is registered
const chatService = core.getService('contextualChat');
if (!chatService) {
  console.error('Contextual chat service not found');
}
```

**Cause: Context injection disabled**
```yaml
# Enable context injection
assistant:
  contextual_chat:
    chat:
      inject_context: true
```

**Cause: LLM service compatibility**
```yaml
# Ensure fallback is enabled
assistant:
  contextual_chat:
    chat:
      fallback_to_standard_chat: true
```

#### Debugging Steps

1. **Test chat service directly:**
```javascript
// Test contextual chat request
const response = await chatService.requestLLMWithContext({
  messages: [],
  input: { content: 'Test message' },
  uiContext: context
}, requestContext);
```

2. **Check chat service logs:**
```bash
# Look for contextual chat errors in logs
grep "contextual.*chat" /path/to/opensearch-dashboards.log
```

### 5. Security and Permission Issues

#### Symptoms
- Context extraction fails for certain users
- Missing content in context for some dashboards
- Audit log errors

#### Possible Causes and Solutions

**Cause: Insufficient user permissions**
```bash
# Check user roles and permissions
curl -X GET "localhost:9200/_security/user/username"
```
**Solution:** Ensure user has appropriate dashboard and index permissions.

**Cause: Content filtering too restrictive**
```yaml
# Review content filters
assistant:
  contextual_chat:
    content_filters:
      allowed_content_types:
        - "visualization"
        - "data_table"  # Add if missing
```

**Cause: Security validation errors**
```yaml
# Check security settings
assistant:
  contextual_chat:
    security:
      respect_permissions: true
      validate_content_access: true
```

#### Debugging Steps

1. **Check permission validation:**
```javascript
// Test permission validation
const validator = core.getService('securityValidator');
const validatedContext = validator.validateAccess(user, context);
console.log('Validated context:', validatedContext);
```

2. **Review audit logs:**
```bash
# Check audit logs for access denials
grep "context.*access.*denied" /path/to/audit.log
```

## Diagnostic Tools

### Built-in Debug Endpoints

Enable debug endpoints in configuration:
```yaml
assistant:
  contextual_chat:
    debug:
      enable_debug_endpoints: true
      debug_endpoint_auth: "admin_only"
```

Available endpoints:

1. **Health Check:**
```bash
curl -X GET "localhost:5601/api/assistant/contextual-chat/health"
```

2. **Context Status:**
```bash
curl -X GET "localhost:5601/api/assistant/contextual-chat/debug/context"
```

3. **Performance Metrics:**
```bash
curl -X GET "localhost:5601/api/assistant/contextual-chat/debug/metrics"
```

4. **Cache Statistics:**
```bash
curl -X GET "localhost:5601/api/assistant/contextual-chat/debug/cache"
```

### Browser Console Commands

Useful commands for debugging in browser console:

```javascript
// Get current context
const context = await window.opensearchDashboards.getService('uiContext').getCurrentContext();

// Test content extraction
const extractor = window.opensearchDashboards.getService('contentExtractor');
const elements = document.querySelectorAll('[data-test-subj*="visualization"]');
for (const element of elements) {
  const content = await extractor.extractFromElement(element);
  console.log('Element content:', content);
}

// Check DOM observer status
const observer = window.opensearchDashboards.getService('domObserver');
console.log('Observer active:', observer.isObserving());

// Test security validation
const validator = window.opensearchDashboards.getService('securityValidator');
const user = window.opensearchDashboards.getCurrentUser();
const validatedContext = validator.validateAccess(user, context);
```

### Log Analysis

#### Key Log Patterns

**Successful context extraction:**
```
[INFO] Contextual chat context extracted successfully: 15 elements, 2.3MB
```

**Extraction timeout:**
```
[WARN] Context extraction timeout after 5000ms
```

**Permission denied:**
```
[ERROR] Context extraction failed: insufficient permissions for user 'username'
```

**Memory issues:**
```
[WARN] Context cache memory limit exceeded: 105MB > 100MB
```

#### Log Analysis Commands

```bash
# Count extraction successes/failures
grep -c "context extracted successfully" /path/to/logs
grep -c "context extraction failed" /path/to/logs

# Find performance issues
grep "extraction timeout\|memory limit exceeded" /path/to/logs

# Check error patterns
grep -E "(ERROR|WARN).*contextual.*chat" /path/to/logs | sort | uniq -c
```

## Performance Monitoring

### Key Metrics to Monitor

1. **Context Extraction Time**
   - Target: < 500ms
   - Alert: > 2000ms

2. **Memory Usage**
   - Target: < 100MB
   - Alert: > 200MB

3. **Cache Hit Rate**
   - Target: > 80%
   - Alert: < 50%

4. **Error Rate**
   - Target: < 1%
   - Alert: > 5%

### Monitoring Queries

```bash
# Average extraction time
curl -X GET "localhost:9200/contextual_chat_metrics/_search" -H 'Content-Type: application/json' -d'
{
  "aggs": {
    "avg_extraction_time": {
      "avg": {
        "field": "extraction_time_ms"
      }
    }
  }
}'

# Error rate by type
curl -X GET "localhost:9200/contextual_chat_metrics/_search" -H 'Content-Type: application/json' -d'
{
  "aggs": {
    "error_types": {
      "terms": {
        "field": "error_type"
      }
    }
  }
}'
```

## Recovery Procedures

### Emergency Disable

If contextual chat is causing system issues:

1. **Immediate disable via API:**
```bash
curl -X POST "localhost:5601/api/assistant/contextual-chat/disable"
```

2. **Configuration disable:**
```yaml
assistant:
  contextual_chat:
    enabled: false
```

3. **Feature flag disable:**
```bash
curl -X POST "localhost:5601/api/assistant/feature-flags/contextual_chat/disable"
```

### Memory Recovery

If memory usage is too high:

1. **Clear context cache:**
```bash
curl -X POST "localhost:5601/api/assistant/contextual-chat/cache/clear"
```

2. **Restart extraction service:**
```bash
curl -X POST "localhost:5601/api/assistant/contextual-chat/restart"
```

### Data Recovery

If context data is corrupted:

1. **Reset context service:**
```bash
curl -X POST "localhost:5601/api/assistant/contextual-chat/reset"
```

2. **Rebuild context cache:**
```bash
curl -X POST "localhost:5601/api/assistant/contextual-chat/cache/rebuild"
```

## Escalation Procedures

### When to Escalate

1. **System Impact:** Dashboard performance degraded > 50%
2. **High Error Rate:** > 10% of context extractions failing
3. **Memory Issues:** Memory usage > 500MB
4. **Security Concerns:** Unauthorized data access detected

### Escalation Information to Collect

1. **System Information:**
   - OpenSearch Dashboards version
   - Plugin version
   - Browser and OS details
   - Dashboard configuration

2. **Error Details:**
   - Error messages and stack traces
   - Reproduction steps
   - Affected user count
   - Timeline of issues

3. **Performance Data:**
   - Memory usage graphs
   - Response time metrics
   - Error rate trends
   - System resource utilization

4. **Configuration:**
   - Current configuration files
   - Recent configuration changes
   - Feature flag settings
   - Security settings

### Support Contacts

- **Level 1:** Dashboard administrators
- **Level 2:** OpenSearch Dashboards developers
- **Level 3:** Plugin development team
- **Emergency:** System administrators

## Prevention Best Practices

### Configuration Management

1. **Use version control** for configuration files
2. **Test configuration changes** in staging first
3. **Monitor configuration drift** between environments
4. **Document all configuration changes**

### Monitoring Setup

1. **Set up proactive alerts** for key metrics
2. **Create dashboards** for contextual chat health
3. **Implement automated testing** for critical paths
4. **Regular performance reviews** and optimization

### Capacity Planning

1. **Monitor growth trends** in context size and usage
2. **Plan for peak usage** scenarios
3. **Regular performance testing** with realistic loads
4. **Capacity alerts** before limits are reached