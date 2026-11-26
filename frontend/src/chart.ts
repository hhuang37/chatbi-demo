import type { ChartSpec, Table } from "./types";

const DATE_PATTERN = /^\d{4}[-/](\d{1,2})([-/](\d{1,2}))?$/;

function parseDateKey(label: string): number | null {
  if (!DATE_PATTERN.test(label)) return null;
  const [y, m, d] = label.split(/[-/]/).map(Number);
  if (m < 1 || m > 12 || (d !== undefined && (d < 1 || d > 31))) return null;
  return Date.UTC(y, m - 1, d ?? 1);
}

export function buildChartSpec(table: Table): ChartSpec | null {
  if (table.rows.length < 2) return null;
  const numeric = table.columns.filter((c) =>
    table.rows.every(
      (row) => typeof row[c] === "number" || row[c] === null,
    ),
  );
  const labelColumn = table.columns.find(
    (c) => !numeric.includes(c) && table.rows.every((row) => row[c] !== null),
  );
  if (!labelColumn || numeric.length === 0) return null;
  const valueColumn = numeric.find(
    (c) => c !== labelColumn && table.rows.some((row) => typeof row[c] === "number"),
  ) ?? numeric[0];
  const dated = table.rows.map((row) => ({
    label: String(row[labelColumn]),
    value: row[valueColumn],
    key: parseDateKey(String(row[labelColumn])),
  }));
  const usable = dated.filter(
    (row) => typeof row.value === "number" && Number.isFinite(row.value),
  );
  if (usable.length < 2) return null;
  if (dated.every((row) => row.key !== null)) {
    dated.sort((a, b) => (a.key ?? 0) - (b.key ?? 0));
    return {
      type: "line",
      labelColumn,
      valueColumn,
      labels: dated.map((r) => r.label),
      values: dated.map((r) => r.value as number),
    };
  }
  usable.sort((a, b) => (b.value as number) - (a.value as number));
  return {
    type: "bar",
    labelColumn,
    valueColumn,
    labels: usable.map((r) => r.label),
    values: usable.map((r) => r.value as number),
  };
}