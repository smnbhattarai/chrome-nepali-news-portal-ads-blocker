/**
 * Where updated rules are fetched from. Replace the placeholder once the repo
 * is pushed to GitHub; until then remote updates are skipped and the bundled
 * rules are used.
 */
export const REMOTE_RULES_URL =
  'https://raw.githubusercontent.com/<your-github-user>/<repo>/main/rules/rules.json';

export const RULES_UPDATE_INTERVAL_MINUTES = 12 * 60;

export function isRemoteConfigured(url: string): boolean {
  return !url.includes('<');
}
