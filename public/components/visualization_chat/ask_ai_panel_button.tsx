/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react';
import { EuiButtonIcon, EuiToolTip } from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { IEmbeddable } from '../../../../../src/plugins/embeddable/public';

export interface AskAIPanelButtonProps {
  embeddable: IEmbeddable;
  onAskAI: (embeddable: IEmbeddable) => void;
}

export const AskAIPanelButton: React.FC<AskAIPanelButtonProps> = ({ embeddable, onAskAI }) => {
  const handleClick = useCallback(() => {
    console.log('🎯 Ask AI button clicked, calling onAskAI handler');
    onAskAI(embeddable);
  }, [embeddable, onAskAI]);

  const buttonLabel = i18n.translate('dashboardsAssistant.askAIPanelButton.label', {
    defaultMessage: 'Ask AI about this visualization',
  });

  return (
    <EuiToolTip content={buttonLabel}>
      <EuiButtonIcon
        className="embPanel__askAIButton"
        iconType="chatRight" // AI chat icon - represents AI conversation
        color="primary" // Make it stand out as a primary action
        size="s"
        aria-label={buttonLabel}
        data-test-subj="embeddablePanelAskAIButton"
        onClick={handleClick}
        style={{
          marginRight: '6px', // Small gap before the options menu
          borderRadius: '4px',
          transition: 'all 0.2s ease',
        }}
      />
    </EuiToolTip>
  );
};