# Nepali Ad Blocker — Plan

A Chrome + Firefox extension that removes ads from **Nepali websites** by hiding
elements, dismissing popups/interstitials, and similar CSS/JS tricks.
It does **not** block network requests.

## Decisions

| Topic | Decision |
|---|---|
| Browsers | Chrome + Firefox, single codebase, Manifest V3 |
| Framework | [WXT](https://wxt.dev) + TypeScript |
| Blocking method | Cosmetic only: CSS hiding, DOM removal, popup dismissal, main-world JS guards. No `declarativeNetRequest` / `webRequest` |
| Site scope | **Only listed sites.** No generic `*.np` matching |
| Phase 1 sites | **onlinekhabar.com** only |
| Rule updates | **Remote updates from day one**: bundled rules + periodic fetch of a JSON rules file |
| Rules host | Raw GitHub URL of this repo's `rules/rules.json` (placeholder until pushed; see `src/config.ts`) |
| UI language | **English and Nepali** (`_locales/en`, `_locales/ne`) |
| Permissions | `storage`, `alarms` only. Content-script `matches` limit it to listed sites; the rules host allows CORS, so no host permissions |

## Why cosmetic-only fits Nepali sites

Many Nepali sites serve ads first-party (e.g. banner images under `/wp-content/uploads/`
linking to sponsors). Network filters can't distinguish these from content; DOM/CSS
rules can. It also keeps permissions minimal and store review simple.

The main ongoing cost is **selector maintenance** when sites redesign — hence remote rule updates.

## Architecture

```
entrypoints/
  background.ts          # settings, rule updates (alarms), badge count, messaging
  content.ts             # cosmetic engine on listed sites (isolated world, document_start)
  popup/                 # toolbar UI (EN/NE)
src/
  config.ts              # remote rules URL, update interval
  sites.ts               # listed domains → content-script match patterns
  rules/types.ts         # rule schema
  rules/validate.ts      # schema validation for remote rules
  rules/store.ts         # bundled + cached rules, update logic
  engine/engine.ts       # css injection, removal, popups, text/link matching, observer
  settings.ts            # per-site enable/disable
  messages.ts            # message types between popup, content and background
rules/
  rules.json             # bundled rules (also the file served for remote updates)
public/
  _locales/en, _locales/ne
tests/                   # Vitest + jsdom fixture tests
```

## Rule format

One rules file with per-site entries. The engine is generic; sites are pure data.

```json
{
  "version": 1,
  "updated": "2026-10-16",
  "sites": [
    {
      "id": "onlinekhabar",
      "domains": ["onlinekhabar.com"],
      "hide":   [".ok-ads-wrap"],
      "remove": [".interstitial"],
      "popups": [{ "overlay": ".popup", "close": ".popup-close" }],
      "unlockScroll": true,
      "textMatch": [{ "selector": ".widget", "contains": ["विज्ञापन", "Advertisement"] }],
      "linkMatch": ["sponsor.example"]
    }
  ]
}
```

| Rule | Technique | Timing |
|---|---|---|
| `hide` | Injected `<style>` → `display:none !important` | `document_start` (no flash) |
| `remove` | `el.remove()` | DOM ready + mutations |
| `popups` | Click close / remove overlay | DOM ready + mutations |
| `unlockScroll` | Reset `overflow` on `html`/`body` | after popup handling |
| `textMatch` | Hide blocks labelled "विज्ञापन"/"Advertisement" | mutations (throttled) |
| `linkMatch` | Hide links whose `href` contains a string and that wrap media | mutations |
| `mainWorld` (phase 2) | Fixed, bundled JS guards toggled by flags | `document_start`, MAIN world |

**Hide over remove** by default — cheaper, pre-paint, less likely to trip anti-adblock
or break layout scripts. `remove` only for overlays that block interaction.

### Remote updates (MV3-compliant)

- Rules are **data only** (selectors + flags). No remote code is ever executed;
  main-world behaviours are bundled functions switched on/off by flags.
- Selectors containing `{`, `}`, `;`, `@`, `<` or `/*` are rejected, since they are
  injected into a stylesheet. Unparseable selectors are dropped individually.
- Bundled `rules.json` works offline and on first install.
- Background fetches the remote `rules.json` on install/startup and every 12h (`alarms`),
  validates it, and caches it in `storage.local` if its `version` is newer.
- Content scripts read cached rules from storage, falling back to bundled.
- New sites still need a release, because host permissions/content-script matches are
  fixed in the manifest. Remote updates cover selector changes on existing sites.

## Common ad patterns to handle

1. Full-screen interstitials on load ("skip in 5s" / close button)
2. Sticky bottom/side banners
3. In-article banners between paragraphs
4. Header/leaderboard banners
5. Popunders / new tabs on first click
6. Leftover scroll-lock after overlay removal
7. Blank gaps — hide wrapper or collapse fixed `min-height` containers

## Popup UI (EN/NE)

- On/off toggle for the current site
- Count of hidden ads on this page (+ badge). Only the outermost hidden block that
  contains media (img/iframe/video/…) counts, so empty ad slots and nested wrappers don't inflate it
- Rules version / last updated, "Update rules now"
- Language follows browser locale (`browser.i18n`)

## Testing

- **Fixture tests**: HTML snapshots → run engine in Vitest/jsdom → assert ads hidden, article visible
- **Live smoke**: Playwright with the extension loaded against site home + one article (later, CI weekly)
- **Manual**: `npm run dev` / `npm run dev:firefox`

## Phases

| Phase | Scope |
|---|---|
| **1. MVP** | WXT scaffold, rule engine (`hide`, `remove`, `popups`, `unlockScroll`, `textMatch`, `linkMatch`), remote rule updates, popup toggle + counter (EN/NE), onlinekhabar.com rules, fixture tests |
| **2. Coverage** | Main-world guards, 10–20 sites (Ekantipur, Setopati, Ratopati, Nagarik, Hamro Patro, Kathmandu Post, Ujyaalo, Himalkhabar…), more fixtures |
| **3. Community** | Report-missed-ad button, element picker for personal rules, Playwright CI |
| **4. Publish** | Chrome Web Store + Firefox Add-ons, privacy policy (no data collected), EN/NE listings |

## Phase 1 status

Done: WXT scaffold (Chrome + Firefox MV3), rule engine, remote updates (12h alarm +
"Update now"), popup with toggle/counter/rules info in EN/NE, onlinekhabar.com rules,
Vitest fixture tests.

Known gaps for onlinekhabar.com:
- The site adds `*-body-enabled` classes to `<body>` when sticky header/footer ads
  exist, which may leave padding behind. Needs a style-override rule type (phase 2).
- Selectors were derived from the static HTML; ads injected by third-party scripts
  (`.ok18-third-party-ad`) should be verified in a real browser.
