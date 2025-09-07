/**
 * Example client-side code for consuming streaming chat responses
 * from OpenSearch Dashboards Assistant.
 * 
 * This demonstrates how to use the streaming API endpoint to get
 * real-time responses from the AI agent.
 */

class StreamingChatClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Send a streaming chat request to the assistant API
   * @param {Object} payload - The chat request payload
   * @param {string} payload.query - The user's query
   * @param {string} [payload.conversationId] - Optional conversation ID
   * @param {Function} onChunk - Callback for each streaming chunk
   * @param {Function} [onError] - Error callback
   * @param {Function} [onComplete] - Completion callback
   * @returns {Promise<void>}
   */
  async streamChat({ query, conversationId }, onChunk, onError, onComplete) {
    const payload = {
      input: {
        type: 'input',
        content: query,
        contentType: 'text',
        context: {
          appId: 'dashboards-assistant'
        }
      },
      messages: [],
      conversationId
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/assistant/send_message/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'osd-xsrf': 'true', // Required for OpenSearch Dashboards
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      // Parse Server-Sent Events
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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

                // Call the chunk callback
                if (onChunk) {
                  onChunk(eventData);
                }

                // Handle completion
                if (eventData.type === 'complete' && onComplete) {
                  onComplete(eventData);
                }

                // Handle errors
                if (eventData.type === 'error' && onError) {
                  onError(new Error(eventData.error || 'Unknown streaming error'));
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE event:', line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        console.error('Streaming chat error:', error);
      }
    }
  }

  /**
   * Send a regular (non-streaming) chat request
   * @param {Object} payload - The chat request payload
   * @returns {Promise<Object>} - The complete response
   */
  async sendChat({ query, conversationId }) {
    const payload = {
      input: {
        type: 'input',
        content: query,
        contentType: 'text',
        context: {
          appId: 'dashboards-assistant'
        }
      },
      messages: [],
      conversationId
    };

    const response = await fetch(`${this.baseUrl}/api/assistant/send_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'osd-xsrf': 'true',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Example usage in a React component or vanilla JavaScript

/**
 * Example React hook for streaming chat
 */
function useStreamingChat() {
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [currentResponse, setCurrentResponse] = React.useState('');
  const [conversationId, setConversationId] = React.useState(null);
  const [error, setError] = React.useState(null);

  const client = React.useMemo(() => new StreamingChatClient(), []);

  const sendStreamingMessage = React.useCallback(async (query) => {
    setIsStreaming(true);
    setCurrentResponse('');
    setError(null);

    await client.streamChat(
      { query, conversationId },
      // onChunk
      (chunk) => {
        switch (chunk.type) {
          case 'start':
            setConversationId(chunk.conversationId);
            break;
          case 'content':
            setCurrentResponse(chunk.accumulatedContent || '');
            break;
          case 'complete':
            setCurrentResponse(chunk.messages?.[0]?.content || chunk.accumulatedContent || '');
            setIsStreaming(false);
            break;
        }
      },
      // onError
      (err) => {
        setError(err.message);
        setIsStreaming(false);
      },
      // onComplete
      () => {
        setIsStreaming(false);
      }
    );
  }, [client, conversationId]);

  return {
    sendStreamingMessage,
    isStreaming,
    currentResponse,
    conversationId,
    error
  };
}

/**
 * Example vanilla JavaScript usage
 */
function exampleUsage() {
  const client = new StreamingChatClient();
  const responseContainer = document.getElementById('response');
  const statusContainer = document.getElementById('status');

  client.streamChat(
    { query: 'What is the health of my OpenSearch cluster?' },
    // onChunk
    (chunk) => {
      switch (chunk.type) {
        case 'start':
          statusContainer.textContent = 'Starting...';
          responseContainer.textContent = '';
          break;
        case 'content':
          statusContainer.textContent = 'Receiving response...';
          responseContainer.textContent = chunk.accumulatedContent || '';
          break;
        case 'complete':
          statusContainer.textContent = 'Complete';
          responseContainer.textContent = chunk.messages?.[0]?.content || chunk.accumulatedContent || '';
          break;
      }
    },
    // onError
    (error) => {
      statusContainer.textContent = 'Error';
      responseContainer.textContent = `Error: ${error.message}`;
    }
  );
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StreamingChatClient };
}