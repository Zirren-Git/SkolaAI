import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Grid2X2,
  Info,
  Layers3,
  LoaderCircle,
  Moon,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import {
  csv,
  format,
  MAX_PAIRS,
  members,
  parseNumber,
  parsePairs,
  ratio,
  selectRows,
  type Calculation,
  type SortKey,
} from "./logic";

type Draft = {
  pairs: { key: number; x: string; y: string }[];
  limitX: string;
  limitY: string;
  onX: boolean;
  onY: boolean;
};
const INITIAL: Draft = {
  pairs: [
    { key: 0, x: "2", y: "3" },
    { key: 1, x: "4", y: "5" },
    { key: 2, x: "6", y: "2" },
    { key: 3, x: "3", y: "4" },
  ],
  limitX: "12",
  limitY: "15",
  onX: true,
  onY: false,
};
const PAGE_SIZE = 7;
const pairLetter = (id: number) => String.fromCharCode(65 + id);
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
function App() {
  const [light, setLight] = useState(() => {
    try {
      return localStorage.getItem("parvis-theme") === "light";
    } catch {
      return false;
    }
  });
  // Labels are derived from shared state, never stored in result data. Renaming
  // therefore updates every heading, filter, accessible label and export at once.
  const [names, setNames] = useState<[string, string]>(["x", "y"]);
  const labels: [string, string] = [
    names[0].trim() || "x",
    names[1].trim() || "y",
  ];
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const nextPairKey = useRef(INITIAL.pairs.length);
  const [applied, setApplied] = useState(JSON.stringify(INITIAL));
  const [result, setResult] = useState<Calculation | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("xy");
  const [pairFilter, setPairFilter] = useState<number | null>(null);
  const [sizeFilter, setSizeFilter] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [exported, setExported] = useState(false);
  const [help, setHelp] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const worker = useRef<Worker | null>(null);
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = applied !== JSON.stringify(draft);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  function run(data = draft) {
    try {
      const input = {
        pairs: parsePairs(data.pairs),
        limitX: data.onX ? parseNumber(data.limitX) : null,
        limitY: data.onY ? parseNumber(data.limitY) : null,
      };
      worker.current?.terminate();
      const nextWorker = new Worker(
        new URL("./calculator.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = nextWorker;
      setBusy(true);
      setError("");
      nextWorker.onmessage = ({
        data: response,
      }: MessageEvent<{ result?: Calculation; error?: string }>) => {
        setBusy(false);
        if (response.error) setError(response.error);
        if (response.result) {
          setResult(response.result);
          setApplied(JSON.stringify(data));
          setPage(0);
          setPairFilter(null);
          setSizeFilter(null);
          setExpanded(null);
        }
        nextWorker.terminate();
      };
      nextWorker.onerror = () => {
        setBusy(false);
        setError("Kunde inte starta beräkningen. Försök igen.");
        nextWorker.terminate();
      };
      nextWorker.postMessage(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kontrollera dina värden.");
    }
  }
  useEffect(() => {
    run(INITIAL);
    return () => {
      worker.current?.terminate();
      if (exportTimer.current) clearTimeout(exportTimer.current);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    try {
      localStorage.setItem("parvis-theme", light ? "light" : "dark");
    } catch {
      /* Storage can be disabled. */
    }
  }, [light]);
  useEffect(() => {
    if (help) dialog.current?.showModal();
    else dialog.current?.close();
  }, [help]);
  const rows = useMemo(
    () => selectRows(result?.rows ?? [], sort, pairFilter, sizeFilter),
    [result, sort, pairFilter, sizeFilter],
  );
  const maxRatio = useMemo(() => {
    let max: number | null = null;
    for (const r of result?.rows ?? []) {
      const v = ratio(r.x, r.y);
      if (v !== null && (max === null || v > max)) max = v;
    }
    return max;
  }, [result]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = rows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const setFilter = (type: "pair" | "size", value: string) => {
    const n = value === "" ? null : Number(value);
    if (type === "pair") setPairFilter(n);
    else setSizeFilter(n);
    setPage(0);
    setExpanded(null);
  };
  const reset = () => {
    setDraft(INITIAL);
    setNames(["x", "y"]);
    setSort("xy");
    run(INITIAL);
  };
  const exportCsv = () => {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([csv(rows, result.pairs, labels)], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "parvis-kombinationer.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
    if (exportTimer.current) clearTimeout(exportTimer.current);
    exportTimer.current = setTimeout(() => setExported(false), 2500);
  };
  const sortLabels = {
    x: `Lägst totalt ${labels[0]}`,
    y: `Lägst totalt ${labels[1]}`,
    xy: `Högst ${labels[0]}:${labels[1]}-kvot`,
    yx: `Högst ${labels[1]}:${labels[0]}-kvot`,
  };
  function addPair() {
    if (draft.pairs.length >= MAX_PAIRS) return;
    const key = nextPairKey.current++;
    setDraft((d) => ({ ...d, pairs: [...d.pairs, { key, x: "", y: "" }] }));
    requestAnimationFrame(() =>
      document.getElementById(`pair-${key}-x`)?.focus(),
    );
  }
  function updatePair(key: number, coordinate: "x" | "y", value: string) {
    setDraft((d) => ({
      ...d,
      pairs: d.pairs.map((pair) =>
        pair.key === key ? { ...pair, [coordinate]: value } : pair,
      ),
    }));
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="Parvis startsida">
          <span className="brand-mark">
            <Grid2X2 size={23} strokeWidth={1.7} />
          </span>
          <span>
            parvis<span className="brand-dot">.</span>
          </span>
          <span className="brand-divider" />
          <span className="brand-description">Kombinationsverktyg</span>
        </a>
        <nav aria-label="Huvudnavigation">
          <span className="nav-active">
            <Grid2X2 size={15} />
            Kalkylator
          </span>
          <button onClick={() => setHelp(true)}>
            <CircleHelp size={16} />
            Så fungerar det
          </button>
        </nav>
        <button
          className="theme-button"
          onClick={() => setLight(!light)}
          aria-label={light ? "Byt till mörkt läge" : "Byt till ljust läge"}
        >
          {light ? <Moon size={17} /> : <Sun size={17} />}
          <span>{light ? "Mörkt läge" : "Ljust läge"}</span>
        </button>
      </header>

      <main className="main-content">
        <section className="intro flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="eyebrow">
              <span /> MINDRE GISSA. MER VETA.
            </div>
            <h1>
              Hitta rätt kombination<span>.</span>
            </h1>
            <p>
              Utforska alla möjligheter. Sätt dina gränser. Jämför det som
              räknas.
            </p>
          </div>
          <span className="local-badge">
            <span className="status-dot" />
            Beräknas lokalt i din webbläsare
          </span>
        </section>

        <div className="workspace">
          <aside className="settings-column">
            <form
              className="panel setup-panel"
              onSubmit={(e) => {
                e.preventDefault();
                run();
              }}
            >
              <div className="panel-header">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal size={17} />
                  <h2>Din uppsättning</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title="Återställ exempel"
                  aria-label="Återställ exempel"
                  onClick={reset}
                >
                  <RotateCcw size={15} />
                </button>
              </div>
              <section className="setup-section">
                <h3>
                  <span className="step">01</span>Variabler & par
                </h3>
                <p className="section-description">
                  Ge variablerna egna namn om du vill.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([0, 1] as const).map((i) => (
                    <div key={i}>
                      <label className="field-label" htmlFor={`name-${i}`}>
                        Namn på {i === 0 ? "första" : "andra"} variabeln
                      </label>
                      <div className="name-input-wrap">
                        <span
                          className={`variable-symbol ${i === 1 ? "second" : ""}`}
                        >
                          {labels[i].slice(0, 1)}
                        </span>
                        <input
                          id={`name-${i}`}
                          className="name-input"
                          value={names[i]}
                          maxLength={20}
                          placeholder={i === 0 ? "x" : "y"}
                          onChange={(e) =>
                            setNames((n) =>
                              i === 0
                                ? [e.target.value, n[1]]
                                : [n[0], e.target.value],
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pair-editor">
                  <div className="pair-editor-title">
                    <strong>Dina par</strong>
                    <span>
                      {draft.pairs.length} / {MAX_PAIRS}
                    </span>
                  </div>
                  <p className="section-description">
                    En rad = ett par med två sammanhörande värden.
                  </p>
                  <div className="pair-editor-head" aria-hidden="true">
                    <span>Par</span>
                    <span>{labels[0]}</span>
                    <span>{labels[1]}</span>
                    <span />
                  </div>
                  <div className="pair-editor-rows">
                    {draft.pairs.map((pair, index) => (
                      <div className="pair-editor-row" key={pair.key}>
                        <span className="input-pair-label">
                          <b>{pairLetter(index)}</b>
                          <span>Par {index + 1}</span>
                        </span>
                        {(["x", "y"] as const).map((coordinate, i) => (
                          <input
                            key={coordinate}
                            id={`pair-${pair.key}-${coordinate}`}
                            aria-label={`${labels[i]} för par ${index + 1}`}
                            aria-describedby="value-hint"
                            inputMode="decimal"
                            value={pair[coordinate]}
                            placeholder="0"
                            onChange={(e) =>
                              updatePair(pair.key, coordinate, e.target.value)
                            }
                          />
                        ))}
                        <button
                          type="button"
                          className="icon-button remove-pair"
                          disabled={draft.pairs.length === 1}
                          aria-label={`Ta bort par ${index + 1}`}
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              pairs: d.pairs.filter((p) => p.key !== pair.key),
                            }))
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="add-pair-button"
                    onClick={addPair}
                    disabled={draft.pairs.length >= MAX_PAIRS}
                  >
                    <Plus size={14} />
                    Lägg till par
                  </button>
                  <p className="field-hint" id="value-hint">
                    Ett tal per fält. Använd punkt för decimaler.
                  </p>
                </div>
              </section>
              <section className="setup-section limits-section">
                <h3>
                  <span className="step">02</span>Sätt dina gränser
                  <span className="optional-label">VALFRITT</span>
                </h3>
                <p className="section-description">
                  Summan får vara lika med eller under gränsen.
                </p>
                {([0, 1] as const).map((i) => {
                  const on = i === 0 ? draft.onX : draft.onY;
                  return (
                    <div
                      className={`limit-row ${on ? "" : "limit-off"}`}
                      key={i}
                    >
                      <div className="limit-label">
                        <div className="flex items-center gap-2">
                          <Toggle
                            checked={on}
                            onChange={() =>
                              update(i === 0 ? "onX" : "onY", !on)
                            }
                            label={`Aktivera maxgräns för ${labels[i]}`}
                          />
                          <label htmlFor={`limit-${i}`}>
                            Max summa <strong>{labels[i]}</strong>
                          </label>
                        </div>
                        <span className="limit-status">
                          {on ? "Gräns aktiv" : "Ingen gräns"}
                        </span>
                      </div>
                      <input
                        id={`limit-${i}`}
                        aria-label={`Max summa ${labels[i]}`}
                        inputMode="decimal"
                        value={i === 0 ? draft.limitX : draft.limitY}
                        disabled={!on}
                        onChange={(e) =>
                          update(i === 0 ? "limitX" : "limitY", e.target.value)
                        }
                      />
                    </div>
                  );
                })}
              </section>
              <div className="calculate-section">
                {error && (
                  <p className="error-message" role="alert">
                    <Info size={16} />
                    {error}
                  </p>
                )}
                <button
                  className="primary-button"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {busy ? "Beräknar…" : "Beräkna kombinationer"}
                  {!busy && <ArrowRight size={17} className="ml-auto" />}
                </button>
                <p>Alla unika urval. Inga upprepade par.</p>
              </div>
            </form>
            <div className="tip-card">
              <span className="tip-icon">
                <Info size={17} />
              </span>
              <div>
                <strong>Dina par hålls ihop</strong>
                <p>
                  Vi kombinerar hela par, aldrig enskilda värden mellan rader.
                  Varje par kan ingå högst en gång.
                </p>
                <button onClick={() => setHelp(true)}>
                  Läs om beräkningen <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </aside>

          <section
            className="results-column"
            aria-label="Resultat"
            aria-busy={busy}
          >
            <div className="results-title">
              <div className="flex items-center gap-3">
                <h2>Din överblick</h2>
                <span className={`live-label ${dirty ? "stale" : ""}`}>
                  <span />
                  {busy
                    ? "Beräknar"
                    : dirty
                      ? "Ändringar väntar"
                      : "Uppdaterad"}
                </span>
              </div>
              <span className="result-note">Från värden till insikt</span>
            </div>
            <div className="stats-grid">
              <Stat
                label="Giltiga kombinationer"
                value={result ? format(result.rows.length) : "—"}
                icon={<Layers3 size={17} />}
              >
                <span className="stat-blue">
                  {result ? format(result.total - result.rows.length) : "—"}{" "}
                  bortfiltrerade
                </span>{" "}
                av gränserna
              </Stat>
              <Stat
                label="Möjliga kombinationer"
                value={result ? format(result.total) : "—"}
                icon={<Grid2X2 size={17} />}
              >
                {result?.pairs.length ?? "—"} inmatade par · alla urval
              </Stat>
              <Stat
                label={`Högsta ${labels[0]}:${labels[1]}-kvot`}
                value={format(maxRatio)}
                icon={<ArrowDownWideNarrow size={17} />}
                accent
              >
                {" "}
                Bästa kvoten inom dina gränser
              </Stat>
            </div>
            <div className="panel results-panel">
              <div className="results-panel-heading">
                <div className="flex items-center gap-2.5">
                  <h2>Kombinationer</h2>
                  <span className="count-pill">{format(rows.length)}</span>
                </div>
                <button
                  className="secondary-button export-button"
                  onClick={exportCsv}
                  disabled={busy || !rows.length}
                >
                  {exported ? <Check size={14} /> : <Download size={14} />}
                  {exported ? "Exporterad" : "Exportera CSV"}
                </button>
              </div>
              <div className="filter-bar">
                <div className="filter-select">
                  <label htmlFor="pair-filter">
                    <SlidersHorizontal size={13} />
                    Innehåller par
                  </label>
                  <div className="select-wrap">
                    <select
                      id="pair-filter"
                      value={pairFilter ?? ""}
                      onChange={(e) => setFilter("pair", e.target.value)}
                    >
                      <option value="">Alla par</option>
                      {result?.pairs.map((p) => (
                        <option value={p.id} key={p.id}>
                          {pairLetter(p.id)} · {labels[0]} {format(p.x)},{" "}
                          {labels[1]} {format(p.y)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </div>
                </div>
                <div className="filter-select size-select">
                  <label htmlFor="size-filter">Antal par</label>
                  <div className="select-wrap">
                    <select
                      id="size-filter"
                      value={sizeFilter ?? ""}
                      onChange={(e) => setFilter("size", e.target.value)}
                    >
                      <option value="">Alla storlekar</option>
                      {result?.pairs.map((_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1} par
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </div>
                </div>
                <div className="filter-select sort-select">
                  <label htmlFor="sort">
                    <ArrowDownWideNarrow size={13} />
                    Sortera efter
                  </label>
                  <div className="select-wrap">
                    <select
                      id="sort"
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value as SortKey);
                        setPage(0);
                        setExpanded(null);
                      }}
                    >
                      {Object.entries(sortLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </div>
                </div>
              </div>
              {dirty && (
                <div className="stale-banner">
                  <Info size={14} />
                  Du har ändrat indata. Beräkna igen för att uppdatera
                  resultaten.
                </div>
              )}
              {(pairFilter !== null || sizeFilter !== null) && (
                <div className="active-filters">
                  <span>
                    {pairFilter !== null
                      ? `Innehåller par ${pairLetter(pairFilter)}`
                      : ""}
                    {pairFilter !== null && sizeFilter !== null ? " · " : ""}
                    {sizeFilter !== null
                      ? `${sizeFilter} par per kombination`
                      : ""}
                  </span>
                  <button
                    onClick={() => {
                      setPairFilter(null);
                      setSizeFilter(null);
                      setPage(0);
                    }}
                  >
                    Rensa filter <X size={12} />
                  </button>
                </div>
              )}
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th className="index-cell">#</th>
                      <th>Kombination</th>
                      <th className={sort === "x" ? "sorted-col" : ""}>
                        Summa {labels[0]}
                        {sort === "x" && <span> ↑</span>}
                      </th>
                      <th className={sort === "y" ? "sorted-col" : ""}>
                        Summa {labels[1]}
                        {sort === "y" && <span> ↑</span>}
                      </th>
                      <th className={sort === "xy" ? "sorted-col" : ""}>
                        {labels[0]}:{labels[1]}
                        {sort === "xy" && <span> ↓</span>}
                      </th>
                      <th className={sort === "yx" ? "sorted-col" : ""}>
                        {labels[1]}:{labels[0]}
                        {sort === "yx" && <span> ↓</span>}
                      </th>
                      <th className="expand-cell">
                        <span className="sr-only">Detaljer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row, index) => (
                      <ResultRow
                        key={row.mask}
                        row={row}
                        pairs={result!.pairs}
                        index={currentPage * PAGE_SIZE + index + 1}
                        sort={sort}
                        names={labels}
                        expanded={expanded === row.mask}
                        onExpand={() =>
                          setExpanded(expanded === row.mask ? null : row.mask)
                        }
                      />
                    ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <div className="empty-state">
                    <span>
                      <Layers3 size={27} />
                    </span>
                    <h3>
                      {busy
                        ? "Vi räknar på möjligheterna…"
                        : "Inga kombinationer hittades"}
                    </h3>
                    <p>
                      {pairFilter !== null || sizeFilter !== null
                        ? "Prova ett annat par eller ta bort dina filter."
                        : "Höj dina gränser eller ändra värdena och beräkna igen."}
                    </p>
                    {(pairFilter !== null || sizeFilter !== null) && (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setPairFilter(null);
                          setSizeFilter(null);
                        }}
                      >
                        Rensa filter
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="table-footer">
                <span aria-live="polite">
                  Visar{" "}
                  <strong>
                    {rows.length ? currentPage * PAGE_SIZE + 1 : 0}–
                    {Math.min((currentPage + 1) * PAGE_SIZE, rows.length)}
                  </strong>{" "}
                  av <strong>{format(rows.length)}</strong>
                </span>
                <div className="pagination">
                  <button
                    className="icon-button"
                    aria-label="Föregående sida"
                    disabled={currentPage === 0}
                    onClick={() => {
                      setPage(currentPage - 1);
                      setExpanded(null);
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>
                    Sida {currentPage + 1} av {format(pageCount)}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Nästa sida"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => {
                      setPage(currentPage + 1);
                      setExpanded(null);
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="results-footnote">
              <Info size={14} />
              <span>
                Kvoter beräknas på summorna. ∞ = oändlig kvot, — = odefinierad
                (0/0).
              </span>
            </div>
            <div className="workflow-note">
              <div className="workflow-icon">
                <CheckCheck size={19} />
              </div>
              <div>
                <strong>Alla möjligheter. Bara relevanta resultat.</strong>
                <p>
                  Vi testar varje unikt urval och behåller de kombinationer som
                  håller dina gränser.
                </p>
              </div>
            </div>
          </section>
        </div>
        <footer className="page-footer">
          <span>
            <span className="footer-brand">parvis.</span> Lite mindre manuellt.
            Lite mer möjligt.
          </span>
          <span>
            <span className="status-dot" />
            Ingen data lämnar din webbläsare
          </span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="help-dialog"
        aria-labelledby="help-title"
        onCancel={() => setHelp(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setHelp(false);
        }}
      >
        <div className="dialog-content">
          <div className="flex items-center justify-between">
            <span className="eyebrow">SÅ FUNGERAR PARVIS</span>
            <button
              autoFocus
              className="icon-button"
              aria-label="Stäng hjälp"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
          </div>
          <h2 id="help-title">Från värden till kombinationer.</h2>
          <p>
            Varje rad är en egen uppsättning: ett värde för{" "}
            <strong>{labels[0]}</strong> och ett för{" "}
            <strong>{labels[1]}</strong>. De två värdena hålls alltid ihop.
            Parvis skapar inga nya par genom att korsa värden mellan rader.
          </p>
          <div className="help-example">
            <span>Par 1: (2; 3)</span>
            <Plus size={14} />
            <span>Par 2: (4; 5)</span>
            <ArrowRight size={15} />
            <span>Summa: (6; 8)</span>
          </div>
          <h3>Varje unikt urval räknas</h3>
          <p>
            Med dessa två par finns tre kombinationer: enbart par 1, enbart par
            2 och båda paren tillsammans. Varje inmatat par används högst en
            gång per kombination. Ordningen spelar ingen roll och det tomma
            urvalet räknas inte. Två rader med samma värden räknas som två
            separata par, inte som en dubblett som ska tas bort.
          </p>
          <h3>Gränser och kvoter</h3>
          <p>
            För varje urval summeras {labels[0]} och {labels[1]} separat. Aktiva
            maxgränser är inkluderande. Kvoten {labels[0]}:{labels[1]} är summa{" "}
            {labels[0]} delat med summa {labels[1]}. Ett tal delat med noll
            visas som ∞ eller −∞; 0/0 visas som — och sorteras sist.
          </p>
          <h3>Få par, många möjligheter</h3>
          <p>
            Med n inmatade par finns 2ⁿ − 1 urval. Upp till 18 par (262 143
            urval) stöds. Negativa tal och noll är tillåtna. Använd punkt för
            decimaler, högst sex decimaler, och tal mellan −1 000 000 och 1 000
            000.
          </p>
          <p>
            Parfiltret visar urval som innehåller det valda paret. CSV-exporten
            innehåller alla filtrerade rader i den valda sorteringsordningen,
            inte bara den aktuella sidan.
          </p>
          <button className="primary-button" onClick={() => setHelp(false)}>
            Jag förstår <ArrowRight size={16} />
          </button>
        </div>
      </dialog>
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  accent,
  children,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`stat-card ${accent ? "accent-stat" : ""}`}>
      <div className="stat-label">
        <span>{label}</span>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <p>{children}</p>
    </div>
  );
}
function ResultRow({
  row,
  pairs,
  index,
  sort,
  names,
  expanded,
  onExpand,
}: {
  row: import("./logic").Combination;
  pairs: import("./logic").Pair[];
  index: number;
  sort: SortKey;
  names: [string, string];
  expanded: boolean;
  onExpand: () => void;
}) {
  const selected = members(row, pairs);
  return (
    <>
      <tr className={expanded ? "expanded-row" : ""}>
        <td className="index-cell">{String(index).padStart(2, "0")}</td>
        <td>
          <div className="combination-pairs">
            {selected.slice(0, 3).map((p, i) => (
              <span className="pair-with-plus" key={p.id}>
                {i > 0 && <span className="pair-plus">+</span>}
                <span
                  className="table-pair"
                  title={`${names[0]}: ${format(p.x)}, ${names[1]}: ${format(p.y)}`}
                >
                  {pairLetter(p.id)}
                </span>
              </span>
            ))}
            {selected.length > 3 && (
              <span className="extra-pairs">+{selected.length - 3}</span>
            )}
            <span className="pair-count">{row.count} par</span>
          </div>
        </td>
        <td className={sort === "x" ? "sorted-value" : ""}>{format(row.x)}</td>
        <td className={sort === "y" ? "sorted-value" : ""}>{format(row.y)}</td>
        <td className={sort === "xy" ? "sorted-value" : "ratio-value"}>
          {format(ratio(row.x, row.y))}
        </td>
        <td className={sort === "yx" ? "sorted-value" : "ratio-value"}>
          {format(ratio(row.y, row.x))}
        </td>
        <td className="expand-cell">
          <button
            className="row-expand"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Dölj" : "Visa"} detaljer för kombination ${index}`}
            onClick={onExpand}
          >
            <ChevronRight size={15} className={expanded ? "rotate-90" : ""} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={7}>
            <div className="detail-content">
              <strong>Kombination {index}</strong>
              <div>
                {selected.map((p) => (
                  <span key={p.id}>
                    <b>{pairLetter(p.id)}</b>
                    {names[0]}: {format(p.x)} <span className="muted">/</span>{" "}
                    {names[1]}: {format(p.y)}
                  </span>
                ))}
              </div>
              <p>
                Summa {names[0]}:{" "}
                {selected
                  .map((p) => (p.x < 0 ? `(${format(p.x)})` : format(p.x)))
                  .join(" + ")}{" "}
                = {format(row.x)}
                <br />
                Summa {names[1]}:{" "}
                {selected
                  .map((p) => (p.y < 0 ? `(${format(p.y)})` : format(p.y)))
                  .join(" + ")}{" "}
                = {format(row.y)}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
export default App;
