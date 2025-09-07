/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import html2canvas from 'html2canvas';

export interface ScreenshotOptions {
  quality?: number;
  format?: 'png' | 'jpeg';
  maxWidth?: number;
  maxHeight?: number;
  excludeSelectors?: string[];
}

export interface ScreenshotResult {
  data: string; // base64 encoded image data
  mimeType: string;
  filename: string;
  width: number;
  height: number;
  size: number; // file size in bytes
}

export class ScreenshotService {
  private static readonly DEFAULT_OPTIONS: ScreenshotOptions = {
    quality: 0.8,
    format: 'png',
    maxWidth: 1920,
    maxHeight: 1080,
    excludeSelectors: [
      '.euiOverlayMask', // Modal overlays
      '.euiToast', // Toast notifications
      '.euiPopover', // Popovers
      '.euiContextMenu', // Context menus
      '[data-test-subj="chatFlyout"]', // Chat flyout itself
      '.assistant-chat-container', // Chat container
    ]
  };

  /**
   * Capture a screenshot of the current page
   */
  static async capturePageScreenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log('📸 Starting page screenshot capture...');
    
    try {
      // Find the best element to capture (dashboard content area)
      const targetElement = this.findBestCaptureTarget();
      console.log('📸 Target element for capture:', {
        tagName: targetElement.tagName,
        className: targetElement.className,
        id: targetElement.id,
        dimensions: `${targetElement.offsetWidth}x${targetElement.offsetHeight}`
      });
      
      // Hide elements that shouldn't be in the screenshot
      const hiddenElements = this.hideElements(opts.excludeSelectors || []);
      
      // Wait for content to be ready and animations to settle
      await this.delay(500);
      
      // Configure html2canvas options optimized for OpenSearch Dashboards
      const html2canvasOptions = {
        allowTaint: true,
        useCORS: true,
        scale: 0.8, // Slightly reduce scale for better performance
        width: Math.min(targetElement.offsetWidth || window.innerWidth, opts.maxWidth || 1920),
        height: Math.min(targetElement.offsetHeight || window.innerHeight, opts.maxHeight || 1080),
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
        removeContainer: false, // Keep container for better layout
        logging: true, // Enable logging for debugging
        imageTimeout: 15000, // Increase timeout for complex dashboards
        onclone: (clonedDoc: Document) => {
          // Ensure all styles are properly cloned
          console.log('📸 Cloning document for screenshot');
          const clonedBody = clonedDoc.body;
          if (clonedBody) {
            clonedBody.style.transform = 'none';
            clonedBody.style.zoom = '1';
          }
        },
        ignoreElements: (element: Element) => {
          // More comprehensive element filtering
          const shouldIgnore = element.classList.contains('screenshot-exclude') ||
                 element.getAttribute('data-screenshot-exclude') === 'true' ||
                 element.classList.contains('euiOverlayMask') ||
                 element.classList.contains('euiToast') ||
                 element.classList.contains('euiPopover') ||
                 element.classList.contains('euiContextMenu') ||
                 element.getAttribute('data-test-subj') === 'chatFlyout' ||
                 element.classList.contains('assistant-chat-container');
          
          if (shouldIgnore) {
            console.log('📸 Ignoring element:', element.className || element.tagName);
          }
          return shouldIgnore;
        }
      };
      
      console.log('📸 Capturing canvas with options:', {
        target: targetElement.tagName,
        dimensions: `${html2canvasOptions.width}x${html2canvasOptions.height}`,
        scale: html2canvasOptions.scale
      });
      
      // Capture the screenshot
      const canvas = await html2canvas(targetElement, html2canvasOptions);
      
      // Restore hidden elements
      this.restoreElements(hiddenElements);
      
      // Convert to base64
      const format = opts.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = opts.format === 'jpeg' ? opts.quality : undefined;
      const dataUrl = canvas.toDataURL(format, quality);
      
      // Extract base64 data (remove data:image/png;base64, prefix)
      const base64Data = dataUrl.split(',')[1];
      
      // Calculate approximate file size
      const sizeInBytes = Math.round((base64Data.length * 3) / 4);
      
      const result: ScreenshotResult = {
        data: base64Data,
        mimeType: format,
        filename: `dashboard-screenshot-${Date.now()}.${opts.format === 'jpeg' ? 'jpg' : 'png'}`,
        width: canvas.width,
        height: canvas.height,
        size: sizeInBytes
      };
      
      // Validate the captured screenshot
      if (result.width <= 1 || result.height <= 1) {
        console.error('❌ Captured screenshot is too small:', {
          dimensions: `${result.width}x${result.height}`,
          targetElement: targetElement.tagName,
          targetDimensions: `${targetElement.offsetWidth}x${targetElement.offsetHeight}`,
          windowDimensions: `${window.innerWidth}x${window.innerHeight}`
        });
        throw new Error(`Screenshot capture failed: resulting image is only ${result.width}x${result.height} pixels`);
      }
      
      console.log('✅ Screenshot captured successfully:', {
        filename: result.filename,
        dimensions: `${result.width}x${result.height}`,
        size: `${Math.round(result.size / 1024)}KB`,
        mimeType: result.mimeType,
        targetElement: targetElement.tagName,
        dataPreview: result.data.substring(0, 50) + '...'
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Primary screenshot capture failed:', error);
      
      // Try fallback approach with document.body and different settings
      try {
        console.log('📸 Attempting fallback screenshot capture...');
        
        const fallbackOptions = {
          allowTaint: true,
          useCORS: true,
          scale: 0.5, // Lower scale for fallback
          backgroundColor: '#ffffff',
          logging: true,
          height: Math.min(window.innerHeight, 800),
          width: Math.min(window.innerWidth, 1200)
        };
        
        const fallbackCanvas = await html2canvas(document.body, fallbackOptions);
        
        if (fallbackCanvas.width > 1 && fallbackCanvas.height > 1) {
          const format = opts.format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const dataUrl = fallbackCanvas.toDataURL(format, opts.quality);
          const base64Data = dataUrl.split(',')[1];
          const sizeInBytes = Math.round((base64Data.length * 3) / 4);
          
          const fallbackResult: ScreenshotResult = {
            data: base64Data,
            mimeType: format,
            filename: `dashboard-screenshot-fallback-${Date.now()}.${opts.format === 'jpeg' ? 'jpg' : 'png'}`,
            width: fallbackCanvas.width,
            height: fallbackCanvas.height,
            size: sizeInBytes
          };
          
          console.log('✅ Fallback screenshot captured:', {
            dimensions: `${fallbackResult.width}x${fallbackResult.height}`,
            size: `${Math.round(fallbackResult.size / 1024)}KB`
          });
          
          return fallbackResult;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback screenshot also failed:', fallbackError);
      }
      
      throw new Error(`Failed to capture screenshot: ${error.message}`);
    }
  }

  /**
   * Capture a screenshot of a specific element
   */
  static async captureElementScreenshot(
    element: HTMLElement, 
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log('📸 Starting element screenshot capture...');
    
    try {
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.delay(200);
      
      const html2canvasOptions = {
        allowTaint: true,
        useCORS: true,
        scale: 1,
        backgroundColor: '#ffffff',
        removeContainer: true,
      };
      
      const canvas = await html2canvas(element, html2canvasOptions);
      
      const format = opts.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = opts.format === 'jpeg' ? opts.quality : undefined;
      const dataUrl = canvas.toDataURL(format, quality);
      const base64Data = dataUrl.split(',')[1];
      const sizeInBytes = Math.round((base64Data.length * 3) / 4);
      
      const result: ScreenshotResult = {
        data: base64Data,
        mimeType: format,
        filename: `element-screenshot-${Date.now()}.${opts.format === 'jpeg' ? 'jpg' : 'png'}`,
        width: canvas.width,
        height: canvas.height,
        size: sizeInBytes
      };
      
      console.log('✅ Element screenshot captured successfully:', {
        filename: result.filename,
        dimensions: `${result.width}x${result.height}`,
        size: `${Math.round(result.size / 1024)}KB`
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Element screenshot capture failed:', error);
      throw new Error(`Failed to capture element screenshot: ${error.message}`);
    }
  }

  /**
   * Hide elements that shouldn't appear in screenshots
   */
  private static hideElements(selectors: string[]): Array<{ element: HTMLElement; originalDisplay: string }> {
    const hiddenElements: Array<{ element: HTMLElement; originalDisplay: string }> = [];
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style.display !== 'none') {
            hiddenElements.push({
              element: htmlEl,
              originalDisplay: htmlEl.style.display || ''
            });
            htmlEl.style.display = 'none';
          }
        });
      } catch (error) {
        console.warn(`Failed to hide elements with selector "${selector}":`, error);
      }
    });
    
    return hiddenElements;
  }

  /**
   * Restore previously hidden elements
   */
  private static restoreElements(hiddenElements: Array<{ element: HTMLElement; originalDisplay: string }>) {
    hiddenElements.forEach(({ element, originalDisplay }) => {
      try {
        element.style.display = originalDisplay;
      } catch (error) {
        console.warn('Failed to restore element display:', error);
      }
    });
  }

  /**
   * Find the best element to capture for dashboard screenshots
   */
  private static findBestCaptureTarget(): HTMLElement {
    // Try to find the main dashboard content area in order of preference
    const selectors = [
      '[data-test-subj="dashboardViewport"]', // Main dashboard viewport
      '.dashboard-container', // Dashboard container
      '.react-grid-layout', // Dashboard grid layout
      '[data-test-subj="kibanaChrome"]', // Main Kibana chrome
      '.application', // Application container
      '#kibana-body', // Kibana body
      'main', // Main content area
      '.euiPage__body', // EUI page body
      '.kbnAppWrapper' // Kibana app wrapper
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element && element.offsetWidth > 100 && element.offsetHeight > 100) {
        console.log(`📸 Found capture target: ${selector}`);
        return element;
      }
    }
    
    // Fallback to document.body but log a warning
    console.warn('📸 No specific dashboard container found, using document.body');
    return document.body;
  }

  /**
   * Simple delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate screenshot size and format
   */
  static validateScreenshot(screenshot: ScreenshotResult): { valid: boolean; error?: string } {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB as per API docs
    
    if (screenshot.size > MAX_SIZE) {
      return {
        valid: false,
        error: `Screenshot size (${Math.round(screenshot.size / 1024 / 1024)}MB) exceeds maximum allowed size (10MB)`
      };
    }
    
    const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(screenshot.mimeType)) {
      return {
        valid: false,
        error: `Unsupported image format: ${screenshot.mimeType}`
      };
    }
    
    return { valid: true };
  }
}