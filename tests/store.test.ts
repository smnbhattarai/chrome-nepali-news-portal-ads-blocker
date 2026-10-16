import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BUNDLED_RULES, findSite, getActiveRules, getRulesInfo, updateRules } from '../src/rules/store';
import { isSiteEnabled, setSiteEnabled } from '../src/settings';

const RULES_URL = 'https://rules.test/rules.json';
const PLACEHOLDER_URL = 'https://raw.githubusercontent.com/<user>/<repo>/main/rules/rules.json';

function respond(body: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

const newer = { ...BUNDLED_RULES, version: BUNDLED_RULES.version + 1, updated: '2026-12-01' };

beforeEach(() => fakeBrowser.reset());

describe('rule updates', () => {
  it('uses bundled rules by default', async () => {
    expect(await getActiveRules()).toBe(BUNDLED_RULES);
    expect((await getRulesInfo()).source).toBe('bundled');
  });

  it('caches and uses newer remote rules', async () => {
    const result = await updateRules(RULES_URL, respond(newer));
    expect(result).toEqual({ status: 'updated', version: newer.version });
    expect((await getActiveRules()).version).toBe(newer.version);

    const info = await getRulesInfo();
    expect(info.source).toBe('remote');
    expect(info.lastCheck).toBeTypeOf('number');
  });

  it('ignores remote rules that are not newer', async () => {
    expect((await updateRules(RULES_URL, respond(BUNDLED_RULES))).status).toBe('current');
    expect(await getActiveRules()).toBe(BUNDLED_RULES);
  });

  it('rejects invalid remote rules and keeps the current ones', async () => {
    const invalid = { ...newer, sites: [{ id: 'x', domains: ['x'], hide: ['}'] }] };
    expect((await updateRules(RULES_URL, respond(invalid))).status).toBe('error');
    expect(await getActiveRules()).toBe(BUNDLED_RULES);
  });

  it('reports HTTP errors', async () => {
    const result = await updateRules(RULES_URL, respond({}, 404));
    expect(result).toMatchObject({ status: 'error', error: expect.stringContaining('404') });
  });

  it('skips the fetch while the URL is a placeholder', async () => {
    const neverCalled: typeof fetch = () => Promise.reject(new Error('should not fetch'));
    expect((await updateRules(PLACEHOLDER_URL, neverCalled)).status).toBe('skipped');
  });
});

describe('findSite', () => {
  it('matches the domain and its subdomains only', () => {
    expect(findSite(BUNDLED_RULES, 'www.onlinekhabar.com')?.id).toBe('onlinekhabar');
    expect(findSite(BUNDLED_RULES, 'onlinekhabar.com')?.id).toBe('onlinekhabar');
    expect(findSite(BUNDLED_RULES, 'notonlinekhabar.com')).toBeUndefined();
  });
});

describe('settings', () => {
  it('toggles a site', async () => {
    expect(await isSiteEnabled('onlinekhabar')).toBe(true);
    await setSiteEnabled('onlinekhabar', false);
    expect(await isSiteEnabled('onlinekhabar')).toBe(false);
    await setSiteEnabled('onlinekhabar', true);
    expect(await isSiteEnabled('onlinekhabar')).toBe(true);
  });
});
