import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import { getLang } from "../lib/lang";
import { getUtms } from "../lib/utm";
import { nights as countNights } from "../lib/format";
import { buildRooms, shapeProducts } from "../lib/shaping";
import type { HotelConfig, ReservationCreateResult, ShapedProduct, ShapedRate, ShapedRoom } from "../types/mews";

export type Step = "dates" | "results" | "guest" | "upgrade" | "extras" | "payment" | "confirmation";
export const STEP_ORDER: Step[] = ["dates", "results", "guest", "upgrade", "extras", "payment", "confirmation"];

// Statuts de panier poussés vers n8n (base des paniers).
// Events de suivi (funnel) → n8n → Supabase.
//  • etape           : une étape atteinte (dates → confirmation), le `step` précise laquelle
//  • paiement_initie : « Payer » cliqué (réservation créée + demande de paiement Mews)
//  • paiement_valide : paiement encaissé (confirmé par Mews)
// « Paiement non abouti » = paiement_initie SANS paiement_valide (dérivé côté Supabase).
export type CartStatus = "etape" | "paiement_initie" | "paiement_valide";

// Identifiant de panier — persistant (localStorage) pour survivre à la redirection
// paiement (Mews → /confirmation). Régénéré à chaque nouvelle recherche (resetAll).
const CART_ID_KEY = "bambou_cart_id";
function newCartId(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  try {
    localStorage.setItem(CART_ID_KEY, id);
  } catch {
    /* localStorage indispo (navigation privée) — id éphémère, ok */
  }
  return id;
}
function loadCartId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(CART_ID_KEY) || newCartId();
  } catch {
    return newCartId();
  }
}

export interface Guest {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  nationalityCode: string;
  sendMarketingEmails: boolean;
  notes: string;
}

const emptyGuest: Guest = {
  firstName: "",
  lastName: "",
  email: "",
  telephone: "",
  nationalityCode: "FR",
  sendMarketingEmails: false,
  notes: "",
};

// Hébergements sélectionnables (Booking Engine configs) — cf. worker _lib PROPERTIES.
export const DEFAULT_PROPERTIES = ["hotel", "creole", "villas"];

interface BookingState {
  step: Step;
  checkIn: string; // yyyy-mm-dd
  checkOut: string;
  adults: number;
  children: number;
  infants: number; // bébés en berceau (0-3) — gratuits ET non décomptés de l'occupation
  voucherCode: string;
  properties: string[]; // hébergements cochés (hotel/creole/villas)
  roomId: string | null;
  rateId: string | null;
  productIds: string[];
  rgid: string | null; // reservation group id (retour paiement)
}

// ── URL <-> state ────────────────────────────────────────────────────────────
function readUrl(): Partial<BookingState> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const num = (k: string, d: number) => {
    const v = parseInt(q.get(k) ?? "", 10);
    return Number.isFinite(v) ? v : d;
  };
  const stepRaw = q.get("step") as Step | null;
  const step = stepRaw && STEP_ORDER.includes(stepRaw) ? stepRaw : undefined;
  const out: Partial<BookingState> = {};
  if (q.get("in")) out.checkIn = q.get("in")!;
  if (q.get("out")) out.checkOut = q.get("out")!;
  if (q.has("adults")) out.adults = num("adults", 2);
  if (q.has("children")) out.children = num("children", 0);
  if (q.has("babies")) out.infants = num("babies", 0);
  if (q.get("voucher")) out.voucherCode = q.get("voucher")!;
  if (q.get("props")) out.properties = q.get("props")!.split(",").filter(Boolean);
  if (q.get("cat")) out.roomId = q.get("cat");
  if (q.get("rate")) out.rateId = q.get("rate");
  if (q.get("products")) out.productIds = q.get("products")!.split(",").filter(Boolean);
  if (q.get("rgid")) out.rgid = q.get("rgid");
  // un retour paiement (?rgid=…) force l'étape confirmation
  if (out.rgid) out.step = "confirmation";
  else if (step) out.step = step;
  return out;
}

// Infos client encodées dans l'URL (lien partageable / reprise). ⚠️ Contient des
// données perso (e-mail, nom, téléphone) : visibles dans l'historique, les logs et
// par toute personne ayant le lien — c'est le compromis assumé du partage de panier.
function readGuest(): Partial<Guest> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const g: Partial<Guest> = {};
  if (q.get("fn")) g.firstName = q.get("fn")!;
  if (q.get("ln")) g.lastName = q.get("ln")!;
  if (q.get("em")) g.email = q.get("em")!;
  if (q.get("tel")) g.telephone = q.get("tel")!;
  if (q.get("nat")) g.nationalityCode = q.get("nat")!;
  if (q.get("note")) g.notes = q.get("note")!;
  if (q.has("mk")) g.sendMarketingEmails = q.get("mk") === "1";
  return g;
}

function writeUrl(s: BookingState, g: Guest) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams();
  if (s.checkIn) q.set("in", s.checkIn);
  if (s.checkOut) q.set("out", s.checkOut);
  q.set("adults", String(s.adults));
  if (s.children) q.set("children", String(s.children));
  if (s.infants) q.set("babies", String(s.infants));
  if (s.voucherCode) q.set("voucher", s.voucherCode);
  if (s.properties.length && s.properties.length < DEFAULT_PROPERTIES.length) q.set("props", s.properties.join(","));
  if (s.step !== "dates") q.set("step", s.step);
  if (s.roomId) q.set("cat", s.roomId);
  if (s.rateId) q.set("rate", s.rateId);
  if (s.productIds.length) q.set("products", s.productIds.join(","));
  if (s.rgid) q.set("rgid", s.rgid);
  // Infos client (pour restaurer la saisie sur un lien partagé).
  if (g.firstName) q.set("fn", g.firstName);
  if (g.lastName) q.set("ln", g.lastName);
  if (g.email) q.set("em", g.email);
  if (g.telephone) q.set("tel", g.telephone);
  if (g.nationalityCode && g.nationalityCode !== "FR") q.set("nat", g.nationalityCode);
  if (g.notes) q.set("note", g.notes);
  if (g.sendMarketingEmails) q.set("mk", "1");
  // Préserve la langue non-défaut dans l'URL (writeUrl reconstruit les params à zéro).
  if (getLang() === "en") q.set("lang", "en");
  const qs = q.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

// ── Context ───────────────────────────────────────────────────────────────────
interface BookingContextValue extends BookingState {
  // config hôtel
  hotel: HotelConfig | null;
  imageBaseUrl: string;
  products: ShapedProduct[];
  hotelLoading: boolean;
  hotelError: boolean;
  // vrai pendant la réhydratation d'un lien profond (App gèle l'étape le temps du chargement)
  hydrating: boolean;
  reloadHotel: () => void;
  // sélection runtime (hydratée depuis les résultats)
  selectedRoom: ShapedRoom | null;
  selectedRate: ShapedRate | null;
  availableRooms: ShapedRoom[]; // liste des résultats (pour le surclassement)
  guest: Guest;
  created: ReservationCreateResult | null;
  // dérivés
  nightsCount: number;
  guestsCount: number;
  selectedProducts: ShapedProduct[];
  productsTotal: number;
  roomTotal: number;
  grandTotal: number;
  // actions
  setSearch: (
    p: Partial<
      Pick<BookingState, "checkIn" | "checkOut" | "adults" | "children" | "infants" | "voucherCode" | "properties">
    >,
  ) => void;
  selectRoomRate: (room: ShapedRoom, rate: ShapedRate) => void;
  hydrateSelection: (room: ShapedRoom | null, rate: ShapedRate | null) => void;
  setAvailableRooms: (rooms: ShapedRoom[]) => void;
  // Filtre d'affichage des hébergements (page résultats) : change `properties`
  // SANS invalider la recherche/sélection (contrairement à setSearch) → bascule
  // instantanée quand on ajoute un hébergement depuis un teaser.
  setProperties: (keys: string[]) => void;
  clearSelection: () => void;
  toggleProduct: (id: string) => void;
  setGuest: (p: Partial<Guest>) => void;
  setCreated: (r: ReservationCreateResult | null) => void;
  goTo: (step: Step) => void;
  resetAll: () => void;
  // suivi panier → n8n
  cartId: string;
  track: (status: CartStatus, extra?: Record<string, unknown>) => Promise<{ ok: boolean }>;
}

const Ctx = createContext<BookingContextValue | null>(null);

const defaults: BookingState = {
  step: "dates",
  checkIn: "",
  checkOut: "",
  adults: 2,
  children: 0,
  infants: 0,
  voucherCode: "",
  properties: DEFAULT_PROPERTIES,
  roomId: null,
  rateId: null,
  productIds: [],
  rgid: null,
};

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(() => ({ ...defaults, ...readUrl() }));
  const [selectedRoom, setSelectedRoom] = useState<ShapedRoom | null>(null);
  const [selectedRate, setSelectedRate] = useState<ShapedRate | null>(null);
  const [availableRooms, setAvailableRoomsState] = useState<ShapedRoom[]>([]);
  // Réhydratation d'un lien profond partagé : vrai tant que la sélection (chambre/tarif)
  // encodée dans l'URL n'est pas reconstruite, pour ne pas afficher (et faire rebondir)
  // une étape > résultats avant que les données soient chargées.
  const [hydrating, setHydrating] = useState<boolean>(() => {
    const u = readUrl();
    const deep = u.step === "guest" || u.step === "upgrade" || u.step === "extras" || u.step === "payment";
    return !!(deep && u.roomId && u.checkIn && u.checkOut);
  });
  const [guest, setGuestState] = useState<Guest>(() => ({ ...emptyGuest, ...readGuest() }));
  const [created, setCreatedState] = useState<ReservationCreateResult | null>(null);
  const [cartId, setCartId] = useState<string>(loadCartId);

  const [hotel, setHotel] = useState<HotelConfig | null>(null);
  const [hotelLoading, setHotelLoading] = useState(true);
  const [hotelError, setHotelError] = useState(false);

  // garde l'URL synchronisée (état de résa + infos client saisies)
  useEffect(() => writeUrl(state, guest), [state, guest]);

  const loadHotel = useCallback(() => {
    setHotelLoading(true);
    setHotelError(false);
    api
      .hotel()
      .then((h) => setHotel(h))
      .catch(() => setHotelError(true))
      .finally(() => setHotelLoading(false));
  }, []);

  useEffect(loadHotel, [loadHotel]);

  // Lien profond partagé (?step=upgrade&cat&rate&in&out) : on arrive sur une étape
  // qui exige une chambre choisie, mais seule l'URL est chargée. On récupère la dispo
  // et on reconstruit selectedRoom/selectedRate + availableRooms AVANT d'afficher
  // l'étape (App gèle le rendu tant que `hydrating`). Ne tourne qu'une fois, au boot.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (hotelError) {
      setHydrating(false);
      return;
    }
    if (!hotel) return; // attendre le catalogue (buildRooms en dépend)
    hydratedRef.current = true;
    const deep = ["guest", "upgrade", "extras", "payment"].includes(state.step);
    if (!deep || selectedRoom || availableRooms.length || !state.roomId || !state.checkIn || !state.checkOut) {
      setHydrating(false);
      return;
    }
    let alive = true;
    setHydrating(true);
    api
      .availability({
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        adults: state.adults,
        children: state.children,
        infants: state.infants,
        voucherCode: state.voucherCode,
      })
      .then((res) => {
        if (!alive) return;
        const rooms = buildRooms(res, hotel);
        setAvailableRoomsState(rooms);
        const room = rooms.find((r) => r.categoryId === state.roomId);
        const rate = room?.rates.find((rt) => rt.rateId === state.rateId) ?? room?.rates[0] ?? null;
        if (room && rate) {
          setSelectedRoom(room);
          setSelectedRate(rate);
        }
      })
      .catch(() => void 0)
      .finally(() => alive && setHydrating(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel, hotelError]);

  const products = useMemo(() => shapeProducts(hotel), [hotel]);
  const imageBaseUrl = hotel?.ImageBaseUrl ?? "";

  const patch = useCallback((p: Partial<BookingState>) => setState((s) => ({ ...s, ...p })), []);

  const setSearch: BookingContextValue["setSearch"] = useCallback(
    (p) =>
      setState((s) => {
        // un changement de dates/occupants invalide la sélection
        const searchChanged =
          (p.checkIn !== undefined && p.checkIn !== s.checkIn) ||
          (p.checkOut !== undefined && p.checkOut !== s.checkOut) ||
          (p.adults !== undefined && p.adults !== s.adults) ||
          (p.children !== undefined && p.children !== s.children) ||
          (p.infants !== undefined && p.infants !== s.infants) ||
          (p.properties !== undefined && p.properties.join(",") !== s.properties.join(","));
        if (searchChanged) {
          setSelectedRoom(null);
          setSelectedRate(null);
          setAvailableRoomsState([]);
        }
        return {
          ...s,
          ...p,
          ...(searchChanged ? { roomId: null, rateId: null, productIds: [] } : {}),
        };
      }),
    [],
  );

  // Ne garde que les extras compatibles avec l'hébergement de la chambre : un produit
  // d'une autre config Mews est refusé à la création (« product invalid »).
  const validProductsFor = useCallback(
    (ids: string[], roomProperty: string | null | undefined) =>
      ids.filter((id) => {
        const p = products.find((pr) => pr.id === id);
        return !p || !p.property || !roomProperty || p.property === roomProperty;
      }),
    [products],
  );

  const selectRoomRate: BookingContextValue["selectRoomRate"] = useCallback(
    (room, rate) => {
      setSelectedRoom(room);
      setSelectedRate(rate);
      setState((s) => ({
        ...s,
        roomId: room.categoryId,
        rateId: rate.rateId,
        productIds: validProductsFor(s.productIds, room.property),
      }));
    },
    [validProductsFor],
  );

  const hydrateSelection: BookingContextValue["hydrateSelection"] = useCallback(
    (room, rate) => {
      setSelectedRoom(room);
      setSelectedRate(rate);
      if (room)
        setState((s) => {
          const kept = validProductsFor(s.productIds, room.property);
          return kept.length === s.productIds.length ? s : { ...s, productIds: kept };
        });
    },
    [validProductsFor],
  );

  const setAvailableRooms: BookingContextValue["setAvailableRooms"] = useCallback(
    (rooms) => setAvailableRoomsState(rooms),
    [],
  );

  const setProperties: BookingContextValue["setProperties"] = useCallback(
    (keys) => patch({ properties: keys }),
    [patch],
  );

  const clearSelection = useCallback(() => {
    setSelectedRoom(null);
    setSelectedRate(null);
    setState((s) => ({ ...s, roomId: null, rateId: null }));
  }, []);

  const toggleProduct: BookingContextValue["toggleProduct"] = useCallback(
    (id) =>
      setState((s) => ({
        ...s,
        productIds: s.productIds.includes(id) ? s.productIds.filter((x) => x !== id) : [...s.productIds, id],
      })),
    [],
  );

  const setGuest: BookingContextValue["setGuest"] = useCallback((p) => setGuestState((g) => ({ ...g, ...p })), []);

  const setCreated: BookingContextValue["setCreated"] = useCallback((r) => {
    setCreatedState(r);
    if (r) setState((s) => ({ ...s, rgid: r.id }));
  }, []);

  const goTo: BookingContextValue["goTo"] = useCallback((step) => patch({ step }), [patch]);

  const resetAll = useCallback(() => {
    setSelectedRoom(null);
    setSelectedRate(null);
    setGuestState(emptyGuest);
    setCreatedState(null);
    setState({ ...defaults });
    setCartId(newCartId()); // nouveau panier
  }, []);

  // ── dérivés ────────────────────────────────────────────────────────────────
  const nightsCount = useMemo(
    () => (state.checkIn && state.checkOut ? countNights(state.checkIn, state.checkOut) : 0),
    [state.checkIn, state.checkOut],
  );
  const guestsCount = state.adults + state.children;

  const selectedProducts = useMemo(
    () => products.filter((p) => state.productIds.includes(p.id)),
    [products, state.productIds],
  );

  const productsTotal = useMemo(
    () => selectedProducts.reduce((sum, p) => sum + productLineTotal(p, nightsCount, guestsCount), 0),
    [selectedProducts, nightsCount, guestsCount],
  );

  const roomTotal = selectedRate?.totalGross ?? 0;
  const grandTotal = roomTotal + productsTotal;

  // ── Suivi de panier → n8n (via /api/mews/track) ──────────────────────────────
  // Snapshot whitelisté de l'état courant du panier.
  const buildCartPayload = (status: CartStatus): Record<string, unknown> => ({
    cartId,
    status,
    step: state.step,
    stay: {
      checkIn: state.checkIn,
      checkOut: state.checkOut,
      nights: nightsCount,
      adults: state.adults,
      children: state.children,
      infants: state.infants,
    },
    room: selectedRoom ? { categoryId: selectedRoom.categoryId, name: selectedRoom.name } : null,
    rate: selectedRate
      ? { rateId: selectedRate.rateId, name: selectedRate.name, totalGross: selectedRate.totalGross }
      : null,
    products: selectedProducts.map((p) => ({ id: p.id, name: p.name, priceEur: p.priceEur })),
    totals: { room: roomTotal, products: productsTotal, grand: grandTotal },
    customer: {
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      telephone: guest.telephone,
      nationalityCode: guest.nationalityCode,
    },
    reservationGroupId: created?.id ?? state.rgid ?? null,
    paymentRequestId: created?.paymentRequestId ?? null,
    // Attribution marketing capturée à l'arrivée (utm_*, gclid, fbclid) + langue.
    utm: getUtms(),
    lang: getLang(),
  });

  const track: BookingContextValue["track"] = (status, extra = {}) =>
    cartId ? api.track({ ...buildCartPayload(status), ...extra }) : Promise.resolve({ ok: false });

  // Réf. toujours à jour (évite de refaire tourner l'effet à chaque rendu).
  const trackRef = useRef(track);
  trackRef.current = track;

  // Funnel : on pousse un event « etape » à CHAQUE changement d'étape (dès `dates`,
  // même sans e-mail) → n8n → Supabase. Permet de mesurer le drop-off complet,
  // les paniers abandonnés et les sources (UTM) à chaque niveau. paiement_initie /
  // paiement_valide sont émis en plus depuis Payment / Confirmation.
  useEffect(() => {
    void trackRef.current("etape");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const value: BookingContextValue = {
    ...state,
    hotel,
    imageBaseUrl,
    products,
    hotelLoading,
    hotelError,
    hydrating,
    reloadHotel: loadHotel,
    selectedRoom,
    selectedRate,
    availableRooms,
    guest,
    created,
    nightsCount,
    guestsCount,
    selectedProducts,
    productsTotal,
    roomTotal,
    grandTotal,
    setSearch,
    selectRoomRate,
    hydrateSelection,
    setAvailableRooms,
    setProperties,
    clearSelection,
    toggleProduct,
    setGuest,
    setCreated,
    goTo,
    resetAll,
    cartId,
    track,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking(): BookingContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking must be used within BookingProvider");
  return v;
}

// Total d'une ligne produit selon son mode de facturation.
export function productLineTotal(p: ShapedProduct, nights: number, guests: number): number {
  const n = Math.max(1, nights);
  const g = Math.max(1, guests);
  switch (p.chargingMode) {
    case "PerNight":
    case "PerTimeUnit": // TimeUnit = nuit sur un hébergement
      return p.priceEur * n;
    case "PerPerson":
      return p.priceEur * g;
    case "PerPersonPerNight":
    case "PerNightPerPerson":
    case "PerPersonPerTimeUnit": // ex. « Déjeuner (Pension complète) »
      return p.priceEur * g * n;
    default: // Once / inconnu
      return p.priceEur;
  }
}
