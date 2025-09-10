/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { IMessage } from '../../../common/types/chat_saved_object_attributes';
import { UIContext } from '../../../common/types/ui_context';

/**
 * Contextual Response Processor - Snapshot-based approach
 *
 * This service processes chat responses and enhances them with
 * contextual information when relevant.
 */
export class ContextualResponseProcessor {
  constructor(private logger: Logger) {}

  /**
   * Process response with contextual enhancement
   */
  async processResponse(
    response: { messages: IMessage[]; interactions: any[] },
    uiContext?: UIContext
  ): Promise<{ messages: IMessage[]; interactions: any[] }> {
    try {
      if (!response.messages || response.messages.length === 0) {
        return response;
      }

      // Process the last assistant message
      const processedMessages = [...response.messages];
      const lastMessage = processedMessages[processedMessages.length - 1];

      if (lastMessage.type === 'output' && uiContext) {
        // Enhance response with contextual metadata
        const enhancedMessage = await this.enhanceResponseMessage(lastMessage, uiContext);
        processedMessages[processedMessages.length - 1] = enhancedMessage;
      }

      return {
        ...response,
        messages: processedMessages,
      };
    } catch (error) {
      this.logger.error('Error processing contextual response:', error);
      return response; // Return original response on error
    }
  }

  /**
   * Enhance response message with contextual metadata
   */
  private async enhanceResponseMessage(message: IMessage, uiContext: UIContext): Promise<IMessage> {
    try {
      // Add contextual metadata to the message
      const contextualMetadata = {
        contextSource: {
          app: uiContext.page?.app,
          title: uiContext.page?.title,
          contentElements: uiContext.content?.length || 0,
          hasFilters: (uiContext.filters?.length || 0) > 0,
          timeRange: uiContext.timeRange?.displayName,
        },
        processingInfo: {
          contextEnhanced: true,
          timestamp: new Date().toISOString(),
        },
      };

      // Check if response mentions specific visualizations or data
      const enhancedContent = this.addContextualHints(message.content, uiContext);

      return {
        ...message,
        content: enhancedContent,
        metadata: {
          ...message.metadata,
          contextual: contextualMetadata,
        },
      };
    } catch (error) {
      this.logger.error('Error enhancing response message:', error);
      return message;
    }
  }

  /**
   * Add contextual hints to response content
   */
  private addContextualHints(content: string, uiContext: UIContext): string {
    // For now, return content as-is
    // Future enhancement: Add specific references to visible charts, tables, etc.
    return content;
  }

  /**
   * Extract insights from UI context for response enhancement
   */
  private extractContextualInsights(uiContext: UIContext): string[] {
    const insights: string[] = [];

    // Extract insights from visible content
    if (uiContext.content) {
      uiContext.content.forEach((item) => {
        if (item.data?.chartData?.trends) {
          insights.push(`${item.title} shows ${item.data.chartData.trends.direction} trend`);
        }

        if (item.data?.tableData?.totalRows) {
          insights.push(`${item.title} contains ${item.data.tableData.totalRows} records`);
        }
      });
    }

    // Extract insights from filters
    if (uiContext.filters && uiContext.filters.length > 0) {
      const activeFilters = uiContext.filters.filter((f) => f.enabled);
      if (activeFilters.length > 0) {
        insights.push(`Data is filtered by ${activeFilters.length} active filter(s)`);
      }
    }

    return insights;
  }
}
