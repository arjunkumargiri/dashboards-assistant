# Image Support Implementation

This document describes the implementation of image support in the OpenSearch Dashboards Assistant plugin, including screenshot functionality when the "Include dashboard context" checkbox is selected.

## Overview

The assistant now supports:
- **Automatic Screenshot Capture**: When the context checkbox is selected, the system automatically captures a screenshot of the current dashboard
- **Image Upload to AI Agent**: Screenshots are sent to the OpenSearch AI Agent along with text queries
- **Visual Analysis**: The AI agent can analyze dashboard screenshots, charts, and error messages
- **Combined Context**: Screenshots are combined with extracted UI context for comprehensive analysis

## Architecture

### Frontend Components

#### 1. Screenshot Service (`public/services/screenshot_service.ts`)
- **Purpose**: Handles screenshot capture using html2canvas library
- **Key Features**:
  - Page-level screenshot capture
  - Element-specific screenshot capture
  - Image validation (size, format)
  - Automatic element hiding (modals, tooltips, chat flyout)
  - Error handling and fallback

#### 2. Chat Input Controls (`public/tabs/chat/controls/chat_input_controls.tsx`)
- **Enhanced Features**:
  - Screenshot capture when checkbox is selected
  - Updated UI states (taking screenshot, extracting context)
  - Image attachment to input messages
  - Progress indicators and status messages

#### 3. Type Definitions (`common/types/chat_saved_object_attributes.ts`)
- **Updated IInput Interface**:
  ```typescript
  export interface IInput {
    type: 'input';
    contentType: 'text';
    content: string;
    context?: {
      appId?: string;
      content?: string;
      datasourceId?: string;
    };
    messageId?: string;
    promptPrefix?: string;
    images?: Array<{
      data: string; // base64 encoded image data
      mimeType: string; // image/png, image/jpeg, etc.
      filename?: string;
    }>;
  }
  ```

### Backend Components

#### 1. Chat Routes (`server/routes/chat_routes.ts`)
- **Enhanced Schema Validation**:
  - Added images array to input validation schema
  - Support for base64 image data, MIME types, and filenames
  - Logging for image presence and count

#### 2. OpenSearch Agents Chat Service (`server/services/chat/opensearch_agents_chat_service.ts`)
- **Updated API Integration**:
  - Maps frontend image format to OpenSearch Agents API format
  - Converts `mimeType` to `mime_type` (camelCase to snake_case)
  - Includes images in agent requests when available

## Implementation Details

### Screenshot Capture Flow

1. **User Interaction**: User checks "Include dashboard context & screenshot" checkbox
2. **Message Submission**: User types message and clicks "Go"
3. **Screenshot Capture**: System automatically captures page screenshot
4. **Context Extraction**: System extracts UI context (existing functionality)
5. **Message Creation**: Input message is created with both screenshot and context
6. **API Request**: Message with image and context is sent to backend
7. **Agent Processing**: OpenSearch AI Agent receives and processes image + text

### Screenshot Service Features

#### Capture Options
```typescript
interface ScreenshotOptions {
  quality?: number;        // 0.1 to 1.0 (default: 0.8)
  format?: 'png' | 'jpeg'; // Image format (default: 'png')
  maxWidth?: number;       // Max width in pixels (default: 1920)
  maxHeight?: number;      // Max height in pixels (default: 1080)
  excludeSelectors?: string[]; // CSS selectors to hide
}
```

#### Automatic Element Exclusion
The service automatically hides these elements during capture:
- Modal overlays (`.euiOverlayMask`)
- Toast notifications (`.euiToast`)
- Popovers (`.euiPopover`)
- Context menus (`.euiContextMenu`)
- Chat flyout (`[data-test-subj="chatFlyout"]`)
- Assistant chat container (`.assistant-chat-container`)

#### Image Validation
- **Maximum Size**: 10MB per image
- **Supported Formats**: PNG, JPEG, GIF, WebP
- **Maximum Images**: 5 per request
- **Automatic Validation**: Size and format validation before upload

### API Integration

#### Frontend to Backend
```typescript
// Input message with image
const inputMessage: IMessage = {
  type: 'input',
  content: 'Analyze this dashboard',
  contentType: 'text',
  context: { appId: 'dashboards' },
  images: [{
    data: 'base64_encoded_image_data',
    mimeType: 'image/png',
    filename: 'dashboard-screenshot-1234567890.png'
  }]
};
```

#### Backend to OpenSearch Agents
```typescript
// OpenSearch Agents API request
const agentRequest = {
  query: 'Analyze this dashboard',
  session_id: 'conversation-id',
  images: [{
    data: 'base64_encoded_image_data',
    mime_type: 'image/png', // Note: snake_case
    filename: 'dashboard-screenshot-1234567890.png'
  }]
};
```

## User Experience

### UI Changes

1. **Checkbox Label**: Updated to "Include dashboard context & screenshot"
2. **Tooltip**: Updated to mention screenshot functionality
3. **Status Messages**: 
   - "Taking screenshot..." during capture
   - "Extracting context..." during context extraction
   - "Context and screenshot will be included with your message"
4. **Button States**: Disabled during screenshot capture and context extraction

### User Flow

1. User navigates to a dashboard
2. User opens the assistant chat
3. User checks "Include dashboard context & screenshot"
4. User types a question about the dashboard
5. User clicks "Go"
6. System shows "Taking screenshot..." status
7. System shows "Extracting context..." status
8. Message is sent with screenshot and context
9. AI agent analyzes both visual and contextual information
10. User receives comprehensive response

## Error Handling

### Screenshot Capture Errors
- **Capture Failure**: Graceful fallback - message sent without screenshot
- **Validation Failure**: Error logged, message sent without screenshot
- **Size Limit**: Automatic compression or format conversion
- **Browser Compatibility**: Fallback to context-only mode

### API Errors
- **Network Issues**: Standard retry logic
- **Image Too Large**: Client-side validation prevents upload
- **Unsupported Format**: Client-side validation prevents upload
- **Agent Processing**: Standard error handling from OpenSearch Agents

## Configuration

### Dependencies Added
```json
{
  "dependencies": {
    "html2canvas": "^1.4.1"
  },
  "devDependencies": {
    "@types/html2canvas": "^1.0.0"
  }
}
```

### Environment Requirements
- Modern browser with Canvas API support
- JavaScript enabled
- Sufficient memory for image processing
- Network connectivity to OpenSearch Agents API

## Testing

### Manual Testing Checklist
- [ ] Checkbox enables screenshot functionality
- [ ] Screenshot captures current page content
- [ ] Chat flyout is excluded from screenshot
- [ ] Large images are handled gracefully
- [ ] Error scenarios don't break chat functionality
- [ ] Images are successfully sent to AI agent
- [ ] AI agent can analyze dashboard screenshots

### Automated Testing
Run the test script:
```bash
node test_image_support.js
```

## Performance Considerations

### Screenshot Capture
- **Memory Usage**: Large screenshots consume browser memory
- **Processing Time**: 100-500ms for typical dashboard screenshots
- **Network Impact**: Base64 encoding increases payload size by ~33%

### Optimizations
- **Automatic Compression**: JPEG format for large images
- **Size Limits**: Client-side validation prevents oversized uploads
- **Async Processing**: Non-blocking screenshot capture
- **Element Exclusion**: Reduces image complexity and size

## Security Considerations

### Data Privacy
- Screenshots may contain sensitive dashboard data
- Images are transmitted to OpenSearch AI Agent
- No client-side image storage (memory only)
- Base64 encoding (not encryption)

### Validation
- File size limits prevent DoS attacks
- Format validation prevents malicious uploads
- Client-side validation reduces server load

## Future Enhancements

### Potential Improvements
1. **Selective Screenshot**: Allow users to select specific dashboard panels
2. **Image Compression**: Advanced compression algorithms
3. **Multiple Images**: Support for multiple screenshots per message
4. **Image Annotation**: Allow users to highlight areas of interest
5. **Caching**: Cache screenshots for repeated queries
6. **Format Options**: Additional image formats (SVG, TIFF)

### Integration Opportunities
1. **Saved Objects**: Store screenshots with saved dashboards
2. **Reporting**: Include screenshots in generated reports
3. **Alerting**: Attach screenshots to alert notifications
4. **Sharing**: Share dashboard screenshots via chat

## Troubleshooting

### Common Issues

#### Screenshot Not Captured
- Check browser console for errors
- Verify html2canvas library is loaded
- Check for JavaScript errors during capture
- Ensure sufficient browser memory

#### Image Too Large
- Reduce dashboard complexity
- Use JPEG format instead of PNG
- Reduce browser zoom level
- Close unnecessary browser tabs

#### Upload Failures
- Check network connectivity
- Verify OpenSearch Agents API is running
- Check server logs for errors
- Validate image format and size

### Debug Information
Enable debug logging in browser console:
```javascript
// Check screenshot service
console.log('Screenshot service available:', !!window.ScreenshotService);

// Check image data
console.log('Image data length:', imageData.length);
console.log('Image MIME type:', mimeType);
```

## API Documentation Reference

For complete OpenSearch AI Agent image API documentation, see:
- [OpenSearch AI Agents Image Support Documentation](https://github.com/opensearch-project/opensearch-ai-agents/blob/main/docs/image-support.md)
- [API Endpoints](https://github.com/opensearch-project/opensearch-ai-agents/blob/main/docs/api.md)