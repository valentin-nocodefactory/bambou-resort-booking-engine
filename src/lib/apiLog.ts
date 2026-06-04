// Petit store d'observabilité : journalise chaque appel /api/mews/* avec une
// explication « pourquoi ». Alimente le Dev Panel (transparence : on voit en
// direct quels appels Mews sont faits et à quoi ils servent).

export interface ApiLogEntry {
  id: number;
  ts: number;
  method: string;
  path: string; // ex. "mews/availability"
  label: string; // libellé humain
  why: string; // explication pédagogique
  request?: unknown; // résumé du body envoyé
  status?: number;
  ok?: boolean;
  durationMs?: number;
  response?: unknown; // résumé (clés + tailles), pas le payload brut
  error?: string;
  pending: boolean;
}

const MAX = 40;
let entries: ApiLogEntry[] = [];
let seq = 0;
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((fn) => fn());

// Résumé compact d'une réponse (1 niveau) pour ne pas garder des Mo en mémoire.
export function summarize(data: unknown): unknown {
  if (data == null) return null;
  if (Array.isArray(data)) return `Array(${data.length})`;
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      out[k] = Array.isArray(v)
        ? `Array(${v.length})`
        : v && typeof v === "object"
          ? "{…}"
          : v;
    }
    return out;
  }
  return data;
}

export const apiLog = {
  start(method: string, path: string, label: string, why: string, request?: unknown): number {
    const id = ++seq;
    entries = [{ id, ts: Date.now(), method, path, label, why, request, pending: true }, ...entries].slice(0, MAX);
    emit();
    return id;
  },
  finish(id: number, patch: Partial<ApiLogEntry>) {
    entries = entries.map((e) => (e.id === id ? { ...e, ...patch, pending: false } : e));
    emit();
  },
  getAll(): ApiLogEntry[] {
    return entries;
  },
  clear() {
    entries = [];
    emit();
  },
  subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};
