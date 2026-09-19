import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/layout/Nav";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IELTS Adaptive Practice",
  description: "Luyện 4 kỹ năng IELTS với vòng quay random có trọng số thích ứng",
};

// Most themes are light (see src/lib/theme.ts); ThemeProvider overrides this
// per-theme at runtime via `documentElement.style.colorScheme`. This static
// default is the pre-hydration baseline and a signal to the browser that the
// page manages its own light/dark appearance — some browsers' built-in
// "force dark mode for web content" features (distinct from the OS/browser
// prefers-color-scheme setting the app's own theme system already stopped
// following) respect this and skip repainting the page; others don't, since
// it's a page-level hint, not something a website can force.
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Nav />
          <div className="flex flex-1 flex-col">{children}</div>
          <ChatBubble />
        </ThemeProvider>
      </body>
    </html>
  );
}
