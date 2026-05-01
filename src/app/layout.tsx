import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastHost } from "@/components/toast-host";
import { ConfirmProvider } from "@/components/confirm-dialog";

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
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastHost>
      </body>
    </html>
  );
}
