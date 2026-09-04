/* Sloppy Lightswitch — settings model
 *
 * Shared by background, popup, options page and the node tests. Pure
 * functions over the stored shape { global: mode, hosts: { host: mode } }.
 *
 * Modes: "system" (leave the page alone), "light", "dark". A per-host
 * entry wins over the global mode; a host without an entry follows it.
 */

"use strict";

(function (global) {
  const MODES = ["system", "light", "dark"];
  const DEFAULTS = { global: "system", hosts: {} };

  function isMode(value) {
    return MODES.includes(value);
  }

  // Coerce whatever is in storage into a valid settings object. Drops
  // unknown modes (e.g. "invert" from 0.4.0 and earlier) and junk hosts.
  function sanitize(raw) {
    const out = { global: DEFAULTS.global, hosts: {} };
    if (raw && isMode(raw.global)) out.global = raw.global;
    if (raw && raw.hosts && typeof raw.hosts === "object") {
      for (const [host, mode] of Object.entries(raw.hosts)) {
        const h = normalizeHost(host);
        if (h && isMode(mode)) out.hosts[h] = mode;
      }
    }
    return out;
  }

  function normalizeHost(text) {
    let h = String(text || "").trim().toLowerCase();
    if (!h) return "";
    // be forgiving: a pasted URL or a trailing slash still means the host
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(h)) {
      try {
        h = new URL(h).hostname;
      } catch (e) {
        return "";
      }
    }
    h = h.replace(/^\/+|\/.*$/g, "").replace(/\.$/, "");
    if (!/^[a-z0-9.\-_\[\]:%]+$/.test(h)) return "";
    return h;
  }

  function effectiveMode(settings, host) {
    if (host && isMode(settings.hosts[host])) return settings.hosts[host];
    return settings.global;
  }

  /* ---- the hand-written list ----
   *
   *   # comments and blank lines are ignored
   *   blog.example.org dark
   *   example.com: light
   *   docs.example.com = system
   *
   * Returns { hosts, errors: [{ line, text, reason }] }. Later lines win.
   */
  function parseList(text) {
    const hosts = {};
    const errors = [];
    const lines = String(text || "").split(/\r?\n/);
    lines.forEach((raw, index) => {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith("//")) return;
      // "<host><sep><mode>" where sep is whitespace, ":" or "=" (the host
      // itself may contain ":" for a port or a pasted URL)
      const match = line.match(/^(.+?)[\s:=]+([A-Za-z-]+)$/);
      const host = match ? normalizeHost(match[1]) : "";
      const mode = match ? match[2].toLowerCase() : "";
      if (!match || !host) {
        errors.push({ line: index + 1, text: raw, reason: "expected: host mode" });
        return;
      }
      if (!isMode(mode)) {
        errors.push({ line: index + 1, text: raw, reason: `mode must be ${MODES.join(", ")}` });
        return;
      }
      hosts[host] = mode;
    });
    return { hosts, errors };
  }

  function formatList(hosts) {
    return Object.keys(hosts || {})
      .sort()
      .map((host) => `${host} ${hosts[host]}`)
      .join("\n");
  }

  // The extension's own pages follow the global mode too: "light"/"dark" pin
  // the root's color-scheme (and with it every light-dark() token in
  // sloppy.css), "system" lets the OS decide.
  function applyScheme(doc, mode) {
    const root = doc && doc.documentElement;
    if (!root) return;
    if (mode === "light" || mode === "dark") {
      root.dataset.scheme = mode;
    } else {
      delete root.dataset.scheme;
    }
  }

  global.sloppySettings = {
    MODES,
    applyScheme,
    DEFAULTS,
    isMode,
    sanitize,
    normalizeHost,
    effectiveMode,
    parseList,
    formatList,
  };
})(globalThis);
