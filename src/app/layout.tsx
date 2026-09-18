import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Toaster } from "@/components/ui/toaster";
import { SiteShell } from "@/components/exam/site-shell";
import { ThemeProvider } from "@/components/exam/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Examina - Test Your Knowledge",
  description:
    "A place to test student knowledge. Sign in to take exams and track your scores. The admin sets up exams and questions.",
  keywords: ["examina", "test", "exam", "examination", "quiz", "report card", "student", "admin", "knowledge"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <SiteShell>{children}</SiteShell>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
