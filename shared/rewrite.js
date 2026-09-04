/* Sloppy Lightswitch — media condition rewriting
 *
 * Pure text transform shared by the content script (loaded before
 * content.js in the same sandbox) and the node unit tests.
 *
 * Pinned modes ("light"/"dark") replace prefers-color-scheme conditions
 * with constants that are valid anywhere a media feature can appear:
 * (width >= 0px) is always true, (width < 0px) never is.
 */

"use strict";

(function (global) {
  const TRUE_COND = "(width >= 0px)";
  const FALSE_COND = "(width < 0px)";

  const VALUE_RE = /\(\s*prefers-color-scheme\s*:\s*(light|dark|no-preference)\s*\)/gi;
  const BARE_RE = /\(\s*prefers-color-scheme\s*\)/gi;

  function needsRewrite(text) {
    return /prefers-color-scheme/i.test(text);
  }

  function rewriteCondition(text, mode) {
    return text
      .replace(VALUE_RE, (match, value) => {
        const v = value.toLowerCase();
        if (v === "no-preference") return FALSE_COND;
        return v === mode ? TRUE_COND : FALSE_COND;
      })
      // bare boolean form: true whenever a preference exists, and a pinned
      // mode is very much a preference
      .replace(BARE_RE, TRUE_COND);
  }

  global.sloppyRewrite = { rewriteCondition, needsRewrite, TRUE_COND, FALSE_COND };
})(globalThis);
