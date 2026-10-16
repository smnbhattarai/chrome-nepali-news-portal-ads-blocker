import { RULES_UPDATE_INTERVAL_MINUTES } from '../src/config';
import type { Message, UpdateRulesResponse } from '../src/messages';
import { getRulesInfo, updateRules } from '../src/rules/store';

const ALARM = 'rules-update';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void updateRules());
  browser.runtime.onStartup.addListener(() => void updateRules());

  void browser.alarms.get(ALARM).then((alarm) => {
    if (!alarm) {
      void browser.alarms.create(ALARM, { periodInMinutes: RULES_UPDATE_INTERVAL_MINUTES });
    }
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void updateRules();
  });

  void browser.action.setBadgeBackgroundColor({ color: '#c0392b' });

  browser.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
    if (msg.type === 'count' && sender.tab?.id !== undefined) {
      void browser.action.setBadgeText({
        tabId: sender.tab.id,
        text: msg.count > 0 ? String(msg.count) : '',
      });
    } else if (msg.type === 'update-rules') {
      void (async () => {
        const result = await updateRules();
        const response: UpdateRulesResponse = { result, info: await getRulesInfo() };
        sendResponse(response);
      })();
      return true;
    }
  });
});
