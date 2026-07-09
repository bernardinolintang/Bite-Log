import { weekdayLetter } from "@/lib/dates";

export default function TrendChart({
  data,
  target,
}: {
  data: { date: string; calories: number }[];
  target: number | null;
}) {
  const W = 340;
  const H = 150;
  const PAD_TOP = 22;
  const PAD_BOTTOM = 20;
  const baseline = H - PAD_BOTTOM;
  const max = Math.max(target ?? 0, ...data.map((d) => d.calories), 1);
  const y = (v: number) => PAD_TOP + (baseline - PAD_TOP) * (1 - v / max);
  const slot = W / data.length;
  const barW = Math.min(28, slot - 8);
  const last = data.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Calories over the last 7 days" className="w-full">
      <clipPath id="trend-clip">
        <rect x="0" y="0" width={W} height={baseline} />
      </clipPath>
      <line x1="0" x2={W} y1={baseline} y2={baseline} stroke="#e7e5e4" strokeWidth="1" />
      {target != null && (
        <g>
          <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="#a8a29e" strokeWidth="1" strokeDasharray="4 3" />
          <text x={W - 2} y={y(target) - 4} textAnchor="end" fontSize="9" fill="#78716c">
            target
          </text>
        </g>
      )}
      <g clipPath="url(#trend-clip)">
        {data.map((d, i) => {
          const x = i * slot + (slot - barW) / 2;
          const barY = y(d.calories);
          const h = baseline - barY;
          return (
            <g key={d.date}>
              <title>{`${d.date}: ${Math.round(d.calories)} kcal`}</title>
              <rect x={x} y={barY} width={barW} height={h + 4} rx="4" fill={i === last ? "#059669" : "#34d399"} />
            </g>
          );
        })}
      </g>
      {data.map((d, i) => (
        <text key={d.date} x={i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#78716c">
          {weekdayLetter(d.date)}
        </text>
      ))}
      {data[last] && data[last].calories > 0 && (
        <text
          x={last * slot + slot / 2}
          y={y(data[last].calories) - 6}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill="#44403c"
        >
          {Math.round(data[last].calories)}
        </text>
      )}
    </svg>
  );
}
