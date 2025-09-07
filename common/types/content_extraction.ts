/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContentElement, ContentType, UIContext } from './ui_context';

/**
 * Content Extraction Pipeline Types
 * 
 * This file defines interfaces and types for the content extraction pipeline
 * that processes DOM elements and embeddables to extract meaningful data.
 */

// ============================================================================
// Extraction Pipeline Interface
// ============================================================================

export interface IContentExtractionPipeline {
  extractors: IContentExtractor[];
  processors: IContentProcessor[];
  validators: IContentValidator[];
  prioritizers: IContentPrioritizer[];

  /**
   * Process a full extraction pipeline
   */
  process(elements: HTMLElement[], userQuery?: string): Promise<ContentElement[]>;

  /**
   * Add extractor to pipeline
   */
  addExtractor(extractor: IContentExtractor): void;

  /**
   * Remove extractor from pipeline
   */
  removeExtractor(extractorId: string): void;
}

// ============================================================================
// DOM-based Extraction Strategy
// ============================================================================

export interface IDOMExtractionStrategy {
  selectors: ContentSelector[];
  extractionRules: ExtractionRule[];
  fallbackStrategies: FallbackStrategy[];

  /**
   * Apply extraction strategy to DOM
   */
  extract(document: Document): Promise<ContentElement[]>;

  /**
   * Check if strategy can handle current page
   */
  canHandle(document: Document): boolean;
}

export interface ContentSelector {
  type: ContentType;
  selector: string;
  attributes: string[];
  dataExtraction: DataExtractionMethod;
  priority: number;
}

export interface ExtractionRule {
  contentType: ContentType;
  selector: string;
  dataPath?: string;
  transform?: (data: any) => any;
  validate?: (data: any) => boolean;
}

export interface FallbackStrategy {
  condition: string;
  selector: string;
  extractionMethod: DataExtractionMethod;
}

export enum DataExtractionMethod {
  TEXT_CONTENT = 'textContent',
  INNER_HTML = 'innerHTML',
  DATA_ATTRIBUTES = 'dataAttributes',
  COMPUTED_STYLE = 'computedStyle',
  EMBEDDABLE_API = 'embeddableApi',
  CUSTOM_FUNCTION = 'customFunction'
}

// ============================================================================
// Specialized Extractor Interfaces
// ============================================================================

export interface IVisualizationExtractor extends ISpecializedExtractor {
  /**
   * Extract chart data from visualization
   */
  extractChartData(element: HTMLElement | any): Promise<ChartData>;

  /**
   * Get visualization type
   */
  getVisualizationType(element: HTMLElement | any): string;

  /**
   * Extract visualization metadata
   */
  extractMetadata(element: HTMLElement | any): Promise<VisualizationMetadata>;
}

export interface ITableExtractor extends ISpecializedExtractor {
  /**
   * Extract table headers
   */
  extractHeaders(element: HTMLElement): string[];

  /**
   * Extract table rows
   */
  extractRows(element: HTMLElement): any[][];

  /**
   * Extract pagination info
   */
  extractPaginationInfo(element: HTMLElement): PaginationInfo | null;

  /**
   * Extract sorting info
   */
  extractSortingInfo(element: HTMLElement): SortInfo | null;
}

export interface ITextExtractor extends ISpecializedExtractor {
  /**
   * Extract plain text content
   */
  extractPlainText(element: HTMLElement): string;

  /**
   * Extract formatted text (HTML)
   */
  extractFormattedText(element: HTMLElement): string;

  /**
   * Extract markdown content
   */
  extractMarkdown(element: HTMLElement): string | null;

  /**
   * Extract links from text
   */
  extractLinks(element: HTMLElement): LinkInfo[];
}

export interface IFormExtractor extends ISpecializedExtractor {
  /**
   * Extract form fields
   */
  extractFields(element: HTMLElement): FormField[];

  /**
   * Extract current form values
   */
  extractValues(element: HTMLElement): Record<string, any>;

  /**
   * Extract validation state
   */
  extractValidationInfo(element: HTMLElement): ValidationInfo;
}

export interface INavigationExtractor extends ISpecializedExtractor {
  /**
   * Extract navigation items
   */
  extractNavigationItems(element: HTMLElement): NavigationItem[];

  /**
   * Extract current path
   */
  extractCurrentPath(element: HTMLElement): string;

  /**
   * Extract available actions
   */
  extractAvailableActions(element: HTMLElement): ActionInfo[];
}

// ============================================================================
// Content Processing Interfaces
// ============================================================================

export interface IContentAggregator {
  /**
   * Aggregate similar content elements
   */
  aggregate(elements: ContentElement[]): ContentElement[];

  /**
   * Group related elements
   */
  groupRelated(elements: ContentElement[]): ContentElementGroup[];
}

export interface IContentSummarizer {
  /**
   * Summarize content element
   */
  summarize(element: ContentElement): Promise<string>;

  /**
   * Summarize multiple elements
   */
  summarizeMultiple(elements: ContentElement[]): Promise<string>;
}

export interface IContentRelationshipMapper {
  /**
   * Map relationships between elements
   */
  mapRelationships(elements: ContentElement[]): ContentElement[];

  /**
   * Find related elements
   */
  findRelated(element: ContentElement, allElements: ContentElement[]): ContentElement[];
}

// ============================================================================
// Security and Validation
// ============================================================================

export interface ISecurityValidator {
  /**
   * Validate user access to content
   */
  validateAccess(user: any, content: ContentElement): boolean;

  /**
   * Sanitize content for security
   */
  sanitizeContent(content: ContentElement): ContentElement;

  /**
   * Filter content based on permissions
   */
  filterByPermissions(content: ContentElement[], permissions: any): ContentElement[];

  /**
   * Audit content access
   */
  auditAccess(user: any, contentId: string): void;
}

export interface IDataSanitizer {
  /**
   * Sanitize HTML content
   */
  sanitizeHTML(html: string): string;

  /**
   * Sanitize text content
   */
  sanitizeText(text: string): string;

  /**
   * Remove sensitive data
   */
  removeSensitiveData(data: any): any;
}

// ============================================================================
// Performance and Caching
// ============================================================================

export interface IContentCache {
  /**
   * Get cached content
   */
  get(key: string): ContentElement | null;

  /**
   * Set cached content
   */
  set(key: string, content: ContentElement, ttl?: number): void;

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void;

  /**
   * Clear all cache
   */
  clear(): void;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

export interface IPerformanceMonitor {
  /**
   * Start timing operation
   */
  startTimer(operation: string): string;

  /**
   * End timing operation
   */
  endTimer(timerId: string): number;

  /**
   * Record extraction metrics
   */
  recordExtraction(contentType: ContentType, duration: number, success: boolean): void;

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics;
}

export interface PerformanceMetrics {
  averageExtractionTime: number;
  successRate: number;
  errorRate: number;
  cacheHitRate: number;
  memoryUsage: number;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ContentElementGroup {
  type: string;
  elements: ContentElement[];
  relationship: string;
  summary?: string;
}

export interface VisualizationMetadata {
  type: string;
  title?: string;
  description?: string;
  dataSource?: string;
  lastUpdated?: string;
  config?: Record<string, any>;
}

// Import required types from other files
import { 
  ISpecializedExtractor, 
  IContentProcessor, 
  IContentValidator, 
  IContentPrioritizer,
  IContentExtractor
} from './contextual_chat_service';

import { 
  ChartData, 
  PaginationInfo, 
  SortInfo, 
  LinkInfo, 
  FormField, 
  ValidationInfo, 
  NavigationItem, 
  ActionInfo 
} from './ui_context';