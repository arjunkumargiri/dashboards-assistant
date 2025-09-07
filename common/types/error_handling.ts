/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Error types for contextual chat functionality
 */
export enum ContextualChatErrorType {
  // Context extraction errors
  CONTEXT_EXTRACTION_FAILED = 'context_extraction_failed',
  CONTEXT_TIMEOUT = 'context_timeout',
  CONTEXT_UNAVAILABLE = 'context_unavailable',
  PARTIAL_CONTEXT_ONLY = 'partial_context_only',
  
  // Permission and security errors
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  UNAUTHORIZED_CONTENT = 'unauthorized_content',
  SECURITY_VALIDATION_FAILED = 'security_validation_failed',
  
  // Service errors
  CHAT_SERVICE_UNAVAILABLE = 'chat_service_unavailable',
  PROMPT_BUILDER_FAILED = 'prompt_builder_failed',
  RESPONSE_PROCESSOR_FAILED = 'response_processor_failed',
  
  // DOM and UI errors
  DOM_OBSERVER_FAILED = 'dom_observer_failed',
  ELEMENT_NOT_FOUND = 'element_not_found',
  ELEMENT_NOT_ACCESSIBLE = 'element_not_accessible',
  
  // Cache and performance errors
  CACHE_ERROR = 'cache_error',
  EXTRACTION_QUEUE_FULL = 'extraction_queue_full',
  MEMORY_LIMIT_EXCEEDED = 'memory_limit_exceeded',
  
  // Network and connectivity errors
  NETWORK_ERROR = 'network_error',
  SERVICE_TIMEOUT = 'service_timeout',
  
  // Configuration errors
  INVALID_CONFIGURATION = 'invalid_configuration',
  FEATURE_DISABLED = 'feature_disabled',
  
  // Unknown errors
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Severity levels for contextual chat errors
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Recovery strategies for different error types
 */
export enum RecoveryStrategy {
  FALLBACK_TO_STANDARD_CHAT = 'fallback_to_standard_chat',
  RETRY_WITH_BACKOFF = 'retry_with_backoff',
  USE_PARTIAL_CONTEXT = 'use_partial_context',
  SKIP_CONTEXT = 'skip_context',
  NOTIFY_USER = 'notify_user',
  LOG_AND_CONTINUE = 'log_and_continue',
  FAIL_GRACEFULLY = 'fail_gracefully'
}

/**
 * Contextual chat error interface
 */
export interface ContextualChatError extends Error {
  type: ContextualChatErrorType;
  severity: ErrorSeverity;
  recoveryStrategy: RecoveryStrategy;
  context?: {
    elementId?: string;
    pageUrl?: string;
    userAction?: string;
    timestamp: string;
    additionalInfo?: Record<string, any>;
  };
  originalError?: Error;
  retryable: boolean;
  userMessage?: string;
}

/**
 * Error recovery result
 */
export interface ErrorRecoveryResult<T = any> {
  success: boolean;
  result?: T;
  fallbackUsed: boolean;
  partialResult: boolean;
  userNotified: boolean;
  error?: ContextualChatError;
}

/**
 * User notification for context issues
 */
export interface ContextIssueNotification {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  dismissible: boolean;
  autoHide?: boolean;
  duration?: number;
}

/**
 * Fallback configuration
 */
export interface FallbackConfiguration {
  enableStandardChatFallback: boolean;
  enablePartialContextFallback: boolean;
  maxRetryAttempts: number;
  retryBackoffMs: number;
  timeoutMs: number;
  notifyUserOnFallback: boolean;
  logAllErrors: boolean;
}

/**
 * Error handler interface
 */
export interface IErrorHandler {
  handleError<T>(
    error: Error | ContextualChatError,
    context?: any
  ): Promise<ErrorRecoveryResult<T>>;
  
  createContextualError(
    type: ContextualChatErrorType,
    message: string,
    originalError?: Error,
    context?: any
  ): ContextualChatError;
  
  shouldRetry(error: ContextualChatError): boolean;
  getRecoveryStrategy(error: ContextualChatError): RecoveryStrategy;
  notifyUser(notification: ContextIssueNotification): void;
}

/**
 * Graceful degradation interface
 */
export interface IGracefulDegradation {
  fallbackToStandardChat<T>(
    originalRequest: any,
    error: ContextualChatError
  ): Promise<T>;
  
  usePartialContext<T>(
    partialContext: any,
    originalRequest: any,
    error: ContextualChatError
  ): Promise<T>;
  
  skipContextEntirely<T>(
    originalRequest: any,
    error: ContextualChatError
  ): Promise<T>;
  
  isPartialContextUsable(partialContext: any): boolean;
  getMinimalContext(): any;
}

/**
 * Error metrics interface
 */
export interface IErrorMetrics {
  recordError(error: ContextualChatError): void;
  recordRecovery(recovery: ErrorRecoveryResult): void;
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ContextualChatErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recoverySuccessRate: number;
    fallbackUsageRate: number;
  };
  getRecentErrors(limit?: number): ContextualChatError[];
}