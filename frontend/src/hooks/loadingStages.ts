/**
 * Loading messages that mirror the real phases of each backend request. The
 * ticker advances through them while the request is in flight, so the user sees
 * what is actually being computed rather than an invented progress bar.
 */
export const UPLOAD_STAGES = ['Uploading file…', 'Reading and parsing the CSV…', 'Cleaning and validating rows…'];

export const ANALYSIS_STAGES = [
  'Processing transactions…',
  'Building spending features…',
  'Running K-Means…',
  'Scoring cluster quality…',
  'Generating insights…',
];

export const CLUSTER_STAGES = ['Building spending features…', 'Running K-Means…', 'Scoring cluster quality…'];

/** Shown when a reload picks the previous dataset back up from the backend. */
export const RESTORE_STAGES = ['Reconnecting to your last dataset…', 'Rebuilding the analysis pipeline…'];

export const loadingStages = {
  upload: UPLOAD_STAGES,
  analysis: ANALYSIS_STAGES,
  clusters: CLUSTER_STAGES,
  restore: RESTORE_STAGES,
};
