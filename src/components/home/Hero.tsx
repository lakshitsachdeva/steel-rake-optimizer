"use client";
import { motion } from "framer-motion";
import Link from "next/link";

export const Hero = () => {
  return (
    <section className="relative flex min-h-[calc(100vh-0px)] items-center justify-center overflow-hidden">
      {/* Aura/Blob background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -top-24 -left-24 h-96 w-96 rounded-full blur-3xl"
          style={{ background:
            "radial-gradient(closest-side, rgba(59,130,246,0.45), rgba(59,130,246,0) 70%)" }}
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -20, 30, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-8rem] right-[-6rem] h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background:
            "radial-gradient(closest-side, rgba(16,185,129,0.45), rgba(16,185,129,0) 70%)" }}
          animate={{
            x: [0, -30, 10, 0],
            y: [0, 10, -35, 0],
            scale: [1, 0.92, 1.08, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background:
            "radial-gradient(closest-side, rgba(236,72,153,0.35), rgba(236,72,153,0) 70%)" }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
        {/* subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/50 px-3 py-1 text-xs font-medium backdrop-blur dark:border-white/10 dark:bg-white/10">
            Hackathon-ready • OR + AI/ML DSS
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Optimize Rake Formation for SAIL with an Intelligent DSS
          </h1>
          <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
            Plan multi-day dispatches, maximize rake utilization, and minimize total logistics cost with real-time simulation and exports.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dss"
              className="group relative inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/70 px-5 py-3 text-sm font-semibold text-black shadow-xl backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              <span>Open DSS Dashboard</span>
              <svg className="h-4 w-4 transition group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-foreground/80 backdrop-blur hover:bg-white/60 dark:border-white/10 dark:hover:bg-white/5"
            >
              Learn more
            </a>
          </div>
        </motion.div>

        {/* Floating cards */}
        <div className="pointer-events-none relative mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Multi-Objective Optimization", desc: "Balance cost, SLA, and utilization with tunable weights." },
            { title: "Scenario Simulator", desc: "Urgent orders, shortages, breakdowns — re-optimize instantly." },
            { title: "Exports", desc: "Download dispatch plans & KPI snapshots as CSV/XLSX." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="pointer-events-auto rounded-2xl border border-white/30 bg-white/60 p-5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10"
            >
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* marquee-like stats */}
        <motion.div
          id="features"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mt-20 max-w-5xl rounded-2xl border border-white/30 bg-white/60 p-6 backdrop-blur dark:border-white/10 dark:bg-white/10"
        >
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat kpi="95%+" label="On-time service" />
            <Stat kpi="10-18%" label="Cost savings" />
            <Stat kpi=">= 1e5" label="Tons planned/day" />
            <Stat kpi="> 30%" label="Idle reduction" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const Stat = ({ kpi, label }: { kpi: string; label: string }) => (
  <div className="text-center">
    <div className="text-3xl font-semibold sm:text-4xl">{kpi}</div>
    <div className="mt-1 text-xs text-muted-foreground">{label}</div>
  </div>
);

export default Hero;