/* global chrome */

const $ = (id) => document.getElementById(id);

function setStatus(msg, cls) {
  const el = $("status");
  el.textContent = msg;
  el.className = cls || "";
}

// Load saved settings.
chrome.storage.local.get(["siteUrl", "token"], (cfg) => {
  if (cfg.siteUrl) $("siteUrl").value = cfg.siteUrl;
  if (cfg.token) $("token").value = cfg.token;
  if (!cfg.siteUrl || !cfg.token) {
    $("settings").open = true;
    setStatus("Add your Site URL and clip token first.", "err");
  }
});

$("save").addEventListener("click", () => {
  const siteUrl = $("siteUrl").value.trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  chrome.storage.local.set({ siteUrl, token }, () => {
    setStatus("Settings saved.", "ok");
  });
});

// Runs inside the page to extract the job. Prefers a text selection.
function scrapePage() {
  const selection = String(window.getSelection() || "").trim();
  const text = (selection || document.body.innerText || "").slice(0, 8000);
  return { title: document.title, url: location.href, text };
}

function sourceFromHost(host) {
  if (/proz\.com/i.test(host)) return "Clip:ProZ";
  if (/linkedin\.com/i.test(host)) return "Clip:LinkedIn";
  return "Clip";
}

$("send").addEventListener("click", async () => {
  const siteUrl = $("siteUrl").value.trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  if (!siteUrl || !token) {
    $("settings").open = true;
    setStatus("Add your Site URL and clip token first.", "err");
    return;
  }

  setStatus("Grabbing the page…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapePage,
    });

    setStatus("Sending to your board…");
    const res = await fetch(`${siteUrl}/api/clip`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-clip-token": token },
      body: JSON.stringify({
        title: result.title,
        text: result.text,
        url: result.url,
        source: sourceFromHost(new URL(result.url).host),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("✓ Sent! It's in your Sourced review queue.", "ok");
    } else {
      setStatus(data.error || `Failed (${res.status}).`, "err");
    }
  } catch (e) {
    setStatus("Couldn't send — check your Site URL/token.", "err");
  }
});
