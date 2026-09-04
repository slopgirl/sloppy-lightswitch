"use strict";

require("../shared/settings.js");
const assert = require("node:assert");

const { sanitize, normalizeHost, effectiveMode, parseList, formatList } = globalThis.sloppySettings;

// sanitize: defaults, unknown modes (invert from <= 0.4.0) fall back, junk dropped
assert.deepEqual(sanitize(undefined), { global: "system", hosts: {} });
assert.deepEqual(sanitize({ global: "invert", hosts: { "a.example": "invert", "b.example": "dark" } }), {
  global: "system",
  hosts: { "b.example": "dark" },
});
assert.deepEqual(sanitize({ global: "dark", hosts: "nope" }), { global: "dark", hosts: {} });
assert.deepEqual(sanitize({ hosts: { "  Blog.Example.ORG ": "light" } }), {
  global: "system",
  hosts: { "blog.example.org": "light" },
});

// hosts: forgiving about URLs, case, slashes; strict about garbage
assert.equal(normalizeHost("Example.com"), "example.com");
assert.equal(normalizeHost("https://blog.example.org/some/path?x=1"), "blog.example.org");
assert.equal(normalizeHost("example.com/"), "example.com");
assert.equal(normalizeHost("localhost:8080"), "localhost:8080");
assert.equal(normalizeHost("not a host"), "");
assert.equal(normalizeHost(""), "");

// effective mode: per-host wins, otherwise global
const s = { global: "dark", hosts: { "a.example": "light", "c.example": "system" } };
assert.equal(effectiveMode(s, "a.example"), "light");
assert.equal(effectiveMode(s, "b.example"), "dark");
assert.equal(effectiveMode(s, "c.example"), "system");
assert.equal(effectiveMode(s, null), "dark");

// the sloppy list: separators, comments, blank lines, errors with line numbers
const parsed = parseList(`
# a comment
blog.example.org dark
docs.example.com: light
old.example.net = system
https://weird.example/path   DARK

// also a comment
`);
assert.deepEqual(parsed.errors, []);
assert.deepEqual(parsed.hosts, {
  "blog.example.org": "dark",
  "docs.example.com": "light",
  "old.example.net": "system",
  "weird.example": "dark",
});

const bad = parseList("good.example dark\nnope.example invert\njust-a-host\na.example dark extra");
assert.deepEqual(bad.hosts, { "good.example": "dark" });
assert.deepEqual(
  bad.errors.map((e) => e.line),
  [2, 3, 4]
);

// later lines win
assert.deepEqual(parseList("a.example dark\na.example light").hosts, { "a.example": "light" });

// round trip, sorted
const hosts = { "z.example": "light", "a.example": "dark" };
assert.equal(formatList(hosts), "a.example dark\nz.example light");
assert.deepEqual(parseList(formatList(hosts)).hosts, hosts);

console.log("settings tests passed");
