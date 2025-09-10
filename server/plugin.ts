/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { first } from 'rxjs/operators';
import { ConfigSchema } from '../common/types/config';
import {
  CoreSetup,
  CoreStart,
  Logger,
  OpenSearchDashboardsRequest,
  Plugin,
  PluginInitializerContext,
} from '../../../src/core/server';
import { AssistantPluginSetup, AssistantPluginStart, MessageParser } from './types';
import { BasicInputOutputParser } from './parsers/basic_input_output_parser';
import { VisualizationCardParser } from './parsers/visualization_card_parser';
import { registerChatRoutes } from './routes/chat_routes';
import { registerText2VizRoutes } from './routes/text2viz_routes';
import { AssistantService } from './services/assistant_service';
import { registerAgentRoutes } from './routes/agent_routes';
import {
  registerSummaryAssistantRoutes,
  registerData2SummaryRoutes,
} from './routes/summary_routes';
import { capabilitiesProvider as visNLQCapabilitiesProvider } from './vis_type_nlq/capabilities_provider';
import { visNLQSavedObjectType } from './vis_type_nlq/saved_object_type';
import { capabilitiesProvider } from './capabilities';
import { ENABLE_AI_FEATURES } from './utils/constants';
import { getContextualChatServiceRegistry } from './services/contextual_chat_service_registry';
import { contextualChatSavedObjectTypes } from './saved_objects/contextual_chat_saved_objects';
import { initializeContextualChatServices } from './services/contextual_chat_initializer';

export class AssistantPlugin implements Plugin<AssistantPluginSetup, AssistantPluginStart> {
  private readonly logger: Logger;
  private messageParsers: MessageParser[] = [];
  private assistantService = new AssistantService();
  private contextualChatServiceRegistry = getContextualChatServiceRegistry();

  constructor(private readonly initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public async setup(core: CoreSetup): Promise<AssistantPluginSetup> {
    this.logger.debug('Assistant: Setup');
    const config = await this.initializerContext.config
      .create<ConfigSchema>()
      .pipe(first())
      .toPromise();

    const assistantServiceSetup = this.assistantService.setup();

    // Initialize contextual chat service registry if enabled
    if (config.contextualChat?.enabled) {
      this.logger.info('Contextual chat feature is enabled (snapshot-based approach)');

      // Register contextual chat saved object types (if any)
      if (contextualChatSavedObjectTypes.length > 0) {
        contextualChatSavedObjectTypes.forEach((type) => {
          core.savedObjects.registerType(type);
        });
        this.logger.debug(
          `Registered ${contextualChatSavedObjectTypes.length} contextual chat saved object types`
        );
      } else {
        this.logger.debug(
          'No contextual chat saved object types to register (snapshot-based approach)'
        );
      }

      // Initialize and register contextual chat services
      try {
        initializeContextualChatServices(config, this.logger);
        this.logger.info('Contextual chat services initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize contextual chat services:', error);
        // Continue with plugin initialization even if contextual chat fails
      }
    }

    const router = core.http.createRouter();

    core.http.registerRouteHandlerContext('assistant_plugin', () => {
      return {
        logger: this.logger,
      };
    });

    registerAgentRoutes(router, assistantServiceSetup);

    // Register server side APIs
    registerChatRoutes(router, {
      config,
      messageParsers: this.messageParsers,
      auth: core.http.auth,
    });

    // Register router for text to visualization
    if (config.text2viz.enabled) {
      registerText2VizRoutes(router, assistantServiceSetup);
      core.capabilities.registerProvider(visNLQCapabilitiesProvider);
      core.savedObjects.registerType(visNLQSavedObjectType);
    }

    // Register router for alert insight
    if (config.alertInsight.enabled) {
      registerSummaryAssistantRoutes(router, assistantServiceSetup);
    }

    core.capabilities.registerProvider(capabilitiesProvider);
    // register UI capabilities from dynamic config service
    core.capabilities.registerSwitcher(
      async (opensearchDashboardsRequest: OpenSearchDashboardsRequest) => {
        const dynamicConfigServiceStart = await core.dynamicConfigService.getStartService();
        const store = dynamicConfigServiceStart.getAsyncLocalStore();
        const client = dynamicConfigServiceStart.getClient();

        try {
          const dynamicConfig = await client.getConfig(
            { pluginConfigPath: 'assistant' },
            { asyncLocalStorageContext: store! }
          );

          const [coreStart] = await core.getStartServices();
          const savedObjectsClient = coreStart.savedObjects.getScopedClient(
            opensearchDashboardsRequest
          );
          const uiSettingsClient = coreStart.uiSettings.asScopedToClient(savedObjectsClient);
          const isAssistantEnabledBySetting = await uiSettingsClient.get(ENABLE_AI_FEATURES);

          return {
            assistant: {
              enabled: dynamicConfig.enabled && isAssistantEnabledBySetting,
              chatEnabled: dynamicConfig.chat.enabled && isAssistantEnabledBySetting,
            },
          };
        } catch (e) {
          this.logger.error(e);
          return {};
        }
      }
    );

    // Register router for discovery summary
    registerData2SummaryRoutes(router, assistantServiceSetup);

    const registerMessageParser = (messageParser: MessageParser) => {
      const findItem = this.messageParsers.find((item) => item.id === messageParser.id);
      if (findItem) {
        throw new Error(`There is already a messageParser whose id is ${messageParser.id}`);
      }

      this.messageParsers.push(messageParser);
    };

    registerMessageParser(BasicInputOutputParser);
    registerMessageParser(VisualizationCardParser);

    return {
      assistantService: assistantServiceSetup,
      registerMessageParser,
      removeMessageParser: (parserId: MessageParser['id']) => {
        const findIndex = this.messageParsers.findIndex((item) => item.id === parserId);
        if (findIndex < 0) {
          this.logger.error(`There is not a messageParser whose id is ${parserId}`);
        }

        this.messageParsers.splice(findIndex, 1);
      },
      contextualChatServiceRegistry: this.contextualChatServiceRegistry,
    };
  }

  public start(core: CoreStart) {
    this.logger.debug('Assistant: Started');
    this.assistantService.start();
    return {};
  }

  public stop() {
    this.assistantService.stop();
  }
}
