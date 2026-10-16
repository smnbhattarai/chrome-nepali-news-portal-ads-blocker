import { browser } from 'wxt/browser';

const DISABLED_SITES_KEY = 'settings.disabledSites';

async function getDisabledSites(): Promise<string[]> {
  const data = await browser.storage.local.get(DISABLED_SITES_KEY);
  return (data[DISABLED_SITES_KEY] as string[] | undefined) ?? [];
}

export async function isSiteEnabled(siteId: string): Promise<boolean> {
  return !(await getDisabledSites()).includes(siteId);
}

export async function setSiteEnabled(siteId: string, enabled: boolean): Promise<void> {
  const others = (await getDisabledSites()).filter((id) => id !== siteId);
  await browser.storage.local.set({
    [DISABLED_SITES_KEY]: enabled ? others : [...others, siteId],
  });
}
