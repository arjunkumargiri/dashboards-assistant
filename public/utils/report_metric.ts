/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as uuid from 'uuid';
import { METRIC_TYPE, UiStatsMetricType } from '@osd/analytics';
import { UsageCollectionSetup } from '../../../../src/plugins/usage_collection/public';

export const reportMetric = (
  usageCollection?: UsageCollectionSetup,
  metricAppName: string = 'app',
  metric: string = 'click',
  metricType: UiStatsMetricType = METRIC_TYPE.CLICK
) => {
  if (usageCollection) {
    usageCollection.reportUiStats(metricAppName, metricType, metric + '-' + uuid.v4());
  }
};
