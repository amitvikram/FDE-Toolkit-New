import type { Metadata } from "next";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { DevConsoleFilter } from "@/components/DevConsoleFilter";
import { Inter, DM_Serif_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fde-toolkit.com"),
  title: {
    default: "FDE-Toolkit | Scale customer-specific AI delivery",
    template: "%s | FDE-Toolkit",
  },
  description:
    "FDE-Toolkit helps enterprises, SaaS vendors, and systems integrators co-build AI and software workflows in isolated sandboxes and promote validated work into governed engineering pipelines.",
  keywords: [
    "forward deployed engineering",
    "enterprise AI delivery",
    "customer-to-production platform",
    "enterprise workflow prototyping",
    "design partner platform",
    "systems integrator delivery platform",
    "SaaS product discovery",
    "AI solution sandbox",
    "GitHub workflow governance",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://fde-toolkit.com",
    title: "FDE-Toolkit | Scale customer-specific AI delivery",
    description:
      "Governed co-building, isolated sandboxes, persistent decision context, and engineering-native promotion for enterprises, SaaS vendors, and systems integrators.",
    siteName: "FDE-Toolkit",
  },
  twitter: {
    card: "summary_large_image",
    title: "FDE-Toolkit | Governed customer-to-production delivery",
    description:
      "A forward-deployed delivery platform for enterprises, software vendors, and systems integrators.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: [
    {
      rel: "icon",
      type: "image/svg+xml",
      url: "/fde-toolkit.svg",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `
    (function() {
      try {
        var k = 'fde-toolkit-theme';
        var stored = localStorage.getItem(k);
        var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', dark);
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased bg-background text-foreground`}
      >
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
        <ThemeProvider initialTheme="light">
          <ConvexClientProvider>
            <UserProvider>
              <TooltipProvider>
                <DevConsoleFilter />
                <div className="min-h-screen w-full flex flex-col">{children}</div>
                <Toaster />
              </TooltipProvider>
            </UserProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
