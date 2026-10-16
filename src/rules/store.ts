import { browser } from 'wxt/browser';
import bundledJson from '../../rules/rules.json';
import { isRemoteConfigured, REMOTE_RULES_URL } from '../config';
import { hostMatchesDomain } from '../sites';
import type { RuleSet, SiteRules } from './types';
import { validateRuleSet } from './validate';

export const BUNDLED_RULES: RuleSet = validateRuleSet(bundledJson);

const CACHE_KEY = 'rules.cache';
const LAST_CHECK_KEY = 'rules.lastCheck';

interface CachedRules {
  rules: RuleSet;
  fetchedAt: number;
}

export interface RulesInfo {
  version: number;
  updated: string;
  source: 'bundled' | 'remote';
  lastCheck: number | null;
}

export type UpdateResult =
  | { status: 'updated' | 'current'; version: number }
  | { status: 'skipped'; version: number }
  | { status: 'error'; version: number; error: string };

async function getCached(): Promise<CachedRules | null> {
  const data = await browser.storage.local.get(CACHE_KEY);
  const cached = data[CACHE_KEY] as CachedRules | undefined;
  if (!cached) return null;
  try {
    return { rules: validateRuleSet(cached.rules), fetchedAt: cached.fetchedAt };
  } catch {
    return null;
  }
}

/** The cached remote rules if newer than the bundled ones, otherwise the bundled rules. */
export async function getActiveRules(): Promise<RuleSet> {
  const cached = await getCached();
  return cached && cached.rules.version > BUNDLED_RULES.version ? cached.rules : BUNDLED_RULES;
}

export async function getRulesInfo(): Promise<RulesInfo> {
  const [rules, data] = await Promise.all([
    getActiveRules(),
    browser.storage.local.get(LAST_CHECK_KEY),
  ]);
  return {
    version: rules.version,
    updated: rules.updated,
    source: rules === BUNDLED_RULES ? 'bundled' : 'remote',
    lastCheck: (data[LAST_CHECK_KEY] as number | undefined) ?? null,
  };
}

export function findSite(rules: RuleSet, hostname: string): SiteRules | undefined {
  return rules.sites.find((s) => s.domains.some((d) => hostMatchesDomain(hostname, d)));
}

/** Fetches remote rules and caches them if they are valid and newer than the active rules. */
export async function updateRules(
  url = REMOTE_RULES_URL,
  fetcher: typeof fetch = fetch,
): Promise<UpdateResult> {
  const current = await getActiveRules();
  if (!isRemoteConfigured(url)) return { status: 'skipped', version: current.version };

  try {
    const res = await fetcher(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = validateRuleSet(await res.json());
    await browser.storage.local.set({ [LAST_CHECK_KEY]: Date.now() });
    if (remote.version <= current.version) return { status: 'current', version: current.version };

    const cached: CachedRules = { rules: remote, fetchedAt: Date.now() };
    await browser.storage.local.set({ [CACHE_KEY]: cached });
    return { status: 'updated', version: remote.version };
  } catch (e) {
    return { status: 'error', version: current.version, error: String(e) };
  }
}
