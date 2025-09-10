/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as uuid from 'uuid';
import { Readable } from 'stream';
import { RequestHandlerContext } from '../../../../../src/core/server';
import { IMessage, IInput } from '../../../common/types/chat_saved_object_attributes';
import { ChatService } from './chat_service';
import { ConfigSchema } from '../../../common/types/config';

interface OpenSearchAgentsChatRequest {
  query: string;
  session_id?: string;
  images?: Array<{
    data: string; // base64 encoded image data
    mime_type: string; // image/png, image/jpeg, etc.
    filename?: string;
  }>;
}

interface OpenSearchAgentsChatResponse {
  response: string;
  session_id: string;
  sources?: Array<{
    index: string;
    document_id: string;
    score: number;
    timestamp: string;
  }>;
  confidence: number;
  query_time_ms: number;
  total_results: number;
  timestamp: string;
}

export class OpenSearchAgentsChatService implements ChatService {
  private static abortControllers: Map<string, AbortController> = new Map();

  constructor(private readonly config: ConfigSchema['aiAgent'], private readonly logger: any) {}

  /**
   * Get OpenSearch client from context for potential future use
   * (e.g., for storing conversation metadata, user preferences, etc.)
   */
  private getOpenSearchClient(context: RequestHandlerContext) {
    return context.core?.opensearch?.client?.asCurrentUser;
  }

  private async makeStreamingRequest(
    endpoint: string,
    payload: any,
    conversationId?: string,
    context?: RequestHandlerContext,
    logger?: any
  ): Promise<Readable | null> {
    const controller = new AbortController();

    if (conversationId) {
      OpenSearchAgentsChatService.abortControllers.set(conversationId, controller);
    }

    // Set up timeout using AbortController
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Prepare headers for streaming
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      };

      // Add request tracing headers if context is available
      if (context && conversationId) {
        headers['X-Conversation-Id'] = conversationId;
        headers['X-Request-Source'] = 'opensearch-dashboards-assistant';
      }

      // Add user context if available
      if (context?.core?.opensearch?.client) {
        headers['X-Request-Context'] = 'authenticated';
      }

      // Use JSON format for both text-only and image requests in streaming
      // This matches the format used by makeAgentRequest and should work better with streaming
      const body = JSON.stringify(payload);
      headers['Content-Type'] = 'application/json';

      if (logger) {
        logger.debug(
          'Using JSON format for streaming request (works better than multipart for streaming):',
          {
            hasImages: !!(payload.images && payload.images.length > 0),
            imageCount: payload.images?.length || 0,
            payloadSize: body.length,
          }
        );
      }

      // Log the request details for debugging
      if (logger) {
        logger.debug('Making streaming request to OpenSearch Agents:', {
          url: `${this.config.baseUrl}${endpoint}`,
          method: 'POST',
          headers,
          hasImages: !!(payload.images && payload.images.length > 0),
          imageCount: payload.images?.length || 0,
          queryLength: payload.query?.length || 0,
        });
      }

      logger.warn('Made streaming request');
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (logger) {
          logger.error('OpenSearch Agents streaming API error response:', {
            status: response.status,
            statusText: response.statusText,
            errorBody: errorText,
          });
        }
        throw new Error(
          `OpenSearch Agents streaming API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      if (!response.body) {
        throw new Error('No response body received from streaming endpoint');
      }

      // Create a readable stream that processes Server-Sent Events
      const readable = new Readable({
        read() {},
      });

      // Process the streaming response
      this.processStreamingResponse(response.body, readable, conversationId, logger);

      return readable;
    } catch (error) {
      clearTimeout(timeoutId);
      if (logger) {
        logger.error(`OpenSearch Agents streaming request failed: ${error.message}`);
      }
      throw error;
    } finally {
      if (conversationId) {
        OpenSearchAgentsChatService.abortControllers.delete(conversationId);
      }
    }
  }

  private async processStreamingResponse(
    responseBody: ReadableStream<Uint8Array>,
    readable: Readable,
    conversationId?: string,
    logger?: any
  ): Promise<void> {
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));

              // Process different event types
              switch (eventData.type) {
                case 'start':
                  readable.push(
                    `data: ${JSON.stringify({
                      type: 'start',
                      conversationId: eventData.session_id || conversationId,
                      timestamp: new Date().toISOString(),
                    })}\n\n`
                  );
                  break;

                case 'content':
                  accumulatedContent += eventData.content || '';
                  readable.push(
                    `data: ${JSON.stringify({
                      type: 'content',
                      content: eventData.content || '',
                      accumulatedContent,
                      conversationId: eventData.session_id || conversationId,
                    })}\n\n`
                  );
                  break;

                case 'complete':
                  // Create final messages for the response
                  const inputMessage: IMessage = {
                    type: 'input',
                    contentType: 'text',
                    content: eventData.query || '',
                  };

                  const responseMessage: IMessage = {
                    type: 'output',
                    contentType: 'markdown',
                    content: eventData.response || accumulatedContent,
                    interactionId: `${eventData.session_id || conversationId}-${Date.now()}`,
                    traceId: `${eventData.session_id || conversationId}-${Date.now()}`,
                    createTime: new Date().toISOString(),
                    ...(eventData.sources &&
                      eventData.sources.length > 0 && {
                        sourceAttributions: eventData.sources.map((source: any) => ({
                          title: `Document ${source.document_id}`,
                          url: `#/discover?_a=(index:'${source.index}')`,
                          body: `Score: ${source.score}, Timestamp: ${source.timestamp}`,
                        })),
                      }),
                  };

                  readable.push(
                    `data: ${JSON.stringify({
                      type: 'complete',
                      messages: [inputMessage, responseMessage],
                      conversationId: eventData.session_id || conversationId,
                      interactionId: `${eventData.session_id || conversationId}-${Date.now()}`,
                      accumulatedContent,
                    })}\n\n`
                  );

                  readable.push(null); // End the stream
                  return;

                case 'error':
                  readable.push(
                    `data: ${JSON.stringify({
                      type: 'error',
                      error: eventData.error || 'Unknown streaming error',
                      conversationId: eventData.session_id || conversationId,
                    })}\n\n`
                  );

                  readable.push(null); // End the stream
                  return;

                default:
                  // Forward other event types as-is
                  readable.push(`data: ${JSON.stringify(eventData)}\n\n`);
              }
            } catch (parseError) {
              if (logger) {
                logger.warn('Failed to parse SSE event:', line, parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      if (logger) {
        logger.error('Error processing streaming response:', error);
      }
      readable.push(
        `data: ${JSON.stringify({
          type: 'error',
          error: error.message,
          conversationId,
        })}\n\n`
      );
    } finally {
      readable.push(null); // Ensure stream ends
      reader.releaseLock();
    }
  }

  private async makeAgentRequest(
    endpoint: string,
    payload: any,
    conversationId?: string,
    context?: RequestHandlerContext
  ): Promise<OpenSearchAgentsChatResponse> {
    const controller = new AbortController();

    if (conversationId) {
      OpenSearchAgentsChatService.abortControllers.set(conversationId, controller);
    }

    // Set up timeout using AbortController
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Prepare headers with potential context-based metadata
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add request tracing headers if context is available
      if (context && conversationId) {
        headers['X-Conversation-Id'] = conversationId;
        headers['X-Request-Source'] = 'opensearch-dashboards-assistant';
      }

      // Add user context if available
      if (context?.core?.opensearch?.client) {
        headers['X-Request-Context'] = 'authenticated';
      }

      // Log the request details for debugging
      this.logger.debug('Making request to OpenSearch Agents:', {
        url: `${this.config.baseUrl}${endpoint}`,
        method: 'POST',
        headers,
        payloadKeys: Object.keys(payload),
        payloadQuery: payload.query,
        payloadSize: JSON.stringify(payload).length,
      });

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('OpenSearch Agents API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
        });
        throw new Error(
          `OpenSearch Agents API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      this.logger.error(`OpenSearch Agents request failed: ${error.message}`);
      throw error;
    } finally {
      if (conversationId) {
        OpenSearchAgentsChatService.abortControllers.delete(conversationId);
      }
    }
  }

  async requestLLM(
    payload: { messages: IMessage[]; input: IInput; conversationId?: string },
    context: RequestHandlerContext
  ): Promise<{
    messages: IMessage[];
    conversationId: string;
    interactionId: string;
    stream?: Readable;
  }> {
    const { input, conversationId } = payload;

    // Debug: Log what we receive at OpenSearch Agents service level
    console.log('🎯 OpenSearch Agents Service - requestLLM called with:', {
      hasContext: !!context,
      contextType: typeof context,
      hasAssistantPlugin: !!context?.assistant_plugin,
      hasLogger: !!context?.assistant_plugin?.logger,
      contextKeys: context ? Object.keys(context) : 'no context',
      assistantPluginKeys: context?.assistant_plugin
        ? Object.keys(context.assistant_plugin)
        : 'no assistant_plugin',
    });

    // Use context logger for better traceability, with defensive checks
    const logger = context?.assistant_plugin?.logger || this.logger;

    // Log context availability for debugging
    if (!context) {
      this.logger.warn('OpenSearch Agents requestLLM: No context provided');
    } else if (!context.assistant_plugin) {
      this.logger.warn('OpenSearch Agents requestLLM: Context missing assistant_plugin');
    } else if (!context.assistant_plugin.logger) {
      this.logger.warn('OpenSearch Agents requestLLM: Context missing logger, using fallback');
    }

    // Validate input content
    if (!input.content || input.content.trim() === '') {
      throw new Error('Input content is required and cannot be empty');
    }

    let llmInput = input.content.trim();

    // If we have images, keep the query simple to avoid context window overflow
    // Otherwise, include context content if available
    if (input.images && input.images.length > 0) {
      // For image requests, use the user's question directly
      llmInput = input.content.trim();
      logger.debug('Using simple query for image request to avoid context overflow');
    } else if (input.context?.content) {
      // For text-only requests, include context
      llmInput = `Based on the context: ${input.context?.content}, answer question: ${input.content}`;
      logger.debug('Using context-enhanced query for text-only request');
    }

    // Validate final query
    if (!llmInput || llmInput.trim() === '') {
      throw new Error('Query cannot be empty after processing');
    }

    // Generate or validate session ID as UUID
    let sessionId = conversationId;
    if (!sessionId) {
      sessionId = uuid.v4();
      logger.debug('Generated new session ID:', { sessionId });
    } else {
      // Validate existing session ID is UUID format, if not generate new one
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(sessionId)) {
        logger.warn('Invalid session ID format, generating new UUID:', { oldSessionId: sessionId });
        sessionId = uuid.v4();
      }
    }

    const agentRequest: OpenSearchAgentsChatRequest = {
      query: llmInput,
      session_id: sessionId,
      ...(input.images &&
        input.images.length > 0 && {
          images: input.images.map((img) => ({
            data: img.data,
            mime_type: img.mimeType,
            filename: img.filename,
          })),
        }),
    };

    // Debug log the request structure
    logger.debug('OpenSearch Agents request:', {
      hasQuery: !!agentRequest.query,
      queryLength: agentRequest.query?.length || 0,
      hasSessionId: !!agentRequest.session_id,
      hasImages: !!agentRequest.images?.length,
      imageCount: agentRequest.images?.length || 0,
    });

    // Try streaming first - return stream directly to UI for real-time streaming
    try {
      logger.info('Attempting streaming response for OpenSearch Agents');
      const stream = await this.makeStreamingRequest(
        '/api/v1/chat/stream',
        agentRequest,
        conversationId,
        context,
        logger
      );

      if (stream) {
        logger.info('Successfully created streaming response - returning stream to UI');
        return {
          messages: [], // Empty messages for streaming mode
          conversationId: sessionId,
          interactionId: `${sessionId}-${Date.now()}`,
          stream, // Return the stream directly to the UI
        };
      }
    } catch (streamError) {
      logger.warn('Streaming failed, falling back to regular request:', streamError.message);
    }

    // Fallback to regular (non-streaming) request
    try {
      logger.info('Using regular (non-streaming) response for OpenSearch Agents');
      const agentResponse = await this.makeAgentRequest(
        '/api/v1/chat',
        agentRequest,
        conversationId,
        context
      );

      // Create input message
      const inputMessage: IMessage = {
        type: 'input',
        contentType: 'text',
        content: input.content,
        ...(input.context && { context: input.context }),
      };

      // Format the response as a message that the UI can display
      const responseMessage: IMessage = {
        type: 'output',
        contentType: 'markdown',
        content: agentResponse.response,
        interactionId: `${agentResponse.session_id}-${Date.now()}`,
        traceId: `${agentResponse.session_id}-${Date.now()}`,
        createTime: new Date().toISOString(),
        ...(agentResponse.sources &&
          agentResponse.sources.length > 0 && {
            sourceAttributions: agentResponse.sources.map((source) => ({
              title: `Document ${source.document_id}`,
              url: `#/discover?_a=(index:'${source.index}')`,
              body: `Score: ${source.score}, Timestamp: ${source.timestamp}`,
            })),
          }),
      };

      return {
        messages: [inputMessage, responseMessage],
        conversationId: agentResponse.session_id,
        interactionId: `${agentResponse.session_id}-${Date.now()}`,
      };
    } catch (error) {
      logger.error(`OpenSearch Agents chat request failed: ${error.message}`);
      throw error;
    }
  }

  async regenerate(
    payload: { conversationId: string; interactionId: string; rootAgentId: string },
    context: RequestHandlerContext
  ): Promise<{
    messages: IMessage[];
    conversationId: string;
    interactionId: string;
  }> {
    const { conversationId } = payload;

    // Use context logger for better traceability, with defensive checks
    const logger = context?.assistant_plugin?.logger || this.logger;

    // Log context availability for debugging
    if (!context) {
      this.logger.warn('OpenSearch Agents regenerate: No context provided');
    } else if (!context.assistant_plugin) {
      this.logger.warn('OpenSearch Agents regenerate: Context missing assistant_plugin');
    } else if (!context.assistant_plugin.logger) {
      this.logger.warn('OpenSearch Agents regenerate: Context missing logger, using fallback');
    }

    // Validate session ID is UUID format for regeneration
    let sessionId = conversationId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!sessionId || !uuidRegex.test(sessionId)) {
      logger.warn('Invalid session ID for regeneration, generating new UUID:', {
        oldSessionId: sessionId,
      });
      sessionId = uuid.v4();
    }

    // For OpenSearch-Agents, regeneration is handled by sending the same session_id
    // with a special regenerate flag or by re-sending the last query
    const agentRequest: OpenSearchAgentsChatRequest = {
      query: 'Please regenerate the last response',
      session_id: sessionId,
    };

    try {
      logger.info(`Regenerating response for conversation: ${conversationId}`);
      const agentResponse = await this.makeAgentRequest(
        '/api/v1/chat',
        agentRequest,
        conversationId,
        context
      );

      // Format the regenerated response as a message
      const responseMessage: IMessage = {
        type: 'output',
        contentType: 'markdown',
        content: agentResponse.response,
        interactionId: `${agentResponse.session_id}-${Date.now()}`,
        traceId: `${agentResponse.session_id}-${Date.now()}`,
        createTime: new Date().toISOString(),
        ...(agentResponse.sources &&
          agentResponse.sources.length > 0 && {
            sourceAttributions: agentResponse.sources.map((source) => ({
              title: `Document ${source.document_id}`,
              url: `#/discover?_a=(index:'${source.index}')`,
              body: `Score: ${source.score}, Timestamp: ${source.timestamp}`,
            })),
          }),
      };

      return {
        messages: [responseMessage],
        conversationId: agentResponse.session_id,
        interactionId: `${agentResponse.session_id}-${Date.now()}`,
      };
    } catch (error) {
      logger.error(`OpenSearch Agents regenerate request failed: ${error.message}`);
      throw error;
    }
  }

  abortAgentExecution(conversationId: string): void {
    const controller = OpenSearchAgentsChatService.abortControllers.get(conversationId);
    if (controller) {
      controller.abort();
      OpenSearchAgentsChatService.abortControllers.delete(conversationId);
    }
  }

  async healthCheck(): Promise<{ status: string; details?: any }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Short timeout for health check

    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const healthData = await response.json();
        return { status: 'healthy', details: healthData };
      } else {
        return { status: 'unhealthy', details: { statusCode: response.status } };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }
}
