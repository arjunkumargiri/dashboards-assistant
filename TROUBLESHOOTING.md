# OpenSearch AI Agent Integration - Troubleshooting Guide

## Common Error: "Memory [ID] not found"

### Error Message
```
resource_not_found_exception: [resource_not_found_exception] Reason: Memory [777ccba4-4e26-4ac1-88b2-b25f8c26f3e5] not found
```

### Root Cause
This error indicates that the system is still trying to use the **old ML Commons Agent Framework API** instead of the new **OpenSearch AI Agent REST API**. This typically happens when:

1. The AI Agent integration is not properly configured
2. The AI Agent service is not running or accessible
3. The configuration hasn't been updated after the integration

### Solution Steps

#### 1. Check OpenSearch Dashboards Configuration

Verify your `opensearch_dashboards.yml` file contains the AI Agent configuration:

```yaml
# Enable the assistant plugin
assistantDashboards.chat.enabled: true

# Enable AI Agent integration (this is crucial!)
assistantDashboards.aiAgent.enabled: true
assistantDashboards.aiAgent.baseUrl: "http://localhost:8000"
assistantDashboards.aiAgent.timeout: 300000
assistantDashboards.aiAgent.healthCheckInterval: 60000
```

#### 2. Start the OpenSearch AI Agent Service

The AI Agent service must be running before using the chat feature:

```bash
# Navigate to the OpenSearch AI Agents directory
cd OpenSearch-Agents

# Install dependencies (if not already done)
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your OpenSearch connection details

# Start the AI Agent server
python -m uvicorn src.opensearch_ai_agents.api.server:create_app --host 0.0.0.0 --port 8000
```

#### 3. Verify AI Agent Service is Running

Test the AI Agent service health:

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

#### 4. Test AI Agent Chat Endpoint

Test the chat functionality directly:

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'
```

#### 5. Restart OpenSearch Dashboards

After updating the configuration, restart OpenSearch Dashboards:

```bash
# Stop OpenSearch Dashboards
# Start OpenSearch Dashboards with the new configuration
```

#### 6. Clear Browser Cache

Clear your browser cache and cookies for the OpenSearch Dashboards site to ensure the new configuration is loaded.

### Configuration Examples

#### Development Environment
```yaml
assistantDashboards.aiAgent.enabled: true
assistantDashboards.aiAgent.baseUrl: "http://localhost:8000"
```

#### Docker Environment
```yaml
assistantDashboards.aiAgent.enabled: true
assistantDashboards.aiAgent.baseUrl: "http://opensearch-ai-agent:8000"
```

#### Production Environment
```yaml
assistantDashboards.aiAgent.enabled: true
assistantDashboards.aiAgent.baseUrl: "https://ai-agent.your-domain.com"
assistantDashboards.aiAgent.timeout: 300000
```

### Verification Steps

1. **Check Configuration Loading**:
   - Look for AI Agent configuration in OpenSearch Dashboards startup logs
   - Verify no configuration errors are reported

2. **Test Service Connectivity**:
   ```bash
   # From the OpenSearch Dashboards server, test connectivity
   curl http://localhost:8000/api/v1/health
   ```

3. **Check Network Connectivity**:
   - Ensure OpenSearch Dashboards can reach the AI Agent service
   - Check firewall rules and network policies
   - Verify DNS resolution if using hostnames

4. **Review Logs**:
   - OpenSearch Dashboards logs for configuration and connection errors
   - AI Agent service logs for request processing
   - OpenSearch cluster logs for connectivity issues

### Advanced Troubleshooting

#### Enable Debug Logging

Add debug logging to your OpenSearch Dashboards configuration:

```yaml
logging.loggers:
  - name: plugins.assistantDashboards
    level: debug
    appenders: [default]
```

#### Check Plugin Loading

Verify the assistant plugin is loaded correctly:

1. Check OpenSearch Dashboards startup logs for plugin loading messages
2. Verify the plugin appears in the OpenSearch Dashboards plugins list
3. Check for any plugin initialization errors

#### Network Diagnostics

If connectivity issues persist:

```bash
# Test network connectivity
telnet localhost 8000

# Check if the port is listening
netstat -tlnp | grep 8000

# Test DNS resolution (if using hostnames)
nslookup your-ai-agent-hostname
```

### Error Messages and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Memory [ID] not found" | Using old ML Commons API | Configure AI Agent integration |
| "AI Agent service is not available" | Service not running | Start the AI Agent service |
| "Connection refused" | Network connectivity issue | Check network configuration |
| "Configuration not found" | Missing configuration | Add AI Agent configuration |
| "Health check failed" | Service unhealthy | Check AI Agent service logs |

### Migration from ML Commons

If you're migrating from the old ML Commons integration:

1. **Backup existing conversations** (optional)
2. **Update configuration** to use AI Agent
3. **Start AI Agent service**
4. **Test functionality**
5. **Monitor for issues**

### Getting Help

If you continue to experience issues:

1. **Check the logs** for detailed error messages
2. **Review the configuration** against the examples
3. **Test each component** individually (AI Agent, OpenSearch, Dashboards)
4. **Consult the documentation**:
   - [AI Agent Integration Guide](AI_AGENT_INTEGRATION.md)
   - [Implementation Summary](IMPLEMENTATION_SUMMARY.md)
5. **File an issue** with:
   - Configuration details
   - Error messages
   - Log excerpts
   - Steps to reproduce

### Quick Fix Checklist

- [ ] AI Agent service is running (`curl http://localhost:8000/api/v1/health`)
- [ ] Configuration includes `assistantDashboards.aiAgent.enabled: true`
- [ ] Configuration includes correct `assistantDashboards.aiAgent.baseUrl`
- [ ] OpenSearch Dashboards has been restarted after configuration changes
- [ ] Browser cache has been cleared
- [ ] Network connectivity between Dashboards and AI Agent is working
- [ ] OpenSearch cluster is accessible from the AI Agent service

Following these steps should resolve the "Memory not found" error and enable the AI Agent integration.