/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Deployment Validation Tests for Contextual Dashboard Chat
 *
 * These tests validate that the contextual chat feature is properly deployed
 * and functioning correctly in the target environment.
 */

const axios = require('axios');
const { expect } = require('chai');
const { describe, it, before, after } = require('mocha');

describe('Contextual Dashboard Chat Deployment Validation', () => {
  let baseURL;
  let authToken;
  let testDashboardId;

  before(async () => {
    // Set up test environment
    baseURL = process.env.OPENSEARCH_DASHBOARDS_URL || 'http://localhost:5601';
    authToken = process.env.TEST_AUTH_TOKEN || (await getTestAuthToken());

    // Create test dashboard for validation
    testDashboardId = await createTestDashboard();
  });

  after(async () => {
    // Clean up test resources
    if (testDashboardId) {
      await cleanupTestDashboard(testDashboardId);
    }
  });

  describe('Service Health Checks', () => {
    it('should have contextual chat service available', async () => {
      const response = await axios.get(`${baseURL}/api/assistant/contextual-chat/health`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.status).to.equal('healthy');
      expect(response.data.services).to.include.all.keys([
        'context_service',
        'chat_service',
        'extraction_service',
      ]);
    });

    it('should have all required services running', async () => {
      const response = await axios.get(`${baseURL}/api/assistant/contextual-chat/health/detailed`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).to.equal(200);

      const services = response.data.services;
      expect(services.context_service.status).to.equal('running');
      expect(services.chat_service.status).to.equal('running');
      expect(services.extraction_service.status).to.equal('running');
      expect(services.dom_observer.status).to.equal('running');
    });

    it('should have proper configuration loaded', async () => {
      const response = await axios.get(`${baseURL}/api/assistant/contextual-chat/config`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.enabled).to.be.a('boolean');
      expect(response.data.max_visualizations).to.be.a('number');
      expect(response.data.extraction_timeout).to.be.a('number');
    });
  });

  describe('Feature Flag Validation', () => {
    it('should have feature flags properly configured', async () => {
      const response = await axios.get(`${baseURL}/api/assistant/feature-flags/contextual_chat`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('enabled');
      expect(response.data).to.have.property('rollout_percentage');
      expect(response.data.rollout_percentage).to.be.within(0, 100);
    });

    it('should respect environment-specific feature flag settings', async () => {
      const environment = process.env.NODE_ENV || 'development';

      const response = await axios.get(
        `${baseURL}/api/assistant/feature-flags/contextual_chat/environment/${environment}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).to.equal(200);

      // Validate environment-specific settings
      if (environment === 'production') {
        expect(response.data.rollout_percentage).to.be.at.most(100);
      } else if (environment === 'development') {
        expect(response.data.enabled).to.equal(true);
      }
    });
  });

  describe('Context Extraction Validation', () => {
    it('should extract context from test dashboard', async () => {
      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/extraction`,
        {
          dashboardId: testDashboardId,
          timeout: 10000,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).to.equal(200);
      expect(response.data.context).to.be.an('object');
      expect(response.data.context.content).to.be.an('array');
      expect(response.data.extraction_time).to.be.a('number');
      expect(response.data.extraction_time).to.be.below(5000); // Should complete within 5 seconds
    });

    it('should handle different content types', async () => {
      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/content-types`,
        {
          dashboardId: testDashboardId,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).to.equal(200);

      const contentTypes = response.data.detected_content_types;
      expect(contentTypes).to.be.an('array');
      expect(contentTypes).to.include.members(['visualization', 'text_panel']);
    });

    it('should respect user permissions during extraction', async () => {
      // Test with limited permission user
      const limitedToken = await getLimitedPermissionToken();

      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/extraction`,
        {
          dashboardId: testDashboardId,
        },
        {
          headers: {
            Authorization: `Bearer ${limitedToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).to.equal(200);

      // Should have fewer content elements due to permission restrictions
      const adminResponse = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/extraction`,
        {
          dashboardId: testDashboardId,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.data.context.content.length).to.be.at.most(
        adminResponse.data.context.content.length
      );
    });
  });

  describe('Chat Integration Validation', () => {
    it('should integrate context with chat requests', async () => {
      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/integration`,
        {
          message: 'What does this dashboard show?',
          dashboardId: testDashboardId,
          includeContext: true,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).to.equal(200);
      expect(response.data.response).to.be.a('string');
      expect(response.data.context_used).to.equal(true);
      expect(response.data.context_elements_count).to.be.a('number');
      expect(response.data.context_elements_count).to.be.above(0);
    });

    it('should fallback to standard chat when context unavailable', async () => {
      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/fallback`,
        {
          message: 'Hello, how are you?',
          simulateContextFailure: true,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).to.equal(200);
      expect(response.data.response).to.be.a('string');
      expect(response.data.context_used).to.equal(false);
      expect(response.data.fallback_used).to.equal(true);
    });
  });

  describe('Performance Validation', () => {
    it('should meet performance requirements for context extraction', async () => {
      const startTime = Date.now();

      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/performance`,
        {
          dashboardId: testDashboardId,
          iterations: 5,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(response.status).to.equal(200);
      expect(response.data.average_extraction_time).to.be.below(2000); // < 2 seconds
      expect(response.data.max_extraction_time).to.be.below(5000); // < 5 seconds
      expect(totalTime).to.be.below(30000); // Total test < 30 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          axios.post(
            `${baseURL}/api/assistant/contextual-chat/test/extraction`,
            {
              dashboardId: testDashboardId,
              requestId: i,
            },
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              },
            }
          )
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).to.equal(200);
        expect(response.data.context).to.be.an('object');
      });

      // Should handle concurrent requests efficiently
      const totalTime = endTime - startTime;
      expect(totalTime).to.be.below(15000); // < 15 seconds for 10 concurrent requests
    });

    it('should maintain acceptable memory usage', async () => {
      const response = await axios.get(`${baseURL}/api/assistant/contextual-chat/metrics/memory`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.current_memory_usage).to.be.a('number');
      expect(response.data.current_memory_usage).to.be.below(200 * 1024 * 1024); // < 200MB
      expect(response.data.memory_leak_detected).to.equal(false);
    });
  });

  describe('Security Validation', () => {
    it('should enforce authentication for all endpoints', async () => {
      try {
        await axios.get(`${baseURL}/api/assistant/contextual-chat/health`);
        expect.fail('Should have required authentication');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });

    it('should validate user permissions for context access', async () => {
      const unauthorizedToken = await getUnauthorizedToken();

      try {
        await axios.post(
          `${baseURL}/api/assistant/contextual-chat/test/extraction`,
          {
            dashboardId: testDashboardId,
          },
          {
            headers: {
              Authorization: `Bearer ${unauthorizedToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        expect.fail('Should have denied access');
      } catch (error) {
        expect(error.response.status).to.equal(403);
      }
    });

    it('should sanitize sensitive data in context', async () => {
      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/sanitization`,
        {
          dashboardId: testDashboardId,
          includeSensitiveData: true,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).to.equal(200);

      const contextString = JSON.stringify(response.data.context);

      // Should not contain sensitive patterns
      expect(contextString).to.not.match(/\b\d{3}-\d{2}-\d{4}\b/); // SSN
      expect(contextString).to.not.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/); // Credit Card
      expect(contextString).to.not.match(/password\s*[:=]\s*\S+/i); // Passwords
    });
  });

  describe('Error Handling Validation', () => {
    it('should handle extraction timeouts gracefully', async () => {
      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/timeout`,
        {
          dashboardId: testDashboardId,
          simulateTimeout: true,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).to.equal(200);
      expect(response.data.error).to.equal('extraction_timeout');
      expect(response.data.fallback_used).to.equal(true);
    });

    it('should handle malformed dashboard data', async () => {
      const response = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/malformed-data`,
        {
          dashboardId: 'invalid-dashboard-id',
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).to.equal(200);
      expect(response.data.error).to.equal('dashboard_not_found');
      expect(response.data.fallback_used).to.equal(true);
    });

    it('should recover from service failures', async () => {
      // Simulate service failure and recovery
      await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/simulate-failure`,
        {
          service: 'extraction_service',
          duration: 5000, // 5 seconds
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Verify service is recovered
      const response = await axios.get(`${baseURL}/api/assistant/contextual-chat/health`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.status).to.equal('healthy');
    });
  });

  describe('Monitoring and Alerting Validation', () => {
    it('should collect and expose metrics', async () => {
      const response = await axios.get(`${baseURL}/api/assistant/contextual-chat/metrics`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.metrics).to.be.an('object');
      expect(response.data.metrics).to.have.property('extraction_time');
      expect(response.data.metrics).to.have.property('error_rate');
      expect(response.data.metrics).to.have.property('memory_usage');
    });

    it('should trigger alerts for threshold violations', async () => {
      // Simulate high error rate
      await axios.post(
        `${baseURL}/api/assistant/contextual-chat/test/simulate-errors`,
        {
          errorRate: 0.15, // 15% error rate
          duration: 60000, // 1 minute
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Wait for alert to trigger
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Check if alert was triggered
      const response = await axios.get(`${baseURL}/api/assistant/contextual-chat/alerts/recent`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.alerts).to.be.an('array');
      expect(response.data.alerts.some((alert) => alert.type === 'high_error_rate')).to.equal(true);
    });
  });

  describe('Rollback Mechanism Validation', () => {
    it('should support emergency disable', async () => {
      // Test emergency disable
      const disableResponse = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/emergency-disable`,
        {
          reason: 'Deployment validation test',
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(disableResponse.status).to.equal(200);

      // Verify feature is disabled
      const statusResponse = await axios.get(`${baseURL}/api/assistant/contextual-chat/status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(statusResponse.data.enabled).to.equal(false);

      // Re-enable for other tests
      await axios.post(
        `${baseURL}/api/assistant/contextual-chat/enable`,
        {
          reason: 'Re-enabling after test',
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should support gradual rollback', async () => {
      // Test gradual rollback
      const rollbackResponse = await axios.post(
        `${baseURL}/api/assistant/contextual-chat/rollback`,
        {
          strategy: 'gradual',
          targetPercentage: 25,
          reason: 'Deployment validation test',
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(rollbackResponse.status).to.equal(200);

      // Verify rollout percentage is reduced
      const flagResponse = await axios.get(
        `${baseURL}/api/assistant/feature-flags/contextual_chat`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(flagResponse.data.rollout_percentage).to.equal(25);

      // Restore full rollout
      await axios.post(
        `${baseURL}/api/assistant/feature-flags/contextual_chat/update`,
        {
          rollout_percentage: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    });
  });
});

// Helper functions
async function getTestAuthToken() {
  // Implementation depends on authentication system
  // This is a placeholder
  return 'test-auth-token';
}

async function getLimitedPermissionToken() {
  // Get token for user with limited permissions
  return 'limited-permission-token';
}

async function getUnauthorizedToken() {
  // Get token for unauthorized user
  return 'unauthorized-token';
}

async function createTestDashboard() {
  // Create a test dashboard with various visualizations
  // Return dashboard ID
  return 'test-dashboard-id';
}

async function cleanupTestDashboard(dashboardId) {
  // Clean up test dashboard
  console.log(`Cleaning up test dashboard: ${dashboardId}`);
}

module.exports = {
  // Export test functions for use in other test files
  getTestAuthToken,
  createTestDashboard,
  cleanupTestDashboard,
};
