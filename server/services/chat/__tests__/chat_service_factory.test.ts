/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatServiceFactory } from '../chat_service_factory';
import { ConfigSchema } from '../../../../common/types/config';

describe('ChatServiceFactory', () => {
  let mockLogger: any;
  let mockOpenSearchTransport: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockOpenSearchTransport = {};
  });

  it('should create OllyChatService when aiAgent is disabled', () => {
    const config: ConfigSchema = {
      enabled: true,
      chat: { enabled: true, trace: true, feedback: true, allowRenameConversation: true, deleteConversation: true, regenerateMessage: true, showConversationHistory: true },
      incontextInsight: { enabled: true },
      next: { enabled: false },
      text2viz: { enabled: false },
      alertInsight: { enabled: false },
      smartAnomalyDetector: { enabled: false },
      contextualChat: { enabled: false, maxVisualizations: 20, contextCacheTTL: 300, extractionTimeout: 5000, security: { respectPermissions: true, auditAccess: true }, performance: { debounceMs: 500, maxContentElements: 50, enableLazyLoading: true } },
      aiAgent: { enabled: false, baseUrl: 'http://localhost:8000', timeout: 300000, healthCheckInterval: 60000 },
      branding: {}
    };

    const service = ChatServiceFactory.create(config, mockOpenSearchTransport, mockLogger);

    expect(service).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith('Using ML-Commons (Olly) chat service');
  });

  it('should create OpenSearchAgentsChatService when aiAgent is enabled', () => {
    const config: ConfigSchema = {
      enabled: true,
      chat: { enabled: true, trace: true, feedback: true, allowRenameConversation: true, deleteConversation: true, regenerateMessage: true, showConversationHistory: true },
      incontextInsight: { enabled: true },
      next: { enabled: false },
      text2viz: { enabled: false },
      alertInsight: { enabled: false },
      smartAnomalyDetector: { enabled: false },
      contextualChat: { enabled: false, maxVisualizations: 20, contextCacheTTL: 300, extractionTimeout: 5000, security: { respectPermissions: true, auditAccess: true }, performance: { debounceMs: 500, maxContentElements: 50, enableLazyLoading: true } },
      aiAgent: { enabled: true, baseUrl: 'http://localhost:8000', timeout: 300000, healthCheckInterval: 60000 },
      branding: {}
    };

    const service = ChatServiceFactory.create(config, mockOpenSearchTransport, mockLogger);

    expect(service).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith('Using OpenSearch-Agents chat service');
  });

  it('should wrap with contextual chat service when contextualChat is enabled', () => {
    const config: ConfigSchema = {
      enabled: true,
      chat: { enabled: true, trace: true, feedback: true, allowRenameConversation: true, deleteConversation: true, regenerateMessage: true, showConversationHistory: true },
      incontextInsight: { enabled: true },
      next: { enabled: false },
      text2viz: { enabled: false },
      alertInsight: { enabled: false },
      smartAnomalyDetector: { enabled: false },
      contextualChat: { enabled: true, maxVisualizations: 20, contextCacheTTL: 300, extractionTimeout: 5000, security: { respectPermissions: true, auditAccess: true }, performance: { debounceMs: 500, maxContentElements: 50, enableLazyLoading: true } },
      aiAgent: { enabled: false, baseUrl: 'http://localhost:8000', timeout: 300000, healthCheckInterval: 60000 },
      branding: {}
    };

    const service = ChatServiceFactory.create(config, mockOpenSearchTransport, mockLogger);

    expect(service).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith('Using ML-Commons (Olly) chat service');
    expect(mockLogger.info).toHaveBeenCalledWith('Contextual chat is enabled, wrapping base service with contextual capabilities');
    expect(mockLogger.info).toHaveBeenCalledWith('Contextual chat service initialized successfully');
  });

  it('should fallback to base service if contextual chat initialization fails', () => {
    const config: ConfigSchema = {
      enabled: true,
      chat: { enabled: true, trace: true, feedback: true, allowRenameConversation: true, deleteConversation: true, regenerateMessage: true, showConversationHistory: true },
      incontextInsight: { enabled: true },
      next: { enabled: false },
      text2viz: { enabled: false },
      alertInsight: { enabled: false },
      smartAnomalyDetector: { enabled: false },
      contextualChat: { enabled: true, maxVisualizations: 20, contextCacheTTL: 300, extractionTimeout: 5000, security: { respectPermissions: true, auditAccess: true }, performance: { debounceMs: 500, maxContentElements: 50, enableLazyLoading: true } },
      aiAgent: { enabled: false, baseUrl: 'http://localhost:8000', timeout: 300000, healthCheckInterval: 60000 },
      branding: {}
    };

    // Mock ContentPrioritizer to throw an error
    jest.doMock('../content_prioritizer', () => {
      return {
        ContentPrioritizer: jest.fn().mockImplementation(() => {
          throw new Error('Mock initialization error');
        })
      };
    });

    const service = ChatServiceFactory.create(config, mockOpenSearchTransport, mockLogger);

    expect(service).toBeDefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to initialize contextual chat service, falling back to base service:',
      expect.any(Error)
    );
  });
});