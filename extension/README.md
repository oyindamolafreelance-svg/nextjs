# LinguaBoard Clipper (browser extension)

Send a translation job you're viewing (ProZ, LinkedIn, agency sites, anywhere)
straight to your LinguaBoard's review queue.

## Install (Chrome / Edge)

1. In the browser, open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click the extension icon → open **Settings** → paste:
   - **Site URL** — your board, e.g. `https://your-app.vercel.app`
   - **Clip token** — generate it on the board under **Settings**
   - Save.

## Use

Open any job page, click the extension, then **Grab this job & send**. It reads
the page (or your text selection), sends it to `/api/clip`, and it appears in
your admin **Sourced** queue to approve.

> It captures the page you're viewing — it does not crawl or scrape in the
> background, which keeps your ProZ/LinkedIn account safe.
