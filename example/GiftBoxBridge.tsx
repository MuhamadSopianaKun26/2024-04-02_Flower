"use client";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEffect, useState } from "react";
import { useScrapbookStore } from "@/state/useScrapbookStore";

export default function GiftBoxBridge({ tapsRequired = 5 }: { tapsRequired?: number }) {
  const { nextPhase } = useScrapbookStore();
  const [taps, setTaps] = useState(0);
  const [opened, setOpened] = useState(false);
  const [blinding, setBlinding] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const boxControls = useAnimation();

  // Buka kotak ketika jumlah tap memenuhi
  useEffect(() => {
    if (taps >= tapsRequired && !opened) {
      setOpened(true);
    }
  }, [taps, tapsRequired, opened]);

  // Setelah animasi blinding dimulai, transisi ke fase berikutnya (durasi diperpanjang)
  useEffect(() => {
    if (!blinding) return;
    const t = setTimeout(() => nextPhase(), 2400);
    return () => clearTimeout(t);
  }, [blinding, nextPhase]);

  // Sync base pose with opened changes
  useEffect(() => {
    boxControls.start({
      y: 0,
      rotate: 0,
      opacity: 1,
      scale: opened ? 1.1 : 1,
      transition: { type: "spring", stiffness: 200, damping: 18 },
    });
  }, [opened, boxControls]);

  const onTap = () => {
    if (!opened) {
      setTaps((x) => Math.min(tapsRequired, x + 1));
      setShakeKey((k) => k + 1); // trigger shake
      // strong wobble: rotate and sway left-right quickly
      void boxControls.start({
        x: [0, -16, 16, -12, 12, -6, 6, 0],
        rotate: [0, -10, 10, -6, 6, -3, 3, 0],
        scale: [1, 1.04, 0.98, 1.03, 0.99, 1.01, 1, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      });
      return;
    }
    // Sudah opened: butuh satu tap lagi untuk memulai blinding
    if (!blinding) setBlinding(true);
  };

  return (
    <div className="min-h-screen w-full bg-black text-zinc-100 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-900 to-black opacity-70" />
      </div>
      <div className="relative flex flex-col items-center gap-6 z-10">
        <AnimatePresence>
          <motion.div
            key="box"
            initial={{ y: -400, rotate: -10, opacity: 0 }}
            animate={boxControls}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            className="w-40 h-40 bg-rose-300 rounded-md shadow-2xl border-4 border-rose-400 flex items-center justify-center relative"
            onClick={onTap}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? onTap() : null)}
          >
            {/* Content */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-10 bg-rose-500" />
            <div className="absolute inset-0 border-2 border-rose-500" />
            {!opened ? (
              <span className="text-black font-semibold">Tap {tapsRequired - taps}</span>
            ) : (
              <span className="text-black font-semibold">Tap sekali lagi</span>
            )}
            {opened && (
              <>
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  className="pointer-events-none absolute -inset-8 -z-10 rounded-2xl bg-rose-300/50 blur-3xl"
                />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1.8, opacity: 0.9 }}
                  transition={{ duration: 0.8 }}
                  className="pointer-events-none absolute -inset-12 -z-10 rounded-3xl bg-white/40 blur-[60px]"
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
        {opened ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm opacity-80">
            Cahaya keluar... masuk ke dalamnya
          </motion.p>
        ) : (
          <p className="text-sm opacity-70">Ketuk kotak beberapa kali untuk membuka</p>
        )}
      </div>
      {/* Blinding overlay */}
      <AnimatePresence>
        {blinding && (
          <motion.div
            key="blind"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 z-20 flex items-center justify-center"
          >
            {/* global white wash to simulate extreme glare */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
              className="absolute inset-0 bg-white"
            />
            <motion.div
              initial={{ scale: 1, opacity: 0.9 }}
              animate={{ scale: 140, opacity: 1 }}
              transition={{ duration: 2.0, ease: "easeInOut" }}
              className="w-64 h-64 rounded-full bg-white shadow-[0_0_420px_220px_rgba(255,255,255,1),0_0_260px_140px_rgba(244,63,94,0.6)]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
