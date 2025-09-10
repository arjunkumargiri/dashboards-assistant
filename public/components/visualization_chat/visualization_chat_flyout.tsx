/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiTitle,
  EuiText,
  EuiImage,
  EuiSpacer,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFieldText,
  EuiFormRow,
  EuiPanel,
  EuiIcon,
  EuiLink,
  EuiCallOut,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import {
  VisualizationChatContext,
  VisualizationChatService,
} from '../../services/visualization_chat_service';
import { CoreStart } from '../../../../../src/core/public';

interface VisualizationChatFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  context: VisualizationChatContext;
  core: CoreStart;
  onStartChat: (message: string, imageData: string) => void;
}

export const VisualizationChatFlyout: React.FC<VisualizationChatFlyoutProps> = ({
  isOpen,
  onClose,
  context,
  core,
  onStartChat,
}) => {
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  const visualizationChatService = new VisualizationChatService(core);

  useEffect(() => {
    if (isOpen && context) {
      const suggestions = visualizationChatService.generateSuggestedQuestions(
        context.visualizationTitle
      );
      setSuggestedQuestions(suggestions);
    }
  }, [isOpen, context, visualizationChatService]);

  const handleStartChat = useCallback(async () => {
    if (!userQuery.trim()) {
      core.notifications.toasts.addWarning({
        title: i18n.translate('dashboardAssistant.visualizationChat.emptyQuery', {
          defaultMessage: 'Please enter a question about the visualization',
        }),
      });
      return;
    }

    setIsLoading(true);
    try {
      // Validate image data
      if (!context.imageData || context.imageData.length === 0) {
        throw new Error('Visualization image data is missing');
      }

      // Show progress notification
      const progressToast = core.notifications.toasts.addInfo({
        title: i18n.translate('dashboardAssistant.visualizationChat.sendingToAI', {
          defaultMessage: 'Sending visualization to AI for analysis...',
        }),
        toastLifeTimeMs: 2000,
      });

      // Start the chat with the user query and image
      await onStartChat(userQuery, context.imageData);

      // Close the flyout after successful submission
      onClose();

      // Show success message
      core.notifications.toasts.addSuccess({
        title: i18n.translate('dashboardAssistant.visualizationChat.chatStarted', {
          defaultMessage: 'Visualization analysis started',
        }),
        text: i18n.translate('dashboardAssistant.visualizationChat.chatStartedText', {
          defaultMessage:
            'AI is analyzing your visualization. Check the chat interface for insights.',
        }),
        toastLifeTimeMs: 4000,
      });
    } catch (error) {
      console.error('Failed to start chat:', error);
      core.notifications.toasts.addError(error as Error, {
        title: i18n.translate('dashboardAssistant.visualizationChat.startChatError', {
          defaultMessage: 'Failed to start chat',
        }),
      });
    } finally {
      setIsLoading(false);
    }
  }, [userQuery, context.imageData, onStartChat, onClose, core.notifications.toasts]);

  const handleSuggestedQuestionClick = useCallback((question: string) => {
    setUserQuery(question);
  }, []);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleStartChat();
      }
    },
    [handleStartChat]
  );

  if (!isOpen) {
    return null;
  }

  const imageUrl = `data:image/png;base64,${context.imageData}`;

  return (
    <EuiFlyout onClose={onClose} size="m" data-test-subj="visualizationChatFlyout">
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="m">
          <h2>
            <EuiIcon type="discuss" size="m" style={{ marginRight: '8px' }} />
            {i18n.translate('dashboardAssistant.visualizationChat.title', {
              defaultMessage: 'Ask AI about visualization',
            })}
          </h2>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiText size="s" color="subdued">
          {context.visualizationTitle}
          {context.dashboardTitle && (
            <>
              {' • '}
              <EuiLink color="subdued">{context.dashboardTitle}</EuiLink>
            </>
          )}
        </EuiText>
      </EuiFlyoutHeader>

      <EuiFlyoutBody>
        <EuiPanel hasShadow={false} hasBorder>
          <EuiImage
            src={imageUrl}
            alt={i18n.translate('dashboardAssistant.visualizationChat.imageAlt', {
              defaultMessage: 'Screenshot of {title}',
              values: { title: context.visualizationTitle },
            })}
            style={{ maxHeight: '300px', width: '100%', objectFit: 'contain' }}
          />
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiFormRow
          label={i18n.translate('dashboardAssistant.visualizationChat.queryLabel', {
            defaultMessage: 'What would you like to know about this visualization?',
          })}
          fullWidth
        >
          <EuiFieldText
            placeholder={i18n.translate('dashboardAssistant.visualizationChat.queryPlaceholder', {
              defaultMessage: 'Ask a question about the data, trends, or insights...',
            })}
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            fullWidth
            data-test-subj="visualizationChatQuery"
          />
        </EuiFormRow>

        <EuiSpacer size="m" />

        {suggestedQuestions.length > 0 && (
          <>
            <EuiText size="s">
              <strong>
                {i18n.translate('dashboardAssistant.visualizationChat.suggestedQuestions', {
                  defaultMessage: 'Suggested questions:',
                })}
              </strong>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiFlexGroup direction="column" gutterSize="s">
              {suggestedQuestions.map((question, index) => (
                <EuiFlexItem key={index}>
                  <EuiLink
                    onClick={() => handleSuggestedQuestionClick(question)}
                    data-test-subj={`suggestedQuestion-${index}`}
                  >
                    <EuiIcon type="arrowRight" size="s" style={{ marginRight: '4px' }} />
                    {question}
                  </EuiLink>
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          </>
        )}

        <EuiSpacer size="l" />

        <EuiCallOut
          title={i18n.translate('dashboardAssistant.visualizationChat.tip', {
            defaultMessage: 'Tip',
          })}
          color="primary"
          iconType="iInCircle"
          size="s"
        >
          <EuiText size="s">
            {i18n.translate('dashboardAssistant.visualizationChat.tipText', {
              defaultMessage:
                "The AI can analyze the visual patterns, trends, and data shown in your visualization. Be specific about what insights you're looking for.",
            })}
          </EuiText>
        </EuiCallOut>
      </EuiFlyoutBody>

      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="spaceBetween">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={onClose} data-test-subj="visualizationChatCancel">
              {i18n.translate('dashboardAssistant.visualizationChat.cancel', {
                defaultMessage: 'Cancel',
              })}
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              onClick={handleStartChat}
              fill
              isLoading={isLoading}
              disabled={!userQuery.trim()}
              data-test-subj="visualizationChatStart"
            >
              {i18n.translate('dashboardAssistant.visualizationChat.startChat', {
                defaultMessage: 'Start chat',
              })}
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};
