/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ISpecializedExtractor,
  IContextualChatService
} from '../../common/types/contextual_chat_service';

/**
 * Service Registry for Contextual Chat System - Snapshot-based approach
 * 
 * This class implements dependency injection and service registration
 * for the contextual chat feature components.
 * Note: UI context services removed in favor of snapshot-based approach.
 */
export class ContextualChatServiceRegistry {
  private contentExtractors: Map<string, ISpecializedExtractor> = new Map();
  private contextualChatService: IContextualChatService | null = null;

  /**
   * Register content extractor
   */
  public registerContentExtractor(extractor: ISpecializedExtractor): void {
    const extractorId = `${extractor.getContentType()}_${Date.now()}`;
    this.contentExtractors.set(extractorId, extractor);
  }

  /**
   * Register contextual chat service
   */
  public registerContextualChatService(service: IContextualChatService): void {
    this.contextualChatService = service;
  }

  /**
   * Get all registered content extractors
   */
  public getContentExtractors(): ISpecializedExtractor[] {
    return Array.from(this.contentExtractors.values());
  }

  /**
   * Get contextual chat service
   */
  public getContextualChatService(): IContextualChatService | null {
    return this.contextualChatService;
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
    return this.contextualChatService !== null &&
           this.contentExtractors.size > 0;
  }

  /**
   * Get registration status
   */
  public getRegistrationStatus(): {
    contextualChatService: boolean;
    extractorCount: number;
  } {
    return {
      contextualChatService: this.contextualChatService !== null,
      extractorCount: this.contentExtractors.size
    };
  }

  /**
   * Clear all registrations (for testing)
   */
  public clear(): void {
    this.contextualChatService = null;
    this.contentExtractors.clear();
  }
}

// Global registry instance
let globalRegistry: ContextualChatServiceRegistry | null = null;

/**
 * Get the global service registry instance
 */
export function getContextualChatServiceRegistry(): ContextualChatServiceRegistry {
  if (!globalRegistry) {
    globalRegistry = new ContextualChatServiceRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (for testing)
 */
export function resetContextualChatServiceRegistry(): void {
  globalRegistry = null;
}