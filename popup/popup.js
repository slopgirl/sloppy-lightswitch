"use strict";

const DEFAULTS = { global: "system", hosts: {} };

let settings = { ...DEFAULTS };
let currentHost = null;

const globalGroup = document.getElementById("global-modes");
const hostGroup = document.getElementById("host-modes");
const hostSection = document.getElementById("host-section");
const noHostSection = document.getElementById("no-host");
const hostName = document.getElementById("host-name");
const status = document.getElementById("status");

function paint(group, selected) {
  for (const button of group.querySelectorAll("button")) {
    button.setAttribute(
      "aria-checked",
      String(button.dataset.mode === (selected ?? ""))
    );
  }
}

function render() {
  paint(globalGroup, settings.global);
  if (currentHost) {
    paint(hostGroup, settings.hosts[currentHost] ?? "");
  }
  const effective = currentHost
    ? settings.hosts[currentHost] ?? settings.global
    : settings.global;
  status.textContent = currentHost
    ? `${currentHost} gets: ${effective}`
    : `everything gets: ${effective}`;
}

async function save() {
  await browser.storage.local.set({
    global: settings.global,
    hosts: settings.hosts,
  });
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

async function init() {
  const stored = await browser.storage.local.get(DEFAULTS);
  settings = { ...DEFAULTS, ...stored };

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    if (url.protocol === "http:" || url.protocol === "https:") {
      currentHost = url.hostname;
    }
  } catch (e) {
    currentHost = null;
  }

  if (currentHost) {
    hostName.textContent = currentHost;
    hostSection.hidden = false;
  } else {
    noHostSection.hidden = false;
  }
  render();
}

init();
