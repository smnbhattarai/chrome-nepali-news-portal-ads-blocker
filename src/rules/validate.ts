import type { PopupRule, RuleSet, SiteRules, TextMatchRule } from './types';

const MAX_SITES = 500;
const MAX_ITEMS = 500;
const MAX_STRING = 500;

export class RulesError extends Error {}

function fail(path: string, msg: string): never {
  throw new RulesError(`${path}: ${msg}`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_STRING) {
    fail(path, 'expected a non-empty string');
  }
  return v;
}

/**
 * Selectors end up inside an injected stylesheet, so reject anything that
 * could close the rule or start a comment/at-rule.
 */
function selector(v: unknown, path: string): string {
  const s = str(v, path);
  if (/[{};@<]|\/\*/.test(s)) fail(path, `unsafe selector "${s}"`);
  return s;
}

function list<T>(v: unknown, path: string, item: (v: unknown, path: string) => T): T[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > MAX_ITEMS) fail(path, 'expected an array');
  return v.map((x, i) => item(x, `${path}[${i}]`));
}

function popup(v: unknown, path: string): PopupRule {
  if (!isObject(v)) fail(path, 'expected an object');
  return {
    overlay: selector(v.overlay, `${path}.overlay`),
    ...(v.close !== undefined && { close: selector(v.close, `${path}.close`) }),
  };
}

function textMatch(v: unknown, path: string): TextMatchRule {
  if (!isObject(v)) fail(path, 'expected an object');
  return {
    selector: selector(v.selector, `${path}.selector`),
    contains: list(v.contains, `${path}.contains`, str),
  };
}

function site(v: unknown, path: string): SiteRules {
  if (!isObject(v)) fail(path, 'expected an object');
  const domains = list(v.domains, `${path}.domains`, str);
  if (domains.length === 0) fail(`${path}.domains`, 'expected at least one domain');
  if (v.unlockScroll !== undefined && typeof v.unlockScroll !== 'boolean') {
    fail(`${path}.unlockScroll`, 'expected a boolean');
  }
  return {
    id: str(v.id, `${path}.id`),
    domains,
    hide: list(v.hide, `${path}.hide`, selector),
    remove: list(v.remove, `${path}.remove`, selector),
    popups: list(v.popups, `${path}.popups`, popup),
    unlockScroll: v.unlockScroll === true,
    textMatch: list(v.textMatch, `${path}.textMatch`, textMatch),
    linkMatch: list(v.linkMatch, `${path}.linkMatch`, str),
  };
}

/** Parses untrusted JSON into a RuleSet, throwing RulesError if it is malformed. */
export function validateRuleSet(v: unknown): RuleSet {
  if (!isObject(v)) fail('rules', 'expected an object');
  if (typeof v.version !== 'number' || !Number.isInteger(v.version) || v.version < 1) {
    fail('version', 'expected a positive integer');
  }
  const sites = list(v.sites, 'sites', site);
  if (sites.length > MAX_SITES) fail('sites', 'too many sites');
  return { version: v.version, updated: str(v.updated, 'updated'), sites };
}
