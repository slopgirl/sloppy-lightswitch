"use strict";

const { MODES, DEFAULTS, applyScheme, sanitize, normalizeHost, parseList, formatList } =
  globalThis.sloppySettings;

let settings = sanitize(DEFAULTS);

const globalGroup = document.getElementById("global-modes");
const hostList = document.getElementById("host-list");
const noHosts = document.getElementById("no-hosts");
const addForm = document.getElementById("add-form");
const addHost = document.getElementById("add-host");
const addMode = document.getElementById("add-mode");
const listArea = document.getElementById("list");
const listStatus = document.getElementById("list-status");

const GLYPH = { system: "#g-system", light: "#g-light", dark: "#g-dark" };

function paint(group, selected) {
  for (const button of group.querySelectorAll("button")) {
    button.setAttribute("aria-checked", String(button.dataset.mode === (selected ?? "")));
  }
}

function modeButton(mode, selected) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.mode = mode;
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(mode === selected));
  button.title = mode;
  button.setAttribute("aria-label", mode);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", GLYPH[mode]);
  svg.append(use);
  const label = document.createElement("span");
  label.textContent = mode;
  button.append(svg, label);
  return button;
}

function renderHosts() {
  hostList.innerHTML = "";
  const hosts = Object.keys(settings.hosts).sort();
  noHosts.hidden = hosts.length > 0;
  for (const host of hosts) {
    const li = document.createElement("li");
    li.dataset.host = host;

    const name = document.createElement("span");
    name.className = "host";
    name.textContent = host;

    const modes = document.createElement("div");
    modes.className = "modes";
    modes.setAttribute("role", "radiogroup");
    modes.setAttribute("aria-label", `Mode for ${host}`);
    for (const mode of MODES) modes.append(modeButton(mode, settings.hosts[host]));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "×";
    remove.title = `forget ${host}`;
    remove.setAttribute("aria-label", `forget ${host}`);

    li.append(name, modes, remove);
    hostList.append(li);
  }
}

// The textarea is the user's draft: only overwrite it when it still matches
// what was last loaded/saved, so a storage change elsewhere cannot eat edits.
let listBaseline = "";

function renderList(force) {
  const text = formatList(settings.hosts);
  if (force || listArea.value === listBaseline) {
    listArea.value = text;
  }
  listBaseline = text;
}

function render() {
  applyScheme(document, settings.global);
  paint(globalGroup, settings.global);
  renderHosts();
  renderList(false);
}

async function save() {
  settings = sanitize(settings);
  await browser.storage.local.set({ global: settings.global, hosts: settings.hosts });
  render();
}

function setStatus(text, kind) {
  listStatus.textContent = text;
  listStatus.className = `hint status ${kind || ""}`;
}

/* ---- wiring ---- */

globalGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  settings.global = button.dataset.mode;
  save();
});

hostList.addEventListener("click", (event) => {
  const li = event.target.closest("li");
  if (!li) return;
  const host = li.dataset.host;
  if (event.target.closest(".remove")) {
    delete settings.hosts[host];
    save();
    return;
  }
  const button = event.target.closest("button[data-mode]");
  if (!button) return;
  settings.hosts[host] = button.dataset.mode;
  save();
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const host = normalizeHost(addHost.value);
  if (!host) {
    addHost.setCustomValidity("that does not look like a host");
    addHost.reportValidity();
    return;
  }
  addHost.setCustomValidity("");
  settings.hosts[host] = addMode.value;
  addHost.value = "";
  save();
});

addHost.addEventListener("input", () => addHost.setCustomValidity(""));

document.getElementById("save-list").addEventListener("click", async () => {
  const { hosts, errors } = parseList(listArea.value);
  if (errors.length) {
    const lines = errors
      .slice(0, 5)
      .map((e) => `line ${e.line}: ${e.reason}  (${e.text.trim()})`)
      .join("\n");
    setStatus(`not saved, ${errors.length} line${errors.length === 1 ? "" : "s"} confused me:\n${lines}`, "bad");
    return;
  }
  settings.hosts = hosts;
  await save();
  renderList(true);
  const n = Object.keys(hosts).length;
  setStatus(`saved ${n} site${n === 1 ? "" : "s"}`, "ok");
});

document.getElementById("reload-list").addEventListener("click", () => {
  renderList(true);
  setStatus("", "");
});

listArea.addEventListener("input", () => setStatus("", ""));

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  settings = sanitize({
    global: changes.global ? changes.global.newValue : settings.global,
    hosts: changes.hosts ? changes.hosts.newValue : settings.hosts,
  });
  render();
});

async function init() {
  settings = sanitize(await browser.storage.local.get(DEFAULTS));
  render();
  renderList(true);
}

init();
