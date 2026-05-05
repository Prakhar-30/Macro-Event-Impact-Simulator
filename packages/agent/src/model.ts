// Centralized model + token budget config. Keep all model IDs here
// so swapping is one edit, not a sweep.

export const MODEL = {
  // User has chosen Opus 4.7 as the only model — used for both
  // classification and the main agent loop. Single-model setup
  // for project simplicity; cost tradeoff accepted.
  agent: "claude-opus-4-7" as const,
  classifier: "claude-opus-4-7" as const,
} as const;

export const TOKEN_BUDGET = {
  // Soft targets for one full scenario run. Tracked per-job so we
  // can plot drift over the eval harness.
  inputSoftCap: 20_000,
  outputSoftCap: 2_000,
  maxToolIterations: 12,
} as const;

export type ModelKey = keyof typeof MODEL;
