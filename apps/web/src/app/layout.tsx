import type { Metadata } from "next";
import { Cinzel, Barlow, Barlow_Condensed } from "next/font/google";
import "../styles/globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "WraexCodex - The Knowledge of Wraeclast",
    template: "%s | WraexCodex",
  },
  description: "The definitive Path of Exile 2 reference platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="bg-void text-[#e8e0d0] font-body antialiased">
        {children}
      </body>
    </html>
  );
}
