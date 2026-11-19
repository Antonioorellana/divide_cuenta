import type { Metadata } from "next";
import { PwaRegistration } from "./PwaRegistration";
import "./globals.css";

const deploymentHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_URL ??
  "la-justa-cuentas.neoevil05.chatgpt.site";
const metadataBase = new URL(
  deploymentHost.startsWith("http")
    ? deploymentHost
    : `https://${deploymentHost}`,
);

export const metadata: Metadata = {
  metadataBase,
  title: "La Justa",
  applicationName: "La Justa",
  description:
    "Divide una cuenta entre amigos, asigna consumos y comparte el resumen.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "La Justa",
  },
  formatDetection: {
    telephone: false,
  },
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
    icon: [
      { url: "/la-justa-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/la-justa-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/la-justa-apple-180.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport = {
  themeColor: "#120e17",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
