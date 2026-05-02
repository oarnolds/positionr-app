import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Positionr",
  description:
    "Snel inzicht in wat je marketing oplevert, zodat je met vertrouwen kunt bijsturen.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
