#!/usr/bin/env node
/**
 * Simple integration test for non-streaming chat functionality
 * This tests the full flow from dashboards to OpenSearch Agents
 */

const http = require('http');

async function testNonStreamingIntegration() {
  console.log('Testing non-streaming chat integration...');

  // Test payload that matches the dashboards assistant format
  const payload = {
    conversationId: undefined, // New conversation
    messages: [],
    input: {
      type: 'input',
      context: {
        appId: 'test',
        content: '',
        datasourceId: undefined,
      },
      content: 'Hello, can you help me understand OpenSearch?',
      contentType: 'text',
      promptPrefix: undefined,
    },
  };

  const postData = JSON.stringify(payload);

  const options = {
    hostname: 'localhost',
    port: 5601, // OpenSearch Dashboards port
    path: '/api/assistant/send_message',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'osd-xsrf': 'true', // Required for OpenSearch Dashboards
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            console.log('\n✅ SUCCESS: Non-streaming chat integration working!');
            console.log(`Conversation ID: ${response.conversationId}`);
            console.log(`Messages count: ${response.messages?.length || 0}`);
            console.log(`Interactions count: ${response.interactions?.length || 0}`);

            if (response.messages && response.messages.length > 0) {
              const lastMessage = response.messages[response.messages.length - 1];
              if (lastMessage.type === 'output') {
                console.log(`Response preview: ${lastMessage.content.substring(0, 100)}...`);
              }
            }

            resolve(response);
          } else {
            console.log(`\n❌ ERROR: ${res.statusCode}`);
            console.log(`Response: ${data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (parseError) {
          console.log(`\n❌ JSON PARSE ERROR: ${parseError.message}`);
          console.log(`Raw response: ${data}`);
          reject(parseError);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`\n❌ REQUEST ERROR: ${error.message}`);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run the test
if (require.main === module) {
  testNonStreamingIntegration()
    .then(() => {
      console.log('\n🎉 Integration test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Integration test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testNonStreamingIntegration };
