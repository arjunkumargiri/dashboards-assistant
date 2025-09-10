/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { IMessage } from '../../../common/types/chat_saved_object_attributes';
import { UIContext } from '../../../common/types/ui_context';
import { ContentPrioritizer } from './content_prioritizer';

/**
 * Contextual Prompt Builder - Snapshot-based approach
 *
 * This service builds contextual prompts by enhancing user messages
 * with relevant UI context information extracted from snapshots.
 */
export class ContextualPromptBuilder {
  constructor(
    private contentPrioritizer: ContentPrioritizer,
    private logger: Logger,
    private config: {
      maxContentElements: number;
      includePageContext: boolean;
      includeUserActions: boolean;
      contentRelevanceThreshold: number;
    }
  ) {}

  /**
   * Enhance messages with UI context information
   */
  async enhanceMessagesWithContext(
    messages: IMessage[],
    uiContext: UIContext
  ): Promise<IMessage[]> {
    try {
      if (!messages || messages.length === 0) {
        return messages;
      }

      // Get the last user message to enhance
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type !== 'input') {
        return messages;
      }

      // Build contextual prompt
      const contextualPrompt = await this.buildContextualPrompt(lastMessage.content, uiContext);

      // Create enhanced message
      const enhancedMessages = [...messages];
      enhancedMessages[enhancedMessages.length - 1] = {
        ...lastMessage,
        content: contextualPrompt,
      };

      this.logger.debug('Enhanced message with UI context', {
        originalLength: lastMessage.content.length,
        enhancedLength: contextualPrompt.length,
        contextElements: uiContext.content?.length || 0,
      });

      return enhancedMessages;
    } catch (error) {
      this.logger.error('Error enhancing messages with context:', error);
      return messages; // Return original messages on error
    }
  }

  /**
   * Build contextual prompt from user input and UI context
   */
  private async buildContextualPrompt(userInput: string, uiContext: UIContext): Promise<string> {
    const contextParts: string[] = [];

    // Add page context if enabled
    if (this.config.includePageContext && uiContext.page) {
      contextParts.push(this.buildPageContextPrompt(uiContext.page));
    }

    // Add prioritized content elements
    if (uiContext.content && uiContext.content.length > 0) {
      const prioritizedContent = await this.contentPrioritizer.prioritizeContent(
        uiContext.content,
        userInput,
        this.config.maxContentElements
      );

      if (prioritizedContent.length > 0) {
        contextParts.push(this.buildContentContextPrompt(prioritizedContent));
      }
    }

    // Add filters and time range context
    if (uiContext.filters && uiContext.filters.length > 0) {
      contextParts.push(this.buildFiltersContextPrompt(uiContext.filters));
    }

    if (uiContext.timeRange) {
      contextParts.push(this.buildTimeRangeContextPrompt(uiContext.timeRange));
    }

    // Add user actions if enabled and available
    if (
      this.config.includeUserActions &&
      uiContext.userActions &&
      uiContext.userActions.length > 0
    ) {
      contextParts.push(this.buildUserActionsContextPrompt(uiContext.userActions));
    }

    // Combine context with user input
    if (contextParts.length === 0) {
      return userInput; // No context available
    }

    const contextPrompt = `Context: I'm currently viewing a ${
      uiContext.page?.app || 'dashboard'
    } page with the following information:

${contextParts.join('\n\n')}

User Question: ${userInput}

Please provide a helpful response based on the context above. Focus on the specific data, visualizations, and insights visible on the current page.`;

    return contextPrompt;
  }

  /**
   * Build page context prompt section
   */
  private buildPageContextPrompt(page: UIContext['page']): string {
    return `Page Information:
- App: ${page.app}
- Title: ${page.title}
- URL: ${page.url}${
      page.breadcrumbs
        ? `
- Navigation: ${page.breadcrumbs.map((b) => b.text).join(' > ')}`
        : ''
    }`;
  }

  /**
   * Build content context prompt section
   */
  private buildContentContextPrompt(content: UIContext['content']): string {
    const contentDescriptions = content.map((item, index) => {
      let description = `${index + 1}. ${item.title || 'Untitled'} (${item.type})`;

      if (item.description) {
        description += `: ${item.description}`;
      }

      // Add data summary for visualizations and tables
      if (item.data) {
        if (item.data.chartData) {
          description += ` - Chart showing ${item.data.chartData.values?.length || 0} data points`;
        }
        if (item.data.tableData) {
          description += ` - Table with ${item.data.tableData.rows?.length || 0} rows`;
        }
      }

      return description;
    });

    return `Visible Content:
${contentDescriptions.join('\n')}`;
  }

  /**
   * Build filters context prompt section
   */
  private buildFiltersContextPrompt(filters: UIContext['filters']): string {
    const filterDescriptions = filters
      .filter((f) => f.enabled)
      .map((f) => `- ${f.displayName || `${f.field} ${f.operator} ${f.value}`}`);

    return `Active Filters:
${filterDescriptions.join('\n')}`;
  }

  /**
   * Build time range context prompt section
   */
  private buildTimeRangeContextPrompt(timeRange: UIContext['timeRange']): string {
    return `Time Range: ${timeRange.displayName || `${timeRange.from} to ${timeRange.to}`}`;
  }

  /**
   * Build user actions context prompt section
   */
  private buildUserActionsContextPrompt(userActions: UIContext['userActions']): string {
    const recentActions = userActions
      .slice(-5) // Last 5 actions
      .map((action) => `- ${action.type}: ${JSON.stringify(action.details)}`)
      .join('\n');

    return `Recent User Actions:
${recentActions}`;
  }
}
