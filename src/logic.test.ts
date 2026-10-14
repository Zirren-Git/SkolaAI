import { describe, expect, it } from "vitest";
import {
  calculate,
  csv,
  format,
  makePairs,
  members,
  parseNumber,
  parsePairs,
  ratio,
  selectRows,
  type CalculateInput,
} from "./logic";
const base: CalculateInput = {
  pairs: [
    { x: 2, y: 3 },
    { x: 4, y: 3 },
  ],
  limitX: null,
  limitY: null,
};

describe("input validation", () => {
  it("parses row values without crossing or deduplicating them", () => {
    expect(
      parsePairs([
        { x: "2", y: "3" },
        { x: "-4", y: ".5" },
      ]),
    ).toEqual([
      { id: 0, x: 2, y: 3 },
      { id: 1, x: -4, y: 0.5 },
    ]);
  });
  it.each(["", " ", "hello", "Infinity", "NaN", "1e9", "1.1234567", "1000001"])(
    "rejects invalid input %s",
    (text) => expect(() => parseNumber(text)).toThrow(),
  );
  it("accepts the numeric boundaries", () => {
    expect(parseNumber("-1000000")).toBe(-1000000);
    expect(parseNumber("0.000001")).toBe(0.000001);
  });
  it("validates limits independently", () =>
    expect(() => parseNumber("")).toThrow());
  it("rejects more than 18 pairs before enumerating", () =>
    expect(() =>
      makePairs(Array.from({ length: 19 }, () => ({ x: 1, y: 2 }))),
    ).toThrow(/18/));
  it("rejects empty arrays", () => expect(() => makePairs([])).toThrow());
});
describe("combinatorial engine", () => {
  it("only combines the supplied pairs, never a Cartesian product", () => {
    const pairs = [
      { x: 2, y: 3 },
      { x: 4, y: 5 },
    ];
    expect(makePairs(pairs)).toEqual([
      { id: 0, x: 2, y: 3 },
      { id: 1, x: 4, y: 5 },
    ]);
    const result = calculate({ ...base, pairs });
    expect(result.total).toBe(3);
    expect(result.rows.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 2, y: 3 },
      { x: 6, y: 8 },
      { x: 4, y: 5 },
    ]);
  });
  it("keeps identical rows as distinct selectable pairs", () => {
    const result = calculate({
      ...base,
      pairs: [
        { x: 2, y: 3 },
        { x: 2, y: 3 },
      ],
    });
    expect(result.rows).toHaveLength(3);
    expect(selectRows(result.rows, "x", 1, null).map((r) => r.mask)).toEqual([
      2, 3,
    ]);
    expect(
      members(result.rows.find((r) => r.mask === 3)!, result.pairs),
    ).toHaveLength(2);
    expect(csv(result.rows, result.pairs, ["x", "y"])).toContain(
      "Par 1 (2; 3) + Par 2 (2; 3)",
    );
  });
  it("identifies the row and coordinate of a missing value", () => {
    expect(() =>
      parsePairs([
        { x: "2", y: "3" },
        { x: "4", y: "" },
      ]),
    ).toThrow(/Par 2, andra värdet/);
  });
  it("supports a single input pair", () => {
    expect(calculate({ ...base, pairs: [{ x: 2, y: 3 }] }).rows).toEqual([
      { mask: 1, count: 1, x: 2, y: 3 },
    ]);
  });
  it("enumerates all non-empty subsets without repetition", () => {
    const r = calculate(base);
    expect(r.total).toBe(3);
    expect(r.rows).toHaveLength(3);
    expect(new Set(r.rows.map((r) => r.mask)).size).toBe(3);
    expect(r.rows.find((r) => r.mask === 3)).toEqual({
      mask: 3,
      count: 2,
      x: 6,
      y: 6,
    });
  });
  it("supports either limit, both limits, and inclusive boundaries", () => {
    expect(calculate({ ...base, limitX: 4 }).rows.map((r) => r.x)).toEqual([
      2, 4,
    ]);
    expect(calculate({ ...base, limitY: 3 }).rows).toHaveLength(2);
    expect(calculate({ ...base, limitX: 2, limitY: 3 }).rows).toHaveLength(1);
    expect(calculate({ ...base, limitX: 1 }).rows).toHaveLength(0);
  });
  it("does not drop a valid later subset because of negative values", () => {
    const r = calculate({
      pairs: [
        { x: 5, y: 1 },
        { x: -4, y: 1 },
      ],
      limitX: 1,
      limitY: null,
    });
    expect(r.rows.find((r) => r.mask === 3)?.x).toBe(1);
  });
  it("uses exact fixed-point sums at decimal boundaries", () => {
    const r = calculate({
      pairs: [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.1 },
      ],
      limitX: 0.3,
      limitY: 0.2,
    });
    expect(r.rows.find((r) => r.mask === 3)).toMatchObject({ x: 0.3, y: 0.2 });
  });
  it("retains distinct subsets with equal totals", () => {
    const r = calculate({
      pairs: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      limitX: null,
      limitY: null,
    });
    expect(r.rows).toHaveLength(15);
    expect(r.rows.filter((r) => r.x === 1 && r.y === 1).length).toBeGreaterThan(
      1,
    );
  });
  it("handles the maximum supported search space", () => {
    const r = calculate({
      pairs: Array.from({ length: 18 }, (_, i) => ({ x: i + 1, y: 1 })),
      limitX: null,
      limitY: null,
    });
    expect(r.total).toBe(262143);
    expect(r.rows).toHaveLength(r.total);
  });
});
describe("sorting, filtering and export", () => {
  const r = calculate(base);
  it("sorts by both totals", () => {
    expect(selectRows(r.rows, "x", null, null).map((r) => r.x)).toEqual([
      2, 4, 6,
    ]);
    expect(selectRows(r.rows, "y", null, null).map((r) => r.y)).toEqual([
      3, 3, 6,
    ]);
  });
  it("sorts by both ratios", () => {
    expect(selectRows(r.rows, "xy", null, null).map((r) => r.mask)).toEqual([
      2, 3, 1,
    ]);
    expect(selectRows(r.rows, "yx", null, null).map((r) => r.mask)).toEqual([
      1, 3, 2,
    ]);
  });
  it("filters by pair membership and size, without mutating the input", () => {
    expect(selectRows(r.rows, "x", 0, 2).map((r) => r.mask)).toEqual([3]);
    expect(r.rows).toHaveLength(3);
    expect(members(r.rows.find((r) => r.mask === 3)!, r.pairs)).toHaveLength(2);
  });
  it("handles zero denominators and sorts undefined last", () => {
    expect(ratio(2, 0)).toBe(Infinity);
    expect(ratio(-2, 0)).toBe(-Infinity);
    expect(ratio(0, 0)).toBeNull();
    const rows = [0, -1, 1].map((x, mask) => ({ x, y: 0, mask, count: 1 }));
    expect(selectRows(rows, "xy", null, null).map((r) => r.x)).toEqual([
      1, -1, 0,
    ]);
    expect(format(null)).toBe("—");
    expect(format(Infinity)).toBe("∞");
    expect(format(-Infinity)).toBe("−∞");
  });
  it("exports custom labels, all selected rows and escaped cells", () => {
    const output = csv(r.rows, r.pairs, ["CO2", 'Pris "kr"']);
    expect(output).toContain('"Summa CO2"');
    expect(output).toContain('"Summa Pris ""kr"""');
    expect(output.split("\r\n")).toHaveLength(4);
    expect(csv([], r.pairs, ["=SUM(1)", "y"])).toContain("'=SUM(1):y");
  });
});
