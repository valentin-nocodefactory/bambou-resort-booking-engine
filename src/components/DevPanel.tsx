import { useState, useSyncExternalStore } from "react";
import { apiLog, type ApiLogEntry } from "../lib/apiLog";
import { IconClose } from "./icons";

function useApiLog(): ApiLogEntry[] {
  return useSyncExternalStore(apiLog.subscribe, apiLog.getAll, apiLog.getAll);
}

const json = (v: unknown) => {
  try {
    const s = JSON.stringify(v, null, 2);
    return s.length > 1400 ? s.slice(0, 1400) + "\n… (tronqué)" : s;
  } catch {
    return String(v);
  }
};

// Dev Panel : transparence sur les appels Mews. Bouton flottant → tiroir « devtools »
// listant chaque appel /api/mews/*, son statut, sa durée, et POURQUOI on le fait.
export function DevPanel() {
  const entries = useApiLog();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const pending = entries.some((e) => e.pending);

  return (
    <>
      {/* Bouton flottant */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 left-4 z-[60] inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 font-mono text-xs font-semibold text-cream shadow-float transition hover:bg-teal-deep"
        aria-expanded={open}
        aria-label="Journal des appels API"
      >
        <span className={`relative flex h-2 w-2`}>
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
          className="fixed bottom-16 left-4 z-[60] flex max-h-[70vh] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink text-cream shadow-float"
          aria-label="Journal des appels API Mews"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="font-mono text-xs font-semibold text-turquoise-vivid">Journal API · Mews</p>
              <p className="text-[11px] text-cream/50">Chaque appel et pourquoi il est fait</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => apiLog.clear()}
                className="rounded-md px-2 py-1 font-mono text-[11px] text-cream/60 hover:bg-white/10 hover:text-cream"
              >
                clear
              </button>
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
            {entries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-cream/40">
                Aucun appel pour l'instant.
                <br />
                Lancez une recherche pour voir les appels Mews apparaître ici.
              </p>
            ) : (
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
                              <Pre>{json(e.request)}</Pre>
                            </Field>
                          )}
                          {e.error && (
                            <Field title="Erreur">
                              <Pre className="text-red-300">{e.error}</Pre>
                            </Field>
                          )}
                          {e.response != null && (
                            <Field title="Réponse (résumé)">
                              <Pre>{json(e.response)}</Pre>
                            </Field>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <footer className="border-t border-white/10 px-4 py-2 text-center text-[10px] text-cream/35">
            Les appels Mews passent par les Pages Functions — le Client & les IDs restent côté serveur.
          </footer>
        </section>
      )}
    </>
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

function Pre({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <pre className={`overflow-x-auto rounded-lg bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-cream/70 ${className}`}>
      {children}
    </pre>
  );
}
