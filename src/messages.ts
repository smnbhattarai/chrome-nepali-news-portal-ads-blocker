import type { RulesInfo, UpdateResult } from './rules/store';

/** Content script → background: number of ads hidden on the page, for the badge. */
export interface CountMessage {
  type: 'count';
  count: number;
}

/** Popup → content script. */
export interface GetStatusMessage {
  type: 'get-status';
}

export interface PageStatus {
  siteId: string | null;
  enabled: boolean;
  count: number;
}

/** Popup → background. */
export interface UpdateRulesMessage {
  type: 'update-rules';
}

export interface UpdateRulesResponse {
  result: UpdateResult;
  info: RulesInfo;
}

export type Message = CountMessage | GetStatusMessage | UpdateRulesMessage;
