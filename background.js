/* Sloppy Lightswitch — background
 *
 * Rewrites the Sec-CH-Prefers-Color-Scheme request header per host or
 * globally. Modes: "system" (leave the request untouched), "light",
 * "dark", "invert" (opposite of whatever would have been sent — the
 * existing header if present, the OS setting otherwise).
 *
 * Also (re)registers the content script that spoofs the scheme inside
 * pages (matchMedia, CSS media conditions, UA color-scheme).
 */

"use strict";

const HEADER = "Sec-CH-Prefers-Color-Scheme";
const MODES = ["system", "light", "dark", "invert"];

const DEFAULTS = { global: "system", hosts: {} };
let settings = { ...DEFAULTS };

// prefers-color-scheme in the background page tracks the OS/browser theme.
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function systemScheme() {
  return darkQuery.matches ? "dark" : "light";
}

function modeForHost(host) {
  const mode = settings.hosts[host];
  return MODES.includes(mode) ? mode : settings.global;
}

// Client hint values are structured-field strings, i.e. sent quoted: "dark"
function quote(value) {
  return `"${value}"`;
}

function unquote(value) {
  return value.replace(/^"|"$/g, "").trim().toLowerCase();
}

function rewriteHeaders(details) {
  let host;
  try {
    host = new URL(details.url).hostname;
  } catch (e) {
    return {};
  }

  const mode = modeForHost(host);
  if (mode === "system") return {};

  const headers = details.requestHeaders;
  const existing = headers.find((h) => h.name.toLowerCase() === HEADER.toLowerCase());

  let scheme;
  if (mode === "invert") {
    const base = existing ? unquote(existing.value) : systemScheme();
    scheme = base === "dark" ? "light" : "dark";
  } else {
    scheme = mode;
  }

  if (existing) {
    existing.value = quote(scheme);
  } else {
    headers.push({ name: HEADER, value: quote(scheme) });
  }
  return { requestHeaders: headers };
}

browser.webRequest.onBeforeSendHeaders.addListener(
  rewriteHeaders,
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

/* Client-side spoofing: register the content script dynamically with the
 * current settings embedded as a code block, so it runs synchronously at
 * document_start — before any page script — with no async storage race.
 * Re-registered on every settings change (already-open pages keep the old
 * mode until reload). */

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
