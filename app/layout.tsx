import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Music Library Visualizer",
  description: "Arrange your Spotify saved tracks on a freeform canvas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
