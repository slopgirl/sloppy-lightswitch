"use strict";

require("../shared/rewrite.js");
const assert = require("node:assert");

const { rewriteCondition, needsRewrite, TRUE_COND, FALSE_COND } = globalThis.sloppyRewrite;

// pinned dark
assert.equal(rewriteCondition("(prefers-color-scheme: dark)", "dark"), TRUE_COND);
assert.equal(rewriteCondition("(prefers-color-scheme: light)", "dark"), FALSE_COND);
assert.equal(rewriteCondition("(prefers-color-scheme: no-preference)", "dark"), FALSE_COND);

// pinned light
assert.equal(rewriteCondition("(prefers-color-scheme: light)", "light"), TRUE_COND);
assert.equal(rewriteCondition("(prefers-color-scheme: dark)", "light"), FALSE_COND);

// bare boolean form: a pinned mode is a preference
assert.equal(rewriteCondition("(prefers-color-scheme)", "light"), TRUE_COND);

// structure of complex queries survives
assert.equal(
  rewriteCondition("screen and (prefers-color-scheme: light) and (max-width: 600px)", "light"),
  `screen and ${TRUE_COND} and (max-width: 600px)`
);

// whitespace and case don't matter
assert.equal(rewriteCondition("( PREFERS-COLOR-SCHEME : DARK )", "light"), FALSE_COND);

// untouched things stay untouched
assert.equal(rewriteCondition("print", "dark"), "print");
assert.equal(rewriteCondition("(min-width: 600px)", "light"), "(min-width: 600px)");

// multiple occurrences in one text (the CSS-file case)
assert.equal(
  rewriteCondition(
    "@media (prefers-color-scheme: dark) { a {} } @media (prefers-color-scheme: light) { b {} }",
    "dark"
  ),
  `@media ${TRUE_COND} { a {} } @media ${FALSE_COND} { b {} }`
);

assert.ok(needsRewrite("@media (prefers-color-scheme: dark) {}"));
assert.ok(!needsRewrite("body { color: red }"));

console.log("rewrite tests passed");
