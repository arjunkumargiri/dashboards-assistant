#!/usr/bin/env node
/**
 * Test to verify context flow through the chat system
 */

const http = require('http');

async function testContextFlow() {
  console.log('🧪 Testing context flow through chat system...');
  
  const payload = {
    conversationId: undefined,
    messages: [],
    input: {
      type: 'input',
      context: {
        appId: 'test',
        content: '',
        datasourceId: undefined
      },
      content: 'Test context flow',
      contentType: 'text'
    }
  };

  const postData = JSON.stringify(payload);
  
  const options = {
    hostname: 'localhost',
    port: 5601,
    path: '/api/assistant/send_message',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'osd-xsrf': 'true'
    }
  };

  return new Promise((resolve, reject) => {
    console.log('📡 Sending request to test context flow...');
    
    const req = http.request(options, (res) => {
      console.log(`📊 Response Status: ${res.statusCode}`);
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            console.log('✅ SUCCESS: Context flow test completed');
            console.log('📋 Check server logs for context debugging information');
            resolve(response);
          } else {
            console.log(`❌ ERROR: ${res.statusCode}`);
            console.log(`Response: ${data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (parseError) {
          console.log(`❌ JSON PARSE ERROR: ${parseError.message}`);
          console.log(`Raw response: ${data}`);
          reject(parseError);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ REQUEST ERROR: ${error.message}`);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run the test
if (require.main === module) {
  testContextFlow()
    .then(() => {
      console.log('\n🎉 Context flow test completed!');
      console.log('📝 Check the OpenSearch Dashboards server logs for detailed context debugging info');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Context flow test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testContextFlow };