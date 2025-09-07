/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { ConfigSchema } from '../../../common/types/config';
import { ChatService } from './chat_service';
import { IMessage } from '../../../common/types/chat_saved_object_attributes';
import { ContextualPromptBuilder } from './contextual_prompt_builder';
import { ContextualResponseProcessor } from './contextual_response_processor';

/**
 * Contextual Chat Service - Snapshot-based approach
 * 
 * This service wraps a base chat service and adds contextual capabilities
 * using snapshot-based context extraction instead of continuous monitoring.
 */
export class ContextualChatService implements ChatService {
  constructor(
    private baseChatService: ChatService,
    private promptBuilder: ContextualPromptBuilder,
    private responseProcessor: ContextualResponseProcessor,
    private logger: Logger,
    private config: {
      enabled: boolean;
      contextTimeout: number;
      enableStandardChatFallback: boolean;
      maxRetryAttempts: number;
      retryBackoffMs: number;
      fallbackToStandard: boolean;
    }
  ) {}

  /**
   * Send a message with contextual enhancement
   */
  async sendMessage(
    messages: IMessage[],
    conversationId?: string,
    context?: any
  ): Promise<{ messages: IMessage[]; interactions: any[] }> {
    if (!this.config.enabled) {
      return this.baseChatService.sendMessage(messages, conversationId, context);
    }

    try {
      // Extract context from the provided context parameter (snapshot-based)
      let enhancedMessages = messages;
      
      if (context && context.uiContext) {
        this.logger.debug('Enhancing messages with UI context');
        enhancedMessages = await this.promptBuilder.enhanceMessagesWithContext(
          messages,
          context.uiContext
        );
      }

      // Send enhanced messages to base service
      const response = await this.baseChatService.sendMessage(
        enhancedMessages,
        conversationId,
        context
      );

      // Process response with contextual information
      const processedResponse = await this.responseProcessor.processResponse(
        response,
        context?.uiContext
      );

      return processedResponse;

    } catch (error) {
      this.logger.error('Error in contextual chat service:', error);
      
      if (this.config.fallbackToStandard) {
        this.logger.info('Falling back to standard chat service');
        return this.baseChatService.sendMessage(messages, conversationId, context);
      }
      
      throw error;
    }
  }

  /**
   * Process streaming response with contextual enhancement
   */
  async processStreamingResponse(
    messages: IMessage[],
    conversationId: string,
    context?: any
  ): Promise<any> {
    if (!this.config.enabled) {
      return this.baseChatService.processStreamingResponse(messages, conversationId, context);
    }

    try {
      // Extract context from the provided context parameter (snapshot-based)
      let enhancedMessages = messages;
      
      if (context && context.uiContext) {
        this.logger.debug('Enhancing streaming messages with UI context');
        enhancedMessages = await this.promptBuilder.enhanceMessagesWithContext(
          messages,
          context.uiContext
        );
      }

      // Process streaming with base service
      return this.baseChatService.processStreamingResponse(
        enhancedMessages,
        conversationId,
        context
      );

    } catch (error) {
      this.logger.error('Error in contextual streaming chat service:', error);
      
      if (this.config.fallbackToStandard) {
        this.logger.info('Falling back to standard streaming chat service');
        return this.baseChatService.processStreamingResponse(messages, conversationId, context);
      }
      
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): { enabled: boolean; contextual: boolean } {
    return {
      enabled: true,
      contextual: this.config.enabled
    };
  }
}