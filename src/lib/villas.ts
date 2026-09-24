// Type d'une villa exposée au formulaire /villa. Les DONNÉES viennent désormais du
// back-office (table Supabase `villas`, seedée depuis Mews et éditable depuis le dashboard),
// via l'endpoint GET /api/mews/villas — cf. api.villas(). Plus de catalogue en dur ici.
export type Villa = {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  capacity: number;
  image: string;
};
