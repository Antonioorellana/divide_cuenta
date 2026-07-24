"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // La aplicación sigue operativa en línea si el registro falla.
      });
    }
  }, []);

  return null;
}
