/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { HttpSetup } from '../../../../src/core/public';
import { ASSISTANT_API } from '../../common/constants/llm';
import { UIContext } from '../../common/types/ui_context';

export interface StreamingChatMessage {
  type: 'input' | 'output';
  content: string;
  contentType: 'text';
}

export interface StreamingChatRequest {
  conversationId?: string;
  messages?: StreamingChatMessage[];
  input: {
    type: 'input';
    context: {
      appId?: string;
      content?: string;
      datasourceId?: string;
    };
    content: string;
    contentType: 'text';
    promptPrefix?: string;
    images?: Array<{
      data: string;
      mimeType: string;
      filename?: string;
    }>;
  };
  uiContext?: UIContext;
}

export interface StreamingChatResponse {
  conversationId: string;
  interactionId: string;
  messages: StreamingChatMessage[];
  interactions: any[];
  title?: string;
}

export class StreamingChatService {
  private abortController: AbortController | null = null;

  constructor(private http: HttpSetup) {}

  /**
   * Send a streaming chat request and handle real-time responses
   */
  async sendStreamingMessage(
    request: StreamingChatRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: StreamingChatResponse) => void,
    onError: (error: Error) => void,
    dataSourceId?: string
  ): Promise<void> {
    console.log('🌊 STREAMING SERVICE: sendStreamingMessage called', {
      hasRequest: !!request,
      hasOnChunk: !!onChunk,
      hasOnComplete: !!onComplete,
      hasOnError: !!onError,
      dataSourceId,
      conversationId: request.conversationId,
      isCurrentlyStreaming: this.isStreaming(),
      timestamp: new Date().toISOString()
    });

    // Only abort if there's actually an active streaming request
    if (this.isStreaming()) {
      console.log('🛑 STREAMING SERVICE: Aborting existing active request');
      this.abortStream();
    } else {
      console.log('ℹ️ STREAMING SERVICE: No active request to abort');
    }

    // Create new abort controller
    this.abortController = new AbortController();

    try {
      // Use the HTTP service to get the correct base path
      const basePath = this.http.basePath.get();
      const endpoint = dataSourceId 
        ? `${ASSISTANT_API.SEND_MESSAGE}?dataSourceId=${dataSourceId}`
        : ASSISTANT_API.SEND_MESSAGE;
      
      // Construct the full URL with base path
      const url = `${basePath}${endpoint}`;

      console.log('🚀 Starting streaming request to:', url);
      console.log('📤 Request payload:', {
        hasUIContext: !!request.uiContext,
        contextElementCount: request.uiContext?.content?.length || 0,
        hasImages: !!request.input.images?.length,
        imageCount: request.input.images?.length || 0,
        basePath: basePath
      });

      console.log('🌐 STREAMING SERVICE: Making fetch request...');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'osd-xsrf': 'true',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      try {
        console.log('📥 STREAMING SERVICE: Fetch response received:', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
      } catch (headerError) {
        console.error('❌ STREAMING SERVICE: Error processing headers:', headerError);
        console.log('📥 STREAMING SERVICE: Basic response info:', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText
        });
      }

      if (!response.ok) {
        try {
          const errorText = await response.text();
          console.error('❌ STREAMING SERVICE: HTTP Error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        } catch (textError) {
          console.error('❌ STREAMING SERVICE: Error reading error response:', textError);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      console.log('🔍 STREAMING SERVICE: About to check content-type...');
      
      let contentType;
      try {
        contentType = response.headers.get('content-type');
        console.log('📥 STREAMING SERVICE: Response content type:', contentType);
      } catch (contentTypeError) {
        console.error('❌ STREAMING SERVICE: Error getting content-type:', contentTypeError);
        contentType = null;
      }
      
      console.log('🔍 STREAMING SERVICE: Content type analysis:', {
        contentType,
        includesEventStream: contentType?.includes('text/event-stream'),
        includesJson: contentType?.includes('application/json'),
        isStreaming: contentType?.includes('text/event-stream')
      });

      // Check if this is a streaming response
      try {
        if (contentType?.includes('text/event-stream')) {
          console.log('🌊 STREAMING SERVICE: Processing streaming response...');
          console.log('🔄 STREAMING SERVICE: Calling processStreamingResponse...');
          await this.processStreamingResponse(response, onChunk, onComplete, onError);
          console.log('✅ STREAMING SERVICE: processStreamingResponse completed');
        } else {
          console.log('📄 STREAMING SERVICE: Processing regular JSON response...');
          console.log('⚠️ STREAMING SERVICE: Backend returned JSON instead of streaming!');
          console.log('📄 STREAMING SERVICE: Content-type was:', contentType);
          
          try {
            // Handle regular JSON response
            const jsonResponse = await response.json();
            console.log('📄 STREAMING SERVICE: JSON response:', jsonResponse);
            onComplete(jsonResponse);
          } catch (jsonError) {
            console.error('❌ STREAMING SERVICE: Error parsing JSON response:', jsonError);
            // Try to read as text instead
            try {
              const textResponse = await response.text();
              console.log('📄 STREAMING SERVICE: Text response:', textResponse);
              throw new Error(`Failed to parse response as JSON: ${textResponse}`);
            } catch (textError) {
              console.error('❌ STREAMING SERVICE: Error reading text response:', textError);
              throw new Error('Failed to read response');
            }
          }
        }
      } catch (processingError) {
        console.error('❌ STREAMING SERVICE: Error in response processing:', processingError);
        onError(processingError as Error);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🛑 Streaming request aborted');
        return;
      }
      console.error('❌ Streaming request failed:', error);
      onError(error as Error);
    }
  }

  /**
   * Process Server-Sent Events stream
   */
  private async processStreamingResponse(
    response: Response,
    onChunk: (chunk: string) => void,
    onComplete: (response: StreamingChatResponse) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    console.log('🌊 STREAMING SERVICE: processStreamingResponse started');
    
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ STREAMING SERVICE: Response body is not readable');
      throw new Error('Response body is not readable');
    }

    console.log('✅ STREAMING SERVICE: Reader obtained, starting to process stream');
    const decoder = new TextDecoder();
    let buffer = '';
    let streamingContent = '';
    let eventCount = 0;
    let finalResponse: StreamingChatResponse | null = null;

    try {
      console.log('🔄 STREAMING SERVICE: Starting read loop...');
      while (true) {
        console.log('📖 STREAMING SERVICE: Reading next chunk...');
        const { done, value } = await reader.read();
        console.log('📖 STREAMING SERVICE: Read result:', { done, hasValue: !!value, valueLength: value?.length || 0 });
        
        if (done) {
          console.log('✅ Stream completed');
          console.log('📊 Stream statistics:', {
            totalEvents: eventCount,
            totalCharacters: streamingContent.length,
            finalResponseAvailable: !!finalResponse
          });
          
          // Only call onComplete if we have a final response from the server
          // Don't create a fallback message from streaming content to avoid duplicates
          if (finalResponse) {
            console.log('🏁 STREAMING SERVICE: Calling onComplete with final response');
            onComplete(finalResponse);
          } else {
            console.log('⚠️ STREAMING SERVICE: No final response received from server');
            // Only create fallback if we actually received streaming content
            if (streamingContent.trim()) {
              console.log('🔄 STREAMING SERVICE: Creating fallback response from streaming content');
              onComplete({
                conversationId: 'stream-conversation',
                interactionId: 'stream-interaction',
                messages: [
                  {
                    type: 'output',
                    content: streamingContent,
                    contentType: 'text'
                  }
                ],
                interactions: []
              });
            } else {
              console.log('❌ STREAMING SERVICE: No content received, not calling onComplete');
            }
          }
          break;
        }

        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue;

          eventCount++;
          
          // Handle Server-Sent Events format
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              console.log('🏁 Received [DONE] signal');
              continue;
            }

            try {
              // Try to parse as JSON (for structured events)
              const eventData = JSON.parse(data);
              
              console.log('📨 Received SSE event:', eventData.type, eventData);
              
              if (eventData.type === 'content') {
                const content = eventData.content || '';
                streamingContent += content;
                onChunk(content);
                console.log('📝 Added content chunk:', {
                  chunkLength: content.length,
                  totalLength: streamingContent.length,
                  chunkPreview: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
                  totalPreview: streamingContent.substring(0, 50) + (streamingContent.length > 50 ? '...' : '')
                });
              } else if (eventData.type === 'start') {
                console.log('🚀 Stream started:', eventData.conversationId);
              } else if (eventData.type === 'complete') {
                console.log('✅ Stream completed with messages:', eventData.messages?.length);
                // Use the complete event data as final response
                finalResponse = {
                  conversationId: eventData.conversationId,
                  interactionId: eventData.interactionId,
                  messages: eventData.messages || [],
                  interactions: []
                };
              } else if (eventData.type === 'error') {
                throw new Error(eventData.error || 'Streaming error');
              }
            } catch (parseError) {
              // If not JSON, treat as plain text content
              if (data.trim() && data !== '[DONE]') {
                streamingContent += data;
                onChunk(data);
              }
            }
          } else if (line.trim() && !line.startsWith(':')) {
            // Handle plain text lines (fallback)
            streamingContent += line + '\n';
            onChunk(line + '\n');
          }
        }
      }
    } catch (error) {
      console.error('❌ Stream processing error:', error);
      onError(error as Error);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Abort the current streaming request
   */
  abortStream(): void {
    if (this.abortController) {
      console.log('🛑 Aborting streaming request');
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if a streaming request is currently active
   */
  isStreaming(): boolean {
    return this.abortController !== null;
  }
}