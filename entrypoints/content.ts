import { Engine } from '../src/engine/engine';
import type { CountMessage, Message, PageStatus } from '../src/messages';
import { findSite, getActiveRules } from '../src/rules/store';
import { isSiteEnabled } from '../src/settings';
import { MATCH_PATTERNS } from '../src/sites';

export default defineContentScript({
  matches: MATCH_PATTERNS,
  runAt: 'document_start',
  async main(ctx) {
    const site = findSite(await getActiveRules(), location.hostname);
    const enabled = site ? await isSiteEnabled(site.id) : false;

    let engine: Engine | null = null;
    if (site && enabled) {
      let badgeTimer: ReturnType<typeof setTimeout> | undefined;
      engine = new Engine(document, site, {
        onCount: (count) => {
          clearTimeout(badgeTimer);
          badgeTimer = setTimeout(() => {
            const msg: CountMessage = { type: 'count', count };
            browser.runtime.sendMessage(msg).catch(() => {});
          }, 250);
        },
      });
      engine.start();
      ctx.onInvalidated(() => engine?.stop());
    }

    browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
      if (msg.type !== 'get-status') return;
      const status: PageStatus = {
        siteId: site?.id ?? null,
        enabled,
        count: engine?.getCount() ?? 0,
      };
      sendResponse(status);
    });
  },
});
