# OpenSearch AI Agent Integration

This document describes how to configure and use the OpenSearch AI Agent REST API integration with the OpenSearch Dashboards Assistant plugin.

## Overview

The Dashboards Assistant plugin has been updated to use the OpenSearch AI Agent REST API instead of the legacy ML Commons API. This provides enhanced capabilities including:

- **Chat Agent**: Natural language interface for OpenSearch data queries
- **Root Cause Analysis**: Automated analysis of system issues and problems
- **Health Monitoring**: Real-time health checks and agent status
- **Enhanced Error Handling**: Graceful degradation and fallback responses

## Configuration

### OpenSearch Dashboards Configuration

Add the following configuration to your `opensearch_dashboards.yml` file:

```yaml
# Enable the assistant plugin
assistant.chat.enabled: true

# Configure AI Agent integration
assistant.aiAgent.enabled: true
assistant.aiAgent.baseUrl: "http://localhost:8000"
assistant.aiAgent.timeout: 300000  # 5 minutes
assistant.aiAgent.healthCheckInterval: 60000  # 1 minute
```

### OpenSearch AI Agent Setup

1. **Install and Start the OpenSearch AI Agent**:
   ```bash
   # Clone the OpenSearch AI Agents repository
   git clone https://github.com/your-org/opensearch-ai-agents.git
   cd opensearch-ai-agents
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Configure environment variables
   cp .env.example .env
   # Edit .env with your OpenSearch connection details
   
   # Start the AI Agent server
   python -m uvicorn src.opensearch_ai_agents.api.server:create_app --host 0.0.0.0 --port 8000
   ```

2. **Verify the AI Agent is Running**:
   ```bash
   curl http://localhost:8000/api/v1/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "version": "1.0.0",
     "timestamp": "2024-01-15T10:30:00Z",
     "components": {
       "agent_chat": "healthy",
       "agent_root_cause": "healthy",
       "manager": "healthy",
       "opensearch": "healthy"
     }
   }
   ```

## Features

### Chat Agent

The chat agent provides a conversational interface for querying OpenSearch data:

- **Natural Language Queries**: Ask questions in plain English
- **Context Awareness**: Maintains conversation context across multiple queries
- **Source Attribution**: Shows which documents were used to generate responses
- **Confidence Scoring**: Provides confidence levels for responses

Example queries:
- "Show me error logs from the last hour"
- "What are the most common errors in my application?"
- "Find logs containing timeout errors"

### Root Cause Analysis

The system automatically detects root cause analysis requests and routes them to the specialized root cause agent:

- **Automatic Detection**: Queries containing keywords like "root cause", "analyze issue", "troubleshoot" are automatically routed
- **Structured Analysis**: Provides structured findings with evidence and recommendations
- **Time-based Analysis**: Analyzes patterns over specified time windows
- **Correlation Detection**: Identifies correlations between different events

Example queries:
- "Analyze the root cause of performance issues"
- "Investigate the database connection errors"
- "Troubleshoot the recent system outage"

### Health Monitoring

The integration includes comprehensive health monitoring:

- **Service Health Checks**: Automatic health checks of the AI Agent service
- **Graceful Degradation**: Falls back to error messages when the service is unavailable
- **Circuit Breaker Pattern**: Prevents cascading failures
- **Request Timeout Handling**: Proper timeout handling for long-running requests

## API Endpoints

The OpenSearch AI Agent provides the following REST API endpoints:

### Chat Endpoint
```
POST /api/v1/chat
```

Request body:
```json
{
  "query": "Show me recent error logs",
  "session_id": "optional-session-id",
  "include_sources": true,
  "max_results": 10
}
```

### Root Cause Analysis Endpoint
```
POST /api/v1/root-cause
```

Request body:
```json
{
  "problem_description": "Database connection pool exhaustion",
  "timeframe": {
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T10:00:00Z"
  },
  "severity": "high",
  "max_findings": 10
}
```

### Health Check Endpoint
```
GET /api/v1/health
```

### Agent Status Endpoint
```
GET /api/v1/agents/status
```

## Error Handling

The integration includes comprehensive error handling:

1. **Service Unavailable**: When the AI Agent service is down, users receive informative error messages
2. **Request Timeouts**: Long-running requests are properly handled with appropriate timeouts
3. **Fallback Responses**: When errors occur, the system provides helpful fallback responses
4. **Circuit Breaker**: Prevents overwhelming a failing service with repeated requests

## Troubleshooting

### Common Issues

1. **AI Agent Service Not Available**
   - Check if the AI Agent service is running: `curl http://localhost:8000/api/v1/health`
   - Verify the `baseUrl` configuration in `opensearch_dashboards.yml`
   - Check the AI Agent service logs for errors

2. **Connection Timeouts**
   - Increase the `timeout` value in the configuration
   - Check network connectivity between OpenSearch Dashboards and the AI Agent service

3. **Authentication Errors**
   - Ensure the AI Agent service is configured with proper authentication if required
   - Check if API keys or JWT tokens are properly configured

4. **OpenSearch Connection Issues**
   - Verify the AI Agent service can connect to your OpenSearch cluster
   - Check the OpenSearch connection configuration in the AI Agent's `.env` file

### Logs

Check the following logs for troubleshooting:

1. **OpenSearch Dashboards Logs**: Look for messages related to the assistant plugin
2. **AI Agent Service Logs**: Check the AI Agent service output for errors
3. **OpenSearch Logs**: Verify OpenSearch is accessible and functioning properly

### Configuration Validation

Validate your configuration:

```bash
# Test the AI Agent health endpoint
curl http://localhost:8000/api/v1/health

# Test the chat endpoint
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'

# Check agent status
curl http://localhost:8000/api/v1/agents/status
```

## Migration from ML Commons

If you're migrating from the previous ML Commons integration:

1. **Backup Existing Conversations**: Export any important conversations before switching
2. **Update Configuration**: Replace ML Commons configuration with AI Agent configuration
3. **Test Functionality**: Verify that chat and analysis features work as expected
4. **Monitor Performance**: Check that response times and accuracy meet your requirements

The new AI Agent integration provides enhanced capabilities and better error handling compared to the legacy ML Commons integration.

## Support

For issues and questions:

1. Check the [OpenSearch AI Agents documentation](https://github.com/your-org/opensearch-ai-agents)
2. Review the [OpenSearch Dashboards Assistant plugin documentation](https://github.com/opensearch-project/dashboards-assistant)
3. File issues in the appropriate GitHub repository