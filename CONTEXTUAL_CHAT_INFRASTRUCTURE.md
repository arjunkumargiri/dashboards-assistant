# Contextual Chat Infrastructure

This document describes the core infrastructure and interfaces implemented for the contextual dashboard chat feature.

## Overview

The contextual chat feature enhances the existing dashboard-assistant plugin by adding the ability to understand and analyze content displayed in OpenSearch Dashboard UI. This includes extracting information from visualizations, data tables, text panels, and other UI components.

## Core Components

### 1. Type Definitions

#### UI Context Types (`common/types/ui_context.ts`)
- **ContentType**: Enum defining all supported content types (visualizations, tables, text, etc.)
- **UIContext**: Main interface representing the complete UI state
- **ContentElement**: Interface for individual UI elements with their data and metadata
- **Specialized Data Types**: ChartData, TableData, TextContent, FormData, NavigationData

#### Service Interfaces (`common/types/contextual_chat_service.ts`)
- **IContextualChatService**: Enhanced chat service with UI context support
- **IUIContextService**: Service for capturing and managing UI context
- **IContentExtractor**: Interface for extracting content from DOM elements
- **ISpecializedExtractor**: Interface for content-type-specific extractors

#### Content Extraction Pipeline (`common/types/content_extraction.ts`)
- **IContentExtractionPipeline**: Pipeline for processing content extraction
- **IDOMExtractionStrategy**: Strategy for DOM-based content extraction
- **Security and Performance Interfaces**: Validation, caching, and monitoring

### 2. Service Registry

#### Server-side Registry (`server/services/contextual_chat_service_registry.ts`)
- **ContextualChatServiceRegistry**: Dependency injection container for server services
- **Global Registry Functions**: `getContextualChatServiceRegistry()`, `resetContextualChatServiceRegistry()`
- **Service Management**: Registration, retrieval, and lifecycle management

#### Frontend Registry (`public/services/contextual_chat_service_registry.ts`)
- **FrontendContextualChatServiceRegistry**: Frontend service container
- **UI Context Provider Management**: Registration and lifecycle of frontend services
- **DOM Observer Integration**: Management of DOM change detection

### 3. Configuration

#### Enhanced Config Schema (`common/types/config.ts`)
```typescript
contextualChat: {
  enabled: boolean;
  maxVisualizations: number;
  contextCacheTTL: number;
  extractionTimeout: number;
  security: {
    respectPermissions: boolean;
    auditAccess: boolean;
  };
  performance: {
    debounceMs: number;
    maxContentElements: number;
    enableLazyLoading: boolean;
  };
}
```

#### Constants (`common/constants/contextual_chat.ts`)
- **Default Configuration Values**
- **DOM Selectors** for content extraction
- **Performance Thresholds**
- **Security Constants**

### 4. Plugin Integration

#### Server Plugin (`server/plugin.ts`)
- Initializes contextual chat service registry during setup
- Exposes registry through plugin setup interface
- Conditional initialization based on configuration

#### Type Extensions (`server/types.ts`)
- Extended `AssistantPluginSetup` interface with contextual chat registry
- Maintains backward compatibility with existing interfaces

## Architecture Principles

### 1. Dependency Injection
- Service registry pattern for loose coupling
- Interface-based design for testability
- Global registry instances for singleton behavior

### 2. Extensibility
- Specialized extractor interfaces for different content types
- Plugin-based architecture for adding new extractors
- Configuration-driven feature enablement

### 3. Security
- Permission-based content filtering
- Data sanitization interfaces
- Audit trail support

### 4. Performance
- Caching interfaces for extracted content
- Debounced DOM observation
- Lazy loading support
- Performance monitoring hooks

## Usage Examples

### Registering a Content Extractor
```typescript
const registry = getContextualChatServiceRegistry();
const visualizationExtractor = new MyVisualizationExtractor();
registry.registerContentExtractor(visualizationExtractor);
```

### Implementing a UI Context Service
```typescript
class MyUIContextService implements IUIContextService {
  async getCurrentContext(): Promise<UIContext> {
    // Implementation
  }
  // ... other methods
}

registry.registerUIContextService(new MyUIContextService());
```

### Using the Enhanced Chat Service
```typescript
const contextualChatService = registry.getContextualChatService();
if (contextualChatService) {
  const response = await contextualChatService.requestLLMWithContext({
    messages,
    input,
    uiContext: currentUIContext
  }, context);
}
```

## Testing

The infrastructure includes comprehensive unit tests:
- Service registry functionality
- Mock implementations for all interfaces
- Configuration validation
- Global registry behavior

Run tests with:
```bash
npm run test:jest -- --testPathPattern=contextual_chat_service_registry.test.ts
```

## Next Steps

This infrastructure provides the foundation for implementing:
1. DOM-based content extraction services
2. UI context observation and management
3. Context-aware chat service implementations
4. Frontend React context providers
5. Specialized content extractors for different UI elements

Each component can be implemented incrementally while maintaining the established interfaces and patterns.