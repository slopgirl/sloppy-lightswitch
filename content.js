/* Sloppy Lightswitch — content script
 *
 * Registered dynamically by background.js (browser.contentScripts.register)
 * with the current settings embedded as a code block, at document_start,
 * so everything here runs synchronously before any page script — including
 * the classic anti-FOUC theme sniffers in <head>.
 *
 * Makes the page believe the chosen color scheme:
 *   1. window.matchMedia — prefers-color-scheme queries are rewritten
 *      before the page's real matchMedia sees them.
 *   2. CSSOM — @media/@import conditions in every reachable stylesheet are
 *      rewritten in place; cross-origin sheets are refetched, fixed up and
 *      swapped in.
 *   3. media="" attributes on <source>, <link> and <style>.
 *   4. the UA's own color-scheme pick (form controls, scrollbars,
 *      light-dark()), when the page declares support for both schemes.
 *
 * Known gaps are listed in NOTES.md.
 */

"use strict";

(function () {
  if (window.__sloppyLightswitchApplied) return;
  window.__sloppyLightswitchApplied = true;

  const MODES = ["system", "light", "dark", "invert"];
  const settings = window.__SLOPPY_SETTINGS || { global: "system", hosts: {} };
  delete window.__SLOPPY_SETTINGS;

  const hostMode = settings.hosts ? settings.hosts[location.hostname] : undefined;
  const mode = MODES.includes(hostMode)
    ? hostMode
    : MODES.includes(settings.global)
      ? settings.global
      : "system";
  if (mode === "system") return;

  const { rewriteCondition, needsRewrite } = globalThis.sloppyRewrite;
  const rewrite = (text) => rewriteCondition(text, mode);

  /* ---- 1. matchMedia, patched into the page's world ---- */

  try {
    const pageWin = window.wrappedJSObject;
    const realMatchMedia = pageWin.matchMedia;
    exportFunction(
      function (query) {
        let q = String(query);
        try {
          if (needsRewrite(q)) q = rewrite(q);
        } catch (e) {
          /* hand the original to the real one */
        }
        return realMatchMedia.call(pageWin, q);
      },
      window,
      { defineAs: "matchMedia" }
    );
  } catch (e) {
    console.warn("sloppy lightswitch: matchMedia patch failed", e);
  }

  /* ---- 2. stylesheets ---- */

  const doneRules = new WeakSet(); // invert must not flip a rule twice
  const refetchedSheets = new WeakSet();

  function walkRules(rules) {
    for (const rule of rules) {
      if (rule.media && !doneRules.has(rule) && needsRewrite(rule.media.mediaText)) {
        doneRules.add(rule);
        try {
          rule.media.mediaText = rewrite(rule.media.mediaText);
        } catch (e) {
          /* leave the rule be */
        }
      }
      if (rule.styleSheet) processSheet(rule.styleSheet); // @import
      let children = null;
      try {
        children = rule.cssRules;
      } catch (e) {
        /* not readable */
      }
      if (children) walkRules(children);
    }
  }

  function processSheet(sheet) {
    if (!sheet) return;
    let rules = null;
    try {
      rules = sheet.cssRules; // throws for cross-origin sheets
    } catch (e) {
      refetchSheet(sheet);
      return;
    }
    if (rules) walkRules(rules);
  }

  // Cross-origin sheet: fetch it ourselves (host permissions beat CORS),
  // rewrite the conditions, absolutify relative references, swap it in.
  async function refetchSheet(sheet) {
    const link = sheet.ownerNode;
    if (!sheet.href || refetchedSheets.has(sheet)) return;
    refetchedSheets.add(sheet);
    if (!link || link.nodeType !== 1 || link.dataset.sloppyReplaced) return;
    try {
      const response = await fetch(sheet.href);
      let text = await response.text();
      if (!needsRewrite(text)) return;
      text = absolutifyUrls(rewrite(text), sheet.href);
      const style = document.createElement("style");
      style.dataset.sloppyLightswitch = "true";
      if (link.media) {
        style.media = needsRewrite(link.media) ? rewrite(link.media) : link.media;
      }
      style.textContent = text;
      link.dataset.sloppyReplaced = "true";
      link.after(style);
      link.disabled = true;
    } catch (e) {
      console.warn("sloppy lightswitch: could not refetch", sheet.href, e);
    }
  }

  function absolutifyUrls(text, base) {
    text = text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, ref) => {
      ref = ref.trim();
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return match;
      try {
        return `url(${quote}${new URL(ref, base).href}${quote})`;
      } catch (e) {
        return match;
      }
    });
    text = text.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, ref) => {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) return match;
      try {
        return `@import ${quote}${new URL(ref, base).href}${quote}`;
      } catch (e) {
        return match;
      }
    });
    return text;
  }

  function sweepSheets() {
    for (const sheet of document.styleSheets) {
      const node = sheet.ownerNode;
      if (node && node.nodeType === 1 && node.dataset.sloppyLightswitch) continue;
      processSheet(sheet);
    }
  }

  /* ---- 3. media="" attributes ---- */

  const attrDone = new WeakMap(); // element → value we set (invert loop guard)

  function fixMediaAttr(el) {
    if (el.nodeType !== 1 || typeof el.getAttribute !== "function") return;
    const value = el.getAttribute("media");
    if (!value || !needsRewrite(value)) return;
    if (attrDone.get(el) === value) return;
    const next = rewrite(value);
    attrDone.set(el, next);
    el.setAttribute("media", next);
  }

  const MEDIA_SELECTOR = "source[media], link[media], style[media]";

  function sweepAttrs(root) {
    if (root.matches && root.matches(MEDIA_SELECTOR)) fixMediaAttr(root);
    if (root.querySelectorAll) {
      for (const el of root.querySelectorAll(MEDIA_SELECTOR)) fixMediaAttr(el);
    }
  }

  /* ---- 4. UA color-scheme pin ---- */

  // Content-script matchMedia is the unpatched one: real OS answer.
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function desiredScheme() {
    if (mode === "invert") return systemDark.matches ? "light" : "dark";
    return mode;
  }

  let pinned = false;

  function pinColorScheme() {
    try {
      const meta = document.querySelector('meta[name="color-scheme" i]');
      const declared =
        ((meta && meta.content) || "") +
        " " +
        (getComputedStyle(document.documentElement).colorScheme || "");
      if (pinned || (/light/i.test(declared) && /dark/i.test(declared))) {
        document.documentElement.style.setProperty("color-scheme", desiredScheme(), "important");
        pinned = true;
      }
    } catch (e) {
      /* no documentElement yet, or a very weird page */
    }
  }

  if (mode === "invert") {
    systemDark.addEventListener("change", () => {
      if (pinned) pinColorScheme();
    });
  }

  /* ---- wiring ---- */

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        fixMediaAttr(mutation.target);
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        sweepAttrs(node);
        if (node.localName === "style" && node.sheet) processSheet(node.sheet);
        if (node.localName === "link" && node.relList && node.relList.contains("stylesheet")) {
          node.addEventListener("load", sweepSheets, { once: true });
        }
      }
    }
  });
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["media"],
  });

  function fullSweep() {
    sweepAttrs(document.documentElement || document);
    sweepSheets();
    pinColorScheme();
  }

  document.addEventListener("DOMContentLoaded", fullSweep);
  window.addEventListener("load", fullSweep);
})();
