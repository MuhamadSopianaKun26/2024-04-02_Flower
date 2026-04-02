"use client";
import { useEffect, useState } from "react";
import { useScrapbookStore } from "@/state/useScrapbookStore";
import type { ScrapbookContent } from "@/state/useScrapbookStore";
import IntroDarkScreen from "@/components/IntroDarkScreen";
import GiftBoxBridge from "@/components/GiftBoxBridge";
import ScrapbookSlides from "@/components/ScrapbookSlides";
import MonologueOverlay from "@/components/MonologueOverlay";
import EndingCloseBook from "@/components/EndingCloseBook";
import { AnimatePresence, motion } from "framer-motion";
import StartScreen from "@/components/StartScreen";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function ScrapbookApp({ content }: { readonly content: ScrapbookContent }) {
  const { phase, setPhase } = useScrapbookStore();
  const [showLoading, setShowLoading] = useState(false);

  // On first mount: restore phase with rules
  // - If saved phase is 'scrapbook' | 'bridge' | 'ending', keep it (so back from story returns to scrapbook).
  // - Otherwise, default to 'start' (fresh open or after refresh on intro/start).
  useEffect(() => {
    try {
      const saved = globalThis.sessionStorage?.getItem("scrapbook_phase");
      const keep = saved === "scrapbook" || saved === "bridge" || saved === "ending";
      const initial = keep ? (saved as typeof saved) : "start";
      if (initial !== phase) setPhase(initial as any);
      globalThis.sessionStorage?.setItem("scrapbook_phase", initial);
    } catch {
      setPhase("start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist phase whenever it changes
  useEffect(() => {
    try {
      globalThis.sessionStorage?.setItem("scrapbook_phase", phase);
    } catch {}
  }, [phase]);

  // Brief loading overlay when entering scrapbook to mask layout/image render
  useEffect(() => {
    if (phase === "scrapbook") {
      setShowLoading(true);
      const t = setTimeout(() => setShowLoading(false), 1200);
      return () => clearTimeout(t);
    }
    setShowLoading(false);
  }, [phase]);

  // When returning to intro or start, clear any saved scrapbook scroll/last slide so it resets to top next time
  useEffect(() => {
    if (phase === "intro" || phase === "start") {
      try {
        globalThis.sessionStorage?.removeItem("scrapbook_scrollTop");
        globalThis.sessionStorage?.removeItem("scrapbook_lastId");
      } catch {}
    }
  }, [phase]);

  return (
    <div className="min-h-screen w-full relative">
      {showLoading && <LoadingOverlay />}
      <AnimatePresence mode="wait">
        {phase === "start" && (
          <motion.div key="phase-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StartScreen texts={content.start}
            />
          </motion.div>
        )}
        {phase === "intro" && (
          <motion.div key="phase-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <IntroDarkScreen items={content.intro} />
          </motion.div>
        )}
        {phase === "bridge" && (
          <motion.div key="phase-bridge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GiftBoxBridge tapsRequired={content.bridge?.boxTapsRequired ?? 5} />
          </motion.div>
        )}
        {phase === "scrapbook" && (
          <motion.div key="phase-scrapbook" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <ScrapbookSlides slides={content.slides} finalSlide={content.finalSlide} monologues={content.monologues}
            />
          </motion.div>
        )}
        {phase === "ending" && (
          <motion.div key="phase-ending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
            <EndingCloseBook poem={content.ending.poem} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay dialog for monologues (triggered via store.setOverlay) */}
      {content.monologues && <MonologueOverlay monologues={content.monologues} />}
    </div>
  );
}
