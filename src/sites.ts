/**
 * Domains the extension runs on. Adding a site requires a release because
 * content-script matches are fixed in the manifest; remote rule updates only
 * change selectors for these domains.
 */
export const SUPPORTED_DOMAINS = ['onlinekhabar.com'];

export const MATCH_PATTERNS = SUPPORTED_DOMAINS.flatMap((d) => [
  `*://${d}/*`,
  `*://*.${d}/*`,
]);

export function hostMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}
