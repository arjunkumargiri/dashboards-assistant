/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { BehaviorSubject } from 'rxjs';
import { TAB_ID } from '../utils/constants';
import { ASSISTANT_API } from '../../common/constants/llm';
import { findLastIndex } from '../utils';
import {
  IMessage,
  ISuggestedAction,
  SendResponse,
  StreamChunk,
} from '../../common/types/chat_saved_object_attributes';
import { useChatContext } from '../contexts/chat_context';
import { useCore } from '../contexts/core_context';
import { AssistantActions } from '../types';
import { LLMResponseType, useChatState } from './use_chat_state';
import { useGetChunksFromHTTPResponse } from './use_get_chunks_from_http_response';

let abortControllerRef: AbortController;

export const useChatActions = (): AssistantActions => {
  const chatContext = useChatContext();
  const core = useCore();
  const { chatState, chatStateDispatch } = useChatState();
  const { getConsumedChunk$FromHttpResponse } = useGetChunksFromHTTPResponse();

  const sendMetadataHandler = (data: Partial<SendResponse>) => {
    // Refresh history list after new conversation created if new conversation saved and history list page visible
    if (
      !chatContext.conversationId &&
      data.conversationId &&
      core.services.conversations.options?.page === 1 &&
      chatContext.selectedTabId === TAB_ID.HISTORY
    ) {
      core.services.conversations.reload();
    }
    if (data.conversationId) {
      chatContext.setConversationId(data.conversationId);
    }

    // set title for first time
    if (data.title && !chatContext.title) {
      chatContext.setTitle(data.title);
    }

    if (data.messages?.length && data.interactions?.length) {
      /**
       * Remove messages that do not have messageId
       * because they are used for displaying loading state
       */
      chatStateDispatch({
        type: 'receive',
        payload: {
          messages: chatState.messages.filter((item) => item.messageId),
          interactions: chatState.interactions,
        },
      });

      /**
       * Patch messages and interactions based on backend response
       */
      chatStateDispatch({
        type: 'patch',
        payload: {
          messages: data.messages,
          interactions: data.interactions,
        },
      });
    }
  };

  const send = async (input: IMessage, uiContext?: any): Promise<void> => {
    // Validate input before processing
    if (!input || !input.content || input.content.trim() === '') {
      console.error('❌ CRITICAL: Invalid input message in send function:', {
        hasInput: !!input,
        inputType: typeof input,
        hasContent: !!input?.content,
        contentLength: input?.content?.length || 0,
        content: input?.content,
      });
      throw new Error('Input message content is required and cannot be empty');
    }

    console.log('📨 useChatActions.send called with:', {
      inputType: input.type,
      contentLength: input.content.length,
      contentPreview: input.content.substring(0, 50) + (input.content.length > 50 ? '...' : ''),
      hasImages: !!input.images?.length,
      imageCount: input.images?.length || 0,
      hasUIContext: !!uiContext,
    });

    const abortController = new AbortController();
    abortControllerRef = abortController;
    chatStateDispatch({ type: 'send', payload: input });

    try {
      const requestBody: any = {
        conversationId: chatContext.conversationId,
        ...(!chatContext.conversationId && { messages: chatState.messages }), // include all previous messages for new chats
        input,
      };

      // Debug UI context before sending
      console.log('🚀 useChatActions - About to send request:', {
        hasUIContext: !!uiContext,
        uiContextType: typeof uiContext,
        uiContextKeys: uiContext ? Object.keys(uiContext) : [],
        contentCount: uiContext?.content?.length || 0,
      });

      // Include UI context if provided
      if (uiContext) {
        requestBody.uiContext = uiContext;
        console.log('✅ Including UI context in request:', {
          contextElementCount: uiContext.content?.length || 0,
          // hasTimeRange removed - no longer used
          hasFilters: !!uiContext.filters?.length,
          pageApp: uiContext.page?.app,
          extractedAt: uiContext.extractedAt,
        });
      } else {
        console.log('❌ No UI context to include in request');
        // Don't include uiContext key at all if it's falsy
      }

      console.log('📤 Final request body keys:', Object.keys(requestBody));

      const fetchResponse = await core.services.http.post(ASSISTANT_API.SEND_MESSAGE, {
        // do not send abort signal to http client to allow LLM call run in background
        body: JSON.stringify(requestBody),
        query: core.services.dataSource.getDataSourceQuery(),
        asResponse: true,
      });
      if (fetchResponse.body?.getReader) {
        const chunk$ = await getConsumedChunk$FromHttpResponse({
          stream: fetchResponse.body,
          abortController,
        });

        return new Promise((resolve) => {
          chunk$.subscribe(
            (chunk) => {
              if (chunk?.event === 'metadata') {
                const { data } = chunk;
                sendMetadataHandler(data);
              }
            },
            () => {
              resolve(undefined);
            },
            () => {
              resolve(undefined);
            }
          );
        });
      } else {
        if (abortController.signal.aborted) return;
        chatStateDispatch({
          type: 'llmRespondingChange',
          payload: {
            flag: false,
          },
        });
        chatStateDispatch({
          type: 'updateResponseType',
          payload: {
            type: LLMResponseType.TEXT,
          },
        });
        sendMetadataHandler(fetchResponse.body as SendResponse);
        return;
      }
    } catch (error) {
      if (abortController.signal.aborted) return;
      chatStateDispatch({ type: 'error', payload: error });
    }
  };

  const loadChat = async (conversationId?: string, nextToken?: string, title?: string) => {
    abortControllerRef?.abort();
    core.services.conversationLoad.abortController?.abort();
    chatContext.setConversationId(conversationId);
    chatContext.setTitle(title);
    // Chat page will always visible in fullscreen mode, we don't need to change the tab anymore
    if (!chatContext.flyoutFullScreen) {
      chatContext.setSelectedTabId(TAB_ID.CHAT);
    }
    chatContext.setFlyoutComponent(null);
    if (!conversationId) {
      chatStateDispatch({ type: 'reset' });
      return;
    }
    const conversation = await core.services.conversationLoad.load(conversationId, nextToken);
    if (conversation) {
      chatStateDispatch({
        type: 'receive',
        payload: {
          nextToken: conversation.nextToken,
          messages: conversation.messages,
          interactions: conversation.interactions,
        },
      });

      chatStateDispatch({
        type: 'llmRespondingChange',
        payload: {
          flag: false,
        },
      });
    }
  };

  const resetChat = () => {
    abortControllerRef?.abort();
    core.services.conversationLoad.abortController?.abort();
    chatContext.setConversationId(undefined);
    chatContext.setTitle(undefined);
    chatContext.setFlyoutComponent(null);
    chatStateDispatch({ type: 'reset' });
  };

  const openChatUI = () => {
    chatContext.setFlyoutVisible(true);
    chatContext.setSelectedTabId(TAB_ID.CHAT);
  };

  const executeAction = async (suggestedAction: ISuggestedAction, message: IMessage) => {
    switch (suggestedAction.actionType) {
      case 'send_as_input': {
        await send({
          type: 'input',
          content: suggestedAction.message,
          contentType: 'text',
        });
        break;
      }

      case 'view_in_dashboards': {
        const type = message.contentType;
        const id = message.content;
        switch (type) {
          case 'visualization':
            window.open(`./visualize#/edit/${id}`, '_blank');
            break;
        }
        break;
      }

      case 'view_ppl_visualization': {
        chatContext.actionExecutors[suggestedAction.actionType]?.({
          name: suggestedAction.metadata.question,
          query: suggestedAction.metadata.query,
        });
        break;
      }

      case 'view_trace':
        if ('interactionId' in message) {
          if (chatContext.selectedTabId !== TAB_ID.TRACE) {
            chatContext.setSelectedTabId(TAB_ID.TRACE);
          }
          chatContext.setInteractionId(message.interactionId);
        }
        break;

      default:
        break;
    }
  };

  const abortAction = async (conversationId?: string) => {
    abortControllerRef.abort();
    chatStateDispatch({ type: 'abort' });

    if (conversationId) {
      // abort agent execution
      await core.services.http.post(`${ASSISTANT_API.ABORT_AGENT_EXECUTION}`, {
        body: JSON.stringify({ conversationId }),
        query: core.services.dataSource.getDataSourceQuery(),
      });
    }
  };

  const regenerateMetadataHandler = (
    data: Partial<SendResponse>,
    input: {
      interactionId: string;
    }
  ) => {
    const findRegeratedMessageIndex = findLastIndex(
      chatState.messages,
      (message) => message.type === 'input'
    );
    /**
     * Remove the regenerated interaction & message.
     * In implementation of Agent framework, it will generate a new interactionId
     * so need to remove the staled interaction in Frontend manually.
     * And chatStateDispatch({ type: 'receive' }) here is used to delete the input message
     */
    if (findRegeratedMessageIndex > -1) {
      chatStateDispatch({
        type: 'receive',
        payload: {
          messages: [
            ...chatState.messages
              .slice(0, findRegeratedMessageIndex)
              .filter((item) => item.messageId),
            ...(data.messages || []),
          ],
          interactions: [
            ...chatState.interactions.filter(
              (interaction) => interaction.interaction_id !== input.interactionId
            ),
            ...(data.interactions || []),
          ],
        },
      });
    }
  };

  const regenerate = async (interactionId: string) => {
    if (chatContext.conversationId) {
      const abortController = new AbortController();
      abortControllerRef = abortController;
      let chunk$ = new BehaviorSubject<StreamChunk | undefined>(undefined);
      chatStateDispatch({ type: 'regenerate' });

      try {
        const fetchResponse = await core.services.http.put(`${ASSISTANT_API.REGENERATE}`, {
          body: JSON.stringify({
            conversationId: chatContext.conversationId,
            interactionId,
          }),
          query: core.services.dataSource.getDataSourceQuery(),
          asResponse: true,
        });

        if (fetchResponse.body?.getReader) {
          chunk$ = await getConsumedChunk$FromHttpResponse({
            stream: fetchResponse.body,
            abortController,
          });

          chunk$.subscribe((chunk) => {
            if (chunk?.event === 'metadata') {
              regenerateMetadataHandler(chunk.data, {
                interactionId,
              });
            }
          });
        } else {
          if (abortController.signal.aborted) {
            return;
          }
          chatStateDispatch({
            type: 'llmRespondingChange',
            payload: {
              flag: false,
            },
          });
          chatStateDispatch({
            type: 'updateResponseType',
            payload: {
              type: LLMResponseType.TEXT,
            },
          });
          regenerateMetadataHandler(fetchResponse.body as SendResponse, {
            interactionId,
          });
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        chatStateDispatch({ type: 'error', payload: error });
      }
    }
  };

  return { send, loadChat, resetChat, executeAction, openChatUI, abortAction, regenerate };
};
