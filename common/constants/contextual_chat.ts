/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Constants for Contextual Chat Feature
 *
 * This file defines constants used throughout the contextual chat system.
 */

// ============================================================================
// Feature Constants
// ============================================================================

export const CONTEXTUAL_CHAT_FEATURE_ID = 'contextual-chat';

export const CONTEXTUAL_CHAT_CONFIG_KEY = 'assistant.contextual_chat';

// ============================================================================
// Default Configuration Values
// ============================================================================

export const DEFAULT_CONTEXTUAL_CHAT_CONFIG = {
  enabled: true,
  maxVisualizations: 20,
  contextCacheTTL: 300, // 5 minutes in seconds
  extractionTimeout: 5000, // 5 seconds in milliseconds
  security: {
    respectPermissions: true,
    auditAccess: true,
  },
  performance: {
    debounceMs: 500,
    maxContentElements: 50,
    enableLazyLoading: true,
  },
} as const;

// ============================================================================
// Content Type Priorities
// ============================================================================

export const CONTENT_TYPE_PRIORITIES = {
  VISUALIZATION: 10,
  DATA_TABLE: 9,
  METRIC: 8,
  SEARCH_RESULTS: 7,
  TEXT_PANEL: 6,
  MARKDOWN: 5,
  CONTROL_PANEL: 4,
  FORM: 3,
  NAVIGATION_MENU: 2,
  BREADCRUMB: 1,
  OTHER: 0,
} as const;

// ============================================================================
// DOM Selectors for Content Extraction
// ============================================================================

export const DOM_SELECTORS = {
  // Dashboard and visualization selectors
  DASHBOARD_CONTAINER: '[data-test-subj="dashboardViewport"]',
  EMBEDDABLE_PANEL: '[data-test-subj="embeddablePanelHeading-"]',
  VISUALIZATION: '.visualization',
  CHART_CONTAINER: '.chart-container',

  // Data table selectors
  DATA_TABLE: '[data-test-subj="paginated-table-body"]',
  TABLE_HEADER: 'thead th',
  TABLE_ROW: 'tbody tr',

  // Text content selectors
  MARKDOWN_PANEL: '.markdown-panel',
  TEXT_PANEL: '.text-panel',

  // Control and filter selectors
  FILTER_BAR: '[data-test-subj="globalFilterBar"]',
  TIME_PICKER: '[data-test-subj="superDatePickerToggleQuickMenuButton"]',
  CONTROL_PANEL: '.control-panel',

  // Navigation selectors
  BREADCRUMBS: '[data-test-subj="breadcrumbs"]',
  NAV_MENU: '[data-test-subj="navDrawer"]',

  // Generic content selectors
  LOADING_SPINNER: '.loading-spinner',
  ERROR_MESSAGE: '.error-message',
} as const;

// ============================================================================
// Event Types
// ============================================================================

export const UI_CHANGE_EVENTS = {
  CONTENT_ADDED: 'content_added',
  CONTENT_REMOVED: 'content_removed',
  CONTENT_MODIFIED: 'content_modified',
  CONTENT_MOVED: 'content_moved',
  FILTER_CHANGED: 'filter_changed',
  TIME_RANGE_CHANGED: 'time_range_changed',
  NAVIGATION_CHANGED: 'navigation_changed',
} as const;

// ============================================================================
// Cache Keys
// ============================================================================

export const CACHE_KEYS = {
  UI_CONTEXT: 'ui_context',
  PAGE_CONTEXT: 'page_context',
  CONTENT_ELEMENT: 'content_element',
  EXTRACTION_RESULT: 'extraction_result',
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  CONTEXT_EXTRACTION_FAILED: 'Failed to extract UI context',
  CONTEXT_NOT_AVAILABLE: 'UI context is not available for this page',
  EXTRACTION_TIMEOUT: 'Content extraction timed out',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions to access content',
  SERVICE_NOT_REGISTERED: 'Required service is not registered',
  INVALID_CONTENT_TYPE: 'Invalid content type specified',
} as const;

// ============================================================================
// Performance Thresholds
// ============================================================================

export const PERFORMANCE_THRESHOLDS = {
  MAX_EXTRACTION_TIME: 5000, // 5 seconds
  MAX_CONTENT_ELEMENTS: 50,
  MAX_CACHE_SIZE: 100,
  DEBOUNCE_DELAY: 500, // 500ms
  THROTTLE_DELAY: 1000, // 1 second
} as const;

// ============================================================================
// Security Constants
// ============================================================================

export const SECURITY_CONSTANTS = {
  SENSITIVE_ATTRIBUTES: ['data-password', 'data-secret', 'data-token', 'data-key'],
  RESTRICTED_SELECTORS: ['[data-sensitive]', '.sensitive-data', '.password-field', '.token-field'],
  AUDIT_EVENTS: {
    CONTEXT_ACCESSED: 'context_accessed',
    CONTENT_EXTRACTED: 'content_extracted',
    PERMISSION_DENIED: 'permission_denied',
  },
} as const;

// ============================================================================
// Content Extraction Patterns
// ============================================================================

export const EXTRACTION_PATTERNS = {
  CHART_TITLE: {
    selectors: ['.chart-title', '.vis-title', '[data-test-subj="visTitle"]'],
    attribute: 'textContent',
  },
  CHART_DATA: {
    selectors: ['.chart-data', '.vis-data'],
    attribute: 'data-chart-data',
  },
  TABLE_PAGINATION: {
    selectors: ['.pagination', '[data-test-subj="pagination"]'],
    attribute: 'data-pagination-info',
  },
  FILTER_VALUES: {
    selectors: ['.filter-value', '[data-test-subj="filterValue"]'],
    attribute: 'data-filter-value',
  },
} as const;
