import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Music Library Visualizer",
  description: "Visualize your music library",
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
