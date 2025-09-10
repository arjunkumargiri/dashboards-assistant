/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { CoreStart } from '../../../../src/core/public';
import { UiActionsStart } from '../../../../src/plugins/ui_actions/public';
import { EmbeddableStart, IEmbeddable } from '../../../../src/plugins/embeddable/public';
import { AskAIPanelButton } from '../components/visualization_chat/ask_ai_panel_button';
import { VisualizationChatExistingUIIntegration } from './visualization_chat_existing_ui_integration';

/**
 * Service that injects "Ask AI" buttons into embeddable panel headers
 */
export class AskAIButtonInjector {
  private core: CoreStart;
  private uiActions: UiActionsStart;
  private embeddable: EmbeddableStart;
  private visualizationChatIntegration: VisualizationChatExistingUIIntegration;
  private observer: MutationObserver | null = null;
  private injectedButtons = new Set<string>();

  constructor(
    core: CoreStart,
    uiActions: UiActionsStart,
    embeddable: EmbeddableStart,
    visualizationChatIntegration: VisualizationChatExistingUIIntegration
  ) {
    this.core = core;
    this.uiActions = uiActions;
    this.embeddable = embeddable;
    this.visualizationChatIntegration = visualizationChatIntegration;
  }

  /**
   * Start injecting Ask AI buttons into embeddable panels
   */
  public start(): void {
    // Initial injection for existing panels
    this.injectButtonsIntoExistingPanels();

    // Set up observer for dynamically added panels
    this.setupMutationObserver();

    console.log('✅ Ask AI button injector started');
  }

  /**
   * Stop the button injector and clean up
   */
  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Remove all injected buttons
    this.removeAllInjectedButtons();

    console.log('🛑 Ask AI button injector stopped');
  }

  /**
   * Inject buttons into existing panels
   */
  private injectButtonsIntoExistingPanels(): void {
    const panels = document.querySelectorAll('[data-test-subj="embeddablePanelHeading"]');
    panels.forEach((panel) => {
      this.injectButtonIntoPanel(panel as HTMLElement);
    });
  }

  /**
   * Set up mutation observer to watch for new panels
   */
  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // Check if the added node is a panel heading
            if (element.matches('[data-test-subj="embeddablePanelHeading"]')) {
              this.injectButtonIntoPanel(element);
            }

            // Check if the added node contains panel headings
            const panelHeadings = element.querySelectorAll(
              '[data-test-subj="embeddablePanelHeading"]'
            );
            panelHeadings.forEach((panel) => {
              this.injectButtonIntoPanel(panel as HTMLElement);
            });
          }
        });
      });
    });

    // Start observing
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Inject Ask AI button into a specific panel
   */
  private injectButtonIntoPanel(panelElement: HTMLElement): void {
    try {
      // Get the embeddable ID from the panel
      const embeddableId = this.getEmbeddableIdFromPanel(panelElement);
      if (!embeddableId) {
        return;
      }

      // Skip if button already injected for this panel
      if (this.injectedButtons.has(embeddableId)) {
        return;
      }

      // Get the embeddable instance
      const embeddable = this.getEmbeddableInstance(embeddableId, panelElement);
      if (!embeddable) {
        return;
      }

      // Check if this is a visualization that supports Ask AI
      if (!this.isVisualizationEmbeddable(embeddable)) {
        return;
      }

      // Find the options menu button to place our button next to it
      const optionsMenuButton = panelElement.querySelector(
        '[data-test-subj="embeddablePanelToggleMenuIcon"]'
      );
      if (!optionsMenuButton || !optionsMenuButton.parentElement) {
        return;
      }

      // Create container for our button
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'embPanel__askAIButtonContainer';
      buttonContainer.setAttribute('data-embeddable-id', embeddableId);

      // Insert before the options menu button
      optionsMenuButton.parentElement.insertBefore(buttonContainer, optionsMenuButton);

      // Render the React button component
      ReactDOM.render(
        React.createElement(AskAIPanelButton, {
          embeddable,
          onAskAI: this.handleAskAI.bind(this),
        }),
        buttonContainer
      );

      // Mark as injected
      this.injectedButtons.add(embeddableId);

      console.log(`✅ Injected Ask AI button for embeddable: ${embeddableId}`);
    } catch (error) {
      console.error('❌ Failed to inject Ask AI button:', error);
    }
  }

  /**
   * Get embeddable ID from panel element
   */
  private getEmbeddableIdFromPanel(panelElement: HTMLElement): string | null {
    // Try to find embeddable ID from various sources
    const embeddablePanel = panelElement.closest('[data-embeddable-id]');
    if (embeddablePanel) {
      return embeddablePanel.getAttribute('data-embeddable-id');
    }

    // Alternative: look for embeddable container
    const embeddableContainer = panelElement.closest('.embPanel');
    if (embeddableContainer) {
      const embeddableElement = embeddableContainer.querySelector('[data-embeddable-id]');
      if (embeddableElement) {
        return embeddableElement.getAttribute('data-embeddable-id');
      }
    }

    return null;
  }

  /**
   * Get embeddable instance from ID
   */
  private getEmbeddableInstance(
    embeddableId: string,
    panelElement: HTMLElement
  ): IEmbeddable | null {
    try {
      // Try to get embeddable from the global registry or container
      // This is a simplified approach - in practice, you might need to access
      // the dashboard container or embeddable registry

      // Look for embeddable data in the DOM
      const embeddableElement = document.querySelector(`[data-embeddable-id="${embeddableId}"]`);
      if (embeddableElement && (embeddableElement as any).__embeddable) {
        return (embeddableElement as any).__embeddable;
      }

      // Create a mock embeddable for testing purposes
      // In production, this should be replaced with proper embeddable retrieval
      return {
        id: embeddableId,
        type: 'visualization', // Assume it's a visualization
        getTitle: () => this.getTitleFromPanel(panelElement),
        getInput: () => ({}),
        getOutput: () => ({}),
      } as IEmbeddable;
    } catch (error) {
      console.error('Failed to get embeddable instance:', error);
      return null;
    }
  }

  /**
   * Get title from panel element
   */
  private getTitleFromPanel(panelElement: HTMLElement): string {
    const titleElement = panelElement.querySelector('[data-test-subj="dashboardPanelTitle"]');
    return titleElement?.textContent || 'Untitled Visualization';
  }

  /**
   * Check if embeddable is a visualization that supports Ask AI
   */
  private isVisualizationEmbeddable(embeddable: IEmbeddable): boolean {
    // Check embeddable type
    const supportedTypes = [
      'visualization',
      'lens',
      'vega',
      'timelion',
      'tsvb',
      'pie',
      'line',
      'area',
      'bar',
      'histogram',
      'table',
    ];

    return supportedTypes.includes(embeddable.type);
  }

  /**
   * Handle Ask AI button click
   */
  private async handleAskAI(embeddable: IEmbeddable): Promise<void> {
    try {
      console.log('🎯 Ask AI button clicked for embeddable:', embeddable.id);

      // Find the embeddable element for screenshot
      const embeddableElement = document.querySelector(`[data-embeddable-id="${embeddable.id}"]`);
      if (!embeddableElement) {
        throw new Error('Could not find embeddable element for screenshot');
      }

      // Use the existing visualization chat integration
      await this.visualizationChatIntegration.handleChatOpen(
        '', // We'll capture the screenshot in the integration
        embeddable.getTitle?.() || 'Untitled Visualization',
        embeddable.id
      );
    } catch (error) {
      console.error('❌ Failed to handle Ask AI click:', error);

      this.core.notifications.toasts.addError(error as Error, {
        title: 'Failed to start Ask AI',
      });
    }
  }

  /**
   * Remove all injected buttons
   */
  private removeAllInjectedButtons(): void {
    const buttonContainers = document.querySelectorAll('.embPanel__askAIButtonContainer');
    buttonContainers.forEach((container) => {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
    });

    this.injectedButtons.clear();
  }
}
