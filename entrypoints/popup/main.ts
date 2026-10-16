import type { GetStatusMessage, PageStatus, UpdateRulesMessage, UpdateRulesResponse } from '../../src/messages';
import { getRulesInfo, type RulesInfo } from '../../src/rules/store';
import { setSiteEnabled } from '../../src/settings';

type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

const t = (key: MessageKey) => browser.i18n.getMessage(key) || key;
const locale = browser.i18n.getUILanguage();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function localize() {
  document.documentElement.lang = locale;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as MessageKey);
  });
}

function renderRulesInfo(info: RulesInfo) {
  const source = t(info.source === 'remote' ? 'rulesRemote' : 'rulesBundled');
  $('version').textContent = `${info.version.toLocaleString(locale)} (${source})`;
  $('last-check').textContent = info.lastCheck
    ? new Date(info.lastCheck).toLocaleString(locale)
    : t('never');
}

async function initSite() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  let status: PageStatus | undefined;
  if (tab?.id !== undefined) {
    const msg: GetStatusMessage = { type: 'get-status' };
    status = await browser.tabs.sendMessage(tab.id, msg).catch(() => undefined);
  }

  if (!status?.siteId || tab?.id === undefined) {
    $('unsupported').hidden = false;
    return;
  }

  const { siteId } = status;
  const tabId = tab.id;
  $('site').hidden = false;
  $('count').textContent = status.count.toLocaleString(locale);

  const toggle = $<HTMLInputElement>('enabled');
  toggle.checked = status.enabled;
  toggle.addEventListener('change', async () => {
    await setSiteEnabled(siteId, toggle.checked);
    await browser.tabs.reload(tabId);
    window.close();
  });
}

function initUpdateButton() {
  const button = $<HTMLButtonElement>('update');
  const statusEl = $('update-status');
  button.addEventListener('click', async () => {
    button.disabled = true;
    statusEl.textContent = t('updating');
    try {
      const msg: UpdateRulesMessage = { type: 'update-rules' };
      const { result, info } = (await browser.runtime.sendMessage(msg)) as UpdateRulesResponse;
      const key = ({
        updated: 'updateUpdated',
        current: 'updateCurrent',
        skipped: 'updateSkipped',
        error: 'updateError',
      } as const)[result.status];
      statusEl.textContent = t(key);
      renderRulesInfo(info);
    } catch {
      statusEl.textContent = t('updateError');
    } finally {
      button.disabled = false;
    }
  });
}

localize();
initUpdateButton();
void getRulesInfo().then(renderRulesInfo);
void initSite();
