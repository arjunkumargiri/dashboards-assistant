/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreStart } from '../../../../src/core/public';
import { UiActionsStart } from '../../../../src/plugins/ui_actions/public';
import { EmbeddableStart, IEmbeddable } from '../../../../src/plugins/embeddable/public';
import { VisualizationChatExistingUIIntegration } from './visualization_chat_existing_ui_integration';

/**
 * Simplified button injector that uses vanilla DOM instead of React
 */
export class SimpleButtonInjector {
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
   * Start injecting Ask AI buttons
   */
  public start(): void {
    console.log('🚀 Starting simple button injector...');
    console.log('Core:', !!this.core);
    console.log('UiActions:', !!this.uiActions);
    console.log('Embeddable:', !!this.embeddable);
    console.log('VisualizationChatIntegration:', !!this.visualizationChatIntegration);
    
    // Initial injection
    this.injectButtonsIntoExistingPanels();

    // Set up observer for new panels
    this.setupMutationObserver();

    console.log('✅ Simple button injector started');
  }

  /**
   * Stop the injector
   */
  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.removeAllInjectedButtons();
    console.log('🛑 Simple button injector stopped');
  }

  /**
   * Inject buttons into existing panels
   */
  private injectButtonsIntoExistingPanels(): void {
    console.log('🔍 Looking for existing panels...');
    const panels = document.querySelectorAll('[data-test-subj="embeddablePanelHeading"]');
    console.log(`Found ${panels.length} panels for button injection`);
    
    if (panels.length === 0) {
      console.log('⚠️ No panels found. User may need to navigate to a dashboard with visualizations.');
    }
    
    panels.forEach((panel, index) => {
      console.log(`Processing panel ${index + 1}...`);
      this.injectButtonIntoPanel(panel as HTMLElement);
    });
    
    console.log(`Completed processing ${panels.length} panels`);
  }

  /**
   * Set up mutation observer
   */
  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            
            // Check if it's a panel heading
            if (element.matches('[data-test-subj="embeddablePanelHeading"]')) {
              this.injectButtonIntoPanel(element);
            }
            
            // Check for panel headings inside the added node
            const panelHeadings = element.querySelectorAll('[data-test-subj="embeddablePanelHeading"]');
            panelHeadings.forEach((panel) => {
              this.injectButtonIntoPanel(panel as HTMLElement);
            });
          }
        });
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Inject button into a specific panel
   */
  private injectButtonIntoPanel(panelElement: HTMLElement): void {
    try {
      console.log('🔧 Attempting to inject button into panel...');
      
      // Get embeddable ID
      const embeddableId = this.getEmbeddableIdFromPanel(panelElement);
      console.log(`Embeddable ID: ${embeddableId}`);
      if (!embeddableId) {
        console.log('❌ No embeddable ID found for panel');
        return;
      }

      // Skip if already injected
      if (this.injectedButtons.has(embeddableId)) {
        console.log(`⚠️ Button already injected for ${embeddableId}`);
        return;
      }

      // Find options menu
      const optionsMenu = panelElement.querySelector('[data-test-subj="embeddablePanelToggleMenuIcon"]');
      console.log(`Options menu found: ${!!optionsMenu}`);
      console.log(`Options menu parent: ${!!(optionsMenu && optionsMenu.parentElement)}`);
      if (!optionsMenu || !optionsMenu.parentElement) {
        console.log('❌ No options menu found for panel');
        return;
      }

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'embPanel__askAIButtonContainer';
      buttonContainer.setAttribute('data-embeddable-id', embeddableId);
      buttonContainer.style.display = 'inline-block';
      buttonContainer.style.marginRight = '6px';

      // Create the button
      const button = document.createElement('button');
      button.className = 'embPanel__askAIButton';
      button.setAttribute('data-test-subj', 'embeddablePanelAskAIButton');
      button.setAttribute('aria-label', 'Ask AI about this visualization');
      button.title = 'Ask AI about this visualization';
      
      // Button styling
      button.style.cssText = `
        background-color: #0078d4;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 8px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      `;

      // Add icon (using text for now)
      button.innerHTML = '💬';

      // Add hover effects
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#106ebe';
        button.style.transform = 'scale(1.05)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#0078d4';
        button.style.transform = 'scale(1)';
      });

      // Add click handler
      button.addEventListener('click', () => {
        this.handleAskAI(embeddableId, panelElement);
      });

      buttonContainer.appendChild(button);

      // Insert before options menu
      optionsMenu.parentElement.insertBefore(buttonContainer, optionsMenu);

      // Mark as injected
      this.injectedButtons.add(embeddableId);

      console.log(`✅ Simple button injected for embeddable: ${embeddableId}`);
    } catch (error) {
      console.error('❌ Failed to inject simple button:', error);
    }
  }

  /**
   * Get embeddable ID from panel
   */
  private getEmbeddableIdFromPanel(panelElement: HTMLElement): string | null {
    const embeddablePanel = panelElement.closest('[data-embeddable-id]');
    if (embeddablePanel) {
      return embeddablePanel.getAttribute('data-embeddable-id');
    }

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
   * Handle Ask AI button click
   */
  private async handleAskAI(embeddableId: string, panelElement: HTMLElement): Promise<void> {
    try {
      console.log('🎯 Simple Ask AI button clicked for embeddable:', embeddableId);

      // Get panel title
      const titleElement = panelElement.querySelector('[data-test-subj="dashboardPanelTitle"]');
      const title = titleElement?.textContent || 'Untitled Visualization';

      // Use the visualization chat integration
      await this.visualizationChatIntegration.handleChatOpen('', title, embeddableId);
    } catch (error) {
      console.error('❌ Failed to handle simple Ask AI click:', error);
      
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
      container.remove();
    });
    
    this.injectedButtons.clear();
  }
}