import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine, HIDDEN_ATTR, STYLE_ID, buildHideCss, validSelectors } from '../src/engine/engine';
import { BUNDLED_RULES } from '../src/rules/store';
import type { SiteRules } from '../src/rules/types';
import fixture from './fixtures/onlinekhabar-article.html?raw';

const onlinekhabar = BUNDLED_RULES.sites.find((s) => s.id === 'onlinekhabar')!;

function load(html: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.body.setAttribute('style', parsed.body.getAttribute('style') ?? '');
}

function isHidden(el: Element | null): boolean {
  if (!el) throw new Error('element not found');
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (getComputedStyle(e).display === 'none') return true;
  }
  return false;
}

function rules(extra: Partial<SiteRules>): SiteRules {
  return { id: 't', domains: ['t.test'], ...extra };
}

let engine: Engine | undefined;

afterEach(() => {
  engine?.stop();
  engine = undefined;
  vi.useRealTimers();
});

describe('onlinekhabar rules on an article page', () => {
  beforeEach(() => load(fixture));

  it('hides every ad slot', () => {
    engine = new Engine(document, onlinekhabar);
    engine.start();

    const ads = ['.ok-full-widht-adv', '.ok-sidebar-ad', '.ok-details-adv-in-left', '#ok-box-ad-wrap', '.ok_roadblock'];
    for (const sel of ads) expect(isHidden(document.querySelector(sel)), sel).toBe(true);
  });

  it('keeps the article visible', () => {
    engine = new Engine(document, onlinekhabar);
    engine.start();

    const content = ['.site-header', '.post__heading', '#para-1', '#para-2', '#article-photo'];
    for (const sel of content) expect(isHidden(document.querySelector(sel)), sel).toBe(false);
  });

  it('skips the roadblock interstitial and unlocks scrolling', () => {
    const skip = vi.fn();
    document.querySelector('.ok_roadblok_skip')!.addEventListener('click', skip);

    engine = new Engine(document, onlinekhabar);
    engine.start();

    expect(skip).toHaveBeenCalledOnce();
    expect(getComputedStyle(document.body).overflow).toBe('auto');
  });

  it('counts each ad once, ignoring empty slots and nested wrappers', () => {
    const onCount = vi.fn();
    engine = new Engine(document, onlinekhabar, { onCount });
    engine.start();

    // roadblock, top banner, in-between, sidebar, box ad
    expect(engine.getCount()).toBe(5);
    expect(onCount).toHaveBeenLastCalledWith(5);
  });

  it('counts ads inserted after load', async () => {
    vi.useFakeTimers();
    engine = new Engine(document, onlinekhabar, { throttleMs: 10 });
    engine.start();
    const before = engine.getCount();

    document.querySelector('.ok-details-adv-in-left .okam-ad-position-wrap')!.innerHTML =
      '<div class="okam-each-ad"><img src="late.jpg" /></div>';
    await vi.advanceTimersByTimeAsync(20);

    expect(engine.getCount()).toBe(before + 1);
  });

  it('stop() removes the injected styles', () => {
    engine = new Engine(document, onlinekhabar);
    engine.start();
    engine.stop();

    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(document.querySelector(`[${HIDDEN_ATTR}]`)).toBeNull();
    expect(isHidden(document.querySelector('.ok-sidebar-ad'))).toBe(false);
  });
});

describe('generic rule types', () => {
  it('removes elements for `remove` rules', () => {
    load('<body><div class="modal"><img src="x"></div><p>content</p></body>');
    engine = new Engine(document, rules({ remove: ['.modal'] }));
    engine.start();

    expect(document.querySelector('.modal')).toBeNull();
    expect(engine.getCount()).toBe(1);
  });

  it('hides blocks labelled विज्ञापन with `textMatch`', () => {
    load('<body><div class="widget" id="ad">विज्ञापन <img src="x"></div><div class="widget" id="news">समाचार</div></body>');
    engine = new Engine(document, rules({ textMatch: [{ selector: '.widget', contains: ['विज्ञापन', 'Advertisement'] }] }));
    engine.start();

    expect(isHidden(document.getElementById('ad'))).toBe(true);
    expect(isHidden(document.getElementById('news'))).toBe(false);
  });

  it('hides sponsor links that wrap media with `linkMatch`', () => {
    load('<body><a id="ad" href="https://ncell.com.np/offer"><img src="x"></a><a id="text" href="https://ncell.com.np/news">text link</a></body>');
    engine = new Engine(document, rules({ linkMatch: ['ncell.com.np'] }));
    engine.start();

    expect(isHidden(document.getElementById('ad'))).toBe(true);
    expect(isHidden(document.getElementById('text'))).toBe(false);
  });

  it('only unlocks scrolling when a popup was dismissed', () => {
    load('<body style="overflow: hidden"><p>menu open</p></body>');
    engine = new Engine(document, rules({ popups: [{ overlay: '.popup' }], unlockScroll: true }));
    engine.start();

    expect(getComputedStyle(document.body).overflow).toBe('hidden');
  });

  it('ignores invalid selectors without breaking valid ones', () => {
    expect(validSelectors(document, ['.ok', 'div[', '.also-ok'])).toEqual(['.ok', '.also-ok']);
    expect(buildHideCss(['.a'])).toContain('.a { display: none !important; }');
  });
});
