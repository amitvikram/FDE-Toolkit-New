import { insights } from "@/lib/insights";

const baseUrl = "https://fde-toolkit.com";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const items = insights
    .map(
      (insight) => `
        <item>
          <title>${escapeXml(insight.title)}</title>
          <link>${baseUrl}/blog/${insight.slug}</link>
          <guid>${baseUrl}/blog/${insight.slug}</guid>
          <description>${escapeXml(insight.dek)}</description>
          <category>${escapeXml(insight.category)}</category>
        </item>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>FDE-Toolkit Insights</title>
        <link>${baseUrl}/blog</link>
        <description>Practical ideas for governed, reusable customer-specific AI delivery.</description>
        ${items}
      </channel>
    </rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
