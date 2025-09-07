/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@osd/logging';
import { SavedObjectsClientContract } from '@osd/core/server';
import { FeatureFlagManager } from '../feature_flag_manager';

describe('FeatureFlagManager', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockSavedObjectsClient: jest.Mocked<SavedObjectsClientContract>;
  let featureFlagManager: FeatureFlagManager;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      get: jest.fn(),
    } as any;

    mockSavedObjectsClient = {
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
    } as any;

    featureFlagManager = new FeatureFlagManager(mockLogger, mockSavedObjectsClient);
  });

  describe('initialization', () => {
    it('should initialize with default flags', () => {
      const flags = featureFlagManager.getAllFlags();

      expect(flags).toHaveLength(8);
      expect(flags.find(f => f.key === 'contextual_chat_enabled')).toBeDefined();
      expect(flags.find(f => f.key === 'content_extraction_enabled')).toBeDefined();
      expect(flags.find(f => f.key === 'admin_interface_enabled')).toBeDefined();
    });

    it('should validate dependencies correctly', () => {
      const validation = featureFlagManager.validateDependencies();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('flag evaluation', () => {
    it('should return default value when no override exists', () => {
      expect(featureFlagManager.isEnabled('contextual_chat_enabled')).toBe(true);
      expect(featureFlagManager.isEnabled('admin_interface_enabled')).toBe(false);
    });

    it('should return false for unknown flags', () => {
      expect(featureFlagManager.isEnabled('unknown_flag')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Unknown feature flag: unknown_flag');
    });

    it('should respect overrides', () => {
      featureFlagManager.setOverride('contextual_chat_enabled', false, 'Testing');

      expect(featureFlagManager.isEnabled('contextual_chat_enabled')).toBe(false);
    });

    it('should handle dependency chains', () => {
      featureFlagManager.setOverride('contextual_chat_enabled', false, 'Testing');

      // content_extraction_enabled depends on contextual_chat_enabled
      expect(featureFlagManager.isEnabled('content_extraction_enabled')).toBe(false);
    });

    it('should handle rollout percentages', () => {
      // admin_interface_enabled has 10% rollout
      const userId1 = 'user1';
      const userId2 = 'user2';

      // Test multiple users to verify percentage logic
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(featureFlagManager.isEnabled('admin_interface_enabled', `user${i}`));
      }

      const enabledCount = results.filter(Boolean).length;
      expect(enabledCount).toBeLessThan(20); // Should be around 10%
    });
  });

  describe('override management', () => {
    it('should set overrides correctly', () => {
      featureFlagManager.setOverride('contextual_chat_enabled', false, 'Maintenance mode', 'admin');

      const overrides = featureFlagManager.getAllOverrides();
      expect(overrides).toHaveLength(1);
      expect(overrides[0].key).toBe('contextual_chat_enabled');
      expect(overrides[0].value).toBe(false);
      expect(overrides[0].reason).toBe('Maintenance mode');
      expect(overrides[0].userId).toBe('admin');
    });

    it('should remove overrides correctly', () => {
      featureFlagManager.setOverride('contextual_chat_enabled', false, 'Testing');
      featureFlagManager.removeOverride('contextual_chat_enabled');

      const overrides = featureFlagManager.getAllOverrides();
      expect(overrides).toHaveLength(0);
      expect(featureFlagManager.isEnabled('contextual_chat_enabled')).toBe(true);
    });

    it('should get flag status for user', () => {
      featureFlagManager.setOverride('contextual_chat_enabled', false, 'Testing');

      const status = featureFlagManager.getFlagStatus('testuser');

      expect(status.contextual_chat_enabled).toBe(false);
      expect(status.content_extraction_enabled).toBe(false); // Due to dependency
    });
  });

  describe('persistence', () => {
    it('should load overrides from saved objects', async () => {
      const mockOverrides = [
        {
          id: 'contextual_chat_enabled',
          attributes: {
            key: 'contextual_chat_enabled',
            value: false,
            reason: 'Loaded from storage',
            timestamp: Date.now(),
          },
        },
      ];

      mockSavedObjectsClient.find.mockResolvedValue({
        saved_objects: mockOverrides,
        total: 1,
        per_page: 100,
        page: 1,
      });

      await featureFlagManager.loadOverrides();

      expect(featureFlagManager.isEnabled('contextual_chat_enabled')).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Loaded 1 feature flag overrides');
    });

    it('should handle load errors gracefully', async () => {
      mockSavedObjectsClient.find.mockRejectedValue(new Error('Storage error'));

      await featureFlagManager.loadOverrides();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load feature flag overrides', expect.any(Error));
    });

    it('should save overrides to saved objects', async () => {
      mockSavedObjectsClient.create.mockResolvedValue({} as any);

      await featureFlagManager.saveOverride({
        key: 'contextual_chat_enabled',
        value: false,
        reason: 'Testing persistence',
        timestamp: Date.now(),
      });

      expect(mockSavedObjectsClient.create).toHaveBeenCalledWith(
        'contextual-chat-feature-flags',
        expect.objectContaining({
          key: 'contextual_chat_enabled',
          value: false,
          reason: 'Testing persistence',
        }),
        { id: 'contextual_chat_enabled', overwrite: true }
      );
    });

    it('should handle save errors', async () => {
      mockSavedObjectsClient.create.mockRejectedValue(new Error('Storage error'));

      await expect(featureFlagManager.saveOverride({
        key: 'contextual_chat_enabled',
        value: false,
        reason: 'Testing error',
        timestamp: Date.now(),
      })).rejects.toThrow('Storage error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save feature flag override for contextual_chat_enabled',
        expect.any(Error)
      );
    });

    it('should handle missing saved objects client', async () => {
      const managerWithoutClient = new FeatureFlagManager(mockLogger);

      await managerWithoutClient.loadOverrides();
      expect(mockLogger.warn).toHaveBeenCalledWith('SavedObjectsClient not available, skipping override loading');

      await managerWithoutClient.saveOverride({
        key: 'test',
        value: true,
        reason: 'test',
        timestamp: Date.now(),
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('SavedObjectsClient not available, cannot save override');
    });
  });

  describe('user ID hashing', () => {
    it('should produce consistent hash for same user ID', () => {
      const userId = 'testuser123';
      
      // Test multiple times to ensure consistency
      const result1 = featureFlagManager.isEnabled('analytics_enabled', userId);
      const result2 = featureFlagManager.isEnabled('analytics_enabled', userId);
      
      expect(result1).toBe(result2);
    });

    it('should produce different results for different users', () => {
      const results = new Set();
      
      // Test with many different user IDs
      for (let i = 0; i < 100; i++) {
        results.add(featureFlagManager.isEnabled('analytics_enabled', `user${i}`));
      }
      
      // Should have both true and false results
      expect(results.size).toBe(2);
      expect(results.has(true)).toBe(true);
      expect(results.has(false)).toBe(true);
    });
  });
});