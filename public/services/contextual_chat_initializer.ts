/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreStart } from '../../../../src/core/public';
import { ConfigSchema } from '../../common/types/config';

// Note: UI context service has been removed in favor of snapshot-based approach
// Context is now extracted on-demand using browser-based scrapers

/**
 * Initialize contextual chat services on the frontend
 */
export function initializeContextualChatPublicServices(
  config: ConfigSchema,
  core: CoreStart
): void {
  if (!config.contextualChat?.enabled) {
    console.log('Contextual chat is disabled, skipping public service initialization');
    return;
  }

  console.log('Initializing contextual chat public services...');
  
  try {
    // Snapshot-based approach - no persistent services to initialize
    // Context extraction happens on-demand when chat is used
    console.log('Contextual chat using snapshot-based approach - no persistent services needed');

    console.log('Contextual chat public services successfully initialized');

  } catch (error) {
    console.error('Failed to initialize contextual chat public services:', error);
    // Don't throw error to avoid breaking the plugin
  }
}

/**
 * Check if contextual chat is ready
 */
export function isContextualChatReady(): boolean {
  // Always ready with snapshot-based approach
  return true;
}

/**
 * Get contextual chat service status
 */
export function getContextualChatStatus() {
  return {
    isReady: true,
    approach: 'snapshot-based'
  };
}