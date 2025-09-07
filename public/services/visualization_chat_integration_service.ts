/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CoreStart } from '../../../../src/core/public';
import { UiActionsStart } from '../../../../src/plugins/ui_actions/public';
import { EmbeddableStart } from '../../../../src/plugins/embeddable/public';
import { toMountPoint } from '../../../../src/plugins/opensearch_dashboards_react/public';
import { VisualizationChatAction, VISUALIZATION_CHAT_ACTION } from '../actions/visualization_chat_action';
import { VisualizationChatFlyout } from '../components/visualization_chat/visualization_chat_flyout';
import { VisualizationChatContext } from './visualization_chat_service';
import { useVisualizationChat } from '../hooks/use_visualization_chat';
import { CONTEXT_MENU_TRIGGER } from '../../../../src/plugins/embeddable/public';

export class VisualizationChatIntegrationService {
  private core: CoreStart;
  private uiActions: UiActionsStart;
  private embeddable: EmbeddableStart;
  private chatFlyoutMount: any = null;

  constructor(core: CoreStart, uiActions: UiActionsStart, embeddable: EmbeddableStart) {
    this.core = core;
    this.uiActions = uiActions;
    this.embeddable = embeddable;
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
    const action = new VisualizationChatAction({
      core: this.core,
      onChatOpen: this.handleChatOpen.bind(this),
    });

    // Register the action with the context menu trigger
    this.uiActions.registerAction(action);
    this.uiActions.attachAction(CONTEXT_MENU_TRIGGER, action.id);

    console.log('✅ Visualization chat action registered successfully');
  }

  /**
   * Handle opening the chat with visualization context
   */
  private handleChatOpen(imageData: string, visualizationTitle: string, embeddableId: string) {
    // Get current dashboard title if available
    const dashboardTitle = this.getCurrentDashboardTitle();

    const context: VisualizationChatContext = {
      imageData,
      visualizationTitle,
      embeddableId,
      dashboardTitle,
      timestamp: Date.now(),
    };

    this.openVisualizationChatFlyout(context);
  }

  /**
   * Open the visualization chat flyout
   */
  private openVisualizationChatFlyout(context: VisualizationChatContext) {
    // Close any existing flyout
    this.closeChatFlyout();

    // Create the flyout component
    const VisualizationChatFlyoutWrapper: React.FC = () => {
      const { isOpen, closeChat } = useVisualizationChat();

      const handleStartChat = (message: string, imageData: string) => {
        // Here we would integrate with the existing chat system
        // For now, we'll show a success message and open the main chat
        this.core.notifications.toasts.addSuccess({
          title: 'Chat started with visualization context',
          text: `Question: ${message}`,
        });

        // TODO: Integrate with the existing chat system
        // This would involve:
        // 1. Creating a new conversation with the visualization context
        // 2. Sending the initial message with the image
        // 3. Opening the main chat interface
        this.openMainChatWithContext(message, imageData, context);
      };

      return React.createElement(VisualizationChatFlyout, {
        isOpen: true,
        onClose: () => {
          closeChat();
          this.closeChatFlyout();
        },
        context,
        core: this.core,
        onStartChat: handleStartChat,
      });
    };

    // Mount the flyout
    this.chatFlyoutMount = this.core.overlays.openFlyout(
      toMountPoint(React.createElement(VisualizationChatFlyoutWrapper)),
      {
        size: 'm',
        'data-test-subj': 'visualizationChatFlyout',
        onClose: () => {
          this.closeChatFlyout();
        },
      }
    );
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
      const dashboardBreadcrumb = breadcrumbs.find(b => 
        b.text && (b.text.includes('Dashboard') || b.href?.includes('dashboard'))
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
   * TODO: This should integrate with the existing chat system
   */
  private openMainChatWithContext(message: string, imageData: string, context: VisualizationChatContext) {
    // This is a placeholder for the actual integration
    // In a real implementation, this would:
    // 1. Create a new conversation with the visualization context
    // 2. Send the initial message with the image to the LLM
    // 3. Open the main chat interface

    console.log('Opening main chat with context:', {
      message,
      context,
      imageDataLength: imageData.length,
    });

    // For now, show a notification that the feature is working
    this.core.notifications.toasts.addInfo({
      title: 'Visualization Chat Integration',
      text: `Ready to analyze "${context.visualizationTitle}" with AI. This would open the main chat interface with the visualization image and your question.`,
      toastLifeTimeMs: 5000,
    });
  }

  /**
   * Cleanup resources
   */
  public stop() {
    this.closeChatFlyout();
  }
}