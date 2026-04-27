import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { NO_FLASH_SCRIPT, ThemeProvider } from "@/components/ThemeProvider";
import { PasswordGate } from "@/components/PasswordGate";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const BP = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Personal Power II",
  description: "30-day companion for working through Tony Robbins' Personal Power II",
  manifest: `${BP}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${BP}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${BP}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${BP}/apple-touch-icon.png`, sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "PPII",
    statusBarStyle: "black-translucent",
    startupImage: [`${BP}/icon-512.png`],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-page text-ink">
        <PasswordGate>
          <main className="flex-1 pb-20">{children}</main>
          <BottomNav />
        </PasswordGate>
        <ServiceWorkerRegister />
        <ThemeProvider />
      </body>
    </html>
  );
}
