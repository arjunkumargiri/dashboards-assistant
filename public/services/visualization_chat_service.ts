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
    const baseQuestions = [
      'What trends do you see in this visualization?',
      'What insights can you provide about this data?',
      'Are there any anomalies or outliers in this chart?',
      'What recommendations do you have based on this data?',
      'Can you explain what this visualization is showing?',
    ];

    // Add context-specific questions based on title keywords
    const titleLower = visualizationTitle.toLowerCase();
    const contextualQuestions: string[] = [];

    if (titleLower.includes('time') || titleLower.includes('trend')) {
      contextualQuestions.push('What time-based patterns do you notice?');
      contextualQuestions.push('How has this metric changed over time?');
    }

    if (titleLower.includes('error') || titleLower.includes('failure')) {
      contextualQuestions.push('What might be causing these errors?');
      contextualQuestions.push('How can we reduce the error rate?');
    }

    if (titleLower.includes('performance') || titleLower.includes('latency')) {
      contextualQuestions.push('How can we improve performance based on this data?');
      contextualQuestions.push('What are the performance bottlenecks?');
    }

    if (titleLower.includes('user') || titleLower.includes('traffic')) {
      contextualQuestions.push('What user behavior patterns do you see?');
      contextualQuestions.push('How can we improve user experience?');
    }

    return [...contextualQuestions, ...baseQuestions].slice(0, 5);
  }

  /**
   * Validate screenshot for chat usage
   */
  public validateScreenshotForChat(screenshot: ScreenshotResult): { valid: boolean; error?: string } {
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