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

// Read the saved theme from localStorage and apply it BEFORE React hydrates,
// so the page paints in the correct palette on first frame. Must be inline
// + synchronous — any delay produces a brief flash of the default theme.
const themeInitScript = `
(function(){try{
  var t=localStorage.getItem("cf-theme");
  if(t!=="day"&&t!=="night"&&t!=="honey")t="honey";
  document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","honey");}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="honey"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Theme-init script — must run before paint to avoid flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <ToastHost>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastHost>
      </body>
    </html>
  );
}
