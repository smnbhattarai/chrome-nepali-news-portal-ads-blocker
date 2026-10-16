import type { SiteRules } from '../rules/types';

/** Elements hidden by JS rules get this attribute; the injected stylesheet hides them. */
export const HIDDEN_ATTR = 'data-nab-hidden';
export const STYLE_ID = 'nab-style';

/** Only blocks containing media count as ads; empty ad slots are hidden but not counted. */
const MEDIA = 'img, picture, iframe, video, ins, canvas, embed, object';

export interface EngineOptions {
  /** Called whenever the number of hidden ads changes. */
  onCount?: (count: number) => void;
  /** Delay before re-scanning after DOM mutations. */
  throttleMs?: number;
}

/** Drops selectors the browser can't parse, so one bad rule can't break the others. */
export function validSelectors(doc: Document, selectors: string[] = []): string[] {
  return selectors.filter((s) => {
    try {
      doc.createDocumentFragment().querySelector(s);
      return true;
    } catch {
      return false;
    }
  });
}

export function buildHideCss(selectors: string[]): string {
  return [...selectors, `[${HIDDEN_ATTR}]`]
    .map((s) => `${s} { display: none !important; }`)
    .join('\n');
}

export class Engine {
  private readonly hide: string[];
  private readonly hideList: string;
  private readonly remove: string[];
  private readonly popups: { overlay: string; close?: string }[];
  private readonly textMatch: { selector: string; contains: string[] }[];
  private readonly linkMatch: string[];

  private style: HTMLStyleElement | null = null;
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly counted = new WeakSet<Element>();
  private readonly dismissed = new WeakSet<Element>();
  private count = 0;

  constructor(
    private readonly doc: Document,
    private readonly rules: SiteRules,
    private readonly opts: EngineOptions = {},
  ) {
    const valid = (s: string) => validSelectors(doc, [s]).length === 1;
    this.hide = validSelectors(doc, rules.hide);
    this.hideList = this.hide.join(', ');
    this.remove = validSelectors(doc, rules.remove);
    this.popups = (rules.popups ?? []).filter(
      (p) => valid(p.overlay) && (p.close === undefined || valid(p.close)),
    );
    this.textMatch = (rules.textMatch ?? []).filter((t) => valid(t.selector));
    this.linkMatch = rules.linkMatch ?? [];
  }

  start(): void {
    this.injectCss();
    this.run();
    this.observer = new this.doc.defaultView!.MutationObserver(() => this.schedule());
    this.observer.observe(this.doc.documentElement, { childList: true, subtree: true });
    if (this.doc.readyState === 'loading') {
      this.doc.addEventListener('DOMContentLoaded', () => this.run(), { once: true });
    }
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.style?.remove();
    this.style = null;
    this.doc.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) => el.removeAttribute(HIDDEN_ATTR));
  }

  getCount(): number {
    return this.count;
  }

  /** Runs every rule once over the current DOM. */
  run(): void {
    const before = this.count;

    this.countHidden();
    this.removeElements();
    const dismissed = this.dismissPopups();
    if (dismissed && this.rules.unlockScroll) this.unlockScroll();
    this.applyTextMatch();
    this.applyLinkMatch();

    if (this.count !== before) this.opts.onCount?.(this.count);
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run();
    }, this.opts.throttleMs ?? 150);
  }

  private injectCss(): void {
    const style = this.doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildHideCss(this.hide);
    (this.doc.head ?? this.doc.documentElement).appendChild(style);
    this.style = style;
  }

  /** Counts an element unless it or an ancestor was already counted. */
  private tally(el: Element): void {
    for (let e: Element | null = el; e; e = e.parentElement) {
      if (this.counted.has(e)) return;
    }
    this.counted.add(el);
    this.count++;
  }

  private hideElement(el: Element): void {
    el.setAttribute(HIDDEN_ATTR, '');
    this.tally(el);
  }

  /** CSS already hides these; this only counts the outermost ones that hold an ad. */
  private countHidden(): void {
    if (!this.hideList) return;
    for (const el of this.doc.querySelectorAll(this.hideList)) {
      if (el.parentElement?.closest(this.hideList)) continue;
      if (el.querySelector(MEDIA)) this.tally(el);
    }
  }

  private removeElements(): void {
    for (const sel of this.remove) {
      for (const el of this.doc.querySelectorAll(sel)) {
        this.tally(el);
        el.remove();
      }
    }
  }

  private dismissPopups(): boolean {
    let any = false;
    for (const { overlay, close } of this.popups) {
      for (const el of this.doc.querySelectorAll(overlay)) {
        if (this.dismissed.has(el)) continue;
        this.dismissed.add(el);
        any = true;
        if (close) {
          const button = el.querySelector(close) ?? this.doc.querySelector(close);
          if (button instanceof this.doc.defaultView!.HTMLElement) button.click();
        }
        this.hideElement(el);
      }
    }
    return any;
  }

  private unlockScroll(): void {
    const view = this.doc.defaultView!;
    for (const el of [this.doc.documentElement, this.doc.body]) {
      if (!el) continue;
      const { overflow, overflowY } = view.getComputedStyle(el);
      if (overflow === 'hidden' || overflowY === 'hidden') {
        el.style.setProperty('overflow', 'auto', 'important');
      }
    }
  }

  private applyTextMatch(): void {
    for (const { selector, contains } of this.textMatch) {
      for (const el of this.doc.querySelectorAll(selector)) {
        if (el.hasAttribute(HIDDEN_ATTR)) continue;
        const text = el.textContent ?? '';
        if (contains.some((c) => text.includes(c))) this.hideElement(el);
      }
    }
  }

  private applyLinkMatch(): void {
    if (this.linkMatch.length === 0) return;
    for (const a of this.doc.querySelectorAll('a[href]')) {
      if (a.hasAttribute(HIDDEN_ATTR)) continue;
      const href = a.getAttribute('href')!;
      if (this.linkMatch.some((m) => href.includes(m)) && a.querySelector(MEDIA)) {
        this.hideElement(a);
      }
    }
  }
}
