import { useInstruments } from '@/state/instrumentStore';

/**
 * A guide grid drawn over the page — squares for proportions, isometric lines
 * for 3D sketches, and a polar rose for angles.
 *
 * It is pure CSS gradients rather than an SVG or a canvas: the browser
 * repaints a gradient for free while scrolling, and the grid has to stay
 * fixed to the screen anyway, not to the paper.
 */
export function GridOverlayLayer() {
  const grid = useInstruments((s) => s.grid);
  const size = useInstruments((s) => s.gridSize);
  const step = useInstruments((s) => s.gridStep);

  if (grid === 'off') return null;

  if (grid === 'polar') return <PolarGrid step={step} size={size} />;

  const line = 'color-mix(in srgb, var(--c-accent) 26%, transparent)';
  const strong = 'color-mix(in srgb, var(--c-accent) 42%, transparent)';

  const style: React.CSSProperties =
    grid === 'dots'
      ? {
          backgroundImage: `radial-gradient(${strong} 1.1px, transparent 1.1px)`,
          backgroundSize: `${size}px ${size}px`,
        }
      : grid === 'iso'
        ? {
            backgroundImage: [
              `repeating-linear-gradient(60deg, ${line} 0 1px, transparent 1px ${size}px)`,
              `repeating-linear-gradient(-60deg, ${line} 0 1px, transparent 1px ${size}px)`,
              `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px ${size}px)`,
            ].join(','),
          }
        : {
            backgroundImage: [
              `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px ${size}px)`,
              `repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px ${size}px)`,
              `repeating-linear-gradient(0deg, ${strong} 0 1px, transparent 1px ${size * 5}px)`,
              `repeating-linear-gradient(90deg, ${strong} 0 1px, transparent 1px ${size * 5}px)`,
            ].join(','),
          };

  return <div className="pointer-events-none absolute inset-0" style={style} aria-hidden />;
}

/** Rays every `step` degrees plus rings, for measuring and setting angles. */
function PolarGrid({ step, size }: { step: number; size: number }) {
  const rays: React.ReactNode[] = [];
  const count = Math.max(4, Math.round(360 / step));
  for (let i = 0; i < count; i++) {
    const deg = i * step;
    const major = deg % 90 === 0;
    rays.push(
      <line
        key={deg}
        x1="50%"
        y1="50%"
        x2={`${50 + 75 * Math.cos((deg * Math.PI) / 180)}%`}
        y2={`${50 + 75 * Math.sin((deg * Math.PI) / 180)}%`}
        stroke="var(--c-accent)"
        strokeWidth={major ? 1.2 : 0.7}
        opacity={major ? 0.4 : 0.22}
      />,
    );
  }
  const rings: React.ReactNode[] = [];
  for (let r = size; r < 900; r += size * 2) {
    rings.push(
      <circle key={r} cx="50%" cy="50%" r={r} fill="none" stroke="var(--c-accent)" strokeWidth={0.7} opacity={0.2} />,
    );
  }
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {rings}
      {rays}
      {[0, 90, 180, 270].map((deg) => (
        <text
          key={deg}
          x={`${50 + 40 * Math.cos((deg * Math.PI) / 180)}%`}
          y={`${50 + 40 * Math.sin((deg * Math.PI) / 180)}%`}
          fontSize={10}
          textAnchor="middle"
          fill="var(--c-accent)"
          opacity={0.5}
        >
          {deg}°
        </text>
      ))}
    </svg>
  );
}
