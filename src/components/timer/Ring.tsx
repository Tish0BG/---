/** Circular countdown ring. `progress` is 1 at the start and 0 when time is up. */
export function Ring({
  progress,
  size,
  stroke = 6,
  color,
  children,
}: {
  progress: number;
  size: number;
  stroke?: number;
  color: string;
  children?: React.ReactNode;
}) {
  const r = 50 - stroke / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="block h-full w-full -rotate-90">
        <circle className="ring-track" cx="50" cy="50" r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}
