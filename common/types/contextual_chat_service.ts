/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Stream } from 'stream';
import { RequestHandlerContext } from '../../../../../src/core/server';
import { IMessage, IInput } from './chat_saved_object_attributes';
import { UIContext } from './ui_context';

/**
 * Service Interfaces for Contextual Chat System
 *
 * This file defines the service interfaces for the contextual chat feature,
 * extending the existing chat service with UI context awareness.
 */

// ============================================================================
// Enhanced Chat Service Interface
// ============================================================================

export interface IContextualChatService {
  /**
   * Enhanced LLM request with UI context support
   */
  requestLLMWithContext(
    payload: {
      messages: IMessage[];
      input: IInput;
      conversationId?: string;
      uiContext?: UIContext;
    },
    context: RequestHandlerContext
  ): Promise<{
    messages: IMessage[];
    conversationId: string;
    interactionId: string;
    stream?: Stream;
  }>;

  /**
   * Regenerate response with context awareness
   */
  regenerateWithContext(
    payload: {
      conversationId: string;
      interactionId: string;
      rootAgentId: string;
      uiContext?: UIContext;
    },
    context: RequestHandlerContext
  ): Promise<{
    messages: IMessage[];
    conversationId: string;
    interactionId: string;
  }>;

  /**
   * Check if contextual features are available
   */
  isContextualModeAvailable(): boolean;

  /**
   * Abort agent execution (inherited from base service)
   */
  abortAgentExecution(conversationId: string): void;
}

// ============================================================================
// UI Context Service Interface
// ============================================================================

export interface IUIContextService {
  /**
   * Get current UI context from the active page
   */
  getCurrentContext(): Promise<UIContext>;

  /**
   * Subscribe to context changes
   */
  subscribeToContextChanges(callback: (context: UIContext) => void): () => void;

  /**
   * Extract content data from a specific element
   */
  extractContentData(elementId: string): Promise<ContentElement | null>;

  /**
   * Get page context information
   */
  getPageContext(): Promise<PageContext>;

  /**
   * Get all visible elements on the current page
   */
  getVisibleElements(): Promise<ContentElement[]>;

  /**
   * Refresh context data
   */
  refreshContext(): Promise<UIContext>;

  /**
   * Check if context extraction is available for current page
   */
  isContextAvailable(): boolean;

  /**
   * Start observing UI changes
   */
  startObserving(): void;

  /**
   * Stop observing UI changes
   */
  stopObserving(): void;
}

// ============================================================================
// Content Extraction Interfaces
// ============================================================================

export interface IContentExtractor {
  /**
   * Extract content from a DOM element
   */
  extractFromElement(element: HTMLElement): Promise<ContentElement>;

  /**
   * Extract content from an embeddable instance
   */
  extractFromEmbeddable(embeddable: any): Promise<ContentElement>;

  /**
   * Extract text content from element
   */
  extractTextContent(element: HTMLElement): TextContent;

  /**
   * Extract table data from element
   */
  extractTableData(element: HTMLElement): TableData;

  /**
   * Extract form data from element
   */
  extractFormData(element: HTMLElement): FormData;

  /**
   * Extract navigation context
   */
  extractNavigationContext(): NavigationContext;

  /**
   * Check if extractor can handle the given element
   */
  canHandle(element: HTMLElement | any): boolean;
}

export interface ISpecializedExtractor {
  /**
   * Check if this extractor can handle the element/embeddable
   */
  canHandle(element: HTMLElement | any): boolean;

  /**
   * Extract content from the element/embeddable
   */
  extract(element: HTMLElement | any): Promise<ContentElement>;

  /**
   * Get the content type this extractor handles
   */
  getContentType(): ContentType;
}

// ============================================================================
// Context Processing Interfaces
// ============================================================================

export interface IContextualPromptBuilder {
  /**
   * Build enhanced prompt with UI context
   */
  buildPrompt(userMessage: string, context: UIContext): string;

  /**
   * Format content elements for LLM consumption
   */
  formatContentElements(elements: ContentElement[]): string;

  /**
   * Format page context for LLM consumption
   */
  formatPageContext(pageContext: PageContext): string;

  /**
   * Format user actions for LLM consumption
   */
  formatUserActions(actions: UserActionContext[]): string;

  /**
   * Prioritize relevant content based on user query
   */
  prioritizeRelevantContent(userMessage: string, context: UIContext): ContentElement[];
}

export interface IContentProcessor {
  /**
   * Process extracted content elements
   */
  process(content: ContentElement[]): Promise<ContentElement[]>;
}

export interface IContentValidator {
  /**
   * Validate content element
   */
  validate(content: ContentElement): boolean;

  /**
   * Sanitize content element for security
   */
  sanitize(content: ContentElement): ContentElement;
}

export interface IContentPrioritizer {
  /**
   * Prioritize content based on user query relevance
   */
  prioritize(content: ContentElement[], userQuery: string): ContentElement[];
}

// ============================================================================
// DOM Observation Interface (DEPRECATED - using snapshot-based approach)
// ============================================================================

/**
 * @deprecated This interface is no longer used. Context extraction now uses
 * snapshot-based approach with on-demand browser-based scrapers.
 */
export interface IDOMObserver {
  /**
   * Start observing DOM changes
   */
  startObserving(): void;

  /**
   * Stop observing DOM changes
   */
  stopObserving(): void;

  /**
   * Subscribe to content changes
   */
  onContentChange(callback: (changes: UIChange[]) => void): () => void;

  /**
   * Check if observer is currently active
   */
  isObserving(): boolean;
}

// ============================================================================
// Frontend Context Provider Interface (DEPRECATED - using snapshot-based approach)
// ============================================================================

/**
 * @deprecated This interface is no longer used. Context extraction now uses
 * snapshot-based approach with on-demand browser-based scrapers.
 */
export interface IUIContextProvider {
  /**
   * Get current UI context (React hook compatible)
   */
  useCurrentUIContext(): UIContext | null;

  /**
   * Refresh context data
   */
  refreshContext(): Promise<void>;

  /**
   * Check if context is available
   */
  isContextAvailable(): boolean;

  /**
   * Start observing UI changes
   */
  observeUIChanges(): void;

  /**
   * Get context for specific element
   */
  getElementContext(selector: string): ContentElement | null;

  /**
   * Subscribe to context updates
   */
  subscribeToUpdates(callback: (context: UIContext | null) => void): () => void;
}

// ============================================================================
// Service Registration Interface
// ============================================================================

export interface IContextualChatServiceRegistry {
  /**
   * Register UI context service
   */
  registerUIContextService(service: IUIContextService): void;

  /**
   * Register content extractor
   */
  registerContentExtractor(extractor: ISpecializedExtractor): void;

  /**
   * Register contextual chat service
   */
  registerContextualChatService(service: IContextualChatService): void;

  /**
   * Get registered UI context service
   */
  getUIContextService(): IUIContextService | null;

  /**
   * Get all registered content extractors
   */
  getContentExtractors(): ISpecializedExtractor[];

  /**
   * Get contextual chat service
   */
  getContextualChatService(): IContextualChatService | null;
}

// ============================================================================
// Configuration Interface
// ============================================================================

export interface IContextualChatConfig {
  enabled: boolean;
  maxVisualizations: number;
  contextCacheTTL: number;
  extractionTimeout: number;
  security: {
    respectPermissions: boolean;
    auditAccess: boolean;
  };
  performance: {
    debounceMs: number;
    maxContentElements: number;
    enableLazyLoading: boolean;
  };
}

// Import types from ui_context.ts
import {
  ContentElement,
  ContentType,
  UIChange,
  PageContext,
  NavigationContext,
  TextContent,
  TableData,
  FormData,
  UserActionContext,
} from './ui_context';
