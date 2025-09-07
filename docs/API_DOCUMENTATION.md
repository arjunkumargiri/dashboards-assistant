# Contextual Dashboard Chat API Documentation

## Overview

The Contextual Dashboard Chat API provides comprehensive context-aware chat functionality for OpenSearch Dashboards. This API enables extraction of UI context from any dashboard content and integration with chat services for intelligent, contextual responses.

## Core Services

### UIContextService

The central service for capturing and managing UI context from OpenSearch Dashboard pages.

#### Interface

```typescript
interface IUIContextService {
  getCurrentContext(): Promise<UIContext>;
  subscribeToContextChanges(callback: (context: UIContext) => void): void;
  extractContentData(elementId: string): Promise<ContentData>;
  getPageContext(): PageContext;
  getVisibleElements(): UIElement[];
}
```

#### Methods

##### `getCurrentContext(): Promise<UIContext>`

Retrieves the current complete UI context including all visible content, navigation state, and user interactions.

**Returns:** Promise resolving to UIContext object containing:
- `page`: Current page information (URL, title, app, route)
- `content`: Array of all extracted content elements
- `navigation`: Navigation context and breadcrumbs
- `filters`: Active filters and their states
- `timeRange`: Current time range selection
- `userActions`: Recent user interactions

**Example:**
```typescript
const contextService = core.getService('uiContext');
const context = await contextService.getCurrentContext();
console.log(`Found ${context.content.length} content elements`);
```

##### `subscribeToContextChanges(callback: (context: UIContext) => void): void`

Subscribes to real-time context changes for dynamic updates.

**Parameters:**
- `callback`: Function called when context changes occur

**Example:**
```typescript
contextService.subscribeToContextChanges((newContext) => {
  console.log('Context updated:', newContext);
});
```

##### `extractContentData(elementId: string): Promise<ContentData>`

Extracts detailed content data from a specific UI element.

**Parameters:**
- `elementId`: DOM element ID or selector

**Returns:** Promise resolving to ContentData with element-specific information

##### `getPageContext(): PageContext`

Returns current page context information.

**Returns:** PageContext object with URL, title, app, route, and breadcrumbs

##### `getVisibleElements(): UIElement[]`

Returns array of all currently visible UI elements.

**Returns:** Array of UIElement objects with position and visibility information

### ContentExtractor

Service for extracting meaningful information from UI elements.

#### Interface

```typescript
interface IContentExtractor {
  extractFromElement(element: HTMLElement): Promise<ContentElement>;
  extractFromEmbeddable(embeddable: IEmbeddable): Promise<ContentElement>;
  extractTextContent(element: HTMLElement): TextContent;
  extractTableData(element: HTMLElement): TableData;
  extractFormData(element: HTMLElement): FormData;
  extractNavigationContext(): NavigationContext;
}
```

#### Methods

##### `extractFromElement(element: HTMLElement): Promise<ContentElement>`

Extracts content from any HTML element using appropriate specialized extractors.

**Parameters:**
- `element`: HTML element to extract content from

**Returns:** Promise resolving to ContentElement with extracted data

##### `extractFromEmbeddable(embeddable: IEmbeddable): Promise<ContentElement>`

Extracts content from OpenSearch Dashboard embeddable instances.

**Parameters:**
- `embeddable`: Embeddable instance (visualization, saved search, etc.)

**Returns:** Promise resolving to ContentElement with embeddable data

### ContextualChatService

Enhanced chat service with UI context integration.

#### Interface

```typescript
interface IContextualChatService extends ChatService {
  requestLLMWithContext(
    payload: { 
      messages: IMessage[]; 
      input: IInput; 
      conversationId?: string;
      uiContext?: UIContext;
    },
    context: RequestHandlerContext
  ): Promise<{
    messages: IMessage[];
    conversationId: string;
    interactionId: string;
    stream?: Stream;
  }>;
}
```

#### Methods

##### `requestLLMWithContext(payload, context): Promise<ChatResponse>`

Sends chat request with UI context to LLM service.

**Parameters:**
- `payload.messages`: Array of conversation messages
- `payload.input`: User input message
- `payload.conversationId`: Optional conversation ID
- `payload.uiContext`: Optional UI context data
- `context`: Request handler context

**Returns:** Promise resolving to chat response with messages and conversation ID

## Data Models

### UIContext

Complete UI context representation.

```typescript
interface UIContext {
  page: PageContext;
  content: ContentElement[];
  navigation: NavigationContext;
  filters: FilterContext[];
  timeRange?: TimeRangeContext;
  userActions: UserActionContext[];
  permissions: PermissionContext;
}
```

### ContentElement

Individual content element with extracted data.

```typescript
interface ContentElement {
  id: string;
  type: ContentType;
  title?: string;
  description?: string;
  data: ContentData;
  position: ElementPosition;
  visibility: VisibilityState;
  metadata: ElementMetadata;
  relationships: ElementRelationship[];
}
```

### ContentType Enum

Supported content types for extraction.

```typescript
enum ContentType {
  VISUALIZATION = 'visualization',
  DATA_TABLE = 'data_table',
  TEXT_PANEL = 'text_panel',
  MARKDOWN = 'markdown',
  METRIC = 'metric',
  SEARCH_RESULTS = 'search_results',
  INDEX_PATTERN = 'index_pattern',
  SAVED_OBJECT = 'saved_object',
  ALERT = 'alert',
  CONTROL_PANEL = 'control_panel',
  NAVIGATION_MENU = 'navigation_menu',
  BREADCRUMB = 'breadcrumb',
  FORM = 'form',
  BUTTON = 'button',
  LINK = 'link',
  OTHER = 'other'
}
```

## Error Handling

### Error Types

```typescript
enum ContextError {
  DASHBOARD_NOT_FOUND = 'dashboard_not_found',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  EXTRACTION_FAILED = 'extraction_failed',
  CONTEXT_TIMEOUT = 'context_timeout'
}
```

### Error Response Format

```typescript
interface ContextErrorResponse {
  error: ContextError;
  message: string;
  details?: any;
  fallbackAvailable: boolean;
}
```

## Usage Examples

### Basic Context Extraction

```typescript
// Get current UI context
const uiContextService = core.getService('uiContext');
const context = await uiContextService.getCurrentContext();

// Use context in chat
const chatService = core.getService('contextualChat');
const response = await chatService.requestLLMWithContext({
  messages: conversationHistory,
  input: { content: userMessage },
  uiContext: context
}, requestContext);
```

### Real-time Context Updates

```typescript
// Subscribe to context changes
uiContextService.subscribeToContextChanges((newContext) => {
  // Update chat interface with new context
  updateChatContext(newContext);
});
```

### Content-Specific Extraction

```typescript
// Extract specific visualization data
const vizElement = document.getElementById('visualization-123');
const contentExtractor = core.getService('contentExtractor');
const vizData = await contentExtractor.extractFromElement(vizElement);

console.log('Visualization type:', vizData.data.chartData?.type);
console.log('Data points:', vizData.data.chartData?.values.length);
```

## Security Considerations

### Permission Validation

All context extraction respects existing OpenSearch Dashboard permissions:

```typescript
// Context automatically filtered based on user permissions
const context = await uiContextService.getCurrentContext();
// Only includes content user is authorized to see
```

### Data Sanitization

Sensitive data is automatically sanitized before inclusion in context:

```typescript
interface SecurityValidator {
  validateAccess(user: User, context: UIContext): UIContext;
  sanitizeContext(context: UIContext): UIContext;
  auditContextAccess(user: User, contextId: string): void;
}
```

## Performance Guidelines

### Best Practices

1. **Context Caching**: Context is automatically cached for 5 minutes
2. **Lazy Loading**: Content extracted on-demand when needed
3. **Debounced Updates**: DOM changes debounced to prevent excessive updates
4. **Memory Management**: Context data cleaned up after use

### Performance Limits

- Maximum 20 visualizations per context
- Context extraction timeout: 5 seconds
- Cache TTL: 300 seconds
- Maximum context size: 10MB

## Integration Points

### Plugin Integration

```typescript
// Register context extractor for custom content
const customExtractor: ISpecializedExtractor = {
  canHandle: (element) => element.classList.contains('my-custom-viz'),
  extract: async (element) => {
    // Custom extraction logic
    return customContentElement;
  }
};

contentExtractor.registerExtractor(customExtractor);
```

### Event Hooks

```typescript
// Hook into context extraction events
uiContextService.on('contextExtracted', (context) => {
  // Custom processing
});

uiContextService.on('extractionError', (error) => {
  // Error handling
});
```