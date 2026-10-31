"use client";

import "./reveal-on-scroll.css";
import { useEffect } from "react";

/**
 * Brings elements marked `data-reveal` into view as the visitor scrolls to
 * them. Content is only hidden once this script has run (it sets
 * `data-reveal-ready` on the page first), so nothing stays invisible if
 * JavaScript fails or is slow. Visitors who prefer reduced motion see
 * everything immediately.
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.dataset.revealReady = "true";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    const observeAll = () => {
      document
        .querySelectorAll("[data-reveal]:not([data-revealed])")
        .forEach((element) => observer.observe(element));
    };
    observeAll();
    // Client-side navigation swaps page content without remounting the layout.
    const mutations = new MutationObserver(observeAll);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      delete root.dataset.revealReady;
    };
  }, []);

  return null;
}
