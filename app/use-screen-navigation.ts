"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export const SCREEN_ORDER = ["capture", "items", "people", "assign", "summary"] as const;
export type Step = (typeof SCREEN_ORDER)[number];

type Screen = {
  step: Step;
  direction: "forward" | "back";
  motion: "still" | "fallback" | "native";
};

/**
 * Mantiene el paso activo y sincroniza las transiciones con el DOM de React.
 *
 * @returns Paso activo, preferencias de movimiento y acciones de navegación.
 */
export function useScreenNavigation() {
  const [screen, setScreen] = useState<Screen>({
    step: "capture",
    direction: "forward",
    motion: "still",
  });
  const committedStep = useRef<Step>("capture");
  const focusedStep = useRef<Step>("capture");
  const navigationSequence = useRef(0);
  const activeTransition = useRef<ViewTransition | null>(null);

  useLayoutEffect(() => {
    if (focusedStep.current === screen.step) {
      return;
    }

    focusedStep.current = screen.step;
    window.scrollTo(0, 0);
    document.getElementById("screen-title")?.focus({ preventScroll: true });
  }, [screen.step]);

  /** Invalida el cambio pendiente antes de reemplazar o cerrar la sesión. */
  function cancelNavigation() {
    navigationSequence.current += 1;
    activeTransition.current?.skipTransition();
    activeTransition.current = null;
  }

  /**
   * Desplaza las dos vistas si el navegador ofrece transiciones nativas.
   *
   * @param step Destino de la navegación.
   * @param animate Permite omitir la animación al iniciar un OCR.
   */
  function navigate(step: Step, animate = true) {
    cancelNavigation();
    const from = committedStep.current;
    if (from === step) {
      return;
    }

    const sequence = navigationSequence.current;
    const direction =
      SCREEN_ORDER.indexOf(step) > SCREEN_ORDER.indexOf(from) ? "forward" : "back";
    const allowMotion = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const useNativeMotion =
      allowMotion &&
      window.scrollY < window.innerHeight &&
      typeof document.startViewTransition === "function";
    const motion = useNativeMotion ? "native" : allowMotion ? "fallback" : "still";

    function commitNavigation() {
      if (sequence !== navigationSequence.current) {
        return;
      }
      committedStep.current = step;
      setScreen({ step, direction, motion });
    }

    if (!useNativeMotion) {
      commitNavigation();
      return;
    }

    document.documentElement.dataset.screenDirection = direction;
    const transition = document.startViewTransition(() => {
      // El navegador captura el DOM en cuanto termina esta función.
      flushSync(commitNavigation);
    });
    activeTransition.current = transition;

    function clearTransition() {
      if (activeTransition.current === transition) {
        activeTransition.current = null;
      }
    }

    // Una navegación rápida puede saltar una transición antes de que esté lista.
    void transition.ready.catch(() => undefined);
    void transition.finished.then(clearTransition, clearTransition);
  }

  return { ...screen, navigate, cancelNavigation };
}
