# OpenSearch AI Agent Integration - Implementation Summary

This document summarizes the changes made to integrate the OpenSearch Dashboards Assistant plugin with the OpenSearch AI Agent REST API.

## Overview

The Olly Chat Service has been completely refactored to use the OpenSearch AI Agent REST API instead of the legacy ML Commons API. This provides enhanced capabilities, better error handling, and improved user experience.

## Key Changes

### 1. Updated OllyChatService (`server/services/chat/olly_chat_service.ts`)

**Major Changes:**
- Replaced ML Commons API calls with OpenSearch AI Agent REST API calls
- Added comprehensive error handling and fallback responses
- Implemented health checking for the AI Agent service
- Added support for root cause analysis queries
- Enhanced response formatting with source attribution

**New Features:**
- **Health Monitoring**: Automatic health checks of the AI Agent service
- **Root Cause Analysis**: Automatic detection and routing of root cause queries
- **Enhanced Error Handling**: Graceful degradation when services are unavailable
- **Source Attribution**: Proper formatting of source documents in responses
- **Circuit Breaker Pattern**: Prevents cascading failures

### 2. Configuration Updates

**Config Schema (`common/types/config.ts`):**
```typescript
aiAgent: schema.object({
  enabled: schema.boolean({ defaultValue: true }),
  baseUrl: schema.string({ defaultValue: 'http://localhost:8000' }),
  timeout: schema.number({ defaultValue: 300000 }), // 5 minutes
  healthCheckInterval: schema.number({ defaultValue: 60000 }), // 1 minute
}),
```

**Constants (`server/utils/constants.ts`):**
- Added AI Agent endpoint constants
- Maintained backward compatibility with existing ML Commons constants

### 3. Route Updates (`server/routes/chat_routes.ts`)

**Changes:**
- Updated `createChatService` to pass AI Agent configuration
- Modified method calls to include required context parameter
- Enhanced error handling in route handlers

### 4. Plugin Configuration (`server/index.ts`)

**Changes:**
- Exposed `aiAgent` configuration to browser
- Updated plugin descriptor to include new configuration options

### 5. Test Updates (`server/services/chat/olly_chat_service.test.ts`)

**Complete Rewrite:**
- Replaced ML Commons mocks with fetch mocks for REST API calls
- Added tests for health checking
- Added tests for root cause analysis
- Added tests for error handling scenarios
- Improved test coverage for new functionality

## API Integration

### OpenSearch AI Agent Endpoints Used

1. **Health Check**: `GET /api/v1/health`
   - Used to verify service availability
   - Called before each request to ensure service is healthy

2. **Chat**: `POST /api/v1/chat`
   - Main chat interface for natural language queries
   - Supports session management and source attribution

3. **Root Cause Analysis**: `POST /api/v1/root-cause`
   - Specialized endpoint for system issue analysis
   - Automatically triggered for relevant queries

### Request/Response Flow

1. **Health Check**: Service availability is verified
2. **Query Classification**: Determines if query is for chat or root cause analysis
3. **API Call**: Makes appropriate REST API call to AI Agent service
4. **Response Processing**: Converts AI Agent response to dashboard format
5. **Error Handling**: Provides fallback responses if service is unavailable

## Error Handling Strategy

### Graceful Degradation
- Service unavailable: Informative error messages
- Request timeouts: Proper timeout handling with user feedback
- Network errors: Fallback responses with retry suggestions

### Circuit Breaker Pattern
- Prevents overwhelming failing services
- Automatic recovery when service becomes available
- Maintains abort controllers for request cancellation

### Fallback Responses
- Structured error messages with recovery suggestions
- Maintains conversation context even during errors
- Provides helpful troubleshooting information

## Configuration Examples

### Development Environment
```yaml
assistantDashboards.aiAgent.enabled: true
assistantDashboards.aiAgent.baseUrl: "http://localhost:8000"
assistantDashboards.aiAgent.timeout: 300000
```

### Production Environment
```yaml
assistantDashboards.aiAgent.enabled: true
assistantDashboards.aiAgent.baseUrl: "https://ai-agent.your-domain.com"
assistantDashboards.aiAgent.timeout: 300000
assistantDashboards.aiAgent.healthCheckInterval: 30000
```

### Docker Environment
```yaml
assistantDashboards.aiAgent.enabled: true
assistantDashboards.aiAgent.baseUrl: "http://opensearch-ai-agent:8000"
```

## Root Cause Analysis Features

### Automatic Detection
Queries containing these keywords are automatically routed to root cause analysis:
- "root cause"
- "analyze issue"
- "troubleshoot"
- "diagnose problem"
- "investigate error"
- "find cause"
- "system issue"
- "performance problem"
- "error analysis"
- "incident analysis"

### Structured Output
Root cause analysis provides:
- **Findings**: Categorized issues with confidence scores
- **Evidence**: Supporting data for each finding
- **Recommendations**: Actionable steps to resolve issues
- **Metrics**: Analysis time, events analyzed, correlations found

## Backward Compatibility

### Migration Strategy
- Configuration is additive (existing ML Commons config still works)
- Gradual migration path available
- Fallback to error messages if AI Agent is not configured

### Legacy Support
- ML Commons constants maintained for backward compatibility
- Existing conversation data remains accessible
- No breaking changes to existing APIs

## Performance Considerations

### Optimizations
- Health checks cached to reduce overhead
- Request timeouts prevent hanging requests
- Abort controllers allow request cancellation
- Circuit breaker prevents cascading failures

### Monitoring
- Comprehensive logging for troubleshooting
- Request/response time tracking
- Error rate monitoring
- Service health status tracking

## Security Considerations

### Network Security
- Configurable base URL for different environments
- Support for HTTPS endpoints
- Timeout controls prevent resource exhaustion

### Error Information
- Sanitized error messages to prevent information leakage
- Structured error responses for better debugging
- Request ID tracking for audit trails

## Future Enhancements

### Planned Features
1. **Authentication Support**: API key and JWT token support
2. **Load Balancing**: Multiple AI Agent endpoint support
3. **Caching**: Response caching for improved performance
4. **Metrics Dashboard**: Real-time monitoring interface
5. **Advanced Configuration**: Per-user or per-tenant settings

### Extension Points
- Plugin architecture for custom message parsers
- Configurable query classification rules
- Custom error handling strategies
- Pluggable authentication methods

## Documentation

### User Documentation
- [AI Agent Integration Guide](AI_AGENT_INTEGRATION.md): Complete setup and configuration guide
- [Configuration Example](config.example.yml): Sample configuration file
- Updated README with integration information

### Developer Documentation
- Comprehensive code comments
- Updated test suite with full coverage
- API integration examples
- Troubleshooting guide

## Testing

### Test Coverage
- Unit tests for all new functionality
- Integration tests for API calls
- Error handling test scenarios
- Mock implementations for development

### Test Categories
1. **Happy Path**: Normal operation scenarios
2. **Error Handling**: Service unavailable, timeouts, network errors
3. **Root Cause Analysis**: Specialized query handling
4. **Configuration**: Different configuration scenarios
5. **Performance**: Timeout and abort handling

This implementation provides a robust, scalable, and maintainable integration with the OpenSearch AI Agent REST API while maintaining backward compatibility and providing enhanced user experience.