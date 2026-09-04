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

const { DEFAULTS, sanitize } = globalThis.sloppySettings;
let settings = sanitize(DEFAULTS);

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

browser.storage.local.get(DEFAULTS).then(async (stored) => {
  settings = sanitize(stored);
  // 0.4.0 and earlier could store "invert"; write the cleaned-up shape back
  // so the UI pages never see it
  if (JSON.stringify(settings) !== JSON.stringify({ global: stored.global, hosts: stored.hosts })) {
    await browser.storage.local.set(settings);
  }
  syncContentScript();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.global) settings.global = sanitize({ global: changes.global.newValue }).global;
  if (changes.hosts) settings.hosts = sanitize({ hosts: changes.hosts.newValue }).hosts;
  syncContentScript();
});
