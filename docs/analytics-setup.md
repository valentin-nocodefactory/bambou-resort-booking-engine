# Analytics du moteur de réservation — Supabase + n8n

Pipeline : **front → `/api/mews/track` (Worker) → n8n (`WEBHOOK_EVENTS`) → Supabase**.

Le front pousse un event à **chaque étape** du tunnel + aux jalons de paiement.
Tout passe par **un seul** webhook n8n (pour avoir les logs), qui insère dans Supabase.

## Events envoyés

| `status`            | Quand                                              |
| ------------------- | -------------------------------------------------- |
| `etape`             | À chaque étape atteinte (le champ `step` précise laquelle : `dates`, `results`, `guest`, `upgrade`, `extras`, `payment`, `confirmation`) |
| `paiement_initie`   | Clic sur « Payer » (réservation créée + demande de paiement Mews) |
| `paiement_valide`   | Paiement encaissé (confirmé par Mews)              |

> **Panier abandonné** = pas de `paiement_valide`. **Paiement non abouti** = `paiement_initie` sans `paiement_valide`. (Dérivés côté Supabase, pas d'event dédié.)

### Payload (exemple)

```json
{
  "event": "cart.etape",
  "status": "etape",
  "timestamp": "2026-08-04T10:12:00.000Z",
  "cartId": "c_ab12…",
  "step": "guest",
  "stay": { "checkIn": "2026-10-12", "checkOut": "2026-10-15", "nights": 3, "adults": 2, "children": 0 },
  "room": { "categoryId": "…", "name": "Bungalow Découverte" },
  "rate": { "rateId": "…", "name": "Non remboursable", "totalGross": 519.6 },
  "products": [{ "id": "…", "name": "Petit déjeuner", "priceEur": 12 }],
  "totals": { "room": 519.6, "products": 0, "grand": 519.6, "currency": "EUR" },
  "customer": { "firstName": "Marie", "lastName": "Martin", "email": "…", "telephone": "+336…", "nationalityCode": "FR" },
  "reservationGroupId": null,
  "paymentRequestId": null,
  "lang": "fr",
  "utm": { "utm_source": "google", "utm_medium": "cpc", "utm_campaign": "ete", "gclid": "…" }
}
```

---

## 1) Supabase — SQL à coller (SQL Editor)

Deux tables : `booking_events` (journal append-only) et `carts` (état courant, 1 ligne/panier).
Un **trigger** met à jour `carts` à chaque insert → **n8n n'a qu'à insérer dans `booking_events`**.

```sql
-- Journal append-only : un event par étape/paiement.
create table if not exists public.booking_events (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  event_at    timestamptz,
  cart_id     text not null,
  status      text not null,   -- etape | paiement_initie | paiement_valide
  step        text,            -- dates|results|guest|upgrade|extras|payment|confirmation
  payload     jsonb not null
);
create index if not exists booking_events_cart_idx     on public.booking_events (cart_id);
create index if not exists booking_events_status_idx   on public.booking_events (status);
create index if not exists booking_events_step_idx      on public.booking_events (step);
create index if not exists booking_events_received_idx  on public.booking_events (received_at desc);

-- État courant par panier (table du dashboard).
create table if not exists public.carts (
  cart_id              text primary key,
  first_seen           timestamptz not null,
  last_seen            timestamptz not null,
  last_step            text,
  last_status          text,
  payment_initiated    boolean not null default false,
  paid                 boolean not null default false,
  lang                 text,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text, gclid text, fbclid text,
  check_in date, check_out date, nights int, adults int, children int,
  room_name text, rate_name text, total_grand numeric, currency text,
  customer_email text, customer_name text, customer_phone text, customer_nationality text,
  reservation_group_id text, payment_request_id text,
  payload jsonb
);
create index if not exists carts_last_seen_idx on public.carts (last_seen desc);
create index if not exists carts_status_idx     on public.carts (last_status);
create index if not exists carts_utm_idx         on public.carts (utm_source);

-- Trigger : agrège chaque event dans carts (upsert).
create or replace function public.sync_cart_from_event()
returns trigger language plpgsql as $$
declare
  p jsonb := new.payload;
  ts timestamptz := coalesce(new.event_at, new.received_at);
begin
  insert into public.carts as c (
    cart_id, first_seen, last_seen, last_step, last_status, payment_initiated, paid, lang,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid,
    check_in, check_out, nights, adults, children,
    room_name, rate_name, total_grand, currency,
    customer_email, customer_name, customer_phone, customer_nationality,
    reservation_group_id, payment_request_id, payload
  ) values (
    new.cart_id, ts, ts, new.step, new.status,
    new.status = 'paiement_initie', new.status = 'paiement_valide', p->>'lang',
    p->'utm'->>'utm_source', p->'utm'->>'utm_medium', p->'utm'->>'utm_campaign',
    p->'utm'->>'utm_term', p->'utm'->>'utm_content', p->'utm'->>'gclid', p->'utm'->>'fbclid',
    nullif(p->'stay'->>'checkIn','')::date, nullif(p->'stay'->>'checkOut','')::date,
    nullif(p->'stay'->>'nights','')::int, nullif(p->'stay'->>'adults','')::int, nullif(p->'stay'->>'children','')::int,
    p->'room'->>'name', p->'rate'->>'name',
    nullif(p->'totals'->>'grand','')::numeric, p->'totals'->>'currency',
    p->'customer'->>'email',
    nullif(trim(concat(p->'customer'->>'firstName',' ',p->'customer'->>'lastName')),''),
    p->'customer'->>'telephone', p->'customer'->>'nationalityCode',
    nullif(p->>'reservationGroupId',''), nullif(p->>'paymentRequestId',''), p
  )
  on conflict (cart_id) do update set
    last_seen            = greatest(c.last_seen, excluded.last_seen),
    last_step            = excluded.last_step,
    last_status          = excluded.last_status,
    payment_initiated    = c.payment_initiated or excluded.payment_initiated,
    paid                 = c.paid or excluded.paid,
    lang                 = coalesce(excluded.lang, c.lang),
    utm_source           = coalesce(c.utm_source, excluded.utm_source),   -- garde la 1re source (attribution)
    utm_medium           = coalesce(c.utm_medium, excluded.utm_medium),
    utm_campaign         = coalesce(c.utm_campaign, excluded.utm_campaign),
    utm_term             = coalesce(c.utm_term, excluded.utm_term),
    utm_content          = coalesce(c.utm_content, excluded.utm_content),
    gclid                = coalesce(c.gclid, excluded.gclid),
    fbclid               = coalesce(c.fbclid, excluded.fbclid),
    check_in             = coalesce(excluded.check_in, c.check_in),
    check_out            = coalesce(excluded.check_out, c.check_out),
    nights               = coalesce(excluded.nights, c.nights),
    adults               = coalesce(excluded.adults, c.adults),
    children             = coalesce(excluded.children, c.children),
    room_name            = coalesce(excluded.room_name, c.room_name),
    rate_name            = coalesce(excluded.rate_name, c.rate_name),
    total_grand          = coalesce(excluded.total_grand, c.total_grand),
    currency             = coalesce(excluded.currency, c.currency),
    customer_email       = coalesce(excluded.customer_email, c.customer_email),
    customer_name        = coalesce(excluded.customer_name, c.customer_name),
    customer_phone       = coalesce(excluded.customer_phone, c.customer_phone),
    customer_nationality = coalesce(excluded.customer_nationality, c.customer_nationality),
    reservation_group_id = coalesce(excluded.reservation_group_id, c.reservation_group_id),
    payment_request_id   = coalesce(excluded.payment_request_id, c.payment_request_id),
    payload              = excluded.payload;
  return new;
end $$;

drop trigger if exists trg_sync_cart on public.booking_events;
create trigger trg_sync_cart after insert on public.booking_events
for each row execute function public.sync_cart_from_event();

-- Sécurité : RLS activé, aucune policy publique → seul le service_role (n8n) écrit/lit.
alter table public.booking_events enable row level security;
alter table public.carts          enable row level security;
```

Puis récupère (Settings → API) : **Project URL** + clé **`service_role`** (secrète — pour n8n uniquement).

---

## 2) n8n — workflow « Bambou — Booking Events »

1. **Webhook** (node) : méthode `POST`, path ex. `booking-events`. Copie la **Production URL** → c'est elle qu'on met dans `WEBHOOK_EVENTS`.
2. **Supabase** (node) → opération **Insert**, table `booking_events`. Mappe (le body arrive sous `{{$json.body}}` en général — vérifie ce que n8n affiche) :
   - `cart_id`  ← `{{ $json.body.cartId }}`
   - `status`   ← `{{ $json.body.status }}`
   - `step`     ← `{{ $json.body.step }}`
   - `event_at` ← `{{ $json.body.timestamp }}`
   - `payload`  ← `{{ $json.body }}`  *(l'objet complet en jsonb)*
   > Pas besoin de toucher `carts` : le trigger Postgres s'en charge.
3. **Active** le workflow. L'onglet **Executions** = tes logs (chaque hit = une exécution).
4. Credentials Supabase dans n8n : Host = Project URL, Service Role Secret = clé `service_role`.

---

## 3) Ce qu'il reste (côté déploiement)

- Donne-moi la **Production URL** du webhook n8n → je la mets dans `WEBHOOK_EVENTS` (wrangler.toml ou Secret Cloudflare) et je déploie.
- Tant que `WEBHOOK_EVENTS` est vide, le tracking est **no-op** (aucune erreur).

---

## Requêtes prêtes (pour le futur dashboard)

```sql
-- Paniers abandonnés (inactifs > 30 min, non payés, arrêtés en cours de tunnel)
select cart_id, last_step, last_seen, customer_email, room_name, total_grand, utm_source
from carts
where not paid and last_status = 'etape' and last_seen < now() - interval '30 minutes'
order by last_seen desc;

-- Paiements non aboutis (paiement lancé mais jamais validé)
select cart_id, last_seen, customer_email, room_name, total_grand, payment_request_id, utm_source
from carts
where payment_initiated and not paid
order by last_seen desc;

-- Sources : sessions vs conversions par utm_source
select coalesce(utm_source,'(direct)') as source,
       count(*)                        as paniers,
       count(*) filter (where paid)    as conversions,
       round(100.0 * count(*) filter (where paid) / nullif(count(*),0), 1) as taux_pct
from carts group by 1 order by paniers desc;

-- Funnel : nb de paniers distincts ayant atteint chaque étape
select step, count(distinct cart_id) as paniers
from booking_events where status = 'etape'
group by step
order by array_position(array['dates','results','guest','upgrade','extras','payment','confirmation'], step);
```
