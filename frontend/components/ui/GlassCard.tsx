"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { fadeUp } from "@/lib/motion";

type GlassCardProps = HTMLMotionProps<"div"> & {
  /** Adds a teal glow accent on hover. */
  interactive?: boolean;
  /** Animate in with the shared fadeUp variant. */
  animate?: boolean;
};

/** The foundational surface: glassmorphic panel with a hairline border. */
export function GlassCard({
  className = "",
  interactive = false,
  animate = false,
  children,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      variants={animate ? fadeUp : undefined}
      className={[
        "glass rounded-xl",
        interactive
          ? "transition-all duration-300 hover:border-teal-500/30 hover:shadow-[0_0_30px_-10px_rgba(45,212,191,0.25)]"
          : "",
        className
      ].join(" ")}
      {...props}
    >
      {children}
    </motion.div>
  );
}
