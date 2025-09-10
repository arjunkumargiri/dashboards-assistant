/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResponseError } from '@opensearch-project/opensearch/lib/errors';
import { schema, TypeOf } from '@osd/config-schema';
import { SendResponse } from 'common/types/chat_saved_object_attributes';
import {
  HttpResponsePayload,
  IOpenSearchDashboardsResponse,
  IRouter,
  RequestHandlerContext,
} from '../../../../src/core/server';
import { ASSISTANT_API, DEFAULT_USER_NAME } from '../../common/constants/llm';
import { OllyChatService } from '../services/chat/olly_chat_service';
import { ChatServiceFactory } from '../services/chat/chat_service_factory';
import { AgentFrameworkStorageService } from '../services/storage/agent_framework_storage_service';
import { StorageServiceFactory } from '../services/storage/storage_service_factory';
import { RoutesOptions } from '../types';
import { ChatService } from '../services/chat/chat_service';
import { getOpenSearchClientTransport } from '../utils/get_opensearch_client_transport';
import { handleError } from './error_handler';

const llmRequestRoute = {
  path: ASSISTANT_API.SEND_MESSAGE,
  validate: {
    body: schema.object({
      conversationId: schema.maybe(schema.string()),
      messages: schema.maybe(schema.arrayOf(schema.any())),
      input: schema.object({
        type: schema.literal('input'),
        context: schema.object({
          appId: schema.maybe(schema.string()),
          content: schema.maybe(schema.string()),
          datasourceId: schema.maybe(schema.string()),
        }),
        content: schema.string(),
        contentType: schema.literal('text'),
        promptPrefix: schema.maybe(schema.string()),
        images: schema.maybe(
          schema.arrayOf(
            schema.object({
              data: schema.string(), // base64 encoded image data
              mimeType: schema.string(), // image/png, image/jpeg, etc.
              filename: schema.maybe(schema.string()),
            })
          )
        ),
      }),
      // Add UI context for contextual chat
      uiContext: schema.maybe(
        schema.object({
          page: schema.object({
            url: schema.string(),
            title: schema.string(),
            app: schema.string(),
            route: schema.string(),
            breadcrumbs: schema.arrayOf(schema.any()),
            metadata: schema.any(),
          }),
          content: schema.arrayOf(schema.any()),
          navigation: schema.object({
            currentApp: schema.string(),
            currentRoute: schema.string(),
            breadcrumbs: schema.arrayOf(schema.any()),
            availableApps: schema.arrayOf(schema.any()),
          }),
          filters: schema.arrayOf(schema.any()),
          userActions: schema.arrayOf(schema.any()),
          permissions: schema.object({
            canViewData: schema.boolean(),
            canModifyDashboard: schema.boolean(),
            canAccessApp: schema.boolean(),
            restrictedFields: schema.arrayOf(schema.string()),
            dataSourcePermissions: schema.any(),
          }),
          extractedAt: schema.string(),
        })
      ),
    }),
    query: schema.object({
      dataSourceId: schema.maybe(schema.string()),
    }),
  },
};
export type LLMRequestSchema = TypeOf<typeof llmRequestRoute.validate.body>;

const getConversationRoute = {
  path: `${ASSISTANT_API.CONVERSATION}/{conversationId}`,
  validate: {
    params: schema.object({
      conversationId: schema.string(),
    }),
    query: schema.object({
      dataSourceId: schema.maybe(schema.string()),
      nextToken: schema.maybe(schema.string()),
    }),
  },
};
export type GetConversationSchema = TypeOf<typeof getConversationRoute.validate.params>;

const abortAgentExecutionRoute = {
  path: `${ASSISTANT_API.ABORT_AGENT_EXECUTION}`,
  validate: {
    body: schema.object({
      conversationId: schema.string(),
    }),
    query: schema.object({
      dataSourceId: schema.maybe(schema.string()),
    }),
  },
};
export type AbortAgentExecutionSchema = TypeOf<typeof abortAgentExecutionRoute.validate.body>;

const regenerateRoute = {
  path: `${ASSISTANT_API.REGENERATE}`,
  validate: {
    body: schema.object({
      conversationId: schema.string(),
      interactionId: schema.string(),
    }),
    query: schema.object({
      dataSourceId: schema.maybe(schema.string()),
    }),
  },
};
export type RegenerateSchema = TypeOf<typeof regenerateRoute.validate.body>;

const getConversationsRoute = {
  path: ASSISTANT_API.CONVERSATIONS,
  validate: {
    query: schema.object({
      perPage: schema.number({ min: 0, defaultValue: 20 }),
      page: schema.number({ min: 0, defaultValue: 1 }),
      sortOrder: schema.maybe(schema.string()),
      sortField: schema.maybe(schema.string()),
      fields: schema.maybe(schema.arrayOf(schema.string())),
      search: schema.maybe(schema.string()),
      searchFields: schema.maybe(schema.oneOf([schema.string(), schema.arrayOf(schema.string())])),
      dataSourceId: schema.maybe(schema.string()),
    }),
  },
};
export type GetConversationsSchema = TypeOf<typeof getConversationsRoute.validate.query>;

const deleteConversationRoute = {
  path: `${ASSISTANT_API.CONVERSATION}/{conversationId}`,
  validate: {
    params: schema.object({
      conversationId: schema.string(),
    }),
    query: schema.object({
      dataSourceId: schema.maybe(schema.string()),
    }),
  },
};

const updateConversationRoute = {
  path: `${ASSISTANT_API.CONVERSATION}/{conversationId}`,
  validate: {
    params: schema.object({
      conversationId: schema.string(),
    }),
    body: schema.object({
      title: schema.string(),
    }),
    query: schema.object({
      dataSourceId: schema.maybe(schema.string()),
    }),
  },
};

const getTracesRoute = {
  path: `${ASSISTANT_API.TRACE}/{interactionId}`,
  validate: {
    params: schema.object({
      interactionId: schema.string(),
    }),
    query: schema.object({
      dataSourceId: schema.maybe(schema.string()),
    }),
  },
};

const feedbackRoute = {
  path: `${ASSISTANT_API.FEEDBACK}/{interactionId}`,
  validate: {
    params: schema.object({
      interactionId: schema.string(),
    }),
    body: schema.object({
      satisfaction: schema.boolean(),
    }),
    query: schema.object({
      dataSourceId: schema.maybe(schema.string()),
    }),
  },
};

const accountRoute = {
  path: `${ASSISTANT_API.ACCOUNT}`,
  validate: {},
};

export function registerChatRoutes(router: IRouter, routeOptions: RoutesOptions) {
  const createStorageService = async (context: RequestHandlerContext, dataSourceId?: string) =>
    StorageServiceFactory.create(
      routeOptions.config,
      await getOpenSearchClientTransport({ context, dataSourceId }),
      routeOptions.messageParsers,
      context.assistant_plugin.logger
    );
  const createChatService = async (context: RequestHandlerContext, dataSourceId?: string) =>
    ChatServiceFactory.create(
      routeOptions.config,
      await getOpenSearchClientTransport({ context, dataSourceId }),
      context.assistant_plugin.logger
    );

  router.post(
    llmRequestRoute,
    async (
      context: RequestHandlerContext,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const { messages = [], input, conversationId: conversationIdInRequestBody } = request.body;

      // Comprehensive context verification at route level
      console.log('🔍 ROUTE LEVEL - Context Analysis:', {
        contextExists: !!context,
        contextType: typeof context,
        contextConstructor: context?.constructor?.name,
        contextKeys: context ? Object.keys(context) : [],
        assistantPluginExists: !!context?.assistant_plugin,
        assistantPluginType: typeof context?.assistant_plugin,
        assistantPluginKeys: context?.assistant_plugin ? Object.keys(context.assistant_plugin) : [],
        loggerExists: !!context?.assistant_plugin?.logger,
        loggerType: typeof context?.assistant_plugin?.logger,
      });

      if (!context) {
        console.error('❌ CRITICAL: No context provided to chat route');
        return response.custom({
          statusCode: 500,
          body: 'Internal server error: No request context',
        });
      }

      if (!context.assistant_plugin) {
        console.error('❌ CRITICAL: Context missing assistant_plugin at route level');
        console.error('Available context keys:', Object.keys(context));
        return response.custom({
          statusCode: 500,
          body: 'Internal server error: Missing plugin context',
        });
      }

      const storageService = await createStorageService(context, request.query.dataSourceId);
      const chatService = await createChatService(context, request.query.dataSourceId);

      let outputs: Awaited<ReturnType<ChatService['requestLLM']>> | undefined;

      /**
       * Get final answer from Agent framework
       */
      try {
        // Check if this is a contextual chat service
        if (typeof (chatService as any).requestLLMWithContext === 'function') {
          // Extract UI context from request body if available
          const uiContext = (request.body as any).uiContext;

          context.assistant_plugin.logger.debug('Using contextual chat service', {
            hasUIContext: !!uiContext,
            contextElementCount: uiContext?.content?.length || 0,
            hasImages: !!input.images?.length,
            imageCount: input.images?.length || 0,
          });

          outputs = await (chatService as any).requestLLMWithContext(
            {
              messages,
              input,
              conversationId: conversationIdInRequestBody,
              uiContext,
            },
            context
          );
        } else {
          // Use standard chat service
          context.assistant_plugin.logger.debug('Using standard chat service', {
            hasImages: !!input.images?.length,
            imageCount: input.images?.length || 0,
          });

          outputs = await chatService.requestLLM(
            {
              messages,
              input,
              conversationId: conversationIdInRequestBody,
            },
            context
          );
        }
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }

      if (outputs.stream) {
        const result = response.ok({
          headers: {
            // Browsers often need to buffer the entire response before decompressing, which defeats the purpose of streaming.
            // need to set 'Content-Encoding' as 'identity' here to prevent browser buffering the response.
            'Content-Encoding': 'identity',
            Connection: 'keep-alive',
            'Content-Type': 'text/event-stream',
          },
          body: outputs.stream,
        });

        return result;
      }

      /**
       * Handle response based on chat service type
       */
      const conversationId = outputs?.conversationId || (conversationIdInRequestBody as string);
      const interactionId = outputs?.interactionId || '';

      try {
        if (!conversationId) {
          throw new Error('Not a valid conversation');
        }

        const resultPayload: SendResponse = {
          messages: [],
          interactions: [],
          conversationId,
        };

        // Check if we're using OpenSearch Agents service
        if (routeOptions.config.aiAgent.enabled) {
          // For OpenSearch Agents, return the messages directly from the chat service
          resultPayload.messages = outputs.messages || [];
          resultPayload.title = conversationIdInRequestBody ? undefined : 'New Conversation';

          // Create a mock interaction for compatibility
          if (resultPayload.messages.length > 0) {
            const lastMessage = resultPayload.messages[resultPayload.messages.length - 1];
            if (lastMessage.type === 'output') {
              resultPayload.interactions = [
                {
                  input: input.content,
                  response: lastMessage.content,
                  conversation_id: conversationId,
                  interaction_id: interactionId,
                  create_time: new Date().toISOString(),
                },
              ];
            }
          }
        } else {
          // For ML Commons service, use the existing storage-based approach
          if (!conversationIdInRequestBody) {
            /**
             * If no conversationId is provided in request payload,
             * it means it is a brand new conversation,
             * need to fetch all the details including title.
             */
            const conversation = await storageService.getConversation(conversationId);
            resultPayload.interactions = conversation.interactions;
            resultPayload.messages = conversation.messages;
            resultPayload.title = conversation.title;
          } else {
            /**
             * Only response with the latest interaction.
             * It may have some issues in Concurrent case like a user may use two tabs to chat with Chatbot in one conversation.
             * But for now we will ignore this case, can be optimized by always fetching conversation if we need to take this case into consideration.
             */
            const interaction = await storageService.getInteraction(conversationId, interactionId);
            resultPayload.interactions = [interaction].filter((item) => item);
            resultPayload.messages = resultPayload.interactions.length
              ? await storageService.getMessagesFromInteractions(resultPayload.interactions)
              : [];
          }

          resultPayload.messages
            .filter((message) => message.type === 'input')
            .forEach((msg) => {
              // hide additional conetxt to how was it generated
              const index = msg.content.indexOf('answer question:');
              const len = 'answer question:'.length;
              if (index !== -1) {
                msg.content = msg.content.substring(index + len);
              }
            });
        }

        return response.ok({
          body: resultPayload,
        });
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }
    }
  );

  router.get(
    getConversationRoute,
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const storageService = await createStorageService(context, request.query.dataSourceId);

      try {
        const getResponse = await storageService.getConversation(request.params.conversationId);
        return response.ok({ body: getResponse });
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }
    }
  );

  router.get(
    getConversationsRoute,
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const storageService = await createStorageService(context, request.query.dataSourceId);

      try {
        const getResponse = await storageService.getConversations(request.query);
        return response.ok({ body: getResponse });
      } catch (error) {
        // Return empty result for 404 errors
        if (error?.meta?.statusCode === 404) {
          return response.ok({ body: { objects: [], total: 0 } });
        }
        context.assistant_plugin.logger.error(error);
        return handleError(error, response, context.assistant_plugin.logger);
      }
    }
  );

  router.delete(
    deleteConversationRoute,
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const storageService = await createStorageService(context, request.query.dataSourceId);

      try {
        const getResponse = await storageService.deleteConversation(request.params.conversationId);
        return response.ok({ body: getResponse });
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }
    }
  );

  router.put(
    updateConversationRoute,
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const storageService = await createStorageService(context, request.query.dataSourceId);

      try {
        const getResponse = await storageService.updateConversation(
          request.params.conversationId,
          request.body.title
        );
        return response.ok({ body: getResponse });
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }
    }
  );

  router.get(
    getTracesRoute,
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const storageService = await createStorageService(context, request.query.dataSourceId);

      try {
        const getResponse = await storageService.getTraces(request.params.interactionId);
        return response.ok({ body: getResponse });
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }
    }
  );

  router.post(
    abortAgentExecutionRoute,
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const chatService = await createChatService(context, request.query.dataSourceId);
      try {
        chatService.abortAgentExecution(request.body.conversationId);
        context.assistant_plugin.logger.info(
          `Abort agent execution: ${request.body.conversationId}`
        );
        return response.ok();
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }
    }
  );

  router.put(
    regenerateRoute,
    async (
      context: RequestHandlerContext,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const { conversationId, interactionId } = request.body;
      const storageService = await createStorageService(context, request.query.dataSourceId);
      const chatService = await createChatService(context, request.query.dataSourceId);

      let outputs: Awaited<ReturnType<ChatService['regenerate']>> | undefined;

      /**
       * Get final answer from Agent framework
       */
      try {
        // Check if this is a contextual chat service
        if (typeof (chatService as any).regenerateWithContext === 'function') {
          // Extract UI context from request body if available
          const uiContext = (request.body as any).uiContext;

          outputs = await (chatService as any).regenerateWithContext(
            {
              conversationId,
              interactionId,
              rootAgentId: '', // This might need to be extracted from the conversation
              uiContext,
            },
            context
          );
        } else {
          // Use standard chat service
          outputs = await chatService.regenerate(
            {
              conversationId,
              interactionId,
              rootAgentId: '', // This might need to be extracted from the conversation
            },
            context
          );
        }
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }

      /**
       * Retrieve latest interactions from memory
       */
      try {
        const interaction = await storageService.getInteraction(
          conversationId,
          outputs?.interactionId || ''
        );
        const finalInteractions = [interaction].filter((item) => item);
        const messages = finalInteractions.length
          ? await storageService.getMessagesFromInteractions(finalInteractions)
          : [];

        return response.ok({
          body: {
            interactions: finalInteractions,
            messages,
            conversationId,
          },
        });
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({ statusCode: error.statusCode || 500, body: error.message });
      }
    }
  );

  router.put(
    feedbackRoute,
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      const storageService = await createStorageService(context, request.query.dataSourceId);
      const { interactionId } = request.params;

      try {
        const updateResponse = await storageService.updateInteraction(interactionId, {
          feedback: request.body,
        });
        return response.ok({ body: { ...updateResponse, success: true } });
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.custom({
          statusCode: error.statusCode || 500,
          body: error.message,
        });
      }
    }
  );

  router.get(
    accountRoute,
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<HttpResponsePayload | ResponseError>> => {
      try {
        const auth = routeOptions.auth.get<{
          authInfo?: {
            user_name?: string;
          };
        }>(request);
        return response.ok({
          body: {
            user_name: auth?.state?.authInfo?.user_name ?? DEFAULT_USER_NAME,
          },
        });
      } catch (error) {
        context.assistant_plugin.logger.error(error);
        return response.ok({
          body: { user_name: DEFAULT_USER_NAME },
        });
      }
    }
  );
}
