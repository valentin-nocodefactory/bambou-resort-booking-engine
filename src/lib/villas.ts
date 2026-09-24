// Catalogue des 3 villas — SEED EN DUR. ⚠️ Destiné à devenir éditable depuis le back-office
// (dashboard) : demande client « récupérer les infos des villas en dur, puis exposer ces
// infos sur le backoffice pour que le user puisse les changer ». En attendant, ces valeurs
// sont la source unique du choix de villa sur le formulaire /villa. `image` : une vraie photo
// PAR villa remplacera `villas.webp` quand elles seront fournies.
export type Villa = {
  id: string;
  name: string;
  tagline: string; // accroche courte (éditable back-office)
  capacity: number; // couchages max
  image: string; // chemin public
};

export const VILLAS: Villa[] = [
  { id: "corail", name: "Villa Corail", tagline: "Vue mer panoramique, piscine privée", capacity: 6, image: "/img/properties/villas.webp" },
  { id: "flamboyant", name: "Villa Flamboyant", tagline: "Jardin tropical & grande terrasse", capacity: 4, image: "/img/properties/villas.webp" },
  { id: "alize", name: "Villa Alizé", tagline: "Les pieds dans l'eau, accès direct plage", capacity: 8, image: "/img/properties/villas.webp" },
];

export const villaById = (id: string | null | undefined) => VILLAS.find((v) => v.id === id);
