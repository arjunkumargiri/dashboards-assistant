/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SavedObjectsType } from '../../../../src/core/server';

/**
 * Contextual Chat Saved Object Types - Snapshot-based approach
 *
 * Note: With the snapshot-based approach, we don't need persistent
 * contextual chat saved objects since context is extracted on-demand.
 * This file provides an empty array to maintain compatibility.
 */

/**
 * Array of contextual chat saved object types
 * Empty for snapshot-based approach - no persistent contextual data needed
 */
export const contextualChatSavedObjectTypes: SavedObjectsType[] = [
  // No saved object types needed for snapshot-based contextual chat
  // Context is extracted on-demand from browser snapshots
];

/**
 * Legacy saved object types (if any were previously defined)
 * These can be added here if migration from previous versions is needed
 */
export const legacyContextualChatSavedObjectTypes: SavedObjectsType[] = [
  // Add any legacy types here if migration is needed
];
