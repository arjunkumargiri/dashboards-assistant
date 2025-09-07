/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { i18n } from '@osd/i18n';
import { EuiIconType } from '@elastic/eui/src/components/icon/icon';
import { Action } from '../../../../src/plugins/ui_actions/public';
import { EmbeddableContext, IEmbeddable } from '../../../../src/plugins/embeddable/public';
import { ScreenshotService } from '../services/screenshot_service';
import { CoreStart } from '../../../../src/core/public';

export const VISUALIZATION_CHAT_ACTION = 'VISUALIZATION_CHAT_ACTION';

interface VisualizationChatActionContext extends EmbeddableContext {
  embeddable: IEmbeddable;
}

export interface VisualizationChatActionParams {
  core: CoreStart;
  onChatOpen: (imageData: string, visualizationTitle: string, embeddableId: string) => void;
}

export class VisualizationChatAction implements Action<VisualizationChatActionContext> {
  public readonly type = VISUALIZATION_CHAT_ACTION;
  public readonly id = VISUALIZATION_CHAT_ACTION;
  public order = 100;

  constructor(private params: VisualizationChatActionParams) {}

  public getDisplayName({ embeddable }: VisualizationChatActionContext): string {
    return i18n.translate('dashboardAssistant.visualizationChatAction.displayName', {
      defaultMessage: 'Ask AI about this visualization',
    });
  }

  public getIconType({ embeddable }: VisualizationChatActionContext): EuiIconType {
    return 'discuss';
  }

  public async isCompatible({ embeddable }: VisualizationChatActionContext): Promise<boolean> {
    // Only show for visualization embeddables
    return embeddable.type === 'visualization' || 
           embeddable.type === 'lens' || 
           embeddable.type === 'map' ||
           embeddable.type === 'vega';
  }

  public async execute({ embeddable }: VisualizationChatActionContext): Promise<void> {
    try {
      // Find the embeddable's DOM element
      const embeddableElement = document.querySelector(
        `[data-test-embeddable-id="${embeddable.id}"] .embPanel__content`
      ) as HTMLElement;

      if (!embeddableElement) {
        this.params.core.notifications.toasts.addWarning({
          title: i18n.translate('dashboardAssistant.visualizationChatAction.elementNotFound', {
            defaultMessage: 'Could not find visualization element',
          }),
        });
        return;
      }

      // Show loading toast
      const loadingToast = this.params.core.notifications.toasts.addInfo({
        title: i18n.translate('dashboardAssistant.visualizationChatAction.capturing', {
          defaultMessage: 'Capturing visualization...',
        }),
        toastLifeTimeMs: 2000,
      });

      // Capture screenshot of the visualization
      const screenshot = await ScreenshotService.captureElementScreenshot(embeddableElement, {
        format: 'png',
        quality: 0.9,
      });

      // Get visualization title
      const title = embeddable.getTitle() || i18n.translate('dashboardAssistant.visualizationChatAction.untitledVisualization', {
        defaultMessage: 'Untitled Visualization',
      });

      // Open chat with the screenshot
      this.params.onChatOpen(screenshot.data, title, embeddable.id);

      this.params.core.notifications.toasts.addSuccess({
        title: i18n.translate('dashboardAssistant.visualizationChatAction.success', {
          defaultMessage: 'Visualization captured successfully',
        }),
        toastLifeTimeMs: 2000,
      });

    } catch (error) {
      console.error('Failed to capture visualization:', error);
      this.params.core.notifications.toasts.addError(error as Error, {
        title: i18n.translate('dashboardAssistant.visualizationChatAction.error', {
          defaultMessage: 'Failed to capture visualization',
        }),
      });
    }
  }
}