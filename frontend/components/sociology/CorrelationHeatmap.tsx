"use client";

interface CorrelationHeatmapProps {
  crimeTypes: string[];
  matrix: Array<Record<string, string | number>>;
}

/** Age-group x crime-type heatmap; cell intensity scales with count. */
export default function CorrelationHeatmap({ crimeTypes, matrix }: CorrelationHeatmapProps) {
  // Max count across all cells for color normalization.
  let max = 1;
  for (const row of matrix) {
    for (const ct of crimeTypes) {
      const v = Number(row[ct] ?? 0);
      if (v > max) max = v;
    }
  }

  const color = (value: number) => {
    const ratio = value / max;
    // teal scale, darker = higher
    const alpha = 0.12 + ratio * 0.88;
    return `rgba(13, 148, 136, ${alpha})`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left text-zinc-400">Age \ Crime</th>
            {crimeTypes.map((ct) => (
              <th key={ct} className="p-2 text-center font-medium text-zinc-400">
                {ct}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={String(row.age_group)}>
              <td className="p-2 font-medium text-zinc-300">{String(row.age_group)}</td>
              {crimeTypes.map((ct) => {
                const value = Number(row[ct] ?? 0);
                return (
                  <td
                    key={ct}
                    className="p-2 text-center text-zinc-100"
                    style={{ background: color(value) }}
                    title={`${row.age_group} · ${ct}: ${value}`}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
