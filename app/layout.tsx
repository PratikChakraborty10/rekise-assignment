import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import Navbar from "@/components/navbar";
import { Toaster } from "@/components/ui/toaster";
import { LaptopMinimalCheck } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rekise Marine Assignment - Pratik",
  description:
    "This is the assignment for Rekise Marine. Submitted by - Pratik Chakraborty",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-[100svh] w-full`}
      >
        <div className="sm:hidden flex flex-col gap-8 items-center justify-center h-screen w-screen bg-background text-foreground p-4 text-center">
          <p className="text-lg font-medium">
            This application is not supported on mobile devices. Please use a
            desktop or tablet.
          </p>
          <LaptopMinimalCheck size={100} />
        </div>
        <div className="hidden sm:block h-full w-full">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Navbar />
            <main className="h-full w-full pt-14">{children}</main>
            <Toaster />
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
