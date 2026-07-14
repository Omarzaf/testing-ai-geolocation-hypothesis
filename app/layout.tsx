import type { Metadata } from "next";
import "./globals.css";

const TITLE = "Reasoning Across Borders";
const DESCRIPTION =
  "An anonymous public benchmark testing whether the same declared AI model reasons differently across regions.";

export const metadata: Metadata = {
  metadataBase: new URL("https://reasoning-across-borders.mumerzafer.workers.dev"),
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: `${TITLE} social preview` }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
