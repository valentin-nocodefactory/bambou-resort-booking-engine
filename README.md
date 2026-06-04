# Bambou Resort — Moteur de réservation sur-mesure

Moteur de réservation custom construit par-dessus la **Mews Booking Engine API** (alias Distributor API)
pour le **Bambou Resort** (Martinique). Front statique **Vite + React + TypeScript + Tailwind**, proxy
serveur en **Cloudflare Worker** (Static Assets), déploiement continu via **GitHub → Cloudflare Workers Builds**.

Ambiance : luxe tropical créole, « les pieds dans l'eau ». Parcours en 6 étapes, données 100 % en direct de Mews.

---

## ✨ Parcours utilisateur

1. **Dates + occupants** → recherche de disponibilité.
2. **Disponibilité groupée par type de chambre** : cartes « à partir de », avec **Choisir** ou **Voir le détail**
   (**panneau latéral** qui glisse depuis la droite — photos + description + équipements + liste des tarifs, badge
   « Meilleur prix », prix barré, confirmation du prix exact via `reservations/getPricing`).
3. **Upsells** : suggestion inline sur l'écran résultats **+** étape Extras dédiée (produits Mews, total recalculé).
4. **Infos client** (voyageur principal, validations).
5. **Extras additionnels**.
6. **Paiement** (Voie A — Payment Request hébergé par Mews + 3-D Secure) → **réservation créée dans Mews** → **confirmation**
   (vérification du paiement via `reservationGroups/get`, bouton « Reprendre le paiement »).

L'état (dates, occupants, sélection, n° de groupe) est porté par l'**URL** (`searchParams`) + un Context React :
liens partageables et retour de paiement robustes, sans base de données.

### Expérience & conversion (style Airbnb)

- **Moteur standalone** : pas de hero — écran de recherche épuré (barre Destination · Dates · Voyageurs · Rechercher).
- **Calendrier de plage à la Airbnb** (`DateRangePicker`) : popover 2 mois, sélection début → fin, surbrillance + aperçu au survol, dates passées désactivées.
- **Panneau détail latéral** (`RoomDetailDrawer`) qui glisse depuis la droite (scrim, Escape, slide animé) — pas une popup modale.
- **Leviers de conversion** : note & avis, « Coup de cœur voyageurs », rareté (« Plus que N »), forte demande, nombre de personnes qui consultent, prix barrés & % d'économie, annulation gratuite, paiement sécurisé, minuteur de maintien au paiement.
- **Dev Panel** (`</> API`, en bas à gauche) : journal en direct de chaque appel `/api/mews/*` avec son **statut, sa durée, le corps de requête, un résumé de réponse, et une explication « pourquoi cet appel »**. Transparence totale sur les échanges avec Mews.
- Typo éditoriale **Fraunces** (serif) + **Manrope** (corps), palette tropicale, micro-animations (slide/scale/fade), cibles tactiles ≥ 44 px, focus visibles.

---

## 🧱 Architecture

```
Navigateur ──(/api/mews/*, même origine)──▶ Cloudflare Worker ──(Client injecté)──▶ Mews Distributor API
   front statique (dist/, binding ASSETS)       worker/index.ts → worker/mews/*       api.mews-demo.com
```

Un **seul Worker** (`worker/index.ts`) :
- route `/api/mews/*` vers les handlers proxy (`worker/mews/*`),
- sert le front buildé via le binding **Static Assets** (`dist/`), avec fallback SPA
  (`not_found_handling = "single-page-application"`) pour les routes client (`/confirmation`…).

**Pourquoi ce modèle (et pas des appels navigateur directs) ?**

- Le `Client` Mews et les IDs (`HotelId`/`ConfigId`/catégories d'âge) restent **server-side**, jamais dans le bundle.
- **Pas de CORS** : le navigateur n'appelle que `/api/mews/*` (même origine que le front).
- Centralisation du timeout (12 s), des erreurs, de la vérification de paiement, et de la **curation** des réponses
  (ex. `getPricing` brut ≈ 380 Ko → ~1 Ko en EUR ; réservations curées en JSON léger).
- Un seul repo, un seul déploiement (`wrangler deploy`), compatible **Cloudflare Workers Builds** (Git).

---

## 🚀 Démarrage local

```bash
npm install
cp .dev.vars.example .dev.vars   # secrets locaux (gitignored)
npm run dev                      # front (Vite :5173) + Worker (wrangler :8787)
```

Ouvrez **http://localhost:5173**. Vite sert le front avec HMR et **proxie `/api/*`** vers le **Worker**
(`wrangler dev`, :8787) qui lit `.dev.vars`. Du point de vue du navigateur, tout est sur la même origine (`:5173`).

> `npm run dev` lance d'abord un `vite build` (le binding ASSETS de `wrangler dev` a besoin de `dist/`), puis
> `concurrently` exécute `wrangler dev` (le Worker, :8787) **et** `vite` (HMR, :5173). En prod, le Worker sert
> à la fois le front et `/api/*` sur la même origine.

### Scripts

| Script | Rôle |
| --- | --- |
| `npm run dev` | Build front + Worker (`wrangler dev`, :8787) + Vite (HMR, :5173), `/api` proxifié. |
| `npm run build` | Build statique du front → `dist/`. |
| `npm run preview` | Build puis `wrangler dev` (:8787) — teste le Worker (front + `/api`) sur une seule origine, comme en prod. |
| `npm run deploy` | Build puis `wrangler deploy` (déploiement manuel du Worker + assets). |
| `npm run typecheck` | `tsc --noEmit` sur `src/`. |

---

## 🔑 Variables d'environnement

| Variable | Rôle | Secret ? | Local | Prod |
| --- | --- | --- | --- | --- |
| `MEWS_BASE_URL` | Base API Mews (`https://api.mews-demo.com`) | non | `.dev.vars` | `wrangler.toml [vars]` ou dashboard |
| `MEWS_APP_BASE_URL` | Base app Mews (page de paiement) | non | `.dev.vars` | idem |
| `MEWS_CLIENT` | Chaîne `Client` Booking Engine API | **OUI** | `.dev.vars` | **Secret** (dashboard Worker) |
| `MEWS_HOTEL_ID` | UUID établissement | non | `.dev.vars` | `wrangler.toml [vars]` ou dashboard |
| `MEWS_CONFIG_ID` | UUID configuration | non | `.dev.vars` | idem |
| `MEWS_ADULT_AGE_CATEGORY_ID` | Catégorie d'âge « adulte » | non | `.dev.vars` | idem (fallback demo intégré) |
| `MEWS_CHILD_AGE_CATEGORY_ID` | Catégorie d'âge « enfant » | non | `.dev.vars` | idem |

Les valeurs **non secrètes** ont des défauts demo dans [`wrangler.toml`](./wrangler.toml) (`[vars]`) : un déploiement
fonctionne immédiatement, seul **`MEWS_CLIENT`** doit être ajouté en **secret chiffré**. Le `Client` et les IDs ne
finissent **jamais** dans le front (aucune variable `VITE_*` n'est utilisée).

### 🔁 Swap du Client `Hotel Bambou 1.0` (last-minute)

Sur la demo aujourd'hui, **seule `My Client 1.0.0` passe (200)** ; `Hotel Bambou 1.0` renvoie 401 tant que Mews ne
l'a pas activée sur l'entreprise. Quand c'est fait :

1. Dashboard Cloudflare → ton Worker → **Settings → Variables and Secrets**.
2. Modifier/ajouter le **secret** `MEWS_CLIENT` = `Hotel Bambou 1.0`. **Aucun changement de code.**
3. Re-déployer (ou « Retry deployment »).

En CLI : `npx wrangler secret put MEWS_CLIENT`.

---

## ☁️ Déploiement GitHub → Cloudflare Workers Builds

Le projet est un **Worker + Static Assets** : `npm run build` produit le front (`dist/`), puis `wrangler deploy`
publie le Worker (`worker/index.ts`) **et** uploade `dist/` comme assets.

1. Push sur GitHub (déjà fait).
2. Cloudflare Dashboard → **Workers & Pages → Create → Workers → Import a repository** → choisir le repo.
3. **Build & deploy settings** :
   - **Build command** : `npm run build`
   - **Deploy command** : `npx wrangler deploy`
   - **Non-production branch deploy command** : `npx wrangler versions upload` (= preview-URLs sur les PR)
   - **API token** : laisser vide (Cloudflare en crée un)
4. **Variables and Secrets** : ajouter `MEWS_CLIENT` en **Secret** (les autres variables viennent de `wrangler.toml [vars]`).
5. **Deploy**. Ensuite : push sur `main` = **production** automatique ; chaque **PR** = version preview (URL dédiée).
6. **Domaine** : Worker → **Settings → Domains & Routes** → `reservation.bambouresort.com` (DNS géré par Cloudflare).

**Déploiement manuel (CLI)** :

```bash
npm run build && npx wrangler deploy
# secret : npx wrangler secret put MEWS_CLIENT
```

> ℹ️ Ce projet n'utilise **pas** le modèle « Pages Functions » (`functions/`) mais le modèle **Workers + Static
> Assets** : un seul Worker route `/api/*` et sert le front. C'est le flux proposé par défaut dans le dashboard
> Cloudflare actuel (« Workers Builds »), avec `wrangler deploy`.

---

## 💳 Paiement

### Voie A — Payment Request (implémentée, MVP)

1. `reservationGroups/create` **sans** `CreditCardData` → comme les `RateGroups` demo sont en
   `Automatic / ChargeCreditCard`, Mews renvoie un `PaymentRequestId`.
2. La Function construit (server-side) l'URL hébergée par Mews :
   `${MEWS_APP_BASE_URL}/navigator/payment-requests/detail/{PaymentRequestId}?returnUrl={base64}`
   où `returnUrl` = Base64 de `${origin}/confirmation?rgid={groupId}`.
3. Le front est redirigé → page carte + 3-D Secure hébergée par Mews.
4. Au retour, `Confirmation` appelle `/api/mews/reservation-status` (`reservationGroups/get`) et boucle tant que le
   paiement n'est ni `Completed`/`Charged` ni en échec final. Bouton **« Reprendre le paiement »** (`/api/mews/payment-link`).

Si un tarif est en **settlement `Manual`** (pas de `PaymentRequestId`), la réservation est créée et la confirmation
affiche **« paiement à l'arrivée »**.

### Voie B — PCI Proxy Secure Fields (V2, non implémentée)

Paiement intégré via Datatrans Secure Fields, `merchantId = PaymentGateway.PublicKey` de `hotels/get`.
⚠️ Sur la demo actuelle, `PaymentGateway` est **`null`** → Voie B non testable tant que la passerelle n'est pas
configurée côté Mews. En sandbox : `https://pay.sandbox.datatrans.com/...` ; en prod retirer `sandbox.`.

---

## 🏭 Passage en production

- **API** : `MEWS_BASE_URL=https://api.mews.com`, `MEWS_APP_BASE_URL=https://app.mews.com`.
- **`MEWS_CLIENT`** : la vraie chaîne activée (`Hotel Bambou 1.0`).
- **`MEWS_HOTEL_ID` / `MEWS_CONFIG_ID`** : UUID réels de l'établissement.
- **Catégories d'âge** : remplacer `MEWS_ADULT/CHILD_AGE_CATEGORY_ID` par les UUID réels (visibles dans Mews) —
  ne pas s'appuyer sur les fallbacks demo.
- **Visuels** : remplacer ceux de `src/lib/assets.ts` par les vrais (ou ceux des `RoomCategories` Mews via `ImageBaseUrl`).
- **E-mails de confirmation** : envoyés par **Mews** (PMS), pas par le moteur. En prod, activer/configurer
  les templates d'e-mails de confirmation côté établissement Mews → envoi auto au client (`Customer.Email`) à la
  confirmation/paiement. La demo n'envoie pas d'e-mail (sandbox). _(Le moteur peut aussi envoyer un e-mail custom
  ou une notif webhook en V2 — non câblé.)_
- **Voie B** (optionnel) : brancher PCI Proxy une fois `PaymentGateway` configuré, retirer `sandbox.`.
- Vérifier que `dist/` ne contient **aucun secret** (`grep -r "My Client" dist/` doit être vide).

---

## 📁 Structure

```
worker/
  index.ts                 # Entrée Worker : route /api/mews/* + sert le front (binding ASSETS) + fallback SPA
  mews/                    # Proxy serveur — un fichier = une route /api/mews/*
    _lib.ts                #   helper mews() (injection Client + timeout 12s), validations, occupancyData()
    hotel.ts               #   hotels/get            (cache 5 min)
    availability.ts        #   hotels/getAvailability
    pricing.ts             #   reservations/getPricing  (curé EUR-only)
    reservation.ts         #   reservationGroups/create (whitelist + construit paymentUrl Voie A)
    reservation-status.ts  #   reservationGroups/get    (statut paiement curé)
    payment-link.ts        #   reconstruit l'URL de paiement pour un PaymentRequest en attente
    voucher.ts             #   vouchers/validate
src/
  lib/        api.ts (frontière réseau unique), shaping.ts (buildRooms, min-price, dédup),
              format.ts (loc/eur/nights/imgUrl), assets.ts, apiLog.ts (journal → Dev Panel)
  state/      booking.tsx (Context + encodage URL + config hôtel + totaux)
  types/      mews.ts
  components/ Brand, StepProgress, DateRangePicker, RoomCard, RoomDetailDrawer, UpsellCard,
              BookingSummary, StepLayout, DataBadge, DevPanel, conversion, Photo, icons
  steps/      Dates (recherche standalone), Results, Guest, Extras, Payment, Confirmation
  App.tsx     machine d'étapes + header + footer + Dev Panel
wrangler.toml (main + [assets] + [vars])   .dev.vars(.example)   .node-version
```

**Sécurité** : chaque handler reconstruit l'objet Mews à partir de champs **whitelistés** (jamais de forward du body
brut), injecte les IDs depuis `env`, et n'expose aucun CORS large.

---

## 🧪 Vérifier les réservations créées

Back-office demo Mews : **https://app.mews-demo.com** — _identifiants de la demo Mews fournis séparément (ne pas committer)._
Les réservations créées par le moteur y apparaissent (n° de confirmation affiché sur l'écran final).

---

## 🔀 Variantes (non implémentées)

- **Embed Webflow** : héberger le moteur sur `reservation.bambouresort.com` (Cloudflare Worker) et y pointer les
  boutons « Réserver » du site Webflow, ou l'embarquer en `<iframe>`. Le proxy Mews reste le Worker.
- **Pages Functions** : variante alternative (dossier `functions/`, `wrangler pages deploy`) si un compte
  expose encore le flux Pages. Ici on utilise **Workers + Static Assets**, le flux par défaut du dashboard actuel.
- **Log des réservations (V2)** : binder un namespace **KV** (ou **D1**) dans `wrangler.toml` et écrire
  `reservationGroupId` + récap après confirmation (point d'extension prévu, pas de DB pour le MVP).

---

## ⚠️ Pièges (vérifiés en live)

1. **401 Client** : seule `My Client 1.0.0` passe sur la demo ; swap via l'env var (cf. ci-dessus). Jamais de Client côté front.
2. **CORS** : résolu par l'architecture (front → `/api/mews/*` même origine).
3. **Prix null** : certains combos renvoient `GrossValue: null` → ignorés (`buildRooms`).
4. **Dates** : toujours `...T00:00:00Z` ; Mews normalise ensuite aux heures réelles de check-in/out de l'hôtel.
5. **Catégories d'âge** : absentes de `hotels/get` → fournies par env (fallback demo), à remplacer en prod.
6. **Paiement** : `PaymentRequestId` seulement si le `RateGroup` est en settlement automatique ; sinon « paiement à l'arrivée ».
7. **returnUrl** : Base64 d'une URL absolue (construit côté serveur).
8. **Secrets** : `.dev.vars` gitignored ; en prod `MEWS_CLIENT` en **Secret** (dashboard Worker) ; `dist/` sans secret.
