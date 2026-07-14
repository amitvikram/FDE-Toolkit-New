import type { MetadataRoute } from "next";
import { insights } from "@/lib/insights";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://fde-toolkit.com";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...insights.map((insight) => ({
      url: `${baseUrl}/blog/${insight.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
