/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { VisualizationChatContext } from '../services/visualization_chat_service';

export interface UseVisualizationChatReturn {
  isOpen: boolean;
  context: VisualizationChatContext | null;
  openChat: (
    imageData: string,
    visualizationTitle: string,
    embeddableId: string,
    dashboardTitle?: string
  ) => void;
  closeChat: () => void;
}

export const useVisualizationChat = (): UseVisualizationChatReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<VisualizationChatContext | null>(null);

  const openChat = useCallback(
    (
      imageData: string,
      visualizationTitle: string,
      embeddableId: string,
      dashboardTitle?: string
    ) => {
      const chatContext: VisualizationChatContext = {
        imageData,
        visualizationTitle,
        embeddableId,
        dashboardTitle,
        timestamp: Date.now(),
      };

      setContext(chatContext);
      setIsOpen(true);
    },
    []
  );

  const closeChat = useCallback(() => {
    setIsOpen(false);
    // Keep context for a moment to allow for smooth closing animation
    setTimeout(() => setContext(null), 300);
  }, []);

  return {
    isOpen,
    context,
    openChat,
    closeChat,
  };
};
