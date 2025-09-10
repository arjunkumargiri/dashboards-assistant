/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenSearchClient } from '../../../../../src/core/server';
import { IMessage, IInteraction } from '../../../common/types/chat_saved_object_attributes';
import { AgentFrameworkStorageService } from './agent_framework_storage_service';

/**
 * Storage service for OpenSearch-Agents integration.
 * Disables memory-related features since OpenSearch-Agents handles conversation management internally.
 */
export class OpenSearchAgentsStorageService extends AgentFrameworkStorageService {
  constructor(
    opensearchClientTransport: OpenSearchClient['transport'],
    messageParsers: any,
    private readonly logger: any
  ) {
    super(opensearchClientTransport, messageParsers);
  }

  /**
   * Override getConversation to return minimal conversation data
   * since OpenSearch-Agents manages conversations internally
   */
  async getConversation(
    conversationId: string
  ): Promise<{
    id: string;
    title: string;
    messages: IMessage[];
    interactions: IInteraction[];
  }> {
    this.logger.debug('OpenSearch-Agents mode: returning minimal conversation data');

    return {
      id: conversationId,
      title: 'OpenSearch-Agents Conversation',
      messages: [],
      interactions: [],
    };
  }

  /**
   * Override getConversations to return empty list
   * since conversation history is disabled in OpenSearch-Agents mode
   */
  async getConversations(options: any): Promise<{ objects: any[]; total: number }> {
    this.logger.debug('OpenSearch-Agents mode: conversation history disabled');

    return {
      objects: [],
      total: 0,
    };
  }

  /**
   * Override getInteraction to return minimal interaction data
   */
  async getInteraction(conversationId: string, interactionId: string): Promise<IInteraction> {
    this.logger.debug('OpenSearch-Agents mode: returning minimal interaction data');

    return {
      conversation_id: conversationId,
      interaction_id: interactionId,
      create_time: new Date().toISOString(),
      input: 'OpenSearch-Agents managed interaction',
      response: 'Response handled by OpenSearch-Agents',
      origin: 'OpenSearchAgents',
      feedback: null,
    };
  }

  /**
   * Override deleteConversation to be a no-op
   * since conversations are managed by OpenSearch-Agents
   */
  async deleteConversation(conversationId: string): Promise<{ success: boolean }> {
    this.logger.debug('OpenSearch-Agents mode: conversation deletion not supported');

    return { success: true };
  }

  /**
   * Override updateConversation to be a no-op
   * since conversations are managed by OpenSearch-Agents
   */
  async updateConversation(conversationId: string, title: string): Promise<{ success: boolean }> {
    this.logger.debug('OpenSearch-Agents mode: conversation updates not supported');

    return { success: true };
  }

  /**
   * Override getTraces to return empty traces
   * since tracing is handled differently in OpenSearch-Agents
   */
  async getTraces(interactionId: string): Promise<any[]> {
    this.logger.debug('OpenSearch-Agents mode: traces not available');

    return [];
  }

  /**
   * Override updateInteraction to handle feedback differently
   */
  async updateInteraction(interactionId: string, updateBody: any): Promise<{ success: boolean }> {
    this.logger.debug('OpenSearch-Agents mode: interaction feedback logged but not persisted');

    // Log feedback for monitoring purposes but don't persist to OpenSearch
    if (updateBody.feedback) {
      this.logger.info(`Feedback received for interaction ${interactionId}:`, updateBody.feedback);
    }

    return { success: true };
  }
}
