/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CoreStart } from '../../../../src/core/public';
import { UiActionsStart } from '../../../../src/plugins/ui_actions/public';
import { EmbeddableStart } from '../../../../src/plugins/embeddable/public';
import { toMountPoint } from '../../../../src/plugins/opensearch_dashboards_react/public';
import {
  VisualizationChatAction,
  VISUALIZATION_CHAT_ACTION,
} from '../actions/visualization_chat_action';
import { VisualizationChatFlyout } from '../components/visualization_chat/visualization_chat_flyout';
import { VisualizationChatContext } from './visualization_chat_service';
import { VisualizationChatAssistantIntegrationService } from './visualization_chat_assistant_integration';
import { useVisualizationChat } from '../hooks/use_visualization_chat';
import { CONTEXT_MENU_TRIGGER } from '../../../../src/plugins/embeddable/public';
import { AssistantActions } from '../types';

export class VisualizationChatIntegrationService {
  private core: CoreStart;
  private uiActions: UiActionsStart;
  private embeddable: EmbeddableStart;
  private chatFlyoutMount: any = null;
  private assistantIntegration: VisualizationChatAssistantIntegrationService | null = null;

  constructor(
    core: CoreStart,
    uiActions: UiActionsStart,
    embeddable: EmbeddableStart,
    assistantActions?: AssistantActions
  ) {
    this.core = core;
    this.uiActions = uiActions;
    this.embeddable = embeddable;

    // Initialize assistant integration if actions are available
    if (assistantActions) {
      this.assistantIntegration = new VisualizationChatAssistantIntegrationService(
        core,
        assistantActions
      );
      console.log('✅ Assistant integration initialized for visualization chat');
    } else {
      console.warn('⚠️ Assistant actions not available - using fallback integration');
    }
  }

  /**
   * Initialize the visualization chat integration
   */
  public setup() {
    this.registerVisualizationChatAction();
  }

  /**
   * Register the visualization chat action with the UI actions service
   */
  private registerVisualizationChatAction() {
    try {
      console.log('🔧 Starting visualization chat action registration...');

      const action = new VisualizationChatAction({
        core: this.core,
        onChatOpen: this.handleChatOpen.bind(this),
      });

      console.log('🎯 Created visualization chat action:', {
        id: action.id,
        type: action.type,
        order: action.order,
      });

      // Register the action with the context menu trigger
      this.uiActions.registerAction(action);
      console.log('📝 Action registered with UI actions service');

      this.uiActions.attachAction(CONTEXT_MENU_TRIGGER, action.id);
      console.log('🔗 Action attached to context menu trigger');

      // Debug: Check if action was registered successfully
      const registeredActions = this.uiActions.getActions ? this.uiActions.getActions() : [];
      console.log('📋 Total registered actions:', registeredActions.length);

      // Try to find our action
      const ourAction = registeredActions.find((a: any) => a.id === action.id);
      if (ourAction) {
        console.log('✅ Our action found in registered actions list');
      } else {
        console.warn('⚠️ Our action NOT found in registered actions list');
      }

      console.log('✅ Visualization chat action registration completed successfully');

      // Store reference for debugging
      (window as any).__visualizationChatAction = action;
    } catch (error) {
      console.error('❌ Failed to register visualization chat action:', error);
      throw error;
    }
  }

  /**
   * Handle opening the chat with visualization context
   */
  private handleChatOpen(imageData: string, visualizationTitle: string, embeddableId: string) {
    console.log('🎯 handleChatOpen called with:', {
      imageDataLength: imageData.length,
      visualizationTitle,
      embeddableId,
    });

    // Get current dashboard title if available
    const dashboardTitle = this.getCurrentDashboardTitle();
    console.log('📊 Dashboard title:', dashboardTitle);

    const context: VisualizationChatContext = {
      imageData,
      visualizationTitle,
      embeddableId,
      dashboardTitle,
      timestamp: Date.now(),
    };

    console.log('🚀 About to open flyout with context:', {
      ...context,
      imageData: `[${imageData.length} chars]`, // Don't log the full image data
    });

    this.openVisualizationChatFlyout(context);
  }

  /**
   * Open the visualization chat flyout
   */
  private openVisualizationChatFlyout(context: VisualizationChatContext) {
    console.log('🚀 Opening visualization chat flyout with context:', context);

    // Close any existing flyout
    this.closeChatFlyout();

    const handleStartChat = (message: string, imageData: string) => {
      console.log('💬 Starting chat with message:', message);

      // Show success notification
      this.core.notifications.toasts.addSuccess({
        title: 'Chat started with visualization context',
        text: `Question: ${message}`,
      });

      // Close the flyout and open main chat
      this.closeChatFlyout();
      this.openMainChatWithContext(message, imageData, context);
    };

    const handleClose = () => {
      console.log('❌ Closing visualization chat flyout');
      this.closeChatFlyout();
    };

    try {
      // Mount the flyout directly without wrapper component
      this.chatFlyoutMount = this.core.overlays.openFlyout(
        toMountPoint(
          React.createElement(VisualizationChatFlyout, {
            isOpen: true,
            onClose: handleClose,
            context,
            core: this.core,
            onStartChat: handleStartChat,
          })
        ),
        {
          size: 'm',
          'data-test-subj': 'visualization-chat-flyout',
          onClose: handleClose,
        }
      );

      console.log('✅ Visualization chat flyout mounted successfully');
    } catch (error) {
      console.error('❌ Failed to open visualization chat flyout:', error);
      this.core.notifications.toasts.addError(error as Error, {
        title: 'Failed to open chat',
      });
    }
  }

  /**
   * Close the chat flyout
   */
  private closeChatFlyout() {
    if (this.chatFlyoutMount) {
      this.chatFlyoutMount.close();
      this.chatFlyoutMount = null;
    }
  }

  /**
   * Get the current dashboard title
   */
  private getCurrentDashboardTitle(): string | undefined {
    try {
      // Try to get dashboard title from the current URL or breadcrumbs
      const breadcrumbs = this.core.chrome.getBreadcrumbs();
      const dashboardBreadcrumb = breadcrumbs.find(
        (b) => b.text && (b.text.includes('Dashboard') || b.href?.includes('dashboard'))
      );

      if (dashboardBreadcrumb && dashboardBreadcrumb.text !== 'Dashboard') {
        return dashboardBreadcrumb.text;
      }

      // Fallback: try to get from document title
      const title = document.title;
      if (title && title.includes('Dashboard')) {
        const parts = title.split(' - ');
        if (parts.length > 1) {
          return parts[0];
        }
      }
    } catch (error) {
      console.warn('Could not determine dashboard title:', error);
    }

    return undefined;
  }

  /**
   * Open the main chat interface with visualization context
   */
  private async openMainChatWithContext(
    message: string,
    imageData: string,
    context: VisualizationChatContext
  ) {
    try {
      // Use assistant integration if available
      if (this.assistantIntegration && this.assistantIntegration.isAssistantAvailable()) {
        console.log('🤖 Using assistant integration for visualization chat');

        // Send the message via assistant actions
        await this.assistantIntegration.sendVisualizationMessage(message, imageData, context);

        // Create and open conversation
        const conversationId = await this.assistantIntegration.createVisualizationConversation(
          context
        );
        this.assistantIntegration.openChatWithVisualization(conversationId);

        this.core.notifications.toasts.addSuccess({
          title: 'Visualization Analysis Started',
          text: `AI is analyzing "${context.visualizationTitle}". The chat interface will open with your results.`,
          toastLifeTimeMs: 4000,
        });
      } else {
        console.log('📡 Using fallback HTTP integration for visualization chat');

        // Fallback to direct HTTP call
        await this.fallbackChatIntegration(message, imageData, context);
      }
    } catch (error) {
      console.error('Failed to open main chat with context:', error);
      this.core.notifications.toasts.addError(error as Error, {
        title: 'Failed to Start Visualization Chat',
        toastLifeTimeMs: 5000,
      });
    }
  }

  /**
   * Fallback integration using direct HTTP calls
   */
  private async fallbackChatIntegration(
    message: string,
    imageData: string,
    context: VisualizationChatContext
  ) {
    // Create a visualization-specific conversation ID
    const conversationId = `viz-${context.embeddableId}-${Date.now()}`;

    // Build the contextual message for the AI
    const contextualMessage = this.buildVisualizationContextMessage(message, context);

    // Create the input message with image
    const inputMessage = {
      type: 'input' as const,
      contentType: 'text' as const,
      content: contextualMessage,
      context: {
        appId: 'dashboards',
        conversationId,
        visualization: {
          id: context.embeddableId,
          title: context.visualizationTitle,
          dashboardTitle: context.dashboardTitle,
          timestamp: context.timestamp,
        },
      },
      images: [
        {
          data: imageData,
          mimeType: 'image/png',
          filename: `${context.visualizationTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`,
        },
      ],
    };

    // Send the message to the chat service
    await this.sendVisualizationChatMessage(inputMessage, conversationId);

    // Try to open the main chat interface
    this.openChatInterface(conversationId);

    this.core.notifications.toasts.addSuccess({
      title: 'Visualization Analysis Started',
      text: `AI is analyzing "${context.visualizationTitle}". Check the chat interface for insights.`,
      toastLifeTimeMs: 3000,
    });
  }

  /**
   * Build a contextual message for visualization analysis
   */
  private buildVisualizationContextMessage(
    userMessage: string,
    context: VisualizationChatContext
  ): string {
    const dashboardContext = context.dashboardTitle
      ? ` from the dashboard "${context.dashboardTitle}"`
      : '';

    return `I'm analyzing a visualization titled "${context.visualizationTitle}"${dashboardContext}. I've attached an image of this visualization.

User question: ${userMessage}

Please analyze the visualization in the image and provide insights based on what you can see. Consider:
- The type of chart/visualization and its purpose
- Data patterns, trends, and relationships visible in the chart
- Any notable insights, anomalies, or outliers
- Key metrics and their significance
- Actionable recommendations based on the data shown
- Potential areas for further investigation

If you need clarification about specific aspects of the visualization or the underlying data, please let me know.`;
  }

  /**
   * Send the visualization chat message to the backend
   */
  private async sendVisualizationChatMessage(inputMessage: any, conversationId: string) {
    try {
      const response = await this.core.http.post('/api/assistant/chat', {
        body: JSON.stringify({
          messages: [],
          input: inputMessage,
          conversationId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Visualization chat message sent successfully:', response);
      return response;
    } catch (error) {
      console.error('Failed to send visualization chat message:', error);
      throw new Error(`Failed to send message to AI: ${error.message}`);
    }
  }

  /**
   * Open the main chat interface
   */
  private openChatInterface(conversationId: string) {
    try {
      // Try to find and trigger the existing chat interface
      // This could be done through various methods depending on the chat implementation

      // Method 1: Try to find the chat button and click it
      const chatButton = document.querySelector(
        '[data-test-subj="chat-header-button"]'
      ) as HTMLElement;
      if (chatButton) {
        chatButton.click();
        console.log('Opened chat interface via header button');
        return;
      }

      // Method 2: Try to dispatch a custom event to open chat
      const chatOpenEvent = new CustomEvent('openAssistantChat', {
        detail: { conversationId },
      });
      document.dispatchEvent(chatOpenEvent);
      console.log('Dispatched chat open event');

      // Method 3: Try to navigate to chat URL if available
      const chatUrl = this.core.application.getUrlForApp('assistant', {
        path: `/chat?conversationId=${conversationId}`,
      });

      if (chatUrl) {
        // Don't navigate immediately, just log for now
        console.log('Chat URL available:', chatUrl);
      }
    } catch (error) {
      console.warn('Could not automatically open chat interface:', error);
      // This is not critical - the user can manually open chat
    }
  }

  /**
   * Cleanup resources
   */
  public stop() {
    this.closeChatFlyout();
  }
}
