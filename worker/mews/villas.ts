import { json, type Env } from "./_lib";

// Catalogue des villas pour le formulaire /villa. Source : table `villas` du back-office
// (Supabase), initialement SEEDÉE depuis Mews et ÉDITABLE depuis le dashboard. Lecture
// publique (RLS `select using (true)`) via la clé anon. Repli statique (les 3 villas réelles)
// si Supabase est indisponible → le formulaire a toujours ses villas.
const FALLBACK = [
  { id: "2cd39d09-d506-4197-ac48-b2f801017ed0", name: "Villa La Baie Turquoise", tagline: "6-8 personnes | 3-4 chambres | 2-3 SdB | Piscine | Vue mer | Resort à 5km", capacity: 8, image: "https://cdn.mews.com/Media/Image/5149eeee-f2d2-4633-97b5-b42700eb176f?width=640&mode=fit", photos: ["https://cdn.mews.com/Media/Image/5149eeee-f2d2-4633-97b5-b42700eb176f"] },
  { id: "da2598dd-a632-4ab3-b334-b2f80101c13a", name: "Villa L'Escapade Tropicale", tagline: "6-8 personnes | 3-4 chambres | 2-3 SdB | Piscine | Vue mer | Salle de sport | Resort à 5km", capacity: 8, image: "https://cdn.mews.com/Media/Image/4ff2f231-c71e-421f-a541-b457010d32f6?width=640&mode=fit", photos: ["https://cdn.mews.com/Media/Image/4ff2f231-c71e-421f-a541-b457010d32f6"] },
  { id: "d6ae8a99-7462-4e16-9e7d-b2f8010130aa", name: "Villa Le Vent des îles", tagline: "6 personnes | 3 chambres | 3 SdB | Piscine | Vue mer | Resort à 5km", capacity: 6, image: "https://cdn.mews.com/Media/Image/b2590c6e-5569-4d2f-980f-b457010a6dcb?width=640&mode=fit", photos: ["https://cdn.mews.com/Media/Image/b2590c6e-5569-4d2f-980f-b457010a6dcb"] },
];

type Row = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  capacity: number | null;
  image_url: string | null;
  photos: string[] | null;
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (base && key) {
    try {
      const url = `${base}/rest/v1/villas?select=id,name,tagline,description,capacity,image_url,photos&active=eq.true&order=sort_order.asc`;
      const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (r.ok) {
        const rows = (await r.json()) as Row[];
        if (Array.isArray(rows) && rows.length) {
          return json(
            rows.map((v) => {
              const photos = Array.isArray(v.photos) ? v.photos.filter((p) => typeof p === "string" && p) : [];
              return {
                id: v.id,
                name: v.name,
                tagline: v.tagline ?? "",
                description: v.description ?? "",
                capacity: v.capacity ?? 2,
                image: photos[0] ?? v.image_url ?? "", // couverture = 1re photo de la galerie
                photos: photos.length ? photos : v.image_url ? [v.image_url] : [],
              };
            }),
            200,
            "public, max-age=300",
          );
        }
      }
    } catch {
      /* repli statique ci-dessous */
    }
  }
  return json(FALLBACK, 200, "public, max-age=120");
};
