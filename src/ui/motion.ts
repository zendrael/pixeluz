export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const distance = Math.abs(overshoot);
  if (distance === 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * distance);
}

export function projectMomentum(velocity: number, deceleration = 0.998): number {
  return (velocity / 1000) * deceleration / (1 - deceleration);
}

export function trackPanelSize(raw: number, collapsed: number, max: number): number {
  if (raw > max) return max + rubberband(raw - max, max);
  if (raw < collapsed) return collapsed - rubberband(collapsed - raw, max);
  return raw;
}

export function panelSnapTarget(
  current: number,
  velocity: number,
  collapsed: number,
  min: number,
  max: number,
): { open: boolean; size: number } {
  const projected = current + projectMomentum(velocity);
  if (projected < (min + collapsed) / 2) return { open: false, size: collapsed };
  return { open: true, size: Math.max(min, Math.min(max, projected)) };
}

export function releaseVelocity(samples: Array<{ t: number; value: number }>): number {
  const last = samples[samples.length - 1];
  const prev = samples[samples.length - 2];
  if (!last || !prev) return 0;
  const dt = (last.t - prev.t) / 1000;
  if (dt <= 0) return 0;
  return (last.value - prev.value) / dt;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function settleNumber(
  from: number,
  to: number,
  velocity: number,
  onFrame: (value: number) => void,
  onDone: () => void,
): () => void {
  if (prefersReducedMotion() || Math.abs(to - from) < 0.5) {
    onFrame(to);
    onDone();
    return () => {};
  }
  let value = from;
  let speed = velocity;
  const stiffness = 280;
  const damping = 2 * Math.sqrt(stiffness);
  let last = performance.now();
  let frame = 0;
  let stopped = false;
  const step = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    speed += (-stiffness * (value - to) - damping * speed) * dt;
    value += speed * dt;
    if (Math.abs(value - to) < 0.5 && Math.abs(speed) < 24) {
      onFrame(to);
      onDone();
      return;
    }
    onFrame(value);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
  };
}
