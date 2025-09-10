/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreStart } from '../../../../src/core/public';
import { ScreenshotService, ScreenshotResult } from './screenshot_service';
import { IMessage } from '../types';

export interface VisualizationChatContext {
  imageData: string;
  visualizationTitle: string;
  embeddableId: string;
  dashboardTitle?: string;
  timestamp: number;
}

export class VisualizationChatService {
  constructor(private core: CoreStart) {}

  /**
   * Create a contextual chat message with visualization image
   */
  public createVisualizationChatMessage(
    userQuery: string,
    context: VisualizationChatContext
  ): IMessage {
    const contextualPrompt = this.buildContextualPrompt(userQuery, context);

    return {
      type: 'input',
      contentType: 'text',
      content: contextualPrompt,
      context: {
        appId: 'dashboards',
        conversationId: `viz-${context.embeddableId}-${context.timestamp}`,
        visualization: {
          id: context.embeddableId,
          title: context.visualizationTitle,
          imageData: context.imageData,
          dashboardTitle: context.dashboardTitle,
        },
      },
    };
  }

  /**
   * Build a contextual prompt that includes visualization information
   */
  private buildContextualPrompt(userQuery: string, context: VisualizationChatContext): string {
    const basePrompt = `I'm looking at a visualization titled "${context.visualizationTitle}"`;
    const dashboardContext = context.dashboardTitle
      ? ` from the dashboard "${context.dashboardTitle}"`
      : '';

    const contextPrompt = `${basePrompt}${dashboardContext}. I've attached an image of this visualization. 

User question: ${userQuery}

Please analyze the visualization in the image and provide insights based on what you can see. Consider:
- The type of chart/visualization
- The data patterns and trends visible
- Any notable insights or anomalies
- Recommendations based on the data shown

If you cannot see the image clearly or need more specific data details, please let me know what additional information would be helpful.`;

    return contextPrompt;
  }

  /**
   * Generate suggested questions based on visualization type
   */
  public generateSuggestedQuestions(visualizationTitle: string): string[] {
    const titleLower = visualizationTitle.toLowerCase();
    const contextualQuestions: string[] = [];

    // Time-series and trend analysis
    if (
      titleLower.includes('time') ||
      titleLower.includes('trend') ||
      titleLower.includes('over time')
    ) {
      contextualQuestions.push('What time-based patterns and trends do you notice?');
      contextualQuestions.push('Are there any seasonal or cyclical patterns?');
      contextualQuestions.push('What caused the significant changes over time?');
    }

    // Error and failure analysis
    if (
      titleLower.includes('error') ||
      titleLower.includes('failure') ||
      titleLower.includes('exception')
    ) {
      contextualQuestions.push('What might be causing these errors or failures?');
      contextualQuestions.push('How can we reduce the error rate?');
      contextualQuestions.push('Are there patterns in when errors occur?');
    }

    // Performance and latency analysis
    if (
      titleLower.includes('performance') ||
      titleLower.includes('latency') ||
      titleLower.includes('response')
    ) {
      contextualQuestions.push('What are the main performance bottlenecks?');
      contextualQuestions.push('How can we optimize performance based on this data?');
      contextualQuestions.push('What performance thresholds should we be concerned about?');
    }

    // User behavior and traffic analysis
    if (
      titleLower.includes('user') ||
      titleLower.includes('traffic') ||
      titleLower.includes('visitor')
    ) {
      contextualQuestions.push('What user behavior patterns do you observe?');
      contextualQuestions.push('How can we improve user experience based on this data?');
      contextualQuestions.push('What insights can help drive user engagement?');
    }

    // Sales and revenue analysis
    if (
      titleLower.includes('sales') ||
      titleLower.includes('revenue') ||
      titleLower.includes('conversion')
    ) {
      contextualQuestions.push('What factors are driving sales performance?');
      contextualQuestions.push('How can we improve conversion rates?');
      contextualQuestions.push('What revenue optimization opportunities do you see?');
    }

    // System monitoring and metrics
    if (
      titleLower.includes('cpu') ||
      titleLower.includes('memory') ||
      titleLower.includes('disk') ||
      titleLower.includes('system')
    ) {
      contextualQuestions.push('Are there any system resource concerns?');
      contextualQuestions.push('What system optimization recommendations do you have?');
      contextualQuestions.push('How can we prevent system issues based on these metrics?');
    }

    // Geographic and location data
    if (
      titleLower.includes('map') ||
      titleLower.includes('geo') ||
      titleLower.includes('location') ||
      titleLower.includes('region')
    ) {
      contextualQuestions.push('What geographic patterns do you notice?');
      contextualQuestions.push('How do different regions compare?');
      contextualQuestions.push('What location-based insights can guide our strategy?');
    }

    // General analysis questions
    const baseQuestions = [
      'What are the key insights from this visualization?',
      'Are there any anomalies or outliers that need attention?',
      'What actionable recommendations do you have?',
      'What should we investigate further based on this data?',
      'How does this data compare to expected benchmarks?',
    ];

    // Combine contextual and base questions, prioritizing contextual ones
    const allQuestions = [...contextualQuestions, ...baseQuestions];

    // Return up to 6 unique questions
    return Array.from(new Set(allQuestions)).slice(0, 6);
  }

  /**
   * Validate screenshot for chat usage
   */
  public validateScreenshotForChat(
    screenshot: ScreenshotResult
  ): { valid: boolean; error?: string } {
    // Use the existing validation from ScreenshotService
    const validation = ScreenshotService.validateScreenshot(screenshot);

    if (!validation.valid) {
      return validation;
    }

    // Additional validation for chat usage
    if (screenshot.width < 100 || screenshot.height < 100) {
      return {
        valid: false,
        error: 'Screenshot is too small for meaningful analysis',
      };
    }

    return { valid: true };
  }

  /**
   * Create a chat session context for visualization
   */
  public createChatSessionContext(context: VisualizationChatContext) {
    return {
      sessionId: `viz-chat-${context.embeddableId}-${Date.now()}`,
      type: 'visualization',
      metadata: {
        visualizationId: context.embeddableId,
        visualizationTitle: context.visualizationTitle,
        dashboardTitle: context.dashboardTitle,
        timestamp: context.timestamp,
        hasImage: true,
      },
    };
  }
}
