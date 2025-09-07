/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { schema, TypeOf } from '@osd/config-schema';

export const configSchema = schema.object({
  enabled: schema.boolean({ defaultValue: true }),
  chat: schema.object({
    enabled: schema.boolean({ defaultValue: false }),
    trace: schema.boolean({ defaultValue: true }),
    feedback: schema.boolean({ defaultValue: true }),
    allowRenameConversation: schema.boolean({ defaultValue: true }),
    deleteConversation: schema.boolean({ defaultValue: true }),
    regenerateMessage: schema.boolean({ defaultValue: true }),
    showConversationHistory: schema.boolean({ defaultValue: true }),
  }),
  incontextInsight: schema.object({
    enabled: schema.boolean({ defaultValue: true }),
  }),
  next: schema.object({
    enabled: schema.boolean({ defaultValue: false }),
  }),
  text2viz: schema.object({
    enabled: schema.boolean({ defaultValue: false }),
  }),
  alertInsight: schema.object({
    enabled: schema.boolean({ defaultValue: false }),
  }),
  smartAnomalyDetector: schema.object({
    enabled: schema.boolean({ defaultValue: false }),
  }),
  contextualChat: schema.object({
    enabled: schema.boolean({ defaultValue: true }),
    maxVisualizations: schema.number({ defaultValue: 20 }),
    contextCacheTTL: schema.number({ defaultValue: 300 }),
    extractionTimeout: schema.number({ defaultValue: 5000 }),
    security: schema.object({
      respectPermissions: schema.boolean({ defaultValue: true }),
      auditAccess: schema.boolean({ defaultValue: true }),
    }),
    performance: schema.object({
      debounceMs: schema.number({ defaultValue: 500 }),
      maxContentElements: schema.number({ defaultValue: 50 }),
      enableLazyLoading: schema.boolean({ defaultValue: true }),
    }),
  }),
  aiAgent: schema.object({
    enabled: schema.boolean({ defaultValue: false }),
    baseUrl: schema.string({ defaultValue: 'http://localhost:8000' }),
    timeout: schema.number({ defaultValue: 300000 }), // 5 minutes
    healthCheckInterval: schema.number({ defaultValue: 60000 }), // 1 minute
  }),
  branding: schema.object({
    label: schema.maybe(schema.string()),
    logo: schema.maybe(
      schema.object({
        gradient: schema.maybe(schema.string()),
        gray: schema.maybe(schema.string()),
        white: schema.maybe(schema.string()),
      })
    ),
  }),
});

export type ConfigSchema = TypeOf<typeof configSchema>;
