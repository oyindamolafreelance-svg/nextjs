import { type Connector, type RawJob, isTranslationRole, safeText } from "./types";

function firstTag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  let v = m ? m[1] : "";
  v = v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return v.trim();
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

// Standard RSS feeds. Add more { name, url } entries to widen coverage.
const RSS_FEEDS: { name: string; url: string }[] = [
  { name: "WeWorkRemotely", url: "https://weworkremotely.com/remote-jobs.rss" },
  { name: "Jobspresso", url: "https://jobspresso.co/remote-work/?feed=job_feed" },
];

function rssConnector(name: string, url: string): Connector {
  return {
    name: `RSS:${name}`,
    async fetch() {
      const xml = await safeText(url);
      if (!xml) return [];
      const items = xml.split(/<item[\s>]/i).slice(1);
      const out: RawJob[] = [];
      for (const block of items) {
        const title = stripHtml(firstTag(block, "title"));
        const link = firstTag(block, "link");
        const desc = stripHtml(firstTag(block, "description") || firstTag(block, "content:encoded"));
        const guid = firstTag(block, "guid") || link;
        if (!title || !link) continue;
        if (!isTranslationRole(title, desc)) continue;
        out.push({
          source_name: `RSS:${name}`,
          external_id: guid || link,
          title,
          description: desc,
          apply_url: link,
        });
      }
      return out;
    },
  };
}

export const RSS_CONNECTORS: Connector[] = RSS_FEEDS.map((f) =>
  rssConnector(f.name, f.url)
);
