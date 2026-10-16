import { describe, expect, it } from 'vitest';
import bundled from '../rules/rules.json';
import { RulesError, validateRuleSet } from '../src/rules/validate';
import { SUPPORTED_DOMAINS } from '../src/sites';

const minimal = { version: 2, updated: '2026-10-16', sites: [{ id: 's', domains: ['s.test'] }] };
const withSite = (extra: object) => ({ ...minimal, sites: [{ id: 's', domains: ['s.test'], ...extra }] });

describe('validateRuleSet', () => {
  it('accepts the bundled rules', () => {
    expect(() => validateRuleSet(bundled)).not.toThrow();
  });

  it('bundled rules only target domains the manifest lists', () => {
    for (const site of validateRuleSet(bundled).sites) {
      for (const domain of site.domains) expect(SUPPORTED_DOMAINS).toContain(domain);
    }
  });

  it('fills in defaults for optional fields', () => {
    expect(validateRuleSet(minimal).sites[0]).toMatchObject({
      hide: [],
      remove: [],
      popups: [],
      unlockScroll: false,
    });
  });

  it.each([
    ['non-object', 'nope'],
    ['missing version', { ...minimal, version: undefined }],
    ['fractional version', { ...minimal, version: 1.5 }],
    ['site without domains', { ...minimal, sites: [{ id: 's', domains: [] }] }],
    ['selector closing the CSS rule', withSite({ hide: ['a} body{display:none'] })],
    ['selector opening a comment', withSite({ hide: ['a /*'] })],
    ['non-string selector', withSite({ hide: [42] })],
    ['popup without overlay', withSite({ popups: [{ close: '.x' }] })],
  ])('rejects %s', (_name, input) => {
    expect(() => validateRuleSet(input)).toThrow(RulesError);
  });
});
