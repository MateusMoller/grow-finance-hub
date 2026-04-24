import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export function GrowHeroArtwork({ className = "" }: { className?: string }) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothPointerX = useSpring(pointerX, { stiffness: 120, damping: 22, mass: 0.7 });
  const smoothPointerY = useSpring(pointerY, { stiffness: 120, damping: 22, mass: 0.7 });
  const sculptureX = useTransform(smoothPointerX, [-40, 40], [-18, 18]);
  const sculptureY = useTransform(smoothPointerY, [-40, 40], [-14, 14]);
  const haloX = useTransform(smoothPointerX, [-40, 40], [-28, 28]);
  const haloY = useTransform(smoothPointerY, [-40, 40], [-18, 18]);
  const illustrationRotate = useTransform(smoothPointerX, [-40, 40], [-8, 8]);
  const ribbonShift = useTransform(smoothPointerX, [-40, 40], [-12, 12]);
  const ribbonLift = useTransform(smoothPointerY, [-40, 40], [-10, 10]);

  const handleIllustrationMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 80;
    const offsetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 80;

    pointerX.set(offsetX);
    pointerY.set(offsetY);
  };

  const handleIllustrationLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleIllustrationMove}
      onMouseLeave={handleIllustrationLeave}
      className={`relative min-h-[460px] overflow-hidden rounded-[38px] px-2 py-3 ${className}`.trim()}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(82,98,140,0.18),transparent_26%),radial-gradient(circle_at_76%_24%,rgba(82,98,140,0.12),transparent_22%),radial-gradient(circle_at_52%_58%,rgba(82,98,140,0.12),transparent_34%)]" />
      <div className="pointer-events-none absolute left-5 top-4 text-[88px] font-black leading-none tracking-[-0.08em] text-primary/7 dark:text-white/5 md:text-[118px]">
        GROW
      </div>
      <div className="pointer-events-none absolute bottom-1 right-2 text-[64px] font-black leading-none tracking-[-0.06em] text-primary/7 dark:text-white/5 md:text-[88px]">
        Finance
      </div>

      <motion.div
        style={{ x: haloX, y: haloY }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl"
      />

      <motion.div style={{ x: sculptureX, y: sculptureY, rotate: illustrationRotate }} className="absolute inset-0">
        <motion.div
          animate={{ rotate: [-14, -8, -14], scale: [1, 1.04, 1] }}
          transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[4%] left-[10%] h-[280px] w-[190px] rounded-[44%_56%_52%_48%/40%_38%_62%_60%] border border-primary/18 bg-gradient-to-br from-primary/16 via-background/20 to-transparent shadow-[0_28px_70px_-36px_rgba(37,47,81,0.35)] backdrop-blur-[6px]"
        />
        <motion.div
          animate={{ rotate: [22, 16, 22], scaleY: [1, 1.08, 1] }}
          transition={{ duration: 7.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[34%] top-[20%] h-[245px] w-[160px] border border-primary/22 bg-gradient-to-b from-primary/20 via-background/10 to-transparent [clip-path:polygon(50%_0%,100%_34%,78%_100%,14%_84%,0%_28%)]"
        />
        <motion.div
          animate={{ rotate: [-28, -18, -28], scale: [1, 1.05, 1] }}
          transition={{ duration: 6.9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[49%] top-[44%] h-[150px] w-[122px] rounded-[42%_58%_60%_40%/46%_36%_64%_54%] bg-primary/20 blur-[2px]"
        />
        <motion.div
          animate={{ y: [0, -18, 0], x: [0, 10, 0] }}
          transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[12%] top-[68%] h-24 w-24 rounded-full border border-primary/20 bg-gradient-to-br from-background/60 to-primary/10 backdrop-blur"
        />
        <motion.div
          animate={{ y: [0, 14, 0], x: [0, -8, 0] }}
          transition={{ duration: 6.1, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute bottom-[14%] right-[10%] h-16 w-16 rounded-full bg-primary/18 blur-sm"
        />
      </motion.div>

      <motion.svg style={{ x: ribbonShift, y: ribbonLift }} viewBox="0 0 420 420" className="pointer-events-none absolute inset-0 h-full w-full">
        <motion.path
          d="M28 156 C 88 94, 170 86, 256 132 S 382 186, 392 108"
          stroke="hsl(var(--primary) / 0.42)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="5 10"
          animate={{ pathLength: [0.82, 1, 0.82], opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M54 300 C 144 250, 202 212, 254 240 S 350 310, 396 250"
          stroke="hsl(var(--primary) / 0.28)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          animate={{ pathLength: [0.7, 1, 0.7], opacity: [0.18, 0.65, 0.18] }}
          transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
        <motion.path
          d="M108 58 C 188 118, 246 184, 206 338"
          stroke="hsl(var(--foreground) / 0.12)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          animate={{ opacity: [0.16, 0.4, 0.16] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx="392"
          cy="108"
          r="6"
          fill="hsl(var(--primary))"
          animate={{ cx: [392, 368, 392], cy: [108, 126, 108] }}
          transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx="54"
          cy="300"
          r="5"
          fill="hsl(var(--primary) / 0.7)"
          animate={{ cx: [54, 72, 54], cy: [300, 286, 300] }}
          transition={{ duration: 4.9, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
      </motion.svg>

      <motion.div
        animate={{ x: [0, 8, 0], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-10 top-10 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70"
      >
        fluxo
      </motion.div>
      <motion.div
        animate={{ x: [0, -10, 0], opacity: [0.4, 0.82, 0.4] }}
        transition={{ duration: 6.1, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="pointer-events-none absolute right-10 top-24 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
      >
        clareza
      </motion.div>
      <motion.div
        animate={{ x: [0, 12, 0], opacity: [0.4, 0.78, 0.4] }}
        transition={{ duration: 5.7, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        className="pointer-events-none absolute bottom-20 left-12 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
      >
        presença
      </motion.div>
      <motion.div
        animate={{ x: [0, -8, 0], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 6.3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="pointer-events-none absolute bottom-14 right-10 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70"
      >
        decisão
      </motion.div>
    </motion.div>
  );
}
