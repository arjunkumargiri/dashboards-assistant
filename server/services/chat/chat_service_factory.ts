/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenSearchClient } from '../../../../../src/core/server';
import { ConfigSchema } from '../../../common/types/config';
import { ChatService } from './chat_service';
import { OllyChatService } from './olly_chat_service';
import { OpenSearchAgentsChatService } from './opensearch_agents_chat_service';
import { ContextualChatService } from './contextual_chat_service';
import { ContextualPromptBuilder } from './contextual_prompt_builder';
import { ContextualResponseProcessor } from './contextual_response_processor';
import { ContentPrioritizer } from './content_prioritizer';

export class ChatServiceFactory {
  static create(
    config: ConfigSchema,
    opensearchClientTransport: OpenSearchClient['transport'],
    logger: any
  ): ChatService {
    // Create the base chat service
    let baseChatService: ChatService;

    if (config.aiAgent.enabled) {
      logger.info('Using OpenSearch-Agents chat service');
      baseChatService = new OpenSearchAgentsChatService(config.aiAgent, logger);
    } else {
      logger.info('Using ML-Commons (Olly) chat service');
      baseChatService = new OllyChatService(opensearchClientTransport);
    }

    // Wrap with contextual chat service if enabled
    if (config.contextualChat?.enabled) {
      logger.info('Contextual chat is enabled, wrapping base service with contextual capabilities');

      try {
        // Create contextual chat components
        const contentPrioritizerConfig = {
          enableSemanticScoring: true,
          keywordWeights: {
            chart: 2,
            graph: 2,
            table: 2,
            data: 1.5,
            visualization: 2,
            metric: 2,
            trend: 1.8,
            filter: 1.5,
            search: 1.5,
            analysis: 1.8,
            insight: 1.8,
            performance: 1.6,
            error: 2,
            alert: 2,
          },
          typeWeights: {} as any, // Will use defaults from ContentPrioritizer
        };

        const contentPrioritizer = new ContentPrioritizer(logger, contentPrioritizerConfig);

        // Create prompt builder configuration
        const promptBuilderConfig = {
          maxContentElements: config.contextualChat.performance?.maxContentElements || 50,
          includePageContext: true,
          includeUserActions: true,
          contentRelevanceThreshold: 0.3,
        };

        const promptBuilder = new ContextualPromptBuilder(
          contentPrioritizer,
          logger,
          promptBuilderConfig
        );
        const responseProcessor = new ContextualResponseProcessor(logger);

        // Create contextual configuration
        const contextualConfig = {
          enabled: config.contextualChat.enabled,
          contextTimeout: config.contextualChat.extractionTimeout || 5000,
          enableStandardChatFallback: true,
          maxRetryAttempts: 2,
          retryBackoffMs: 1000,
          fallbackToStandard: true,
        };

        // Wrap base service with contextual capabilities
        const contextualService = new ContextualChatService(
          baseChatService,
          promptBuilder,
          responseProcessor,
          logger,
          contextualConfig
        );

        logger.info('Contextual chat service initialized successfully');
        return contextualService as any; // Type assertion needed due to interface differences
      } catch (error) {
        logger.error(
          'Failed to initialize contextual chat service, falling back to base service:',
          error
        );
        return baseChatService;
      }
    }

    return baseChatService;
  }
}
