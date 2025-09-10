/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { EuiButton, EuiFlexGroup, EuiFlexItem, EuiTextArea, EuiCheckbox, EuiToolTip, EuiButtonEmpty } from '@elastic/eui';
import autosize from 'autosize';
import React, { useRef, useState } from 'react';
import { useEffectOnce } from 'react-use';
import { IMessage } from '../../../../common/types/chat_saved_object_attributes';
import { useChatContext } from '../../../contexts';
import { useChatActions, useChatState } from '../../../hooks';
import { ScreenshotService, ScreenshotResult } from '../../../services/screenshot_service';
import { useStreamingChat } from '../../../hooks/use_streaming_chat';
import { HttpSetup } from '../../../../../src/core/public';
// Use a simple inline context extraction instead of complex services

// Helper functions for enhanced extraction
const parseMetricValue = (value) => {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const extractUnit = (value) => {
  if (!value) return '';
  const unitMatch = value.match(/[a-zA-Z%$€£¥]+/);
  return unitMatch ? unitMatch[0] : '';
};

const extractTrendIndicator = (element) => {
  const trendClasses = element.className || '';
  if (trendClasses.includes('up') || trendClasses.includes('increase') || trendClasses.includes('positive')) {
    return 'up';
  }
  if (trendClasses.includes('down') || trendClasses.includes('decrease') || trendClasses.includes('negative')) {
    return 'down';
  }
  return 'neutral';
};

const detectChartType = (element) => {
  const className = element.className || '';
  const textContent = element.textContent || '';

  // Check for specific chart types
  if (className.includes('bar') || textContent.includes('bar')) return 'bar';
  if (className.includes('line') || textContent.includes('line')) return 'line';
  if (className.includes('pie') || textContent.includes('pie')) return 'pie';
  if (className.includes('area') || textContent.includes('area')) return 'area';
  if (className.includes('scatter') || textContent.includes('scatter')) return 'scatter';
  if (className.includes('histogram') || textContent.includes('histogram')) return 'histogram';

  // Check for canvas or SVG
  if (element.querySelector('canvas')) return 'canvas-chart';
  if (element.querySelector('svg')) return 'svg-chart';

  return 'chart';
};

interface ChatInputControlsProps {
  disabled: boolean;
  loading: boolean;
  http?: HttpSetup;
  enableStreaming?: boolean;
  onStreamingResponse?: (content: string, isComplete: boolean) => void;
  streamingChat?: any; // Add the streaming chat hook
}

export const ChatInputControls: React.FC<ChatInputControlsProps> = (props) => {
  const chatContext = useChatContext();
  const { send } = useChatActions();
  const { chatStateDispatch } = useChatState();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [includeContext, setIncludeContext] = useState(false);
  const [isExtractingContext, setIsExtractingContext] = useState(false);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [useStreaming, setUseStreaming] = useState(props.enableStreaming || true); // Enable by default for testing

  // Use the streaming chat hook passed from parent (chat page)
  const streamingChat = props.streamingChat;

  // Puppeteer-inspired context extraction functions
  const extractPuppeteerStyleContext = async () => {
    console.log('🎭 Extracting Puppeteer-style dashboard context...');

    try {
      // Step 1: Wait for content to be ready (Puppeteer-style)
      await waitForDashboardReady();

      // Step 2: Find dashboard elements using comprehensive selectors
      const dashboardElements = document.querySelectorAll([
        '[data-test-subj*="embeddable"]',
        '[data-test-subj*="embeddablePanel"]',
        '[data-test-subj*="visualization"]',
        '.react-grid-item',
        '.euiPanel',
        '.euiStat',
        'table',
        '.euiTable',
        '.euiDataGrid',
        'canvas[data-chart]',
        'svg[data-chart]',
        '.lens-vis-container',
        '.vega-vis-container'
      ].join(', '));

      console.log(`📊 Found ${dashboardElements.length} dashboard elements`);

      const content = [];

      // Step 3: Process each element with advanced extraction
      for (let index = 0; index < Math.min(dashboardElements.length, 15); index++) {
        const element = dashboardElements[index];
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight;

        if (isVisible) {
          const elementData = await extractAdvancedElementData(element, index);
          if (elementData) {
            content.push(elementData);
            console.log(`  📌 Added: ${elementData.title} (${elementData.type})`);
          }
        }
      }

      // Step 4: Build comprehensive context
      const context = {
        page: {
          url: window.location.href,
          title: document.title,
          app: chatContext.appId || extractAppFromURL(),
          route: window.location.pathname,
          breadcrumbs: extractBreadcrumbs(), // Add required breadcrumbs array
          metadata: {
            dashboardId: extractDashboardId(),
            savedObjectType: extractSavedObjectType(),
            lastModified: new Date().toISOString(),
            permissions: ['read', 'view']
          }
        },
        content,
        navigation: {
          currentApp: chatContext.appId || extractAppFromURL(),
          currentRoute: window.location.pathname,
          breadcrumbs: extractBreadcrumbs(), // Add breadcrumbs here too
          availableApps: [] // Add required availableApps array
        },
        filters: await extractAdvancedFilters(),
        // timeRange removed - no longer used
        userActions: [], // Add required userActions array
        permissions: {
          canViewData: true,
          canModifyDashboard: false,
          canAccessApp: true,
          restrictedFields: [],
          dataSourcePermissions: {}
        },
        extractedAt: new Date().toISOString()
      };

      console.log('✅ Puppeteer-style context extracted:', {
        contentCount: content.length,
        pageApp: context.page.app,
        hasFilters: context.filters.length > 0
        // hasTimeRange removed - no longer used
      });

      return context;
    } catch (error) {
      console.error('❌ Puppeteer-style context extraction failed:', error);
      throw error;
    }
  };

  // Wait for dashboard content to be ready (Puppeteer waitForSelector equivalent)
  const waitForDashboardReady = async () => {
    console.log('⏳ Waiting for dashboard content to be ready...');

    const selectors = [
      '[data-test-subj="dashboardViewport"]',
      '.react-grid-layout',
      '[data-render-complete="true"]',
      '.dashboard-container'
    ];

    const timeout = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          console.log(`✅ Dashboard ready: found ${selector}`);

          // Additional wait for dynamic content
          await waitForDynamicContent();
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('⚠️ Dashboard readiness timeout, proceeding anyway');
  };

  // Wait for dynamic content to load
  const waitForDynamicContent = async () => {
    console.log('🔄 Waiting for dynamic content...');

    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[data-loading="true"]',
      '.euiLoadingSpinner'
    ];

    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max

    while (attempts < maxAttempts) {
      const hasLoading = loadingSelectors.some(selector =>
        document.querySelector(selector)
      );

      if (!hasLoading) {
        console.log('✅ Dynamic content loaded');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    console.log('⏰ Dynamic content wait completed');
  };

  // Advanced element data extraction
  const extractAdvancedElementData = async (element, index) => {
    const rect = element.getBoundingClientRect();
    const type = determineElementType(element);
    const title = extractElementTitle(element);

    const elementData = {
      id: element.id || `element-${index}`,
      type,
      title,
      data: {
        summary: await generateAdvancedSummary(element, type),
        textContent: element.textContent?.trim().substring(0, 300) || '',
        tagName: element.tagName,
        className: element.className,
        testSubj: element.getAttribute('data-test-subj'),

        // Advanced data extraction based on type
        ...(type === 'visualization' && {
          chartData: await extractChartDataAdvanced(element)
        }),
        ...(type === 'data_table' && {
          tableData: await extractTableDataAdvanced(element)
        }),
        ...(type === 'metric' && {
          metricData: await extractMetricDataAdvanced(element)
        })
      },
      position: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        area: rect.width * rect.height
      },
      visual: {
        hasCanvas: !!element.querySelector('canvas'),
        hasSVG: !!element.querySelector('svg'),
        hasLegend: !!element.querySelector('.legend, .euiLegend'),
        hasTooltip: !!element.getAttribute('title') || !!element.getAttribute('aria-describedby')
      },
      interactions: {
        isClickable: isElementClickable(element),
        hasHover: hasHoverEffects(element),
        isKeyboardAccessible: element.tabIndex >= 0
      },
      metadata: {
        extractionMethod: 'puppeteer-style',
        visible: true,
        renderComplete: element.getAttribute('data-render-complete') === 'true',
        lastUpdated: new Date().toISOString()
      }
    };

    return elementData;
  };

  // Simplified but aggressive chart data extraction
  const extractChartDataAdvanced = async (element) => {
    const chartData = {
      type: detectChartType(element),
      dataPoints: [],
      metadata: {
        hasCanvas: !!element.querySelector('canvas'),
        hasSVG: !!element.querySelector('svg'),
        hasLegend: !!element.querySelector('.legend, .euiLegend, .echLegend')
      }
    };

    try {
      // Strategy 1: Aggressive text number extraction
      const allText = element.textContent || '';
      const numbers = allText.match(/\b\d+(?:\.\d+)?(?:[KMB])?\b/g);

      if (numbers && numbers.length >= 2) {
        console.log('📊 Found numbers in text:', numbers);

        // Convert numbers and handle suffixes
        const processedNumbers = numbers.map(numStr => {
          let value = parseFloat(numStr.replace(/[KMB]/g, ''));
          if (numStr.includes('K')) value *= 1000;
          if (numStr.includes('M')) value *= 1000000;
          if (numStr.includes('B')) value *= 1000000000;
          return value;
        }).filter(n => !isNaN(n) && n > 0);

        if (processedNumbers.length >= 2) {
          chartData.dataPoints = processedNumbers.slice(0, 10).map((num, index) => ({
            x: index,
            y: num,
            label: `Value ${index + 1}: ${numbers[index]}`
          }));
          console.log('✅ Extracted', chartData.dataPoints.length, 'data points from text');
        }
      }

      // Strategy 2: Look for any elements with numeric content
      if (chartData.dataPoints.length === 0) {
        const allElements = element.querySelectorAll('*');
        const numericElements = [];

        allElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length < 20) { // Short text likely to be numbers
            const num = parseFloat(text.replace(/[^0-9.-]/g, ''));
            if (!isNaN(num) && num > 0) {
              numericElements.push({ element: el, value: num, text: text });
            }
          }
        });

        if (numericElements.length >= 2) {
          console.log('📊 Found numeric elements:', numericElements.length);
          chartData.dataPoints = numericElements.slice(0, 10).map((item, index) => ({
            x: index,
            y: item.value,
            label: `${item.text}`
          }));
          console.log('✅ Extracted', chartData.dataPoints.length, 'data points from elements');
        }
      }

      // Strategy 3: Look for specific OpenSearch Dashboards patterns
      if (chartData.dataPoints.length === 0) {
        // Common selectors in OpenSearch Dashboards visualizations
        const kibanaSelectors = [
          '.visAxis__splitTitles .visAxis__splitTitle',
          '.visWrapper__chart .visAxis__column',
          '.vis-editor-canvas .visualization',
          '[data-test-subj="visChart"] .chart-container',
          '.echChart text',
          '.vega-vis text',
          '.lens-vis text'
        ];

        for (const selector of kibanaSelectors) {
          const elements = element.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log('📊 Found Kibana elements with selector:', selector, elements.length);

            const extractedData = [];
            elements.forEach((el, index) => {
              const text = el.textContent?.trim();
              if (text) {
                const num = parseFloat(text.replace(/[^0-9.-]/g, ''));
                if (!isNaN(num)) {
                  extractedData.push({
                    x: index,
                    y: num,
                    label: text
                  });
                }
              }
            });

            if (extractedData.length > 0) {
              chartData.dataPoints = extractedData.slice(0, 15);
              console.log('✅ Extracted', chartData.dataPoints.length, 'data points from Kibana selector');
              break;
            }
          }
        }
      }

      // Strategy 4: Extract from any table structure
      if (chartData.dataPoints.length === 0) {
        const tables = element.querySelectorAll('table, .euiTable, [role="table"]');

        for (const table of tables) {
          const cells = table.querySelectorAll('td, .euiTableRowCell, [role="cell"]');
          const numericCells = [];

          cells.forEach(cell => {
            const text = cell.textContent?.trim();
            if (text) {
              const num = parseFloat(text.replace(/[^0-9.-]/g, ''));
              if (!isNaN(num) && num > 0) {
                numericCells.push({ value: num, text: text });
              }
            }
          });

          if (numericCells.length >= 2) {
            console.log('📊 Found numeric table cells:', numericCells.length);
            chartData.dataPoints = numericCells.slice(0, 10).map((item, index) => ({
              x: index,
              y: item.value,
              label: item.text
            }));
            console.log('✅ Extracted', chartData.dataPoints.length, 'data points from table');
            break;
          }
        }
      }

      // Strategy 5: Brute force - extract ALL numbers from the element
      if (chartData.dataPoints.length === 0) {
        console.log('📊 Using brute force number extraction...');

        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        const allNumbers = [];
        let node;

        while (node = walker.nextNode()) {
          const text = node.textContent?.trim();
          if (text && text.length < 50) { // Reasonable length
            const numbers = text.match(/\b\d+(?:\.\d+)?\b/g);
            if (numbers) {
              numbers.forEach(numStr => {
                const num = parseFloat(numStr);
                if (!isNaN(num) && num > 0) {
                  allNumbers.push({ value: num, text: numStr, context: text });
                }
              });
            }
          }
        }

        if (allNumbers.length >= 2) {
          console.log('📊 Brute force found numbers:', allNumbers.length);
          // Remove duplicates and take unique values
          const uniqueNumbers = allNumbers.filter((item, index, arr) =>
            arr.findIndex(other => other.value === item.value) === index
          );

          chartData.dataPoints = uniqueNumbers.slice(0, 8).map((item, index) => ({
            x: index,
            y: item.value,
            label: `${item.text} (${item.context.substring(0, 20)}...)`
          }));
          console.log('✅ Brute force extracted', chartData.dataPoints.length, 'data points');
        }
      }

      console.log('📊 Final extraction result:', chartData.dataPoints.length, 'data points');
      if (chartData.dataPoints.length > 0) {
        console.log('📊 Sample data points:', chartData.dataPoints.slice(0, 3));
      }

    } catch (error) {
      console.warn('Simple chart data extraction error:', error);
    }

    return chartData;
  };

  // Enhanced table data extraction
  const extractTableDataAdvanced = async (element) => {
    const tableData = {
      headers: [],
      rows: [],
      metadata: {}
    };

    try {
      // Look for various table structures in OpenSearch Dashboards
      const tableSelectors = [
        'table',
        '.euiTable',
        '.osdTable',
        '.kbn-table',
        '.react-grid-HeaderCell',
        '.ag-grid'
      ];

      let foundTable = null;
      for (const selector of tableSelectors) {
        foundTable = element.querySelector(selector);
        if (foundTable) break;
      }

      if (foundTable) {
        // Extract headers
        const headerSelectors = [
          'thead th',
          '.euiTableHeaderCell',
          '.osdTableHeaderCell',
          '.ag-header-cell-text'
        ];

        for (const selector of headerSelectors) {
          const headers = foundTable.querySelectorAll(selector);
          if (headers.length > 0) {
            tableData.headers = Array.from(headers).map(cell => cell.textContent?.trim() || '');
            break;
          }
        }

        // Extract rows
        const rowSelectors = [
          'tbody tr',
          '.euiTableRow',
          '.osdTableRow',
          '.ag-row'
        ];

        for (const selector of rowSelectors) {
          const rows = foundTable.querySelectorAll(selector);
          if (rows.length > 0) {
            tableData.rows = Array.from(rows).slice(0, 50).map(row => {
              const cellSelectors = ['td', '.euiTableRowCell', '.ag-cell'];
              let cells = [];

              for (const cellSelector of cellSelectors) {
                cells = row.querySelectorAll(cellSelector);
                if (cells.length > 0) break;
              }

              return Array.from(cells).map(cell => cell.textContent?.trim() || '');
            }).filter(row => row.length > 0);
            break;
          }
        }

        // Extract metadata
        tableData.metadata = {
          totalRows: tableData.rows.length,
          visibleRows: Math.min(tableData.rows.length, 50),
          totalColumns: tableData.headers.length,
          hasPagination: !!element.querySelector('.euiPagination, .ag-paging-panel'),
          hasSorting: !!element.querySelector('.euiTableHeaderCell--isSorted, .ag-header-cell-sorted'),
          hasFiltering: !!element.querySelector('.euiFieldSearch, .ag-floating-filter')
        };
      }
    } catch (error) {
      console.warn('Enhanced table data extraction error:', error);
    }

    return tableData;
  };

  // Enhanced metric data extraction
  const extractMetricDataAdvanced = async (element) => {
    const metricData = {
      metrics: [],
      metadata: {}
    };

    try {
      // Look for various metric display patterns
      const metricSelectors = [
        '.euiStat__number',
        '.metric-value',
        '.kbn-metric-value',
        '.visualization-metric',
        '.metric-container .metric-value'
      ];

      const titleSelectors = [
        '.euiStat__title',
        '.metric-title',
        '.kbn-metric-title',
        '.visualization-title'
      ];

      for (const selector of metricSelectors) {
        const metricElements = element.querySelectorAll(selector);

        for (let i = 0; i < metricElements.length; i++) {
          const metricEl = metricElements[i];
          const value = metricEl.textContent?.trim();

          if (value) {
            // Try to find associated title
            let title = 'Metric';
            for (const titleSelector of titleSelectors) {
              const titleEl = element.querySelector(titleSelector) ||
                metricEl.parentElement?.querySelector(titleSelector) ||
                metricEl.closest('.euiStat')?.querySelector(titleSelector);
              if (titleEl) {
                title = titleEl.textContent?.trim() || 'Metric';
                break;
              }
            }

            metricData.metrics.push({
              label: title,
              value: parseMetricValue(value),
              displayValue: value,
              unit: extractUnit(value),
              trend: extractTrendIndicator(element)
            });
          }
        }

        if (metricData.metrics.length > 0) break;
      }

      metricData.metadata = {
        count: metricData.metrics.length,
        hasComparison: !!element.querySelector('.comparison, .trend, .euiStat__description'),
        hasTarget: !!element.querySelector('.target, .goal, .threshold')
      };
    } catch (error) {
      console.warn('Enhanced metric data extraction error:', error);
    }

    return metricData;
  };

  // Helper functions moved to top of file to avoid hoisting issues

  // Advanced filters extraction
  const extractAdvancedFilters = async () => {
    const filters = [];

    try {
      const filterElements = document.querySelectorAll([
        '[data-test-subj*="filter"]',
        '.globalFilterItem',
        '.filter-bar .filter',
        '.euiFilterButton'
      ].join(', '));

      for (const element of filterElements) {
        const text = element.textContent?.trim();
        if (text) {
          const filterData = {
            displayName: text,
            enabled: !element.classList.contains('disabled'),
            negated: element.classList.contains('negated'),
            pinned: element.classList.contains('pinned'),
            type: element.getAttribute('data-filter-type') || 'unknown'
          };

          // Try to parse field and value
          const colonIndex = text.indexOf(':');
          if (colonIndex > 0) {
            filterData.field = text.substring(0, colonIndex).trim();
            filterData.value = text.substring(colonIndex + 1).trim();
          }

          filters.push(filterData);
        }
      }
    } catch (error) {
      console.warn('Filter extraction error:', error);
    }

    return filters;
  };

  // extractAdvancedTimeRange function removed - no longer used

  // Generate advanced summary based on extracted data
  const generateAdvancedSummary = async (element, type) => {
    const title = extractElementTitle(element);

    switch (type) {
      case 'visualization':
        const chartData = await extractChartDataAdvanced(element);
        const chartType = chartData.type;
        const dataCount = chartData.dataPoints.length;
        const hasLegend = chartData.metadata.hasLegend ? ', includes legend' : '';
        return `${title} - ${chartType} visualization with ${dataCount} data points${hasLegend}`;

      case 'data_table':
        const tableData = await extractTableDataAdvanced(element);
        const cols = tableData.headers.length;
        const rows = tableData.metadata.totalRows;
        const features = [];
        if (tableData.metadata.hasPagination) features.push('paginated');
        if (tableData.metadata.hasSorting) features.push('sortable');
        const featuresText = features.length > 0 ? `, ${features.join(', ')}` : '';
        return `${title} - table with ${cols} columns and ${rows} rows${featuresText}`;

      case 'metric':
        const metricData = await extractMetricDataAdvanced(element);
        if (metricData.metrics.length > 0) {
          const metric = metricData.metrics[0];
          return `${title} - ${metric.label}: ${metric.displayValue}`;
        }
        return `${title} - metric display`;

      default:
        return `${title} - ${type} element`;
    }
  };

  const determineElementType = (element) => {
    const testSubj = element.getAttribute('data-test-subj') || '';
    const className = element.className || '';

    if (testSubj.includes('visualization') || className.includes('visualization')) {
      return 'visualization';
    }
    if (testSubj.includes('embeddable') || className.includes('embeddable')) {
      return 'visualization';
    }
    if (className.includes('euiStat') || testSubj.includes('metric')) {
      return 'metric';
    }
    if (element.tagName === 'TABLE' || className.includes('euiTable')) {
      return 'data_table';
    }
    return 'other';
  };

  const extractElementTitle = (element) => {
    // Try multiple methods to get element title
    const titleSelectors = [
      '.embeddable-title',
      '.panel-title',
      '.euiStat__title',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      '[data-test-subj*="title"]'
    ];

    for (const selector of titleSelectors) {
      const titleEl = element.querySelector(selector);
      if (titleEl && titleEl.textContent?.trim()) {
        return titleEl.textContent.trim();
      }
    }

    return element.getAttribute('title') ||
      element.getAttribute('aria-label') ||
      element.getAttribute('data-test-subj') ||
      `Element ${element.tagName}`;
  };

  const generateElementSummary = (element) => {
    const type = determineElementType(element);
    const title = extractElementTitle(element);

    if (type === 'visualization') {
      const hasCanvas = element.querySelector('canvas');
      const hasSVG = element.querySelector('svg');
      const hasTable = element.querySelector('table');

      if (hasCanvas) return `${title} - canvas-based visualization`;
      if (hasSVG) return `${title} - SVG-based visualization`;
      if (hasTable) return `${title} - table visualization`;
      return `${title} - visualization`;
    }

    if (type === 'metric') {
      const valueEl = element.querySelector('.euiStat__number');
      const value = valueEl?.textContent?.trim();
      return value ? `${title} - metric showing ${value}` : `${title} - metric display`;
    }

    if (type === 'data_table') {
      const rows = element.querySelectorAll('tbody tr, .euiTableRow');
      const headers = element.querySelectorAll('thead th, .euiTableHeaderCell');
      return `${title} - table with ${headers.length} columns and ${rows.length} rows`;
    }

    return `${title} - ${type} element`;
  };

  const extractSimpleFilters = () => {
    const filters = [];
    const filterElements = document.querySelectorAll('[data-test-subj*="filter"], .globalFilterItem');

    Array.from(filterElements).forEach(element => {
      const text = element.textContent?.trim();
      if (text) {
        filters.push({
          displayName: text,
          enabled: !element.classList.contains('disabled')
        });
      }
    });

    return filters;
  };

  const extractSimpleTimeRange = () => {
    const timePickerEl = document.querySelector('[data-test-subj="superDatePickerShowDatesButton"]');
    if (timePickerEl) {
      return {
        displayName: timePickerEl.textContent?.trim() || 'Time range',
        mode: 'relative'
      };
    }
    return undefined;
  };

  const extractAppFromURL = () => {
    const match = window.location.pathname.match(/\/app\/([^\/]+)/);
    return match ? match[1] : 'unknown';
  };

  // Additional utility functions for Puppeteer-style extraction
  // detectChartType function moved to enhanced extraction section above

  const isElementClickable = (element) => {
    return element.onclick !== null ||
      element.getAttribute('role') === 'button' ||
      element.classList.contains('clickable') ||
      element.querySelector('button, a, [role="button"]') !== null;
  };

  const hasHoverEffects = (element) => {
    const style = window.getComputedStyle(element);
    return style.cursor === 'pointer' ||
      element.classList.contains('hoverable') ||
      element.getAttribute('title') !== null;
  };

  // Duplicate helper functions removed - using enhanced versions above

  // Extract breadcrumbs from the page
  const extractBreadcrumbs = () => {
    const breadcrumbs = [];

    try {
      const breadcrumbElements = document.querySelectorAll([
        '[data-test-subj*="breadcrumb"]',
        '.euiBreadcrumbs .euiBreadcrumb',
        '.breadcrumb-item',
        'nav[aria-label="breadcrumb"] a'
      ].join(', '));

      breadcrumbElements.forEach((element, index) => {
        const text = element.textContent?.trim();
        const href = element.getAttribute('href');
        const isActive = element.classList.contains('active') ||
          element.classList.contains('euiBreadcrumb--last') ||
          index === breadcrumbElements.length - 1;

        if (text) {
          breadcrumbs.push({
            text,
            href: href || undefined,
            active: isActive
          });
        }
      });
    } catch (error) {
      console.warn('Failed to extract breadcrumbs:', error);
    }

    return breadcrumbs;
  };

  // Extract dashboard ID from URL
  const extractDashboardId = () => {
    try {
      const path = window.location.pathname;
      const match = path.match(/\/dashboard\/([^\/\?]+)/);
      return match ? match[1] : undefined;
    } catch (error) {
      return undefined;
    }
  };

  // Extract saved object type from URL
  const extractSavedObjectType = () => {
    try {
      const path = window.location.pathname;
      if (path.includes('/dashboard/')) return 'dashboard';
      if (path.includes('/visualize/')) return 'visualization';
      if (path.includes('/discover/')) return 'search';
      return undefined;
    } catch (error) {
      return undefined;
    }
  };
  /**
   * Capture screenshot when checkbox is selected
   */
  const captureScreenshot = async (): Promise<ScreenshotResult | null> => {
    if (!includeContext) {
      console.log('❌ Checkbox not checked - skipping screenshot');
      return null;
    }

    setIsTakingScreenshot(true);
    console.log('📸 Taking screenshot of current page...');
    console.log('📸 Page info:', {
      url: window.location.href,
      title: document.title,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      bodySize: `${document.body.offsetWidth}x${document.body.offsetHeight}`,
      dashboardElements: document.querySelectorAll('[data-test-subj*="dashboard"], .dashboard-container, .react-grid-layout').length
    });

    try {
      const screenshot = await ScreenshotService.capturePageScreenshot({
        quality: 0.8,
        format: 'png',
        maxWidth: 1920,
        maxHeight: 1080,
        excludeSelectors: [
          '.euiOverlayMask',
          '.euiToast',
          '.euiPopover',
          '.euiContextMenu',
          '[data-test-subj="chatFlyout"]',
          '.assistant-chat-container',
          '.screenshot-exclude'
        ]
      });

      // Validate screenshot
      const validation = ScreenshotService.validateScreenshot(screenshot);
      if (!validation.valid) {
        console.error('❌ Screenshot validation failed:', validation.error);
        throw new Error(validation.error);
      }

      // Additional validation for placeholder detection
      if (screenshot.width <= 1 || screenshot.height <= 1) {
        console.error('❌ Screenshot appears to be a placeholder:', {
          dimensions: `${screenshot.width}x${screenshot.height}`,
          size: screenshot.size,
          dataPreview: screenshot.data.substring(0, 100)
        });
        throw new Error('Screenshot capture resulted in placeholder image');
      }

      console.log('✅ Screenshot captured successfully:', {
        filename: screenshot.filename,
        size: `${Math.round(screenshot.size / 1024)}KB`,
        dimensions: `${screenshot.width}x${screenshot.height}`,
        dataLength: screenshot.data.length,
        mimeType: screenshot.mimeType
      });

      return screenshot;
    } catch (error) {
      console.error('❌ Failed to capture screenshot:', error);
      console.error('📸 Screenshot capture context:', {
        userAgent: navigator.userAgent,
        cookiesEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        pageVisibility: document.visibilityState,
        readyState: document.readyState
      });

      // Don't throw - we can still send the message without screenshot
      return null;
    } finally {
      setIsTakingScreenshot(false);
    }
  };

  /**
   * Extract dashboard context on-demand when checkbox is checked
   */
  const extractDashboardContext = async () => {
    if (!includeContext) {
      console.log('❌ Checkbox not checked - skipping context extraction');
      return undefined;
    }

    setIsExtractingContext(true);
    console.log('🔍 Extracting dashboard context on-demand...');
    console.log('📍 Current page:', {
      url: window.location.href,
      pathname: window.location.pathname,
      title: document.title
    });

    try {
      // Use Puppeteer-style context extraction
      const context = await extractPuppeteerStyleContext();

      console.log('✅ Dashboard context extracted successfully:', {
        hasPage: !!context.page,
        hasContent: !!context.content,
        contentCount: context.content?.length || 0,
        // hasTimeRange removed - no longer used
        hasFilters: !!context.filters?.length,
        pageApp: context.page?.app,
        extractedAt: context.extractedAt
      });

      // Log first few content elements for debugging
      if (context.content && context.content.length > 0) {
        console.log('📊 Sample content elements:');
        context.content.slice(0, 3).forEach((element, index) => {
          console.log(`  ${index + 1}. ${element.title} (${element.type})`);
          console.log(`      Summary: ${element.data.summary}`);
        });
      } else {
        console.log('⚠️ No content elements found in context');
      }

      return context;
    } catch (error) {
      console.error('❌ Failed to extract dashboard context:', error);
      console.log('🔄 Creating minimal fallback context...');

      // Create minimal fallback context with all required fields
      const fallbackContext = {
        page: {
          url: window.location.href,
          title: document.title,
          app: chatContext.appId || 'unknown',
          route: window.location.pathname,
          breadcrumbs: [], // Required array
          metadata: {
            dashboardId: extractDashboardId(),
            savedObjectType: extractSavedObjectType(),
            lastModified: new Date().toISOString(),
            permissions: ['read', 'view']
          }
        },
        content: [],
        navigation: {
          currentApp: chatContext.appId || 'unknown',
          currentRoute: window.location.pathname,
          breadcrumbs: [], // Required array
          availableApps: [] // Required array
        },
        filters: [], // Required array
        userActions: [], // Required array
        permissions: {
          canViewData: true,
          canModifyDashboard: false,
          canAccessApp: true,
          restrictedFields: [],
          dataSourcePermissions: {}
        },
        extractedAt: new Date().toISOString()
      };

      console.log('✅ Minimal fallback context created');
      return fallbackContext;
    } finally {
      setIsExtractingContext(false);
    }
  };

  useEffectOnce(() => {
    if (inputRef.current) {
      autosize(inputRef.current);
    }
  });

  const onSubmit = async () => {
    console.log('🚀 ONSUBMIT CALLED');
    console.log('🔍 SUBMIT CONDITIONS:', {
      disabled: props.disabled,
      hasInputRef: !!inputRef.current,
      inputValue: inputRef.current?.value,
      timestamp: new Date().toISOString()
    });

    if (props.disabled || !inputRef.current) {
      console.log('❌ Submit blocked: disabled or no input ref');
      return;
    }

    const userInput = inputRef.current.value.trim();
    console.log('📝 USER INPUT:', {
      original: inputRef.current.value,
      trimmed: userInput,
      length: userInput.length
    });

    if (!userInput) {
      console.log('❌ Submit blocked: empty user input');
      return;
    }

    // Additional validation
    if (userInput.length === 0) {
      console.error('❌ User input is empty after trim');
      return;
    }

    console.log('🚀 Starting message submission:', {
      userInput: userInput.substring(0, 50) + (userInput.length > 50 ? '...' : ''),
      userInputLength: userInput.length,
      includeScreenshot: includeContext,
      isTakingScreenshot
    });

    // Clear input immediately for better UX
    inputRef.current.value = '';
    inputRef.current.style.height = '40px';

    // Capture screenshot if checkbox is checked
    console.log('📸 About to capture screenshot...');
    const screenshot = await captureScreenshot();

    // Temporarily disable UI context extraction to avoid context window overflow
    console.log('📋 Skipping dashboard context extraction (temporarily disabled to avoid context overflow)');
    const dashboardContext = null; // Disabled for now

    // Check for pending visualization data from "Ask AI" button
    const pendingVisualizationData = (window as any).__pendingVisualizationData;
    
    // Create input message with screenshot or visualization data if available
    const inputMessage: IMessage = {
      type: 'input',
      content: userInput,
      contentType: 'text',
      context: {
        appId: chatContext.appId,
        ...(pendingVisualizationData && {
          content: `Visualization: ${pendingVisualizationData.visualizationTitle}`
        })
      },
      ...(screenshot && {
        images: [{
          data: screenshot.data,
          mimeType: screenshot.mimeType,
          filename: screenshot.filename
        }]
      }),
      ...(pendingVisualizationData && !screenshot && {
        images: [{
          data: pendingVisualizationData.imageData,
          mimeType: pendingVisualizationData.mimeType,
          filename: pendingVisualizationData.filename
        }]
      })
    };

    // Clear pending visualization data after using it
    if (pendingVisualizationData) {
      delete (window as any).__pendingVisualizationData;
      
      // Remove the image preview from UI
      const preview = document.querySelector('.visualization-image-preview');
      if (preview) {
        preview.remove();
      }
      
      console.log('📊 Used pending visualization data in message');
    }

    // Validate input message before sending
    if (!inputMessage.content || inputMessage.content.trim() === '') {
      console.error('❌ CRITICAL: Input message content is empty!', {
        originalUserInput: userInput,
        messageContent: inputMessage.content,
        messageContentLength: inputMessage.content?.length || 0
      });
      return;
    }

    console.log('📤 About to send message:', {
      hasInputMessage: !!inputMessage,
      messageContent: inputMessage.content,
      messageContentLength: inputMessage.content?.length || 0,
      messageType: inputMessage.type,
      messageContentType: inputMessage.contentType,
      hasScreenshot: !!screenshot,
      screenshotSize: screenshot ? `${Math.round(screenshot.size / 1024)}KB` : 'none',
      hasImages: !!inputMessage.images?.length,
      imageCount: inputMessage.images?.length || 0,
      contextDisabled: 'UI context extraction temporarily disabled to avoid context overflow',
      useStreaming: useStreaming && !!streamingChat
    });

    // Send message with streaming support if enabled
    if (useStreaming && streamingChat) {

      // Add user's input message to chat state first (frontend maintains conversation history)
      // Create a user message for the chat state with proper structure
      const userMessage = {
        type: 'input' as const,
        contentType: 'text' as const,
        content: userInput,
        timestamp: new Date().toISOString(),
        messageId: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
        context: {
          appId: chatContext.appId,
        },
        ...(inputMessage.images && {
          images: inputMessage.images
        })
      };

      console.log('📨 Dispatching user message to chat state:', {
        messageId: userMessage.messageId,
        content: userMessage.content.substring(0, 50) + '...',
        hasImages: !!userMessage.images?.length
      });

      // Add user message to chat state using the send action
      chatStateDispatch({ type: 'send', payload: userMessage });

      // Clear any previous streaming content
      streamingChat.clearContent();

      try {
        // Send streaming message
        await streamingChat.sendMessage(
          userInput,
          dashboardContext || undefined,
          inputMessage.images
        );
      } catch (error) {
        console.error('Streaming message failed:', error);
      }
    } else {
      // Send message with dashboard context and screenshot (if enabled)
      send(inputMessage, dashboardContext);
    }
  };

  return (
    <>
      {/* Control Checkboxes */}
      <EuiFlexGroup gutterSize="s" alignItems="center" style={{ marginBottom: 8 }}>
        <EuiFlexItem grow={false}>
          <EuiToolTip content="Include a screenshot of the current dashboard for visual analysis">
            <EuiCheckbox
              id="include-dashboard-context"
              label="Include dashboard screenshot"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              disabled={props.disabled}
            />
          </EuiToolTip>
        </EuiFlexItem>

        {props.enableStreaming && streamingChat && (
          <EuiFlexItem grow={false}>
            <EuiToolTip content="Enable real-time streaming responses for faster interaction">
              <EuiCheckbox
                id="enable-streaming"
                label="Enable streaming"
                checked={useStreaming}
                onChange={(e) => setUseStreaming(e.target.checked)}
                disabled={props.disabled || streamingChat.isStreaming}
              />
            </EuiToolTip>
          </EuiFlexItem>
        )}

        {streamingChat?.isStreaming && (
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              size="xs"
              color="danger"
              onClick={() => streamingChat.abortStream()}
              iconType="cross"
            >
              Stop streaming
            </EuiButtonEmpty>
          </EuiFlexItem>
        )}

        {includeContext && (
          <EuiFlexItem grow={false}>
            <span style={{ fontSize: '12px', color: '#69707D' }}>
              {isTakingScreenshot
                ? 'Taking screenshot...'
                : 'Screenshot will be included with your message'
              }
            </span>
          </EuiFlexItem>
        )}

        {useStreaming && streamingChat && (
          <EuiFlexItem grow={false}>
            <span style={{ fontSize: '12px', color: '#0078A0' }}>
              {streamingChat.isStreaming
                ? 'Streaming response...'
                : 'Streaming enabled'
              }
            </span>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      {/* Chat Input */}
      <EuiFlexGroup
        gutterSize="s"
        alignItems="flexEnd"
        justifyContent="spaceEvenly"
        responsive={false}
      >
        <EuiFlexItem grow={false} />
        <EuiFlexItem>
          <EuiTextArea
            fullWidth
            rows={1}
            compressed
            autoFocus
            disabled={props.disabled || isTakingScreenshot}
            placeholder={includeContext ? "Ask about your dashboard screenshot..." : "Ask me anything..."}
            inputRef={inputRef}
            style={{ minHeight: 40, maxHeight: 400 }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            aria-label="send"
            minWidth={70}
            fill
            iconType={props.loading || isTakingScreenshot || (streamingChat?.isStreaming) ? undefined : 'returnKey'}
            iconSide="right"
            size="m"
            onClick={onSubmit}
            isDisabled={props.disabled || isTakingScreenshot || (streamingChat?.isStreaming)}
          >
            {streamingChat?.isStreaming
              ? 'Streaming...'
              : props.loading
                ? 'Generating...'
                : isTakingScreenshot
                  ? 'Capturing...'
                  : 'Go'
            }
          </EuiButton>
        </EuiFlexItem>
        <EuiFlexItem grow={false} />
      </EuiFlexGroup>
    </>
  );
};
