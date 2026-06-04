# Bambou Resort — Moteur de réservation sur-mesure

Moteur de réservation custom construit par-dessus la **Mews Booking Engine API** (alias Distributor API)
pour le **Bambou Resort** (Martinique). Front statique **Vite + React + TypeScript + Tailwind**, proxy
serveur en **Cloudflare Pages Functions**, déploiement continu via **GitHub → Cloudflare Pages**.

Ambiance : luxe tropical créole, « les pieds dans l'eau ». Parcours en 6 étapes, données 100 % en direct de Mews.

---

## ✨ Parcours utilisateur

1. **Dates + occupants** → recherche de disponibilité.
2. **Disponibilité groupée par type de chambre** : cartes « à partir de », avec **Choisir** ou **Voir le détail**
   (popup photos + description + liste des tarifs, badge « Meilleur prix », prix barré, confirmation du prix exact
   via `reservations/getPricing`).
3. **Upsells** : suggestion inline sur l'écran résultats **+** étape Extras dédiée (produits Mews, total recalculé).
4. **Infos client** (voyageur principal, validations).
5. **Extras additionnels**.
6. **Paiement** (Voie A — Payment Request hébergé par Mews + 3-D Secure) → **réservation créée dans Mews** → **confirmation**
   (vérification du paiement via `reservationGroups/get`, bouton « Reprendre le paiement »).

L'état (dates, occupants, sélection, n° de groupe) est porté par l'**URL** (`searchParams`) + un Context React :
liens partageables et retour de paiement robustes, sans base de données.

---

## 🧱 Architecture

```
Navigateur ──(/api/mews/*, même origine)──▶ Cloudflare Pages Functions ──(Client injecté)──▶ Mews Distributor API
   front statique (dist/)                       functions/api/mews/*                      api.mews-demo.com
```

**Pourquoi des Pages Functions (et pas un Worker séparé ni des appels navigateur) ?**

- Le `Client` Mews et les IDs (`HotelId`/`ConfigId`/catégories d'âge) restent **server-side**, jamais dans le bundle.
- **Pas de CORS** : le navigateur n'appelle que `/api/mews/*` (même origine que le front).
- Centralisation du timeout (12 s), des erreurs, de la vérification de paiement, et de la **curation** des réponses
  (ex. `getPricing` brut ≈ 380 Ko → ~1 Ko en EUR ; réservations curées en JSON léger).
- Un seul repo, un seul déploiement, intégration GitHub native.

---

## 🚀 Démarrage local

```bash
npm install
cp .dev.vars.example .dev.vars   # secrets locaux (gitignored)
npm run dev                      # front (Vite :5173) + Functions (wrangler :8788)
```

Ouvrez **http://localhost:5173**. Vite sert le front avec HMR et **proxie `/api/*`** vers l'instance
`wrangler pages dev` qui émule les Functions et lit `.dev.vars`. Du point de vue du navigateur, tout est sur la
même origine (`:5173`).

> **Note sur la commande `dev`.** Le prompt d'origine proposait `wrangler pages dev -- vite`. Avec les versions
> récentes de Wrangler (≥ 4.9x), cette forme entre en conflit avec `pages_build_output_dir` du `wrangler.toml`
> (« Cannot specify both a directory and a proxy command »). On utilise donc `concurrently` pour lancer Vite **et**
> `wrangler pages dev` en parallèle, Vite proxant `/api` vers Wrangler (voir `vite.config.ts` et `package.json`).
> Résultat identique : `npm run dev` = front + `/api/mews/*` en local.

### Scripts

| Script | Rôle |
| --- | --- |
| `npm run dev` | Front (HMR, :5173) + Functions (:8788), `/api` proxifié. |
| `npm run build` | Build statique du front → `dist/`. |
| `npm run preview` | Build puis `wrangler pages dev dist` (:8788) — teste le rendu prod + Functions sur une seule origine. |
| `npm run deploy` | Build puis `wrangler pages deploy dist` (déploiement manuel via Direct Upload). |
| `npm run typecheck` | `tsc --noEmit` sur `src/`. |

---

## 🔑 Variables d'environnement

| Variable | Rôle | Secret ? | Local | Prod |
| --- | --- | --- | --- | --- |
| `MEWS_BASE_URL` | Base API Mews (`https://api.mews-demo.com`) | non | `.dev.vars` | `wrangler.toml [vars]` ou dashboard |
| `MEWS_APP_BASE_URL` | Base app Mews (page de paiement) | non | `.dev.vars` | idem |
| `MEWS_CLIENT` | Chaîne `Client` Booking Engine API | **OUI** | `.dev.vars` | **Encrypt** dans le dashboard |
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

1. Dashboard Cloudflare → Pages → projet → **Settings → Environment variables**.
2. Modifier `MEWS_CLIENT` = `Hotel Bambou 1.0` (Production **et** Preview), garder « Encrypt ».
3. Re-déployer (ou « Retry deployment »). **Aucun changement de code.**

En CLI : `npx wrangler pages secret put MEWS_CLIENT`.

---

## ☁️ Déploiement GitHub → Cloudflare Pages

1. `git init && git add . && git commit -m "init" && git push` vers un repo GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choisir le repo.
3. **Build settings** :
   - Framework preset : **Vite** (ou aucun)
   - Build command : `npm run build`
   - Build output directory : `dist`
   - Les Functions du dossier `functions/` sont détectées et déployées automatiquement.
4. **Environment variables** (onglets **Production** *et* **Preview**) : ajouter `MEWS_CLIENT` en **Encrypt**.
   Les autres variables sont fournies par `wrangler.toml [vars]` (ou ajoutez-les ici pour surcharger).
5. **Deploy**. Ensuite : push sur `main` = **production** ; chaque **PR = Preview Deployment** (URL dédiée, idéale
   pour faire valider l'hôtel).
6. **Domaine** : Custom domains → `reservation.bambouresort.com` (DNS géré par Cloudflare).

**Alternative CLI** (sans connecter Git) :

```bash
npm run build
npx wrangler pages deploy dist
# secrets : npx wrangler pages secret put MEWS_CLIENT
```

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
- **Voie B** (optionnel) : brancher PCI Proxy une fois `PaymentGateway` configuré, retirer `sandbox.`.
- Vérifier que `dist/` ne contient **aucun secret** (`grep -r "My Client" dist/` doit être vide).

---

## 📁 Structure

```
functions/api/mews/        # Proxy serveur — un fichier = une route /api/mews/*
  _lib.ts                  #   helper mews() (injection Client + timeout 12s), validations, occupancyData()
  hotel.ts                 #   hotels/get            (cache 5 min)
  availability.ts          #   hotels/getAvailability
  pricing.ts               #   reservations/getPricing  (curé EUR-only)
  reservation.ts           #   reservationGroups/create (whitelist + construit paymentUrl Voie A)
  reservation-status.ts    #   reservationGroups/get    (statut paiement curé)
  payment-link.ts          #   reconstruit l'URL de paiement pour un PaymentRequest en attente
  voucher.ts               #   vouchers/validate
src/
  lib/        api.ts (frontière réseau unique), shaping.ts (buildRooms, min-price, dédup),
              format.ts (loc/eur/nights/imgUrl), assets.ts
  state/      booking.tsx (Context + encodage URL + config hôtel + totaux)
  types/      mews.ts
  components/ Hero, StepProgress, RoomCard, RoomDetailModal, UpsellCard, BookingSummary, StepLayout, DataBadge, Photo, icons
  steps/      Dates, Results, Guest, Extras, Payment, Confirmation
  App.tsx     machine d'étapes + header + footer
wrangler.toml  .dev.vars(.example)  public/_redirects (SPA fallback)
```

**Sécurité** : chaque Function reconstruit l'objet Mews à partir de champs **whitelistés** (jamais de forward du body
brut), injecte les IDs depuis `env`, et n'expose aucun CORS large.

---

## 🧪 Vérifier les réservations créées

Back-office demo Mews : **https://app.mews-demo.com** · `distributor-api@mews.li` · `Distributor-api1`.
Les réservations créées par le moteur y apparaissent (n° de confirmation affiché sur l'écran final).

---

## 🔀 Variantes (non implémentées)

- **Worker standalone** : un Worker `itty-router` (`/api/mews/*`) + Pages pour le front. Plus de pièces, CORS à gérer
  entre les deux origines → on préfère les Pages Functions (mono-repo) pour le MVP.
- **Embed Webflow** : héberger le moteur sur `reservation.bambouresort.com` (Cloudflare Pages) et y pointer les
  boutons « Réserver » du site Webflow, ou l'embarquer en `<iframe>`. Le proxy Mews reste la Pages Function.
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
8. **Secrets** : `.dev.vars` gitignored ; en prod `MEWS_CLIENT` en Encrypt ; `dist/` sans secret.
