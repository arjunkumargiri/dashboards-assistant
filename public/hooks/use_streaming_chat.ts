/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import React from 'react';
import { HttpSetup } from '../../../../src/core/public';
import {
  StreamingChatService,
  StreamingChatRequest,
  StreamingChatResponse,
} from '../services/streaming_chat_service';
import { UIContext } from '../../common/types/ui_context';

export interface UseStreamingChatOptions {
  http: HttpSetup;
  dataSourceId?: string;
  onComplete?: (response: StreamingChatResponse) => void;
  onError?: (error: Error) => void;
  onUpdate?: (content: string, isStreaming: boolean) => void;
}

export interface UseStreamingChatReturn {
  sendMessage: (
    message: string,
    context?: UIContext,
    images?: Array<{ data: string; mimeType: string; filename?: string }>
  ) => Promise<void>;
  streamingContent: string;
  isStreaming: boolean;
  error: Error | null;
  abortStream: () => void;
  clearContent: () => void;
  forceUpdate: number;
}

export const useStreamingChat = (options: UseStreamingChatOptions): UseStreamingChatReturn => {
  const hookId = React.useRef(Math.random().toString(36).substr(2, 9));
  console.log('🔧 useStreamingChat hook initializing... ID:', hookId.current);
  const { http, dataSourceId, onComplete, onError, onUpdate } = options;

  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [forceUpdate, setForceUpdate] = useState<number>(0);

  const streamingServiceRef = useRef<StreamingChatService | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);

  // Initialize streaming service
  useEffect(() => {
    streamingServiceRef.current = new StreamingChatService(http);

    return () => {
      // Cleanup on unmount
      if (streamingServiceRef.current) {
        streamingServiceRef.current.abortStream();
      }
    };
  }, [http]);

  const sendMessage = useCallback(
    async (
      message: string,
      context?: UIContext,
      images?: Array<{ data: string; mimeType: string; filename?: string }>
    ) => {
      console.log('🚀 HOOK: sendMessage called with:', {
        messageLength: message.length,
        hasContext: !!context,
        hasImages: !!images?.length,
        hasOnUpdate: !!onUpdate,
        currentConversationId: conversationIdRef.current,
        timestamp: new Date().toISOString(),
      });

      if (!streamingServiceRef.current) {
        console.error('❌ Streaming service not initialized');
        return;
      }

      console.log('🔄 HOOK: Resetting state...');
      // Reset state
      setError(null);
      setStreamingContent('');
      setIsStreaming(true);

      console.log('🔄 HOOK: State reset complete, isStreaming should be true');

      const request: StreamingChatRequest = {
        conversationId: conversationIdRef.current,
        input: {
          type: 'input',
          context: {
            appId: context?.page?.app,
            content: context ? JSON.stringify(context) : undefined,
          },
          content: message,
          contentType: 'text',
          images,
        },
        uiContext: context,
      };

      console.log('🚀 Sending streaming message:', {
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        hasContext: !!context,
        contextElementCount: context?.content?.length || 0,
        hasImages: !!images?.length,
        imageCount: images?.length || 0,
      });

      try {
        await streamingServiceRef.current.sendStreamingMessage(
          request,
          // onChunk
          (chunk: string) => {
            setStreamingContent((prev) => {
              const newContent = prev + chunk;

              // Force a re-render to ensure component sees the update
              setForceUpdate((prev) => {
                const newValue = prev + 1;
                return newValue;
              });

              // Call direct callback to notify component immediately
              if (onUpdate) {
                try {
                  onUpdate(newContent, true);
                } catch (error) {
                  console.error('❌ HOOK: Direct callback failed:', error);
                }
              } else {
                console.warn('⚠️ HOOK: onUpdate callback is not available!');
              }

              return newContent;
            });
          },
          // onComplete
          (response: StreamingChatResponse) => {
            setIsStreaming(false);

            // Call direct callback to notify component streaming is complete
            if (onUpdate) {
              // Get the current content from state
              setStreamingContent((currentContent) => {
                onUpdate(currentContent, false);
                return currentContent;
              });
            }

            // Store conversation ID for future messages
            if (response.conversationId) {
              conversationIdRef.current = response.conversationId;
            }

            // Call completion callback
            if (onComplete) {
              onComplete(response);
            }
          },
          // onError
          (streamError: Error) => {
            console.error('❌ Streaming error:', streamError);
            setError(streamError);
            setIsStreaming(false);

            if (onError) {
              onError(streamError);
            }
          },
          dataSourceId
        );
      } catch (sendError) {
        console.error('❌ Failed to send streaming message:', sendError);
        setError(sendError as Error);
        setIsStreaming(false);

        if (onError) {
          onError(sendError as Error);
        }
      }
    },
    [dataSourceId, onComplete, onError, onUpdate]
  );

  const abortStream = useCallback(() => {
    if (streamingServiceRef.current) {
      streamingServiceRef.current.abortStream();
      setIsStreaming(false);
    }
  }, []);

  const clearContent = useCallback(() => {
    setStreamingContent('');
    setError(null);
  }, []);

  return {
    sendMessage,
    streamingContent,
    isStreaming,
    error,
    abortStream,
    clearContent,
    forceUpdate, // Expose force update counter
  };
};
