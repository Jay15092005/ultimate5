// Root layout for the Ultimate Advisor Platform (Next.js App Router)
// Sets up global fonts, metadata, and wraps all pages

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientNotificationListener } from "@/components/ClientNotificationListener";
import { AdvisorNotificationListener } from "@/components/AdvisorNotificationListener";
import { ClientJoinCallListener } from "@/components/ClientJoinCallListener";
import Providers from './Providers';

// Load Geist Sans and Mono fonts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Default site metadata
export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

// Main layout component
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Site title and meta description for SEO */}
        <title>Ultimate Advisor Platform</title>
        <meta name="description" content="Connect instantly with top advisors in business, finance, and more." />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {/* Global client notification listener for real-time toasts */}
          <ClientNotificationListener />
          {/* Global advisor notification listener for real-time toasts */}
          <AdvisorNotificationListener />
          {/* Global client join call modal */}
          <ClientJoinCallListener />
          {/* Render all page content here */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
