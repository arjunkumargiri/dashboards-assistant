# Developer Guide: Extending Context Extractors

## Overview

This guide provides comprehensive instructions for developers who want to extend the Contextual Dashboard Chat feature by creating custom content extractors, integrating with new UI components, or enhancing existing functionality.

## Architecture Overview

### Core Components

The contextual chat system consists of several key components:

1. **UIContextService**: Central service for managing UI context
2. **ContentExtractor**: Base service for content extraction
3. **SpecializedExtractors**: Type-specific extraction implementations
4. **ContextualChatService**: Enhanced chat service with context integration
5. **SecurityValidator**: Permission and data validation
6. **DOMObserver**: Real-time UI change detection

### Extension Points

The system provides several extension points:

- **Custom Content Extractors**: For new UI component types
- **Content Processors**: For post-extraction data processing
- **Context Validators**: For custom validation logic
- **Prompt Enhancers**: For custom context formatting
- **Security Filters**: For additional security validations

## Creating Custom Content Extractors

### Basic Extractor Interface

All content extractors must implement the `ISpecializedExtractor` interface:

```typescript
interface ISpecializedExtractor {
  canHandle(element: HTMLElement | IEmbeddable): boolean;
  extract(element: HTMLElement | IEmbeddable): Promise<ContentElement>;
  getContentType(): ContentType;
  getPriority(): number;
}
```

### Example: Custom Visualization Extractor

Here's a complete example of creating a custom extractor for a hypothetical "HeatmapVisualization":

```typescript
import { ISpecializedExtractor, ContentElement, ContentType } from '../types';

export class HeatmapVisualizationExtractor implements ISpecializedExtractor {
  
  /**
   * Determines if this extractor can handle the given element
   */
  canHandle(element: HTMLElement | IEmbeddable): boolean {
    if (element instanceof HTMLElement) {
      // Check for specific CSS classes or data attributes
      return element.classList.contains('heatmap-visualization') ||
             element.getAttribute('data-viz-type') === 'heatmap';
    }
    
    if (this.isEmbeddable(element)) {
      // Check embeddable type
      return element.type === 'heatmap_visualization';
    }
    
    return false;
  }
  
  /**
   * Extract content from the heatmap visualization
   */
  async extract(element: HTMLElement | IEmbeddable): Promise<ContentElement> {
    const contentElement: ContentElement = {
      id: this.generateId(element),
      type: ContentType.VISUALIZATION,
      title: await this.extractTitle(element),
      description: await this.extractDescription(element),
      data: await this.extractHeatmapData(element),
      position: this.getElementPosition(element),
      visibility: this.getVisibilityState(element),
      metadata: await this.extractMetadata(element),
      relationships: await this.extractRelationships(element)
    };
    
    return contentElement;
  }
  
  getContentType(): ContentType {
    return ContentType.VISUALIZATION;
  }
  
  getPriority(): number {
    return 100; // Higher priority than generic extractors
  }
  
  /**
   * Extract heatmap-specific data
   */
  private async extractHeatmapData(element: HTMLElement | IEmbeddable): Promise<ContentData> {
    if (this.isEmbeddable(element)) {
      return this.extractFromEmbeddable(element);
    } else {
      return this.extractFromDOM(element as HTMLElement);
    }
  }
  
  private async extractFromEmbeddable(embeddable: IEmbeddable): Promise<ContentData> {
    // Access embeddable's data and configuration
    const output = embeddable.getOutput();
    const input = embeddable.getInput();
    
    return {
      chartData: {
        type: 'heatmap',
        values: await this.processHeatmapValues(output.data),
        aggregations: output.aggregations,
        axes: this.extractAxesInfo(input.params),
        series: this.extractSeriesInfo(output.data),
        trends: await this.analyzeTrends(output.data)
      },
      summary: this.generateSummary(output.data),
      rawData: output.data
    };
  }
  
  private async extractFromDOM(element: HTMLElement): Promise<ContentData> {
    // Extract data from DOM elements
    const dataElements = element.querySelectorAll('[data-heatmap-value]');
    const values: DataPoint[] = [];
    
    dataElements.forEach((dataEl) => {
      const value = parseFloat(dataEl.getAttribute('data-heatmap-value') || '0');
      const x = dataEl.getAttribute('data-x') || '';
      const y = dataEl.getAttribute('data-y') || '';
      
      values.push({
        x: x,
        y: y,
        value: value,
        label: dataEl.textContent || ''
      });
    });
    
    return {
      chartData: {
        type: 'heatmap',
        values: values,
        axes: this.extractAxesFromDOM(element),
        series: this.extractSeriesFromDOM(element)
      },
      summary: this.generateDOMSummary(values),
      rawData: values
    };
  }
  
  private async extractTitle(element: HTMLElement | IEmbeddable): Promise<string> {
    if (this.isEmbeddable(element)) {
      return element.getOutput().title || element.getInput().title || 'Heatmap Visualization';
    } else {
      const titleEl = element.querySelector('.visualization-title, h1, h2, h3');
      return titleEl?.textContent || 'Heatmap Visualization';
    }
  }
  
  private async extractDescription(element: HTMLElement | IEmbeddable): Promise<string> {
    if (this.isEmbeddable(element)) {
      return element.getOutput().description || element.getInput().description || '';
    } else {
      const descEl = element.querySelector('.visualization-description, .description');
      return descEl?.textContent || '';
    }
  }
  
  private generateId(element: HTMLElement | IEmbeddable): string {
    if (this.isEmbeddable(element)) {
      return `heatmap-${element.id}`;
    } else {
      return `heatmap-${element.id || Date.now()}`;
    }
  }
  
  private getElementPosition(element: HTMLElement | IEmbeddable): ElementPosition {
    if (this.isEmbeddable(element)) {
      // Get position from embeddable container
      const container = document.querySelector(`[data-embeddable-id="${element.id}"]`);
      if (container) {
        const rect = container.getBoundingClientRect();
        return {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        };
      }
    } else {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    }
    
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  
  private getVisibilityState(element: HTMLElement | IEmbeddable): VisibilityState {
    // Implementation for visibility detection
    return {
      visible: true,
      inViewport: true,
      obscured: false
    };
  }
  
  private async extractMetadata(element: HTMLElement | IEmbeddable): Promise<ElementMetadata> {
    return {
      extractedAt: new Date().toISOString(),
      extractorVersion: '1.0.0',
      contentHash: this.generateContentHash(element),
      customProperties: {
        visualizationType: 'heatmap',
        hasInteractivity: this.hasInteractivity(element),
        dataSource: await this.getDataSource(element)
      }
    };
  }
  
  private async extractRelationships(element: HTMLElement | IEmbeddable): Promise<ElementRelationship[]> {
    const relationships: ElementRelationship[] = [];
    
    // Find related filters
    const filters = this.findRelatedFilters(element);
    filters.forEach(filter => {
      relationships.push({
        type: 'filtered_by',
        targetId: filter.id,
        description: `Filtered by ${filter.field}`
      });
    });
    
    // Find related time range
    const timeRange = this.findRelatedTimeRange(element);
    if (timeRange) {
      relationships.push({
        type: 'time_filtered',
        targetId: timeRange.id,
        description: `Time range: ${timeRange.from} to ${timeRange.to}`
      });
    }
    
    return relationships;
  }
  
  // Helper methods
  private isEmbeddable(element: any): element is IEmbeddable {
    return element && typeof element.getOutput === 'function';
  }
  
  private processHeatmapValues(data: any): DataPoint[] {
    // Process raw data into standardized format
    return data.rows?.map((row: any, index: number) => ({
      x: row.x || index,
      y: row.y || 0,
      value: row.value || 0,
      label: row.label || `Point ${index}`
    })) || [];
  }
  
  private generateSummary(data: any): string {
    const valueCount = data.rows?.length || 0;
    const maxValue = Math.max(...(data.rows?.map((r: any) => r.value) || [0]));
    const minValue = Math.min(...(data.rows?.map((r: any) => r.value) || [0]));
    
    return `Heatmap with ${valueCount} data points, values ranging from ${minValue} to ${maxValue}`;
  }
}
```

### Registering Custom Extractors

Register your custom extractor with the content extraction system:

```typescript
// In your plugin's setup method
export class MyPlugin implements Plugin {
  setup(core: CoreSetup, deps: PluginDependencies) {
    // Get the content extractor service
    const contentExtractor = deps.dashboardsAssistant.getContentExtractor();
    
    // Register your custom extractor
    contentExtractor.registerExtractor(new HeatmapVisualizationExtractor());
    
    // Register multiple extractors
    contentExtractor.registerExtractors([
      new HeatmapVisualizationExtractor(),
      new CustomTableExtractor(),
      new CustomFormExtractor()
    ]);
  }
}
```

## Creating Content Processors

Content processors allow you to modify or enhance extracted content:

```typescript
interface IContentProcessor {
  process(content: ContentElement[]): Promise<ContentElement[]>;
  getPriority(): number;
}

export class DataEnrichmentProcessor implements IContentProcessor {
  async process(content: ContentElement[]): Promise<ContentElement[]> {
    return Promise.all(content.map(async (element) => {
      if (element.type === ContentType.VISUALIZATION) {
        // Enrich visualization data
        element.data = await this.enrichVisualizationData(element.data);
        
        // Add computed metrics
        element.metadata.customProperties = {
          ...element.metadata.customProperties,
          computedMetrics: await this.computeMetrics(element.data)
        };
      }
      
      return element;
    }));
  }
  
  getPriority(): number {
    return 50; // Medium priority
  }
  
  private async enrichVisualizationData(data: ContentData): Promise<ContentData> {
    if (data.chartData) {
      // Add trend analysis
      data.chartData.trends = await this.analyzeTrends(data.chartData.values);
      
      // Add statistical summaries
      data.chartData.statistics = this.computeStatistics(data.chartData.values);
    }
    
    return data;
  }
}

// Register the processor
contentExtractor.registerProcessor(new DataEnrichmentProcessor());
```

## Creating Custom Validators

Custom validators can add additional security or data validation:

```typescript
interface IContentValidator {
  validate(content: ContentElement): boolean;
  sanitize(content: ContentElement): ContentElement;
  getPriority(): number;
}

export class ComplianceValidator implements IContentValidator {
  validate(content: ContentElement): boolean {
    // Check if content meets compliance requirements
    if (content.type === ContentType.DATA_TABLE) {
      return this.validateTableCompliance(content);
    }
    
    if (content.type === ContentType.VISUALIZATION) {
      return this.validateVisualizationCompliance(content);
    }
    
    return true;
  }
  
  sanitize(content: ContentElement): ContentElement {
    // Remove or mask sensitive data
    if (content.data.tableData) {
      content.data.tableData = this.sanitizeTableData(content.data.tableData);
    }
    
    if (content.data.chartData) {
      content.data.chartData = this.sanitizeChartData(content.data.chartData);
    }
    
    return content;
  }
  
  getPriority(): number {
    return 200; // High priority for security
  }
  
  private validateTableCompliance(content: ContentElement): boolean {
    const tableData = content.data.tableData;
    if (!tableData) return true;
    
    // Check for sensitive column names
    const sensitiveColumns = ['ssn', 'credit_card', 'password'];
    const hasRestrictedColumns = tableData.headers.some(header => 
      sensitiveColumns.some(sensitive => 
        header.toLowerCase().includes(sensitive)
      )
    );
    
    return !hasRestrictedColumns;
  }
  
  private sanitizeTableData(tableData: TableData): TableData {
    // Mask sensitive data in table
    const sanitizedRows = tableData.rows.map(row => 
      row.map((cell, index) => {
        const header = tableData.headers[index]?.toLowerCase() || '';
        if (header.includes('email')) {
          return this.maskEmail(cell);
        }
        if (header.includes('phone')) {
          return this.maskPhone(cell);
        }
        return cell;
      })
    );
    
    return {
      ...tableData,
      rows: sanitizedRows
    };
  }
}

// Register the validator
contentExtractor.registerValidator(new ComplianceValidator());
```

## Extending Chat Integration

### Custom Prompt Enhancers

Create custom prompt enhancers to format context for specific use cases:

```typescript
interface IPromptEnhancer {
  enhance(prompt: string, context: UIContext, userQuery: string): string;
  canHandle(context: UIContext, userQuery: string): boolean;
  getPriority(): number;
}

export class VisualizationPromptEnhancer implements IPromptEnhancer {
  canHandle(context: UIContext, userQuery: string): boolean {
    // Handle queries about visualizations
    const hasVisualizations = context.content.some(c => c.type === ContentType.VISUALIZATION);
    const isVisualizationQuery = /chart|graph|visualization|plot|trend/i.test(userQuery);
    
    return hasVisualizations && isVisualizationQuery;
  }
  
  enhance(prompt: string, context: UIContext, userQuery: string): string {
    const visualizations = context.content.filter(c => c.type === ContentType.VISUALIZATION);
    
    let enhancedPrompt = prompt + '\n\nVisualization Context:\n';
    
    visualizations.forEach((viz, index) => {
      enhancedPrompt += `\nVisualization ${index + 1}: ${viz.title}\n`;
      enhancedPrompt += `Type: ${viz.data.chartData?.type}\n`;
      enhancedPrompt += `Data Points: ${viz.data.chartData?.values.length}\n`;
      
      if (viz.data.chartData?.trends) {
        enhancedPrompt += `Trends: ${this.describeTrends(viz.data.chartData.trends)}\n`;
      }
      
      if (viz.data.summary) {
        enhancedPrompt += `Summary: ${viz.data.summary}\n`;
      }
    });
    
    return enhancedPrompt;
  }
  
  getPriority(): number {
    return 100;
  }
  
  private describeTrends(trends: TrendAnalysis): string {
    // Convert trend data to natural language
    const descriptions = [];
    
    if (trends.direction === 'increasing') {
      descriptions.push('showing an upward trend');
    } else if (trends.direction === 'decreasing') {
      descriptions.push('showing a downward trend');
    }
    
    if (trends.volatility === 'high') {
      descriptions.push('with high volatility');
    }
    
    return descriptions.join(', ');
  }
}

// Register the enhancer
const contextualChatService = deps.dashboardsAssistant.getContextualChatService();
contextualChatService.registerPromptEnhancer(new VisualizationPromptEnhancer());
```

## Testing Custom Extensions

### Unit Testing

Create comprehensive unit tests for your custom extractors:

```typescript
describe('HeatmapVisualizationExtractor', () => {
  let extractor: HeatmapVisualizationExtractor;
  let mockElement: HTMLElement;
  let mockEmbeddable: IEmbeddable;
  
  beforeEach(() => {
    extractor = new HeatmapVisualizationExtractor();
    mockElement = createMockHeatmapElement();
    mockEmbeddable = createMockHeatmapEmbeddable();
  });
  
  describe('canHandle', () => {
    it('should handle heatmap HTML elements', () => {
      mockElement.classList.add('heatmap-visualization');
      expect(extractor.canHandle(mockElement)).toBe(true);
    });
    
    it('should handle heatmap embeddables', () => {
      mockEmbeddable.type = 'heatmap_visualization';
      expect(extractor.canHandle(mockEmbeddable)).toBe(true);
    });
    
    it('should not handle non-heatmap elements', () => {
      expect(extractor.canHandle(document.createElement('div'))).toBe(false);
    });
  });
  
  describe('extract', () => {
    it('should extract content from HTML element', async () => {
      const content = await extractor.extract(mockElement);
      
      expect(content.type).toBe(ContentType.VISUALIZATION);
      expect(content.data.chartData?.type).toBe('heatmap');
      expect(content.data.chartData?.values).toBeDefined();
    });
    
    it('should extract content from embeddable', async () => {
      const content = await extractor.extract(mockEmbeddable);
      
      expect(content.type).toBe(ContentType.VISUALIZATION);
      expect(content.data.chartData?.type).toBe('heatmap');
      expect(content.id).toContain('heatmap-');
    });
    
    it('should include metadata', async () => {
      const content = await extractor.extract(mockElement);
      
      expect(content.metadata.extractedAt).toBeDefined();
      expect(content.metadata.extractorVersion).toBe('1.0.0');
      expect(content.metadata.customProperties?.visualizationType).toBe('heatmap');
    });
  });
});
```

### Integration Testing

Test your extensions with the full contextual chat system:

```typescript
describe('Custom Extractor Integration', () => {
  let contextService: IUIContextService;
  let contentExtractor: IContentExtractor;
  
  beforeEach(async () => {
    // Set up test environment
    const testSetup = await createTestEnvironment();
    contextService = testSetup.contextService;
    contentExtractor = testSetup.contentExtractor;
    
    // Register custom extractor
    contentExtractor.registerExtractor(new HeatmapVisualizationExtractor());
  });
  
  it('should extract custom content in full context', async () => {
    // Create test dashboard with heatmap
    const dashboard = await createTestDashboard({
      visualizations: [
        { type: 'heatmap', id: 'test-heatmap' }
      ]
    });
    
    // Get context
    const context = await contextService.getCurrentContext();
    
    // Verify custom content is extracted
    const heatmapContent = context.content.find(c => 
      c.id === 'heatmap-test-heatmap'
    );
    
    expect(heatmapContent).toBeDefined();
    expect(heatmapContent?.type).toBe(ContentType.VISUALIZATION);
  });
  
  it('should work with contextual chat', async () => {
    const chatService = getContextualChatService();
    const context = await contextService.getCurrentContext();
    
    const response = await chatService.requestLLMWithContext({
      messages: [],
      input: { content: 'What does the heatmap show?' },
      uiContext: context
    }, mockRequestContext);
    
    expect(response.messages).toBeDefined();
    // Verify response references heatmap data
  });
});
```

## Performance Considerations

### Optimization Guidelines

1. **Lazy Loading**: Only extract content when needed
```typescript
export class OptimizedExtractor implements ISpecializedExtractor {
  private cache = new Map<string, ContentElement>();
  
  async extract(element: HTMLElement | IEmbeddable): Promise<ContentElement> {
    const id = this.generateId(element);
    
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    
    // Extract and cache
    const content = await this.performExtraction(element);
    this.cache.set(id, content);
    
    return content;
  }
}
```

2. **Debounced Updates**: Prevent excessive re-extraction
```typescript
export class DebouncedExtractor implements ISpecializedExtractor {
  private extractionPromises = new Map<string, Promise<ContentElement>>();
  
  async extract(element: HTMLElement | IEmbeddable): Promise<ContentElement> {
    const id = this.generateId(element);
    
    // Return existing promise if extraction in progress
    if (this.extractionPromises.has(id)) {
      return this.extractionPromises.get(id)!;
    }
    
    // Create new extraction promise
    const promise = this.performExtraction(element);
    this.extractionPromises.set(id, promise);
    
    // Clean up after completion
    promise.finally(() => {
      this.extractionPromises.delete(id);
    });
    
    return promise;
  }
}
```

3. **Memory Management**: Clean up resources
```typescript
export class ManagedExtractor implements ISpecializedExtractor {
  private observers = new Set<MutationObserver>();
  
  async extract(element: HTMLElement | IEmbeddable): Promise<ContentElement> {
    const content = await this.performExtraction(element);
    
    // Set up cleanup
    this.setupCleanup(element, content);
    
    return content;
  }
  
  private setupCleanup(element: HTMLElement | IEmbeddable, content: ContentElement) {
    if (element instanceof HTMLElement) {
      // Clean up when element is removed
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.removedNodes.forEach((node) => {
            if (node === element) {
              this.cleanup(content);
            }
          });
        });
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      this.observers.add(observer);
    }
  }
  
  private cleanup(content: ContentElement) {
    // Clean up resources
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}
```

## Best Practices

### Code Organization

1. **Separate Concerns**: Keep extraction, processing, and validation separate
2. **Use TypeScript**: Leverage strong typing for better development experience
3. **Error Handling**: Implement comprehensive error handling and fallbacks
4. **Documentation**: Document all public APIs and complex logic
5. **Testing**: Write comprehensive unit and integration tests

### Security Considerations

1. **Input Validation**: Always validate extracted data
2. **Permission Checks**: Respect existing security boundaries
3. **Data Sanitization**: Remove or mask sensitive information
4. **Audit Logging**: Log security-relevant operations

### Performance Guidelines

1. **Lazy Loading**: Extract content only when needed
2. **Caching**: Cache expensive operations appropriately
3. **Memory Management**: Clean up resources and prevent leaks
4. **Debouncing**: Prevent excessive updates from DOM changes

## Debugging and Troubleshooting

### Debug Logging

Enable debug logging for your custom extractors:

```typescript
export class DebuggableExtractor implements ISpecializedExtractor {
  private logger = getLogger('CustomExtractor');
  
  async extract(element: HTMLElement | IEmbeddable): Promise<ContentElement> {
    this.logger.debug('Starting extraction', { elementId: this.generateId(element) });
    
    try {
      const content = await this.performExtraction(element);
      this.logger.debug('Extraction successful', { 
        contentId: content.id, 
        dataSize: JSON.stringify(content.data).length 
      });
      return content;
    } catch (error) {
      this.logger.error('Extraction failed', { error: error.message });
      throw error;
    }
  }
}
```

### Performance Monitoring

Add performance monitoring to your extractors:

```typescript
export class MonitoredExtractor implements ISpecializedExtractor {
  async extract(element: HTMLElement | IEmbeddable): Promise<ContentElement> {
    const startTime = performance.now();
    
    try {
      const content = await this.performExtraction(element);
      
      const duration = performance.now() - startTime;
      this.recordMetric('extraction_time', duration);
      this.recordMetric('content_size', JSON.stringify(content.data).length);
      
      return content;
    } catch (error) {
      this.recordMetric('extraction_error', 1);
      throw error;
    }
  }
  
  private recordMetric(name: string, value: number) {
    // Send metrics to monitoring system
    window.opensearchDashboards?.getService('metrics')?.record(name, value);
  }
}
```

This developer guide provides comprehensive information for extending the contextual dashboard chat feature. Follow these patterns and best practices to create robust, performant, and secure extensions.