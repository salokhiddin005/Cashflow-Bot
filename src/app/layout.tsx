import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ToastHost } from "@/components/toast-host";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sahifa — Business Finance",
  description: "A finance manager for small and medium businesses in Uzbekistan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastHost>
          <div className="flex min-h-screen bg-[--color-background] text-[--color-foreground]">
            <Sidebar />
            <div className="flex flex-1 flex-col">
              <Topbar />
              <main className="flex-1 px-6 py-6 lg:px-10 lg:py-8">{children}</main>
            </div>
          </div>
        </ToastHost>
      </body>
    </html>
  );
}
