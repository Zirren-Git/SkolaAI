export const MAX_PAIRS = 18;
const SCALE = 1_000_000;
const numberFormat = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 6,
});
export type PairValues = { x: number; y: number };
export type Pair = PairValues & { id: number };
export type Combination = { mask: number; count: number; x: number; y: number };
export type SortKey = "x" | "y" | "xy" | "yx";
export type Calculation = { pairs: Pair[]; rows: Combination[]; total: number };
export type CalculateInput = {
  pairs: PairValues[];
  limitX: number | null;
  limitY: number | null;
};

export function parseNumber(text: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(text.trim()))
    throw new Error(
      "Använd tal med högst 6 decimaler och punkt som decimaltecken.",
    );
  const number = Number(text);
  if (!Number.isFinite(number) || Math.abs(number) > 1_000_000)
    throw new Error("Värden måste vara mellan −1 000 000 och 1 000 000.");
  return number;
}
export function parsePairs(values: { x: string; y: string }[]): Pair[] {
  return makePairs(
    values.map((pair, id) => {
      const read = (coordinate: "x" | "y") => {
        try {
          return parseNumber(pair[coordinate]);
        } catch (error) {
          throw new Error(
            `Par ${id + 1}, ${coordinate === "x" ? "första" : "andra"} värdet: ${(error as Error).message}`,
          );
        }
      };
      return { x: read("x"), y: read("y") };
    }),
  );
}
export function makePairs(values: PairValues[]): Pair[] {
  if (!values.length) throw new Error("Ange minst ett par med två värden.");
  if (values.length > MAX_PAIRS)
    throw new Error(
      `Högst ${MAX_PAIRS} par stöds. Ta bort en eller flera rader.`,
    );
  // Varje inmatad rad är ett eget par. Koordinater korsas aldrig mellan rader.
  // Även rader med identiska värden behåller varsin identitet i urvalen.
  return values.map(({ x, y }, id) => ({ id, x, y }));
}
export function calculate(input: CalculateInput): Calculation {
  const pairs = makePairs(input.pairs);
  const rows: Combination[] = [];
  const capX =
    input.limitX === null ? Infinity : Math.round(input.limitX * SCALE);
  const capY =
    input.limitY === null ? Infinity : Math.round(input.limitY * SCALE);
  // Every non-empty subset of the supplied pairs appears exactly once.
  // Fixed-point sums avoid rounding errors at a limit (e.g. 0.1 + 0.2).
  // Do not prune on partial sums: a later negative value can make them valid.
  const walk = (
    start: number,
    mask: number,
    x: number,
    y: number,
    count: number,
  ) => {
    for (let i = start; i < pairs.length; i++) {
      const nextX = x + Math.round(pairs[i].x * SCALE);
      const nextY = y + Math.round(pairs[i].y * SCALE);
      const nextMask = mask | (1 << i);
      if (nextX <= capX && nextY <= capY)
        rows.push({
          mask: nextMask,
          count: count + 1,
          x: nextX / SCALE,
          y: nextY / SCALE,
        });
      walk(i + 1, nextMask, nextX, nextY, count + 1);
    }
  };
  walk(0, 0, 0, 0, 0);
  return { pairs, rows, total: 2 ** pairs.length - 1 };
}
export function ratio(a: number, b: number): number | null {
  if (a === 0 && b === 0) return null;
  if (b === 0) return a > 0 ? Infinity : -Infinity;
  return a / b;
}
export function selectRows(
  rows: Combination[],
  sort: SortKey,
  pair: number | null,
  size: number | null,
): Combination[] {
  const selected = rows.filter(
    (row) =>
      (pair === null || (row.mask & (1 << pair)) !== 0) &&
      (size === null || row.count === size),
  );
  return selected.sort((a, b) => {
    if (sort === "x" || sort === "y")
      return a[sort] - b[sort] || a.mask - b.mask;
    const ra = sort === "xy" ? ratio(a.x, a.y) : ratio(a.y, a.x);
    const rb = sort === "xy" ? ratio(b.x, b.y) : ratio(b.y, b.x);
    if (ra === rb) return a.mask - b.mask;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra > rb ? -1 : 1;
  });
}
export function members(row: Combination, pairs: Pair[]): Pair[] {
  return pairs.filter((p) => (row.mask & (1 << p.id)) !== 0);
}
export function format(value: number | null): string {
  if (value === null) return "—";
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  return numberFormat.format(value);
}
export function csv(
  result: Combination[],
  pairs: Pair[],
  names: [string, string],
): string {
  // Quote every cell; neutralize spreadsheet formula injection in custom names.
  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const label = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
  const header = [
    "Par",
    `Summa ${label(names[0])}`,
    `Summa ${label(names[1])}`,
    `${label(names[0])}:${label(names[1])}`,
    `${label(names[1])}:${label(names[0])}`,
  ];
  return (
    "\ufeff" +
    [
      header,
      ...result.map((r) => [
        members(r, pairs)
          .map((p) => `Par ${p.id + 1} (${p.x}; ${p.y})`)
          .join(" + "),
        String(r.x),
        String(r.y),
        format(ratio(r.x, r.y)),
        format(ratio(r.y, r.x)),
      ]),
    ]
      .map((r) => r.map(cell).join(";"))
      .join("\r\n")
  );
}
