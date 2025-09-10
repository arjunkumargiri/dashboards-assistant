/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreStart } from '../../../../src/core/public';
import { UiActionsStart } from '../../../../src/plugins/ui_actions/public';
import { EmbeddableStart } from '../../../../src/plugins/embeddable/public';
import { VisualizationChatAction } from '../actions/visualization_chat_action';
import { CONTEXT_MENU_TRIGGER } from '../../../../src/plugins/embeddable/public';
import { AssistantActions } from '../types';

/**
 * Service that integrates visualization chat with the existing chat UI
 * instead of creating a separate flyout
 */
export class VisualizationChatExistingUIIntegration {
  private core: CoreStart;
  private uiActions: UiActionsStart;
  private embeddable: EmbeddableStart;
  private assistantActions?: AssistantActions;

  constructor(
    core: CoreStart,
    uiActions: UiActionsStart,
    embeddable: EmbeddableStart,
    assistantActions?: AssistantActions
  ) {
    this.core = core;
    this.uiActions = uiActions;
    this.embeddable = embeddable;
    this.assistantActions = assistantActions;
  }

  /**
   * Initialize the visualization chat integration
   */
  public setup(): void {
    try {
      // Register the visualization chat action for dropdown menu
      const action = new VisualizationChatAction({
        core: this.core,
        onChatOpen: this.handleChatOpen.bind(this),
      });

      this.uiActions.registerAction(action);
      this.uiActions.attachAction(CONTEXT_MENU_TRIGGER, action.id);

      console.log('✅ Visualization chat action registered successfully (dropdown menu)');
    } catch (error) {
      console.error('❌ Failed to setup visualization chat integration:', error);
      throw error;
    }
  }

  /**
   * Handle opening chat with visualization context using existing UI
   */
  private async handleChatOpen(
    imageData: string,
    visualizationTitle: string,
    embeddableId: string
  ): Promise<void> {
    try {
      console.log('🎯 Opening existing chat UI for visualization:', visualizationTitle);

      // Step 1: Open existing chat UI if not already open
      const isChatOpen = this.isChatUIOpen();
      if (!isChatOpen) {
        await this.openExistingChatUI();
      }

      // Step 2: Wait for chat UI to be ready
      await this.waitForChatUI();

      // Step 3: Attach screenshot to chat input (don't send automatically)
      await this.attachVisualizationToChat(imageData, visualizationTitle, embeddableId);

      console.log('✅ Visualization screenshot attached to chat UI successfully');
    } catch (error) {
      console.error('❌ Failed to integrate with existing chat UI:', error);

      this.core.notifications.toasts.addError(error as Error, {
        title: 'Failed to open visualization chat',
      });
    }
  }

  /**
   * Check if the existing chat UI is currently open
   */
  private isChatUIOpen(): boolean {
    // Look for various selectors that indicate chat is open
    const chatSelectors = [
      '.chatbot-sidecar',
      '[data-test-subj="chat-flyout"]',
      '.euiFlyout',
      '.chat-container',
      '.assistant-chat',
    ];

    return chatSelectors.some((selector) => document.querySelector(selector) !== null);
  }

  /**
   * Open the existing chat UI
   */
  private async openExistingChatUI(): Promise<void> {
    // Try multiple methods to open the chat UI

    // Method 1: Click the chat header button
    const chatButton = document.querySelector(
      '[aria-label="toggle chat flyout icon"]'
    ) as HTMLButtonElement;
    if (chatButton) {
      chatButton.click();
      console.log('✅ Opened chat via header button');
      return;
    }

    // Method 2: Look for other chat buttons
    const altChatButtons = [
      '[data-test-subj="chat-header-button"]',
      '.chat-toggle-button',
      '[aria-label*="chat"]',
      '[title*="chat"]',
    ];

    for (const selector of altChatButtons) {
      const button = document.querySelector(selector) as HTMLButtonElement;
      if (button) {
        button.click();
        console.log(`✅ Opened chat via button: ${selector}`);
        return;
      }
    }

    // Method 3: Use assistant actions if available
    if (this.assistantActions && typeof this.assistantActions.openChat === 'function') {
      this.assistantActions.openChat();
      console.log('✅ Opened chat via assistant actions');
      return;
    }

    // Method 4: Dispatch custom event
    const openChatEvent = new CustomEvent('openAssistantChat', {
      bubbles: true,
      detail: { source: 'visualization-chat' },
    });
    document.dispatchEvent(openChatEvent);
    console.log('✅ Dispatched open chat event');

    throw new Error('Could not find a way to open the existing chat UI');
  }

  /**
   * Wait for the chat UI to be ready
   */
  private async waitForChatUI(maxWait: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (this.isChatUIOpen()) {
        // Wait a bit more for the UI to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if chat input is available
        const chatInput = this.findChatInput();
        if (chatInput) {
          console.log('✅ Chat UI is ready with input field');
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('Chat UI did not become ready within expected time');
  }

  /**
   * Find the chat input element
   */
  private findChatInput(): HTMLTextAreaElement | HTMLInputElement | null {
    const inputSelectors = [
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="ask"]',
      'textarea[placeholder*="chat"]',
      'textarea[placeholder*="message"]',
      'input[placeholder*="Ask"]',
      'input[placeholder*="ask"]',
      'input[placeholder*="chat"]',
      'input[placeholder*="message"]',
      '[data-test-subj="chat-input"]',
      '.chat-input textarea',
      '.chat-input input',
    ];

    for (const selector of inputSelectors) {
      const input = document.querySelector(selector) as HTMLTextAreaElement | HTMLInputElement;
      if (input && !input.disabled) {
        return input;
      }
    }

    return null;
  }

  /**
   * Find the send button
   */
  private findSendButton(): HTMLButtonElement | null {
    const sendSelectors = [
      'button[type="submit"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[title*="Send"]',
      'button[title*="send"]',
      '[data-test-subj="chat-send-button"]',
      '.chat-send-button',
      'button:contains("Send")',
    ];

    for (const selector of sendSelectors) {
      const button = document.querySelector(selector) as HTMLButtonElement;
      if (button && !button.disabled) {
        return button;
      }
    }

    return null;
  }

  /**
   * Attach visualization screenshot to the existing chat input
   */
  private async attachVisualizationToChat(
    imageData: string,
    visualizationTitle: string,
    embeddableId: string
  ): Promise<void> {
    try {
      // Store the image data globally so the chat system can access it
      this.storeVisualizationData(imageData, visualizationTitle, embeddableId);

      // Add visual indicator to chat input
      this.addImagePreviewToChat(imageData, visualizationTitle);

      // No notification needed - the visual preview is sufficient feedback

      console.log('✅ Visualization data attached to chat successfully');
    } catch (error) {
      console.error('❌ Failed to attach visualization to chat:', error);
      throw error;
    }
  }

  /**
   * Store visualization data globally for chat system to access
   */
  private storeVisualizationData(
    imageData: string,
    visualizationTitle: string,
    embeddableId: string
  ): void {
    // Store in window object for global access
    (window as any).__pendingVisualizationData = {
      imageData,
      visualizationTitle,
      embeddableId,
      timestamp: Date.now(),
      mimeType: 'image/png',
      filename: `${visualizationTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`,
    };

    console.log('📦 Stored visualization data globally');
  }

  /**
   * Add image preview to chat input area
   */
  private addImagePreviewToChat(imageData: string, visualizationTitle: string): void {
    try {
      // Find the chat input container
      const chatContainer = document.querySelector(
        '.chat-input-container, .euiFlyout, .chatbot-sidecar'
      );
      if (!chatContainer) {
        console.warn('⚠️ Could not find chat container for image preview');
        return;
      }

      // Remove any existing preview
      const existingPreview = chatContainer.querySelector('.visualization-image-preview');
      if (existingPreview) {
        existingPreview.remove();
      }

      // Create image preview element
      const previewContainer = document.createElement('div');
      previewContainer.className = 'visualization-image-preview';
      previewContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        margin: 8px 0;
        background: #f8f9fa;
        border: 1px solid #e1e5e9;
        border-radius: 8px;
        font-size: 13px;
        color: #495057;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: all 0.2s ease;
      `;

      // Add hover effect
      previewContainer.addEventListener('mouseenter', () => {
        previewContainer.style.background = '#f1f3f4';
        previewContainer.style.borderColor = '#d1d5db';
      });

      previewContainer.addEventListener('mouseleave', () => {
        previewContainer.style.background = '#f8f9fa';
        previewContainer.style.borderColor = '#e1e5e9';
      });

      // Create thumbnail
      const thumbnail = document.createElement('img');
      // Ensure the image data has the proper data URL format
      const imageSrc = imageData.startsWith('data:')
        ? imageData
        : `data:image/png;base64,${imageData}`;
      thumbnail.src = imageSrc;
      thumbnail.style.cssText = `
        width: 44px;
        height: 44px;
        object-fit: cover;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        flex-shrink: 0;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      `;

      // Add error handling for broken images
      thumbnail.onerror = () => {
        // Replace with a chart icon if image fails to load
        thumbnail.style.display = 'none';
        const iconPlaceholder = document.createElement('div');
        iconPlaceholder.innerHTML = '📊';
        iconPlaceholder.style.cssText = `
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8f9fa;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 20px;
          flex-shrink: 0;
        `;
        thumbnail.parentNode?.insertBefore(iconPlaceholder, thumbnail);
        console.warn('⚠️ Using icon placeholder for thumbnail');
      };

      // Create text info
      const textInfo = document.createElement('div');
      textInfo.style.cssText = 'flex: 1; min-width: 0;'; // min-width: 0 allows text to truncate
      textInfo.innerHTML = `
        <div style="font-weight: 600; color: #1a202c; font-size: 13px; margin-bottom: 2px;">📊 Visualization attached</div>
        <div style="font-size: 12px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${visualizationTitle}">${visualizationTitle}</div>
      `;

      // Create remove button
      const removeButton = document.createElement('button');
      removeButton.innerHTML = '✕';
      removeButton.style.cssText = `
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
        font-size: 16px;
        line-height: 1;
        transition: all 0.2s ease;
        flex-shrink: 0;
      `;
      removeButton.title = 'Remove attachment';

      // Add hover effects
      removeButton.addEventListener('mouseenter', () => {
        removeButton.style.background = '#f3f4f6';
        removeButton.style.color = '#ef4444';
      });

      removeButton.addEventListener('mouseleave', () => {
        removeButton.style.background = 'none';
        removeButton.style.color = '#9ca3af';
      });

      removeButton.onclick = () => {
        previewContainer.remove();
        delete (window as any).__pendingVisualizationData;
        console.log('🗑️ Removed visualization attachment');
      };

      // Assemble preview
      previewContainer.appendChild(thumbnail);
      previewContainer.appendChild(textInfo);
      previewContainer.appendChild(removeButton);

      // Find the best place to insert the preview
      const chatInput = this.findChatInput();
      if (chatInput && chatInput.parentElement) {
        // Insert before the input
        chatInput.parentElement.insertBefore(previewContainer, chatInput);
      } else {
        // Fallback: append to chat container
        chatContainer.appendChild(previewContainer);
      }

      console.log('🖼️ Added image preview to chat UI');
    } catch (error) {
      console.error('❌ Failed to add image preview:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public stop(): void {
    // Clean up any stored visualization data
    delete (window as any).__pendingVisualizationData;

    // Remove any image previews
    const previews = document.querySelectorAll('.visualization-image-preview');
    previews.forEach((preview) => preview.remove());
  }
}
