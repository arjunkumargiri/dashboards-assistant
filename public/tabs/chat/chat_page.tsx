/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { EuiFlyoutBody, EuiFlyoutFooter, EuiPage, EuiPageBody, EuiSpacer, EuiPanel, EuiText, EuiFlexGroup, EuiFlexItem, EuiLoadingSpinner } from '@elastic/eui';
import React, { useCallback, useRef, useEffect, useState } from 'react';
import cs from 'classnames';
import { useObservable } from 'react-use';
import { useChatContext, useCore } from '../../contexts';
import { useChatState, useChatActions } from '../../hooks';
import { LLMResponseType } from '../../hooks/use_chat_state';
import { useStreamingChat } from '../../hooks/use_streaming_chat';
import { ChatPageContent } from './chat_page_content';
import { ChatInputControls } from './controls/chat_input_controls';


interface ChatPageProps {
  className?: string;
  enableStreaming?: boolean;
}

export const ChatPage: React.FC<ChatPageProps> = (props) => {
  const core = useCore();
  const chatContext = useChatContext();
  const { chatState, chatStateDispatch } = useChatState();
  const conversationLoadStatus = useObservable(core.services.conversationLoad.status$);
  const conversationsStatus = useObservable(core.services.conversationLoad.latestIdStatus$);
  const messagesLoading = conversationLoadStatus === 'loading';
  const conversationsLoading = conversationsStatus === 'loading';

  // Streaming state management
  const currentStreamingMessageIdRef = useRef<string | null>(null);

  // Direct callback to receive updates from the hook
  const onStreamingUpdate = useCallback((content: string, isStreaming: boolean) => {
    console.log('📨 CHAT PAGE: onStreamingUpdate called', {
      contentLength: content.length,
      isStreaming,
      currentMessageCount: chatState.messages.length,
      lastMessageId: chatState.messages[chatState.messages.length - 1]?.messageId,
      currentStreamingMessageId: currentStreamingMessageIdRef.current
    });

    // Add/update streaming message in chat state for ChatPageContent
    if (content.length > 0) {
      // Generate unique messageId for each new streaming session
      // Only generate new ID when starting a new streaming session (isStreaming = true and no current ID)
      if (!currentStreamingMessageIdRef.current && isStreaming) {
        currentStreamingMessageIdRef.current = `streaming-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('🆕 CHAT PAGE: Generated new streaming message ID:', currentStreamingMessageIdRef.current);
      }

      const streamingMessage = {
        type: 'output' as const,
        contentType: 'markdown' as const,
        content: content,
        timestamp: new Date().toISOString(),
        messageId: currentStreamingMessageIdRef.current
      };

      // Check if we already have this streaming message
      const currentMessages = chatState.messages;
      const existingStreamingMessage = currentMessages.find(msg => msg.messageId === currentStreamingMessageIdRef.current);

      if (existingStreamingMessage) {
        console.log('🔄 CHAT PAGE: Updating existing streaming message');
        // Update existing streaming message using patch to preserve conversation history
        chatStateDispatch({
          type: 'patch',
          payload: {
            messages: [streamingMessage], // This will update the existing message with same messageId
            interactions: chatState.interactions,
          },
        });
      } else {
        console.log('➕ CHAT PAGE: Adding new streaming message');
        // Add new streaming message preserving existing messages
        chatStateDispatch({
          type: 'patch',
          payload: {
            messages: [streamingMessage], // This will append the new message
            interactions: chatState.interactions,
          },
        });

        // Set response type to streaming for the first chunk
        chatStateDispatch({
          type: 'updateResponseType',
          payload: {
            type: LLMResponseType.STREAMING,
          },
        });
      }

      // Set LLM responding state for streaming UI
      chatStateDispatch({
        type: 'llmRespondingChange',
        payload: { flag: isStreaming },
      });
    }

    // Clear the streaming message ID when streaming completes
    if (!isStreaming) {
      console.log('🏁 CHAT PAGE: Streaming complete, clearing message ID');
      currentStreamingMessageIdRef.current = null;
    }
  }, [chatState.messages, chatState.interactions, chatStateDispatch]);

  // Initialize streaming chat service with stable callbacks
  const onStreamingComplete = useCallback((response) => {
    console.log('🏁 Streaming complete callback triggered:', {
      hasResponse: !!response,
      hasMessages: !!response?.messages?.length,
      messageCount: response?.messages?.length || 0,
      hasInteractions: !!response?.interactions?.length,
      currentMessageCount: chatState.messages.length
    });

    // Update LLM responding state and reset response type
    chatStateDispatch({
      type: 'llmRespondingChange',
      payload: { flag: false },
    });

    // Reset response type to TEXT when streaming completes
    chatStateDispatch({
      type: 'updateResponseType',
      payload: {
        type: LLMResponseType.TEXT,
      },
    });

    console.log('✅ Streaming completion handling finished');
  }, [chatState.messages, chatStateDispatch]);

  const onStreamingError = useCallback((error) => {
    console.error('Streaming error:', error);

    // Update LLM responding state
    chatStateDispatch({
      type: 'llmRespondingChange',
      payload: { flag: false },
    });
  }, [chatStateDispatch]);

  // Memoize the streaming chat options to prevent hook recreation
  const streamingChatOptions = React.useMemo(() => ({
    http: core.services.http,
    onComplete: onStreamingComplete,
    onError: onStreamingError,
    onUpdate: onStreamingUpdate
  }), [core.services.http, onStreamingComplete, onStreamingError, onStreamingUpdate]);

  const streamingChat = useStreamingChat(streamingChatOptions);

  const refreshConversation = useCallback(async () => {
    if (!chatContext.conversationId) {
      return;
    }
    const conversation = await core.services.conversationLoad.load(chatContext.conversationId);
    if (conversation) {
      chatStateDispatch({
        type: 'receive',
        payload: {
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
  }, [chatContext.conversationId, chatStateDispatch, core.services.conversationLoad]);

  const { loadChat } = useChatActions();
  const chatScrollTopRef = useRef<{ scrollTop: number; height: number } | null>(null);
  const handleScroll = async (event: React.UIEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const scrollTop = target.scrollTop;
    if (!messagesLoading && chatState?.nextToken && chatState?.nextToken !== '') {
      if (scrollTop < 150) {
        chatScrollTopRef.current = { scrollTop, height: target.scrollHeight };
        await loadChat(chatContext.conversationId, chatState.nextToken);
        target.scrollTop = target.scrollHeight - chatScrollTopRef.current.height;
        chatScrollTopRef.current = null;
      }
    }
  };
  const refreshConversationsList = useCallback(async () => {
    if (!chatContext.conversationId) {
      core.services.conversationLoad.getLatestConversationId().then(async (conversationId) => {
        if (conversationId) {
          const conversation = await core.services.conversationLoad.load(conversationId);
          if (conversation) {
            chatStateDispatch({
              type: 'receive',
              payload: {
                messages: conversation.messages,
                interactions: conversation.interactions,
              },
            });
          }
        }
      });
    }
  }, [chatStateDispatch, core.services.conversationLoad]);

  // Handle streaming response updates
  const handleStreamingResponse = useCallback((content: string, isComplete: boolean) => {
    if (!isComplete) {
      // Update LLM responding state to show we're streaming
      chatStateDispatch({
        type: 'llmRespondingChange',
        payload: { flag: true },
      });
    }
  }, [chatStateDispatch]);

  return (
    <>
      <EuiFlyoutBody
        className={cs(props.className, 'llm-chat-flyout-body')}
        onScroll={handleScroll}
      >
        <EuiPage paddingSize="s">
          <EuiPageBody component="div">

            <ChatPageContent
              messagesLoading={messagesLoading}
              conversationsLoading={conversationsLoading}
              messagesLoadingError={
                typeof conversationLoadStatus !== 'string'
                  ? conversationLoadStatus?.error
                  : undefined
              }
              chatScrollTopRef={chatScrollTopRef}
              conversationsError={
                typeof conversationsStatus !== 'string' ? conversationsStatus?.error : undefined
              }
              onRefreshConversation={refreshConversation}
              onRefreshConversationsList={refreshConversationsList}
            />


          </EuiPageBody>
        </EuiPage>
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiSpacer size="xs" />
        <ChatInputControls
          loading={chatState.llmResponding}
          disabled={messagesLoading || chatState.llmResponding || streamingChat.isStreaming}
          http={core.services.http}
          enableStreaming={props.enableStreaming}
          onStreamingResponse={handleStreamingResponse}
          streamingChat={streamingChat} // Pass the streaming chat hook
        />
        <EuiSpacer size="m" />
      </EuiFlyoutFooter>


    </>
  );
};
