import type { Metadata } from "next";
import { CuentaApp } from "./CuentaApp";

export const metadata: Metadata = {
  title: "La Justa",
  description: "Divide una cuenta entre amigos de forma rápida y transparente.",
};

export default function Home() {
  return <CuentaApp />;
}
