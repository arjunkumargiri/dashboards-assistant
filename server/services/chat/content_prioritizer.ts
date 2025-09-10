/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { ContentElement, ContentType } from '../../../common/types/ui_context';

/**
 * Content Prioritizer - Snapshot-based approach
 *
 * This service prioritizes UI content elements based on relevance
 * to user queries and content importance.
 */
export class ContentPrioritizer {
  constructor(
    private logger: Logger,
    private config: {
      enableSemanticScoring: boolean;
      keywordWeights: Record<string, number>;
      typeWeights: Record<ContentType, number>;
    }
  ) {
    // Set default type weights if not provided
    if (!this.config.typeWeights || Object.keys(this.config.typeWeights).length === 0) {
      this.config.typeWeights = {
        [ContentType.VISUALIZATION]: 2.0,
        [ContentType.DATA_TABLE]: 1.8,
        [ContentType.SEARCH_RESULTS]: 1.6,
        [ContentType.FORM]: 1.2,
        [ContentType.TEXT]: 1.0,
        [ContentType.IMAGE]: 0.8,
        [ContentType.NAVIGATION]: 0.6,
        [ContentType.FILTER]: 1.4,
        [ContentType.METRIC]: 2.2,
        [ContentType.ALERT]: 2.5,
      };
    }
  }

  /**
   * Prioritize content elements based on relevance to user query
   */
  async prioritizeContent(
    content: ContentElement[],
    userQuery: string,
    maxElements: number
  ): Promise<ContentElement[]> {
    try {
      if (!content || content.length === 0) {
        return [];
      }

      // Score each content element
      const scoredContent = content.map((element) => ({
        element,
        score: this.calculateContentScore(element, userQuery),
      }));

      // Sort by score (highest first) and take top elements
      const prioritized = scoredContent
        .sort((a, b) => b.score - a.score)
        .slice(0, maxElements)
        .map((item) => item.element);

      this.logger.debug('Prioritized content elements', {
        totalElements: content.length,
        selectedElements: prioritized.length,
        topScores: scoredContent.slice(0, 5).map((item) => ({
          title: item.element.title,
          type: item.element.type,
          score: item.score,
        })),
      });

      return prioritized;
    } catch (error) {
      this.logger.error('Error prioritizing content:', error);
      return content.slice(0, maxElements); // Fallback to first N elements
    }
  }

  /**
   * Calculate relevance score for a content element
   */
  private calculateContentScore(element: ContentElement, userQuery: string): number {
    let score = 0;

    // Base score from content type
    const typeWeight = this.config.typeWeights[element.type] || 1.0;
    score += typeWeight;

    // Visibility bonus
    if (element.visibility?.isVisible) {
      score += 1.0;
    }
    if (element.visibility?.inViewport) {
      score += 0.5;
    }

    // Keyword matching in title and description
    if (element.title) {
      score += this.calculateKeywordScore(element.title, userQuery);
    }
    if (element.description) {
      score += this.calculateKeywordScore(element.description, userQuery) * 0.8;
    }

    // Data relevance scoring
    if (element.data) {
      score += this.calculateDataRelevanceScore(element.data, userQuery);
    }

    // Position bonus (elements higher on page are more important)
    if (element.position) {
      const positionBonus = Math.max(0, 1 - element.position.y / 1000); // Normalize by typical page height
      score += positionBonus * 0.3;
    }

    // Size bonus (larger elements are typically more important)
    if (element.position?.width && element.position?.height) {
      const area = element.position.width * element.position.height;
      const sizeBonus = Math.min(1, area / 500000); // Normalize by typical large element area
      score += sizeBonus * 0.2;
    }

    return score;
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(text: string, userQuery: string): number {
    if (!text || !userQuery) {
      return 0;
    }

    const textLower = text.toLowerCase();
    const queryLower = userQuery.toLowerCase();
    let score = 0;

    // Exact phrase match
    if (textLower.includes(queryLower)) {
      score += 2.0;
    }

    // Individual keyword matches
    const queryWords = queryLower.split(/\s+/).filter((word) => word.length > 2);
    queryWords.forEach((word) => {
      if (textLower.includes(word)) {
        const weight = this.config.keywordWeights[word] || 1.0;
        score += weight * 0.5;
      }
    });

    // Weighted keyword matches
    Object.entries(this.config.keywordWeights).forEach(([keyword, weight]) => {
      if (textLower.includes(keyword.toLowerCase())) {
        score += weight * 0.3;
      }
    });

    return score;
  }

  /**
   * Calculate data relevance score
   */
  private calculateDataRelevanceScore(data: any, userQuery: string): number {
    let score = 0;

    // Chart data relevance
    if (data.chartData) {
      score += 0.5; // Base score for having chart data

      if (data.chartData.trends) {
        score += 0.3; // Bonus for trend information
      }

      if (data.chartData.values && data.chartData.values.length > 0) {
        score += Math.min(0.5, data.chartData.values.length / 100); // More data points = higher score
      }
    }

    // Table data relevance
    if (data.tableData) {
      score += 0.4; // Base score for having table data

      if (data.tableData.rows && data.tableData.rows.length > 0) {
        score += Math.min(0.4, data.tableData.rows.length / 50); // More rows = higher score
      }
    }

    // Form data relevance
    if (data.formData) {
      score += 0.2; // Base score for form data
    }

    return score;
  }

  /**
   * Get content prioritization statistics
   */
  getStats(
    content: ContentElement[]
  ): {
    totalElements: number;
    typeDistribution: Record<string, number>;
    visibilityStats: { visible: number; inViewport: number };
  } {
    const typeDistribution: Record<string, number> = {};
    let visible = 0;
    let inViewport = 0;

    content.forEach((element) => {
      // Count by type
      typeDistribution[element.type] = (typeDistribution[element.type] || 0) + 1;

      // Count visibility
      if (element.visibility?.isVisible) visible++;
      if (element.visibility?.inViewport) inViewport++;
    });

    return {
      totalElements: content.length,
      typeDistribution,
      visibilityStats: { visible, inViewport },
    };
  }
}
