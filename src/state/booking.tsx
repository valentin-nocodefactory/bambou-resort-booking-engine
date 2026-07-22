import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import { nights as countNights } from "../lib/format";
import { shapeProducts } from "../lib/shaping";
import type { HotelConfig, ReservationCreateResult, ShapedProduct, ShapedRate, ShapedRoom } from "../types/mews";

export type Step = "dates" | "results" | "guest" | "upgrade" | "extras" | "payment" | "confirmation";
export const STEP_ORDER: Step[] = ["dates", "results", "guest", "upgrade", "extras", "payment", "confirmation"];

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

interface BookingState {
  step: Step;
  checkIn: string; // yyyy-mm-dd
  checkOut: string;
  adults: number;
  children: number;
  voucherCode: string;
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
  if (q.get("voucher")) out.voucherCode = q.get("voucher")!;
  if (q.get("cat")) out.roomId = q.get("cat");
  if (q.get("rate")) out.rateId = q.get("rate");
  if (q.get("products")) out.productIds = q.get("products")!.split(",").filter(Boolean);
  if (q.get("rgid")) out.rgid = q.get("rgid");
  // un retour paiement (?rgid=…) force l'étape confirmation
  if (out.rgid) out.step = "confirmation";
  else if (step) out.step = step;
  return out;
}

function writeUrl(s: BookingState) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams();
  if (s.checkIn) q.set("in", s.checkIn);
  if (s.checkOut) q.set("out", s.checkOut);
  q.set("adults", String(s.adults));
  if (s.children) q.set("children", String(s.children));
  if (s.voucherCode) q.set("voucher", s.voucherCode);
  if (s.step !== "dates") q.set("step", s.step);
  if (s.roomId) q.set("cat", s.roomId);
  if (s.rateId) q.set("rate", s.rateId);
  if (s.productIds.length) q.set("products", s.productIds.join(","));
  if (s.rgid) q.set("rgid", s.rgid);
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
  setSearch: (p: Partial<Pick<BookingState, "checkIn" | "checkOut" | "adults" | "children" | "voucherCode">>) => void;
  selectRoomRate: (room: ShapedRoom, rate: ShapedRate) => void;
  hydrateSelection: (room: ShapedRoom | null, rate: ShapedRate | null) => void;
  setAvailableRooms: (rooms: ShapedRoom[]) => void;
  clearSelection: () => void;
  toggleProduct: (id: string) => void;
  setGuest: (p: Partial<Guest>) => void;
  setCreated: (r: ReservationCreateResult | null) => void;
  goTo: (step: Step) => void;
  resetAll: () => void;
}

const Ctx = createContext<BookingContextValue | null>(null);

const defaults: BookingState = {
  step: "dates",
  checkIn: "",
  checkOut: "",
  adults: 2,
  children: 0,
  voucherCode: "",
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
  const [guest, setGuestState] = useState<Guest>(emptyGuest);
  const [created, setCreatedState] = useState<ReservationCreateResult | null>(null);

  const [hotel, setHotel] = useState<HotelConfig | null>(null);
  const [hotelLoading, setHotelLoading] = useState(true);
  const [hotelError, setHotelError] = useState(false);

  // garde l'URL synchronisée
  useEffect(() => writeUrl(state), [state]);

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
          (p.children !== undefined && p.children !== s.children);
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

  const selectRoomRate: BookingContextValue["selectRoomRate"] = useCallback((room, rate) => {
    setSelectedRoom(room);
    setSelectedRate(rate);
    setState((s) => ({ ...s, roomId: room.categoryId, rateId: rate.rateId }));
  }, []);

  const hydrateSelection: BookingContextValue["hydrateSelection"] = useCallback((room, rate) => {
    setSelectedRoom(room);
    setSelectedRate(rate);
  }, []);

  const setAvailableRooms: BookingContextValue["setAvailableRooms"] = useCallback(
    (rooms) => setAvailableRoomsState(rooms),
    [],
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

  const value: BookingContextValue = {
    ...state,
    hotel,
    imageBaseUrl,
    products,
    hotelLoading,
    hotelError,
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
    clearSelection,
    toggleProduct,
    setGuest,
    setCreated,
    goTo,
    resetAll,
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
