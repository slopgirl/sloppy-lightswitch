"use strict";

const { DEFAULTS, applyScheme, sanitize, effectiveMode } = globalThis.sloppySettings;

let settings = sanitize(DEFAULTS);
let currentHost = null;

const globalGroup = document.getElementById("global-modes");
const hostGroup = document.getElementById("host-modes");
const hostSection = document.getElementById("host-section");
const noHostSection = document.getElementById("no-host");
const hostName = document.getElementById("host-name");
const status = document.getElementById("status");

function paint(group, selected) {
  for (const button of group.querySelectorAll("button")) {
    button.setAttribute("aria-checked", String(button.dataset.mode === (selected ?? "")));
  }
}

function render() {
  applyScheme(document, settings.global);
  paint(globalGroup, settings.global);
  if (currentHost) paint(hostGroup, settings.hosts[currentHost] ?? "");
  const effective = effectiveMode(settings, currentHost);
  status.innerHTML = "";
  status.append(currentHost ? `${currentHost} gets ` : "everything gets ");
  const b = document.createElement("b");
  b.textContent = effective;
  status.append(b);
}

async function save() {
  await browser.storage.local.set({ global: settings.global, hosts: settings.hosts });
  render();
}

globalGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  settings.global = button.dataset.mode;
  save();
});

hostGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !currentHost) return;
  if (button.dataset.mode === "") {
    delete settings.hosts[currentHost];
  } else {
    settings.hosts[currentHost] = button.dataset.mode;
  }
  save();
});

document.getElementById("open-options").addEventListener("click", async () => {
  try {
    await browser.runtime.openOptionsPage();
  } catch (e) {
    // some builds lack openOptionsPage in popups; fall back to a plain tab
    await browser.tabs.create({ url: browser.runtime.getURL("options/options.html") });
  }
  window.close();
});

// The active tab's host, if it has one. On Android the popup is an overlay
// over the current tab, so the same query works there; the second query is
// a fallback for builds where currentWindow is not what we think it is.
async function findHost() {
  const queries = [{ active: true, currentWindow: true }, { active: true }];
  for (const query of queries) {
    try {
      const tabs = await browser.tabs.query(query);
      for (const tab of tabs) {
        const url = new URL(tab.url || "");
        if (url.protocol === "http:" || url.protocol === "https:") return url.hostname;
      }
    } catch (e) {
      /* try the next query */
    }
  }
  return null;
}

async function init() {
  settings = sanitize(await browser.storage.local.get(DEFAULTS));
  currentHost = await findHost();

  if (currentHost) {
    hostName.textContent = currentHost;
    hostSection.hidden = false;
  } else {
    noHostSection.hidden = false;
  }
  render();
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  settings = sanitize({
    global: changes.global ? changes.global.newValue : settings.global,
    hosts: changes.hosts ? changes.hosts.newValue : settings.hosts,
  });
  render();
});

init();
