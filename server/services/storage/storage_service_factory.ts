/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenSearchClient } from '../../../../../src/core/server';
import { ConfigSchema } from '../../../common/types/config';
import { AgentFrameworkStorageService } from './agent_framework_storage_service';
import { OpenSearchAgentsStorageService } from './opensearch_agents_storage_service';

export class StorageServiceFactory {
  static create(
    config: ConfigSchema,
    opensearchClientTransport: OpenSearchClient['transport'],
    messageParsers: any,
    logger: any
  ): AgentFrameworkStorageService {
    if (config.aiAgent.enabled) {
      logger.info('Using OpenSearch-Agents storage service (memory features disabled)');
      return new OpenSearchAgentsStorageService(opensearchClientTransport, messageParsers, logger);
    } else {
      logger.info('Using standard Agent Framework storage service');
      return new AgentFrameworkStorageService(opensearchClientTransport, messageParsers);
    }
  }
}
