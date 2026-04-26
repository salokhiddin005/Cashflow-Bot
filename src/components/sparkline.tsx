// Tiny inline SVG sparkline. No charting library — just a path + an area
// fill. Designed to sit inside a KPI card and read at a glance.

export function Sparkline({
  data,
  color = "currentColor",
  width = 120,
  height = 36,
  strokeWidth = 1.5,
}: {
  data: { day: string; value: number }[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} />;
  }
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const padX = 2;
  const padY = 3;

  const pts = data.map((d, i) => {
    const x = padX + (i * (width - padX * 2)) / (data.length - 1);
    const y = height - padY - ((d.value - min) / range) * (height - padY * 2);
    return [x, y] as const;
  });

  const linePath = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${height} L ${pts[0][0]} ${height} Z`;

  // Use a unique gradient id per render so multiple sparklines don't share
  const gradId = `spark-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label={`14-day trend, ${data.length} points`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill={color} />
    </svg>
  );
}
