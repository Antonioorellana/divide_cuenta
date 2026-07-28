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
    statusBarStyle: "default",
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
    icon: "/icon-192.png",
    shortcut: "/icon-192.png",
    apple: "/icon-180.png",
  },
};

export const viewport = {
  themeColor: "#426655",
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
