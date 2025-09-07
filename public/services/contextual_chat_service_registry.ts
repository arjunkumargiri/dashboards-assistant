/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ISpecializedExtractor
} from '../../common/types/contextual_chat_service';

/**
 * Frontend Service Registry for Contextual Chat System
 * 
 * This class manages frontend services for the contextual chat feature.
 * Note: UI context services have been removed in favor of snapshot-based approach.
 */
export class FrontendContextualChatServiceRegistry {
  private contentExtractors: Map<string, ISpecializedExtractor> = new Map();

  /**
   * Register content extractor
   */
  public registerContentExtractor(extractor: ISpecializedExtractor): void {
    const extractorId = `${extractor.getContentType()}_${Date.now()}`;
    this.contentExtractors.set(extractorId, extractor);
  }

  /**
   * Get all registered content extractors
   */
  public getContentExtractors(): ISpecializedExtractor[] {
    return Array.from(this.contentExtractors.values());
  }

  /**
   * Get content extractors by type
   */
  public getExtractorsByType(contentType: string): ISpecializedExtractor[] {
    return this.getContentExtractors().filter(
      extractor => extractor.getContentType() === contentType
    );
  }

  /**
   * Check if all required services are registered
   */
  public isFullyConfigured(): boolean {
    return this.contentExtractors.size > 0;
  }

  /**
   * Get registration status
   */
  public getRegistrationStatus(): {
    extractorCount: number;
  } {
    return {
      extractorCount: this.contentExtractors.size
    };
  }

  /**
   * Initialize all registered services
   */
  public initializeServices(): void {
    // Snapshot-based approach - no continuous services to initialize
  }

  /**
   * Cleanup all registered services
   */
  public cleanupServices(): void {
    // Snapshot-based approach - no continuous services to cleanup
  }

  /**
   * Clear all registrations (for testing)
   */
  public clear(): void {
    this.cleanupServices();
    this.contentExtractors.clear();
  }
}

// Global registry instance
let globalFrontendRegistry: FrontendContextualChatServiceRegistry | null = null;

/**
 * Get the global frontend service registry instance
 */
export function getFrontendContextualChatServiceRegistry(): FrontendContextualChatServiceRegistry {
  if (!globalFrontendRegistry) {
    globalFrontendRegistry = new FrontendContextualChatServiceRegistry();
  }
  return globalFrontendRegistry;
}

/**
 * Reset the global frontend registry (for testing)
 */
export function resetFrontendContextualChatServiceRegistry(): void {
  if (globalFrontendRegistry) {
    globalFrontendRegistry.clear();
  }
  globalFrontendRegistry = null;
}