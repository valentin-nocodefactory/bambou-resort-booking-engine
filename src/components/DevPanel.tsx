import { useState, useSyncExternalStore } from "react";
import { apiLog, type ApiLogEntry } from "../lib/apiLog";
import { IconChevron, IconClose } from "./icons";

function useApiLog(): ApiLogEntry[] {
  return useSyncExternalStore(apiLog.subscribe, apiLog.getAll, apiLog.getAll);
}

// ── Arbre JSON repliable (ouvrir/fermer chaque objet & array) ────────────────
function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-pink-300">null</span>;
  if (value === undefined) return <span className="text-cream/40">undefined</span>;
  const t = typeof value;
  if (t === "string") return <span className="text-emerald-300 break-all">"{value as string}"</span>;
  if (t === "number") return <span className="text-sky-300">{String(value)}</span>;
  if (t === "boolean") return <span className="text-amber-300">{String(value)}</span>;
  return <span className="text-cream/70">{String(value)}</span>;
}

function JsonNode({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 1); // racine ouverte, le reste replié
  const isObj = value !== null && typeof value === "object";

  if (!isObj) {
    return (
      <div className="break-words">
        {name !== undefined && <span className="text-turquoise-vivid">{name}</span>}
        {name !== undefined && <span className="text-cream/40">: </span>}
        <Primitive value={value} />
      </div>
    );
  }

  const isArr = Array.isArray(value);
  const entries: [string, unknown][] = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const summary = isArr ? `Array(${(value as unknown[]).length})` : `{${entries.length}}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-1 text-left transition hover:text-cream"
      >
        <IconChevron className={`mt-[3px] h-3 w-3 shrink-0 text-cream/40 transition-transform ${open ? "rotate-90" : ""}`} />
        <span>
          {name !== undefined && <span className="text-turquoise-vivid">{name}</span>}
          {name !== undefined && <span className="text-cream/40">: </span>}
          <span className="text-cream/45">{summary}</span>
        </span>
      </button>
      {open && (
        <div className="ml-2 border-l border-white/10 pl-2.5">
          {entries.slice(0, 200).map(([k, v]) => (
            <JsonNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
          {entries.length > 200 && (
            <div className="text-[10px] text-cream/30">… {entries.length - 200} éléments de plus</div>
          )}
        </div>
      )}
    </div>
  );
}

const JsonTree = ({ value }: { value: unknown }) => (
  <div className="overflow-x-auto rounded-lg bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-cream/80">
    <JsonNode value={value} depth={0} />
  </div>
);

// ── Dev Panel ─────────────────────────────────────────────────────────────────
export function DevPanel() {
  const entries = useApiLog();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"calls" | "sources">("calls");
  const [expanded, setExpanded] = useState<number | null>(null);
  const pending = entries.some((e) => e.pending);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 left-4 z-[60] inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 font-mono text-xs font-semibold text-cream shadow-float transition hover:bg-teal-deep"
        aria-expanded={open}
        aria-label="Journal des appels API"
      >
        <span className="relative flex h-2 w-2">
          {pending && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-turquoise-vivid opacity-75" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${pending ? "bg-turquoise-vivid" : "bg-turquoise"}`} />
        </span>
        {"</>"} API
        {entries.length > 0 && (
          <span className="rounded-full bg-turquoise-vivid px-1.5 text-[10px] text-ink">{entries.length}</span>
        )}
      </button>

      {open && (
        <section
          className="fixed bottom-16 left-4 z-[60] flex max-h-[74vh] w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink text-cream shadow-float"
          aria-label="Journal des appels API Mews"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Tab active={view === "calls"} onClick={() => setView("calls")}>
                Appels{entries.length ? ` (${entries.length})` : ""}
              </Tab>
              <Tab active={view === "sources"} onClick={() => setView("sources")}>
                Sources des données
              </Tab>
            </div>
            <div className="flex items-center gap-1">
              {view === "calls" && (
                <button
                  type="button"
                  onClick={() => apiLog.clear()}
                  className="rounded-md px-2 py-1 font-mono text-[11px] text-cream/60 hover:bg-white/10 hover:text-cream"
                >
                  clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="grid h-7 w-7 place-items-center rounded-md text-cream/60 hover:bg-white/10 hover:text-cream"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="no-scrollbar flex-1 overflow-y-auto">
            {view === "calls" ? <CallsView entries={entries} expanded={expanded} setExpanded={setExpanded} /> : <SourcesView />}
          </div>

          <footer className="border-t border-white/10 px-4 py-2 text-center text-[10px] text-cream/35">
            Les appels Mews passent par le Worker — le Client & les IDs restent côté serveur.
          </footer>
        </section>
      )}
    </>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
        active ? "bg-white/10 text-cream" : "text-cream/50 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

function CallsView({
  entries,
  expanded,
  setExpanded,
}: {
  entries: ApiLogEntry[];
  expanded: number | null;
  setExpanded: (id: number | null) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-cream/40">
        Aucun appel pour l'instant.
        <br />
        Lancez une recherche pour voir les appels Mews apparaître ici.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {entries.map((e) => {
        const isOpen = expanded === e.id;
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : e.id)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-white/5"
            >
              <StatusDot e={e} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-cream">{e.label}</span>
                <span className="block truncate font-mono text-[11px] text-cream/45">
                  {e.method} /{e.path}
                </span>
              </span>
              <span className="shrink-0 text-right font-mono text-[11px] text-cream/50">
                {e.pending ? "…" : `${e.status ?? "ERR"}`}
                {e.durationMs != null && <span className="block text-cream/35">{e.durationMs}ms</span>}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-3 bg-black/20 px-4 py-3">
                <Field title="Pourquoi cet appel ?">
                  <p className="text-[12px] leading-relaxed text-cream/75">{e.why}</p>
                </Field>
                {e.request != null && (
                  <Field title="Requête (envoyée au proxy)">
                    <JsonTree value={e.request} />
                  </Field>
                )}
                {e.error && (
                  <Field title="Erreur">
                    <pre className="rounded-lg bg-black/40 p-2.5 font-mono text-[11px] text-red-300">{e.error}</pre>
                  </Field>
                )}
                {e.response != null && (
                  <Field title="Réponse Mews (cliquez pour déplier les arrays)">
                    <JsonTree value={e.response} />
                  </Field>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Onglet « Sources » : ce qui est réel (Mews) vs en dur (démo) ─────────────
const LIVE: string[] = [
  "Chambres : nom, description, photos, capacité (lits)",
  "Disponibilité : « Plus que N chambres » = AvailableRoomCount réel",
  "Prix : « à partir de », par tarif, /nuit, total, prix barré (MaxPrice) → le −% en découle",
  "Tarifs : nom, description, privé/public, mode de règlement",
  "Extras : nom, description, prix EUR, facturation",
  "Réservation : n° de confirmation, total, état du paiement",
];
const MOCK: string[] = [
  "Notes & avis (« 9,4 · 1 248 », « 9,0 · 129 ») — aucune API avis branchée",
  "« X personnes consultent », « réservé N fois » — générés (déterministe par chambre)",
  "« Coup de cœur voyageurs », « Très demandé » — badges marketing",
  "Bandeau « Forte demande pour vos dates » — copie",
  "« Annulation gratuite / sans frais » — copie (vraie politique = RateGroups Mews, non branchée)",
  "Minuteur « Nous gardons votre chambre 09:58 » — cosmétique",
  "Équipements du détail (Wi-Fi, clim, terrasse, vue) — génériques",
  "Visuels de la page d'accueil — placeholders (CDN du site)",
];

function SourcesView() {
  return (
    <div className="space-y-4 px-4 py-3 text-[12px] leading-relaxed">
      <p className="text-cream/60">
        Règle simple : <strong className="text-cream">tout ce qui apparaît dans l'onglet « Appels » est réel</strong>{" "}
        (réponses Mews en direct). Le reste de l'interface listé ci-dessous est <strong className="text-cream">en dur</strong>{" "}
        (démo conversion, à brancher en prod).
      </p>

      <div>
        <p className="mb-1.5 inline-flex items-center gap-2 font-semibold text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Données en direct · Mews
        </p>
        <ul className="space-y-1">
          {LIVE.map((t) => (
            <li key={t} className="flex gap-2 text-cream/75">
              <span className="text-emerald-400">✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1.5 inline-flex items-center gap-2 font-semibold text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Données de démonstration · en dur
        </p>
        <ul className="space-y-1">
          {MOCK.map((t) => (
            <li key={t} className="flex gap-2 text-cream/75">
              <span className="text-amber-400">⚠</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-cream/40">
          Centralisé dans <code className="text-cream/60">src/components/conversion.tsx</code> (+ équipements dans{" "}
          <code className="text-cream/60">RoomDetailDrawer</code>). À remplacer par de vraies sources (avis,
          politique d'annulation Mews, équipements) en production.
        </p>
      </div>
    </div>
  );
}

function StatusDot({ e }: { e: ApiLogEntry }) {
  const color = e.pending ? "bg-amber-400" : e.ok ? "bg-emerald-400" : "bg-red-400";
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {e.pending && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-turquoise-vivid/80">{title}</p>
      {children}
    </div>
  );
}
