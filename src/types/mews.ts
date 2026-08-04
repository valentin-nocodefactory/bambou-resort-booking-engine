// Types des réponses Mews (Booking Engine / Distributor API v1), modélisés d'après
// les réponses live vérifiées sur l'environnement demo. Les Functions passent la
// réponse brute (hotel/availability/pricing) ou une version curée (reservation*).

export type Localized = Record<string, string>;

export interface MewsAmount {
  Currency: string;
  GrossValue: number | null;
  NetValue: number | null;
}
export type EurAmount = { EUR?: MewsAmount };

// ── hotels/get ──────────────────────────────────────────────────────────────
export interface RoomCategory {
  Id: string;
  Name: Localized;
  Description: Localized | null;
  ImageIds: string[];
  NormalBedCount: number;
  ExtraBedCount: number;
  SpaceType: string;
  Property?: string | null; // hébergement (hotel/creole/villas) — configuration/get
}

export interface Product {
  Id: string;
  Name: Localized;
  Description: Localized | null;
  CategoryId: string | null;
  ImageId: string | null;
  IncludedByDefault: boolean;
  AlwaysIncluded: boolean;
  Prices: Record<string, number>; // { EUR: 12.6, ... }
  ChargingMode?: string;
  Property?: string | null; // hébergement (hotel/creole/villas) — un produit n'est réservable qu'avec une chambre de SA config
}

export interface PaymentGateway {
  PaymentGatewayType: string; // ex. "PciProxy"
  PublicKey?: string; // = merchantId PCI Proxy
  SupportedCreditCardTypes?: string[];
}

export interface HotelConfig {
  ImageBaseUrl: string;
  Id: string;
  Name: Localized;
  Description: Localized | null;
  DefaultCurrencyCode: string;
  RoomCategories: RoomCategory[];
  Products: Product[];
  PaymentGateway: PaymentGateway | null;
  TermsAndConditionsUrl?: string | null;
  // Hébergements proposés (Booking Engine configs) — alimente le sélecteur.
  Properties?: { key: string; label: string }[];
}

// ── hotels/getAvailability ───────────────────────────────────────────────────
export interface RateGroup {
  Id: string;
  SettlementType: "Automatic" | "Manual" | string;
  SettlementAction: "ChargeCreditCard" | "CreatePreauthorization" | string;
  SettlementTrigger?: string;
  SettlementValue?: number;
}

export interface Rate {
  Id: string;
  Name: Localized;
  Description?: Localized | null;
  RateGroupId: string;
  IsPrivate: boolean;
  Ordering?: number;
}

export interface PriceBlock {
  TotalAmount?: EurAmount;
  AverageAmountPerNight?: EurAmount;
}

export interface RatePricing {
  RateId: string;
  Price: PriceBlock;
  MaxPrice?: PriceBlock | null;
}

export interface RoomOccupancyAvailability {
  Pricing: RatePricing[];
  AdultCount: number;
  ChildCount: number;
  OccupancyData: { AgeCategoryId: string; PersonCount: number }[];
}

export interface RoomCategoryAvailability {
  RoomCategoryId: string;
  AvailableRoomCount: number;
  RoomOccupancyAvailabilities: RoomOccupancyAvailability[];
}

export interface AvailabilityResponse {
  RateGroups: RateGroup[];
  Rates: Rate[];
  RoomCategoryAvailabilities: RoomCategoryAvailability[];
  ViolatedRestrictions?: unknown[];
}

// ── Réponses curées des Functions ────────────────────────────────────────────
export interface CuratedAmount {
  currency: "EUR";
  gross: number | null;
  net: number | null;
}

export interface PricingResult {
  occupancyPrices: {
    occupancy: { AgeCategoryId: string; PersonCount: number }[] | null;
    pricing: {
      rateId: string;
      total: CuratedAmount | null;
      perNight: CuratedAmount | null;
      max: CuratedAmount | null;
    }[];
  }[];
}

export interface CreatedReservation {
  id: string;
  number: string;
  roomCategoryId: string;
  rateId: string;
  startUtc: string;
  endUtc: string;
  adultCount: number;
  childCount: number;
  amount: CuratedAmount | null;
}

export interface ReservationCreateResult {
  id: string;
  customerId: string;
  paymentRequestId: string | null;
  paymentUrl: string | null; // URL de paiement Mews (Voie A), construite côté serveur
  creditCardAvailable: boolean | null;
  totalAmount: CuratedAmount | null;
  reservations: CreatedReservation[];
}

export interface ReservationStatusResult {
  id: string;
  paid: boolean;
  finalFailure: boolean;
  paymentRequests: { id: string; state: string }[];
  payments: { id: string; state: string }[];
  reservations: { number: string }[];
}

// ── Types domaine (shapés pour l'UI, voir lib/shaping.ts) ─────────────────────
export interface ShapedRate {
  rateId: string;
  rateGroupId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  totalGross: number | null;
  perNightGross: number | null;
  maxGross: number | null; // prix barré (avant remise) si présent
  settlement: { type: string; action: string; isAutomatic: boolean };
}

export interface ShapedRoom {
  categoryId: string;
  name: string;
  description: string;
  imageIds: string[];
  normalBedCount: number;
  extraBedCount: number;
  spaceType: string;
  availableRoomCount: number;
  capacity: number; // lits normaux + d'appoint
  rates: ShapedRate[]; // triés prix croissant, prix null exclus
  fromGross: number | null; // min des totaux non-null
  property?: string | null; // hébergement (hotel/creole/villas)
}

export interface ShapedProduct {
  id: string;
  name: string;
  description: string;
  priceEur: number;
  chargingMode: string;
  imageId: string | null;
  property: string | null; // hébergement (hotel/creole/villas) auquel l'extra est rattaché
}
