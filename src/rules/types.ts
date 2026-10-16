export interface PopupRule {
  /** The overlay/interstitial element. It is hidden once found. */
  overlay: string;
  /** Optional close/skip button, clicked so the site restores its own state. */
  close?: string;
}

export interface TextMatchRule {
  /** Candidate blocks to inspect. */
  selector: string;
  /** Hide the block if its text contains any of these strings. */
  contains: string[];
}

export interface SiteRules {
  id: string;
  domains: string[];
  /** Hidden with injected CSS at document_start. */
  hide?: string[];
  /** Removed from the DOM. Use only for elements that block interaction. */
  remove?: string[];
  popups?: PopupRule[];
  /** Reset `overflow: hidden` on html/body after a popup is dismissed. */
  unlockScroll?: boolean;
  textMatch?: TextMatchRule[];
  /** Hide links whose href contains one of these strings and that wrap media. */
  linkMatch?: string[];
}

export interface RuleSet {
  version: number;
  updated: string;
  sites: SiteRules[];
}
