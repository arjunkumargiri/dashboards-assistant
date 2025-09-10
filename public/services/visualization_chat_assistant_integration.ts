/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreStart } from '../../../../src/core/public';
import { AssistantActions } from '../types';
import { IMessage } from '../../common/types/chat_saved_object_attributes';
import { VisualizationChatContext } from './visualization_chat_service';

export interface VisualizationChatAssistantIntegration {
  sendVisualizationMessage: (
    message: string,
    imageData: string,
    context: VisualizationChatContext
  ) => Promise<void>;
  openChatWithVisualization: (conversationId?: string) => void;
}

export class VisualizationChatAssistantIntegrationService implements VisualizationChatAssistantIntegration {
  constructor(
    private core: CoreStart,
    private assistantActions: AssistantActions
  ) {}

  /**
   * Send a visualization message to the AI assistant
   */
  async sendVisualizationMessage(
    message: string,
    imageData: string,
    context: VisualizationChatContext
  ): Promise<void> {
    try {
      // Build the contextual message for better AI understanding
      const contextualMessage = this.buildVisualizationPrompt(message, context);

      // Create the input message with image
      const inputMessage: IMessage = {
        type: 'input',
        contentType: 'text',
        content: contextualMessage,
        context: {
          appId: 'dashboards',
          conversationId: `viz-${context.embeddableId}-${context.timestamp}`,
          visualization: {
            id: context.embeddableId,
            title: context.visualizationTitle,
            dashboardTitle: context.dashboardTitle,
            timestamp: context.timestamp,
          },
        },
        images: [{
          data: imageData,
          mimeType: 'image/png',
          filename: this.generateImageFilename(context),
        }],
      };

      // Use the existing assistant actions to send the message
      if (this.assistantActions.send) {
        await this.assistantActions.send(inputMessage);
        console.log('✅ Visualization message sent via assistant actions');
      } else {
        throw new Error('Assistant send action not available');
      }

    } catch (error) {
      console.error('Failed to send visualization message:', error);
      throw new Error(`Failed to send visualization to AI: ${error.message}`);
    }
  }

  /**
   * Open the chat interface with visualization context
   */
  openChatWithVisualization(conversationId?: string): void {
    try {
      if (this.assistantActions.openChatUI) {
        this.assistantActions.openChatUI(conversationId);
        console.log('✅ Chat UI opened via assistant actions');
      } else {
        // Fallback: try to find and click the chat button
        this.fallbackOpenChat();
      }
    } catch (error) {
      console.warn('Could not open chat UI via assistant actions:', error);
      this.fallbackOpenChat();
    }
  }

  /**
   * Build a comprehensive prompt for visualization analysis
   */
  private buildVisualizationPrompt(userMessage: string, context: VisualizationChatContext): string {
    const dashboardContext = context.dashboardTitle 
      ? ` from the dashboard "${context.dashboardTitle}"` 
      : '';
    
    const timestamp = new Date(context.timestamp).toLocaleString();
    
    return `I'm analyzing a visualization titled "${context.visualizationTitle}"${dashboardContext}. I've attached an image of this visualization captured at ${timestamp}.

**User Question:** ${userMessage}

**Analysis Request:**
Please analyze the visualization in the attached image and provide comprehensive insights. Consider the following aspects:

1. **Visualization Type & Structure:**
   - What type of chart/visualization is this?
   - How is the data organized and presented?
   - What are the key visual elements (axes, legends, data points, etc.)?

2. **Data Patterns & Trends:**
   - What patterns, trends, or relationships are visible?
   - Are there any notable increases, decreases, or fluctuations?
   - What time-based or categorical patterns can you identify?

3. **Key Insights & Findings:**
   - What are the most important insights from this data?
   - What story does this visualization tell?
   - What metrics or values stand out as significant?

4. **Anomalies & Outliers:**
   - Are there any unusual data points or anomalies?
   - What might explain any outliers or unexpected patterns?
   - Are there any data quality concerns visible?

5. **Actionable Recommendations:**
   - What actions should be taken based on this data?
   - What areas need further investigation?
   - How can performance be improved based on these insights?

6. **Context & Implications:**
   - What business or operational implications does this data suggest?
   - How does this relate to typical benchmarks or expectations?
   - What questions should stakeholders be asking about this data?

Please provide specific, actionable insights based on what you can observe in the visualization. If you need clarification about any aspect of the data or context, please ask.`;
  }

  /**
   * Generate a descriptive filename for the visualization image
   */
  private generateImageFilename(context: VisualizationChatContext): string {
    const sanitizedTitle = context.visualizationTitle
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    
    const timestamp = new Date(context.timestamp).toISOString().slice(0, 19).replace(/:/g, '-');
    
    return `visualization_${sanitizedTitle}_${timestamp}.png`;
  }

  /**
   * Fallback method to open chat interface
   */
  private fallbackOpenChat(): void {
    try {
      // Method 1: Try to find the chat header button
      const chatButton = document.querySelector('[data-test-subj="chat-header-button"]') as HTMLElement;
      if (chatButton) {
        chatButton.click();
        console.log('✅ Opened chat via header button');
        return;
      }

      // Method 2: Try to find any chat-related button
      const chatButtons = document.querySelectorAll('button[title*="chat" i], button[aria-label*="chat" i]');
      if (chatButtons.length > 0) {
        (chatButtons[0] as HTMLElement).click();
        console.log('✅ Opened chat via fallback button');
        return;
      }

      // Method 3: Dispatch custom event
      const chatOpenEvent = new CustomEvent('openAssistantChat', {
        detail: { source: 'visualization-chat' },
      });
      document.dispatchEvent(chatOpenEvent);
      console.log('✅ Dispatched chat open event');

    } catch (error) {
      console.warn('All fallback methods failed to open chat:', error);
      
      // Show user notification to manually open chat
      this.core.notifications.toasts.addInfo({
        title: 'Visualization Analysis Sent',
        text: 'Your visualization has been sent to AI for analysis. Please open the chat interface to see the results.',
        toastLifeTimeMs: 5000,
      });
    }
  }

  /**
   * Create a conversation specifically for visualization analysis
   */
  async createVisualizationConversation(context: VisualizationChatContext): Promise<string> {
    const conversationId = `viz-${context.embeddableId}-${context.timestamp}`;
    
    try {
      // If there's a loadChat method, use it to initialize the conversation
      if (this.assistantActions.loadChat) {
        await this.assistantActions.loadChat(
          conversationId,
          undefined,
          `Analysis: ${context.visualizationTitle}`
        );
        console.log('✅ Visualization conversation created');
      }
      
      return conversationId;
    } catch (error) {
      console.warn('Could not create specific conversation, using default:', error);
      return conversationId;
    }
  }

  /**
   * Check if assistant actions are available and functional
   */
  isAssistantAvailable(): boolean {
    return !!(
      this.assistantActions &&
      this.assistantActions.send &&
      typeof this.assistantActions.send === 'function'
    );
  }

  /**
   * Get assistant capabilities for debugging
   */
  getAssistantCapabilities(): Record<string, boolean> {
    return {
      send: !!(this.assistantActions?.send),
      loadChat: !!(this.assistantActions?.loadChat),
      resetChat: !!(this.assistantActions?.resetChat),
      openChatUI: !!(this.assistantActions?.openChatUI),
    };
  }
}