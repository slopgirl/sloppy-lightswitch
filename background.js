/* Sloppy Lightswitch — background
 *
 * (Re)registers the content script that spoofs prefers-color-scheme
 * inside pages (matchMedia, CSS media conditions, media attributes,
 * UA color-scheme).
 *
 * The content script is registered dynamically with the current settings
 * embedded as a code block, so it runs synchronously at document_start —
 * before any page script — with no async storage race. Re-registered on
 * every settings change (already-open pages keep the old mode until
 * reload).
 */

"use strict";

const DEFAULTS = { global: "system", hosts: {} };
let settings = { ...DEFAULTS };

let registeredScript = null;
let syncChain = Promise.resolve();

function syncContentScript() {
  syncChain = syncChain.then(async () => {
    try {
      const next = await browser.contentScripts.register({
        matches: ["<all_urls>"],
        js: [
          { code: `window.__SLOPPY_SETTINGS = ${JSON.stringify(settings)};` },
          { file: "shared/rewrite.js" },
          { file: "content.js" },
        ],
        runAt: "document_start",
        allFrames: true,
        matchAboutBlank: true,
      });
      if (registeredScript) await registeredScript.unregister();
      registeredScript = next;
    } catch (e) {
      console.warn("sloppy lightswitch: content script registration failed", e);
    }
  });
  return syncChain;
}

browser.storage.local.get(DEFAULTS).then((stored) => {
  settings = { ...DEFAULTS, ...stored };
  syncContentScript();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.global) settings.global = changes.global.newValue ?? DEFAULTS.global;
  if (changes.hosts) settings.hosts = changes.hosts.newValue ?? {};
  syncContentScript();
});
