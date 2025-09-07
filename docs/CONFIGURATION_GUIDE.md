# Contextual Dashboard Chat Configuration Guide

## Overview

This guide provides comprehensive configuration instructions for administrators setting up and managing the Contextual Dashboard Chat feature in OpenSearch Dashboards.

## Configuration Files

### Main Configuration

The primary configuration is located in `opensearch_dashboards.yml`:

```yaml
# Contextual Dashboard Chat Configuration
assistant:
  contextual_chat:
    # Enable/disable the contextual chat feature
    enabled: true
    
    # Maximum number of visualizations to extract per context
    max_visualizations: 20
    
    # Context cache time-to-live in seconds
    context_cache_ttl: 300
    
    # Timeout for content extraction in milliseconds
    extraction_timeout: 5000
    
    # Maximum context size in bytes
    max_context_size: 10485760  # 10MB
    
    # Performance settings
    performance:
      # Debounce delay for DOM updates in milliseconds
      dom_update_debounce: 250
      
      # Maximum concurrent extractions
      max_concurrent_extractions: 5
      
      # Memory limit for context cache in MB
      cache_memory_limit: 100
    
    # Security settings
    security:
      # Respect existing dashboard permissions
      respect_permissions: true
      
      # Enable audit logging for context access
      audit_access: true
      
      # Sanitize sensitive data in context
      sanitize_data: true
      
      # Maximum context retention time in hours
      max_retention_hours: 24
    
    # Content extraction settings
    extraction:
      # Enable extraction for different content types
      visualizations: true
      data_tables: true
      text_content: true
      forms_controls: true
      navigation: true
      
      # Extraction quality settings
      include_metadata: true
      include_relationships: true
      summarize_large_content: true
      
      # Content prioritization
      prioritize_visible_content: true
      max_content_elements: 50
    
    # Chat integration settings
    chat:
      # Enable context injection into chat prompts
      inject_context: true
      
      # Context relevance scoring threshold (0-1)
      relevance_threshold: 0.3
      
      # Maximum context tokens for LLM
      max_context_tokens: 4000
      
      # Fallback behavior when context unavailable
      fallback_to_standard_chat: true
    
    # Monitoring and logging
    monitoring:
      # Enable performance metrics collection
      collect_metrics: true
      
      # Log level for contextual chat operations
      log_level: "info"  # debug, info, warn, error
      
      # Enable detailed extraction logging
      log_extractions: false
      
      # Metrics collection interval in seconds
      metrics_interval: 60
```

### Feature Flags Configuration

Feature flags allow gradual rollout and A/B testing:

```yaml
# Feature flags for contextual chat
assistant:
  feature_flags:
    contextual_chat:
      # Global enable/disable
      enabled: true
      
      # Percentage of users to enable for (0-100)
      rollout_percentage: 100
      
      # Specific user groups to enable
      enabled_groups:
        - "admin"
        - "power_users"
      
      # Specific users to enable (by username)
      enabled_users:
        - "user1@company.com"
        - "user2@company.com"
      
      # Environment-specific settings
      environments:
        development:
          enabled: true
          rollout_percentage: 100
        staging:
          enabled: true
          rollout_percentage: 50
        production:
          enabled: false
          rollout_percentage: 0
```

## Environment-Specific Configuration

### Development Environment

```yaml
assistant:
  contextual_chat:
    enabled: true
    extraction_timeout: 10000  # Longer timeout for debugging
    monitoring:
      log_level: "debug"
      log_extractions: true
      collect_metrics: true
    security:
      audit_access: true
```

### Production Environment

```yaml
assistant:
  contextual_chat:
    enabled: true
    extraction_timeout: 3000   # Shorter timeout for performance
    max_visualizations: 15     # Reduced for performance
    performance:
      max_concurrent_extractions: 3
      cache_memory_limit: 50
    monitoring:
      log_level: "warn"
      log_extractions: false
      collect_metrics: true
    security:
      respect_permissions: true
      audit_access: true
      sanitize_data: true
```

## Security Configuration

### Permission Integration

The contextual chat feature integrates with existing OpenSearch Dashboard security:

```yaml
assistant:
  contextual_chat:
    security:
      # Use existing role-based access control
      respect_permissions: true
      
      # Additional security validations
      validate_content_access: true
      
      # Audit configuration
      audit_access: true
      audit_retention_days: 90
      
      # Data sanitization rules
      sanitize_data: true
      sanitization_rules:
        - field_patterns: ["password", "secret", "token"]
          action: "redact"
        - field_patterns: ["email", "phone"]
          action: "mask"
```

### Content Filtering

Configure what content types are accessible:

```yaml
assistant:
  contextual_chat:
    content_filters:
      # Allow/deny specific content types
      allowed_content_types:
        - "visualization"
        - "data_table"
        - "text_panel"
      
      denied_content_types:
        - "sensitive_data"
      
      # Field-level filtering
      field_filters:
        exclude_patterns:
          - "*password*"
          - "*secret*"
          - "*token*"
        
        include_only:
          - "public_*"
          - "dashboard_*"
```

## Performance Tuning

### Memory Management

```yaml
assistant:
  contextual_chat:
    performance:
      # Cache configuration
      cache_memory_limit: 100  # MB
      cache_cleanup_interval: 300  # seconds
      
      # Extraction limits
      max_concurrent_extractions: 5
      extraction_queue_size: 20
      
      # Content size limits
      max_content_size_per_element: 1048576  # 1MB
      max_total_context_size: 10485760       # 10MB
```

### Optimization Settings

```yaml
assistant:
  contextual_chat:
    optimization:
      # Lazy loading configuration
      enable_lazy_loading: true
      lazy_load_threshold: 5  # elements
      
      # Content prioritization
      prioritize_visible_content: true
      content_relevance_scoring: true
      
      # DOM observation optimization
      dom_update_debounce: 250  # ms
      observe_only_active_tabs: true
```

## Monitoring Configuration

### Metrics Collection

```yaml
assistant:
  contextual_chat:
    monitoring:
      # Enable metrics collection
      collect_metrics: true
      
      # Metrics to collect
      metrics:
        - "extraction_time"
        - "context_size"
        - "cache_hit_rate"
        - "error_rate"
        - "user_engagement"
      
      # Metrics storage
      metrics_storage:
        type: "elasticsearch"  # or "file", "memory"
        index: "contextual_chat_metrics"
        retention_days: 30
```

### Alerting Configuration

```yaml
assistant:
  contextual_chat:
    alerting:
      # Enable alerting
      enabled: true
      
      # Alert thresholds
      thresholds:
        extraction_timeout_rate: 0.1    # 10% timeout rate
        error_rate: 0.05                # 5% error rate
        memory_usage: 0.8               # 80% memory usage
        response_time: 5000             # 5 second response time
      
      # Alert destinations
      destinations:
        - type: "email"
          recipients: ["admin@company.com"]
        - type: "slack"
          webhook: "https://hooks.slack.com/..."
```

## Deployment Configuration

### Rolling Deployment

```yaml
assistant:
  contextual_chat:
    deployment:
      # Gradual rollout strategy
      rollout_strategy: "percentage"
      rollout_percentage: 10  # Start with 10%
      rollout_increment: 10   # Increase by 10% each step
      rollout_interval: 3600  # 1 hour between increments
      
      # Health checks
      health_checks:
        enabled: true
        endpoint: "/api/assistant/contextual-chat/health"
        interval: 30  # seconds
        timeout: 5    # seconds
        
      # Rollback configuration
      auto_rollback:
        enabled: true
        error_threshold: 0.1    # 10% error rate
        timeout_threshold: 0.2  # 20% timeout rate
```

### Load Balancing

```yaml
assistant:
  contextual_chat:
    load_balancing:
      # Distribution strategy
      strategy: "round_robin"  # or "least_connections", "weighted"
      
      # Node configuration
      nodes:
        - id: "node1"
          weight: 1
          max_connections: 100
        - id: "node2"
          weight: 2
          max_connections: 200
      
      # Circuit breaker
      circuit_breaker:
        enabled: true
        failure_threshold: 5
        recovery_timeout: 30000  # 30 seconds
```

## Troubleshooting Configuration

### Debug Settings

```yaml
assistant:
  contextual_chat:
    debug:
      # Enable debug mode
      enabled: false
      
      # Debug logging
      log_level: "debug"
      log_extractions: true
      log_context_changes: true
      
      # Debug endpoints
      enable_debug_endpoints: false
      debug_endpoint_auth: "admin_only"
      
      # Performance profiling
      enable_profiling: false
      profiling_sample_rate: 0.1  # 10% of requests
```

### Error Handling

```yaml
assistant:
  contextual_chat:
    error_handling:
      # Retry configuration
      max_retries: 3
      retry_delay: 1000  # ms
      exponential_backoff: true
      
      # Fallback behavior
      fallback_to_standard_chat: true
      fallback_timeout: 2000  # ms
      
      # Error reporting
      report_errors: true
      error_sampling_rate: 1.0  # Report all errors
```

## Configuration Validation

### Validation Rules

The system validates configuration on startup:

```yaml
assistant:
  contextual_chat:
    validation:
      # Strict validation mode
      strict_mode: true
      
      # Required fields validation
      require_all_fields: false
      
      # Value range validation
      validate_ranges: true
      
      # Configuration schema validation
      validate_schema: true
```

### Configuration Testing

Test configuration before deployment:

```bash
# Validate configuration
npm run validate-config

# Test configuration with sample data
npm run test-config -- --config-file=config/test.yml

# Dry run deployment
npm run deploy -- --dry-run --config-file=config/production.yml
```

## Best Practices

### Security Best Practices

1. **Always enable permission validation** in production
2. **Use audit logging** for compliance requirements
3. **Configure data sanitization** for sensitive environments
4. **Limit context retention time** to minimize data exposure
5. **Use HTTPS** for all contextual chat communications

### Performance Best Practices

1. **Start with conservative limits** and increase gradually
2. **Monitor memory usage** and adjust cache limits
3. **Use lazy loading** for large dashboards
4. **Enable content prioritization** to focus on relevant data
5. **Configure appropriate timeouts** for your environment

### Operational Best Practices

1. **Use feature flags** for gradual rollouts
2. **Monitor key metrics** continuously
3. **Set up alerting** for critical thresholds
4. **Test configuration changes** in staging first
5. **Have rollback procedures** ready

## Configuration Examples

### Small Deployment (< 100 users)

```yaml
assistant:
  contextual_chat:
    enabled: true
    max_visualizations: 10
    context_cache_ttl: 600
    performance:
      max_concurrent_extractions: 3
      cache_memory_limit: 50
```

### Large Deployment (> 1000 users)

```yaml
assistant:
  contextual_chat:
    enabled: true
    max_visualizations: 25
    context_cache_ttl: 300
    performance:
      max_concurrent_extractions: 10
      cache_memory_limit: 200
    monitoring:
      collect_metrics: true
      metrics_interval: 30
```

### High Security Environment

```yaml
assistant:
  contextual_chat:
    enabled: true
    security:
      respect_permissions: true
      audit_access: true
      sanitize_data: true
      max_retention_hours: 1
    content_filters:
      allowed_content_types:
        - "visualization"
        - "text_panel"
```