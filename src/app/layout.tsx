import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Job Vettai", template: "%s · Job Vettai" },
  description: "An AI job hunt studio: build your profile, scan portals, rank fits, draft tailored CVs and cover letters, prep interviews and track every application.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#06070d" },
    { media: "(prefers-color-scheme: light)", color: "#f4f5fb" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Applies the saved theme before first paint so there is no light/dark flash.
const themeScript = `(()=>{try{const s=JSON.parse(localStorage.getItem("job-vettai")||"{}");const t=s?.state?.settings?.theme||"dark";const d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){document.documentElement.classList.add("dark")}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
