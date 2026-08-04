import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { IconPhone, IconMail, IconShare, IconClose } from "./icons";

// ⚙️ Contact réception (bambouresort.com). Modifiable ici en un seul endroit.
const RECEPTION_PHONE = "+33768308396"; // format tel: (E.164)
const RECEPTION_PHONE_DISPLAY = "+33 7 68 30 83 96";
const RECEPTION_EMAIL = "reservation@hotelbambou.fr";

// Accès permanent (bouton flottant bas-droite) pour joindre la réception à toute
// étape : APPELER (tel:), ÉCRIRE (mailto:) ou PARTAGER le lien courant — qui
// contient tous les choix (dates, hébergements, chambre, tarif, extras, langue),
// pour que le destinataire arrive avec la même sélection sans rien refaire.
export function ContactBar() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // URL partageable : reprend TOUS les choix (dates, hébergements, chambre, tarif,
  // extras, langue) mais épinglée sur l'étape « résultats » → le destinataire voit
  // la même sélection sans atterrir sur une étape qui exige des infos perso, et sans
  // hériter d'un retour de paiement.
  function shareUrl(): string {
    const url = new URL(window.location.href);
    const step = url.searchParams.get("step");
    if (step && step !== "dates" && step !== "results") url.searchParams.set("step", "results");
    url.searchParams.delete("rgid");
    return url.toString();
  }

  async function share() {
    const url = shareUrl(); // état complet encodé dans l'URL, épinglé sur les résultats
    if (navigator.share) {
      try {
        await navigator.share({ title: t("contact.shareTitle"), text: t("contact.shareText"), url });
        return;
      } catch (e) {
        // Annulation utilisateur → ne rien faire ; autre erreur → repli presse-papier.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* presse-papier bloqué : on ne casse rien */
    }
  }

  return (
    <div ref={wrapRef} className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="w-72 animate-scale-in overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-float">
          <div className="flex items-start justify-between gap-3 bg-teal-deep px-4 py-3 text-cream">
            <div>
              <p className="font-display text-lg leading-tight">{t("contact.title")}</p>
              <p className="mt-0.5 text-xs text-cream/70">{t("contact.subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("contact.close")}
              className="-mr-1 -mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-cream/70 transition hover:bg-cream/10 hover:text-cream"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1 p-2">
            <a
              href={`tel:${RECEPTION_PHONE}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-cream"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-turquoise/12 text-teal-deep">
                <IconPhone className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{t("contact.call")}</span>
                <span className="block truncate text-xs text-ink/55">{RECEPTION_PHONE_DISPLAY}</span>
              </span>
            </a>

            <a
              href={`mailto:${RECEPTION_EMAIL}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-cream"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-turquoise/12 text-teal-deep">
                <IconMail className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{t("contact.email")}</span>
                <span className="block truncate text-xs text-ink/55">{RECEPTION_EMAIL}</span>
              </span>
            </a>

            <button
              type="button"
              onClick={share}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-cream"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-corail/15 text-corail">
                <IconShare className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{t("contact.share")}</span>
                <span className="block truncate text-xs text-ink/55">
                  {copied ? t("contact.copied") : window.location.host}
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("contact.open")}
        aria-expanded={open}
        className="grid h-14 w-14 place-items-center rounded-full bg-corail text-white shadow-float ring-1 ring-black/5 transition hover:brightness-105 active:scale-95"
      >
        {open ? <IconClose className="h-6 w-6" /> : <IconPhone className="h-6 w-6" />}
      </button>
    </div>
  );
}
