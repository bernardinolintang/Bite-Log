import type { Metadata, Viewport } from "next";
import { Newsreader, Oswald } from "next/font/google";
import "./globals.css";

const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: "BiteLog",
  description: "Personal AI meal logging — estimates only, always editable.",
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${oswald.variable} ${newsreader.variable} bg-paper font-serif text-ink antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
