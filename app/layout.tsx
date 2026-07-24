import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "La Justa",
  description:
    "Divide una cuenta entre amigos, asigna consumos y comparte el resumen.",
  openGraph: {
    title: "La Justa · Divide. Comparte. Listo.",
    description: "La forma más rápida de dividir una cuenta entre amigos.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "La Justa · Divide. Comparte. Listo.",
    description: "La forma más rápida de dividir una cuenta entre amigos.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
