import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "SpectraForge — FFT Image Editor",
  description:
    "A high-performance FFT-powered image editor for removing periodic noise, moire patterns, and scan artifacts. Real-time frequency domain editing with smart detection.",
  keywords: [
    "FFT",
    "image editor",
    "noise removal",
    "moire",
    "frequency domain",
    "spectrum",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
