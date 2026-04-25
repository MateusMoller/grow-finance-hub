import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export function GrowHeroArtwork({ className = "" }: { className?: string }) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothPointerX = useSpring(pointerX, { stiffness: 110, damping: 24, mass: 0.7 });
  const smoothPointerY = useSpring(pointerY, { stiffness: 110, damping: 24, mass: 0.74 });

  const haloX = useTransform(smoothPointerX, [-46, 46], [-26, 26]);
  const haloY = useTransform(smoothPointerY, [-46, 46], [-18, 18]);
  const sculptureX = useTransform(smoothPointerX, [-46, 46], [-20, 20]);
  const sculptureY = useTransform(smoothPointerY, [-46, 46], [-16, 16]);
  const sculptureRotate = useTransform(smoothPointerX, [-46, 46], [-7, 7]);
  const ribbonShift = useTransform(smoothPointerX, [-46, 46], [-14, 14]);
  const ribbonLift = useTransform(smoothPointerY, [-46, 46], [-10, 10]);
  const grainShift = useTransform(smoothPointerX, [-46, 46], [-10, 10]);

  const handleIllustrationMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 92;
    const offsetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 92;

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
      className={`relative min-h-[460px] overflow-hidden px-2 py-3 ${className}`.trim()}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(83,96,145,0.16),transparent_24%),radial-gradient(circle_at_72%_20%,rgba(97,108,170,0.10),transparent_18%),radial-gradient(circle_at_46%_62%,rgba(82,98,140,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(246,247,252,0.96)_100%)]" />
      <motion.div
        style={{ x: grainShift }}
        className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,rgba(52,60,95,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(52,60,95,0.03)_1px,transparent_1px)] [background-size:80px_80px] [mask-image:linear-gradient(180deg,black_0%,black_68%,transparent_100%)]"
      />

      <motion.div
        style={{ x: haloX, y: haloY }}
        className="pointer-events-none absolute left-[36%] top-[42%] h-[320px] w-[320px] rounded-full bg-primary/12 blur-3xl"
      />

      <div className="pointer-events-none absolute left-[9%] top-[8%] text-[90px] font-black leading-none tracking-[-0.09em] text-foreground/90 md:text-[126px]">
        GROW
      </div>
      <div className="pointer-events-none absolute bottom-[10%] right-[7%] text-[66px] font-black leading-none tracking-[-0.065em] text-foreground/90 md:text-[92px]">
        Finance
      </div>

      <motion.div
        animate={{ x: [0, 8, 0], opacity: [0.36, 0.76, 0.36] }}
        transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-[12%] top-[10%] text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/60"
      >
        fluxo
      </motion.div>
      <motion.div
        animate={{ x: [0, -9, 0], opacity: [0.34, 0.78, 0.34] }}
        transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
        className="pointer-events-none absolute right-[13%] top-[16%] text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground"
      >
        clareza
      </motion.div>
      <motion.div
        animate={{ x: [0, 9, 0], opacity: [0.34, 0.72, 0.34] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        className="pointer-events-none absolute bottom-[18%] left-[13%] text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground"
      >
        presenca
      </motion.div>
      <motion.div
        animate={{ x: [0, -7, 0], opacity: [0.38, 0.8, 0.38] }}
        transition={{ duration: 5.9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="pointer-events-none absolute bottom-[14%] right-[15%] text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/62"
      >
        decisao
      </motion.div>

      <motion.div style={{ x: sculptureX, y: sculptureY, rotate: sculptureRotate }} className="absolute inset-0">
        <motion.div
          animate={{ rotate: [-12, -7, -12], scale: [1, 1.04, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[16%] left-[14%] h-[270px] w-[165px] rounded-[42%_58%_54%_46%/36%_34%_66%_64%] border border-primary/16 bg-gradient-to-br from-white/72 via-primary/6 to-transparent shadow-[0_34px_78px_-44px_rgba(37,47,81,0.36)] backdrop-blur-[7px]"
        />
        <motion.div
          animate={{ rotate: [18, 12, 18], scaleY: [1, 1.08, 1] }}
          transition={{ duration: 8.3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[38%] top-[22%] h-[208px] w-[126px] border border-primary/12 bg-gradient-to-b from-primary/16 via-white/10 to-transparent [clip-path:polygon(46%_0%,100%_32%,76%_100%,14%_82%,0%_30%)]"
        />
        <motion.div
          animate={{ rotate: [-24, -18, -24], scale: [1, 1.04, 1] }}
          transition={{ duration: 7.1, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[49%] top-[46%] h-[138px] w-[116px] rounded-[42%_58%_60%_40%/48%_38%_62%_52%] bg-primary/22 blur-[1.4px]"
        />
        <motion.div
          animate={{ y: [0, -12, 0], x: [0, 8, 0] }}
          transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[18%] top-[60%] h-[94px] w-[94px] rounded-full border border-primary/16 bg-gradient-to-br from-white/72 to-primary/8 backdrop-blur"
        />
        <motion.div
          animate={{ y: [0, 14, 0], x: [0, -8, 0] }}
          transition={{ duration: 5.7, repeat: Infinity, ease: "easeInOut", delay: 0.45 }}
          className="absolute bottom-[20%] right-[16%] h-[58px] w-[58px] rounded-full bg-primary/16 blur-sm"
        />
        <motion.div
          animate={{ opacity: [0.08, 0.2, 0.08], rotate: [0, 6, 0] }}
          transition={{ duration: 7.4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[12%] top-[14%] h-[210px] w-[210px] rounded-[36px] border border-primary/10"
        />
      </motion.div>

      <motion.svg
        style={{ x: ribbonShift, y: ribbonLift }}
        viewBox="0 0 420 420"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <motion.path
          d="M30 158 C 94 92, 176 86, 260 128 S 382 186, 392 106"
          stroke="hsl(var(--primary) / 0.34)"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
          animate={{ pathLength: [0.82, 1, 0.82], opacity: [0.36, 0.92, 0.36] }}
          transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M58 302 C 138 246, 202 218, 254 240 S 346 308, 392 254"
          stroke="hsl(var(--primary) / 0.18)"
          strokeWidth="1.35"
          fill="none"
          strokeLinecap="round"
          animate={{ pathLength: [0.72, 1, 0.72], opacity: [0.18, 0.6, 0.18] }}
          transition={{ duration: 6.1, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
        />
        <motion.path
          d="M118 58 C 196 120, 248 186, 214 330"
          stroke="hsl(var(--foreground) / 0.08)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          animate={{ opacity: [0.12, 0.34, 0.12] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M330 78 C 354 86, 366 100, 358 126"
          stroke="hsl(var(--primary) / 0.14)"
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
          animate={{ opacity: [0.16, 0.5, 0.16] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />

        <motion.circle
          cx="374"
          cy="118"
          r="5.6"
          fill="hsl(var(--primary))"
          animate={{ cx: [374, 360, 374], cy: [118, 132, 118] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx="374"
          cy="118"
          r="14"
          stroke="hsl(var(--primary) / 0.22)"
          strokeWidth="1.1"
          fill="none"
          animate={{ r: [10, 18, 10], opacity: [0.18, 0.5, 0.18] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx="76"
          cy="290"
          r="5.2"
          fill="hsl(var(--primary) / 0.7)"
          animate={{ cx: [76, 92, 76], cy: [290, 278, 290] }}
          transition={{ duration: 5.1, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
        />
        <motion.circle
          cx="76"
          cy="290"
          r="22"
          stroke="hsl(var(--foreground) / 0.09)"
          strokeWidth="1"
          fill="none"
          animate={{ r: [18, 26, 18], opacity: [0.12, 0.28, 0.12] }}
          transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
        />
      </motion.svg>

      <motion.div
        animate={{ y: [0, -6, 0], opacity: [0.28, 0.62, 0.28], rotate: [0, 6, 0] }}
        transition={{ duration: 4.7, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        className="pointer-events-none absolute right-[16%] top-[20%] h-4 w-4"
      >
        <div className="absolute inset-0 rotate-45 bg-primary/56 blur-[0.2px]" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/75" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/75" />
      </motion.div>

      <div className="pointer-events-none absolute bottom-[12%] right-[11%] flex items-center gap-2 opacity-55">
        <div className="h-px w-10 bg-primary/22" />
        <div className="grid gap-1">
          <div className="h-1.5 w-10 rounded-full bg-primary/18" />
          <div className="h-1.5 w-6 rounded-full bg-primary/12" />
        </div>
      </div>
    </motion.div>
  );
}
