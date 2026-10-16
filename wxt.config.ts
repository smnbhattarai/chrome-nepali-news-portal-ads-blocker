import { defineConfig } from 'wxt';

export default defineConfig({
  // WXT defaults Firefox to MV2; use MV3 everywhere.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // No host permissions: content scripts are limited to the listed sites via
    // their `matches`, and the remote rules host (raw.githubusercontent.com)
    // allows cross-origin fetches.
    permissions: ['storage', 'alarms'],
    action: { default_title: '__MSG_extName__' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'nepali-adblocker@example.com',
          strict_min_version: '128.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
