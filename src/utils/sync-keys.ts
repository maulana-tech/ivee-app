export const CLOUD_SYNC_KEYS = [
  'ivee-panels',
  'ivee-monitors',
  'ivee-layers',
  'ivee-disabled-feeds',
  'ivee-panel-spans',
  'ivee-panel-col-spans',
  'ivee-panel-order',
  'ivee-theme',
  'ivee-variant',
  'ivee-map-mode',
  'wm-breaking-alerts-v1',
  'wm-market-watchlist-v1',
] as const;

export type CloudSyncKey = (typeof CLOUD_SYNC_KEYS)[number];
