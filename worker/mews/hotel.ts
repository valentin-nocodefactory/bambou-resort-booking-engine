import { mewsJson, json, PROPERTIES, propertyByConfig, type Env } from "./_lib";

const locStr = (v: unknown): string | null =>
  typeof v === "string" ? v : v && typeof v === "object" ? ((v as any)["fr-FR"] ?? (v as any)["en-GB"] ?? Object.values(v as any)[0] ?? null) : null;

// configuration/get — catalogue CONFIG-NATIF des 3 hébergements (Hôtel Bambou,
// Culture Créole, Villas) en UN seul appel. On cure en HotelConfig léger (EUR-only) :
//  • RoomCategories de TOUS les hébergements, chacune taguée `Property` (clé),
//  • Products fusionnés (dédup par Id), ImageBaseUrl, CGV, liste des hébergements.
// Caché 5 min (public) — la config bouge rarement. Aucun input front.
const handler: PagesFunction<Env> = async ({ env }) => {
  const res = await mewsJson<any>(env, "configuration/get", {
    Ids: PROPERTIES.map((p) => p.configId),
    PrimaryId: env.MEWS_CONFIG_ID, // Hôtel Bambou = primaire
    LanguageCode: "fr-FR",
  });
  if (!res.ok || !res.data) return json({ error: "config_failed", status: res.status }, 502);
  const d = res.data;
  const configs: any[] = Array.isArray(d.Configurations) ? d.Configurations : [];
  const primary = configs.find((c) => c.Id === env.MEWS_CONFIG_ID)?.Enterprise ?? configs[0]?.Enterprise ?? {};

  const RoomCategories: any[] = [];
  const productMap = new Map<string, any>();
  for (const cfg of configs) {
    const key = propertyByConfig(cfg.Id)?.key ?? null;
    const ent = cfg.Enterprise ?? {};
    for (const c of ent.Categories ?? []) {
      RoomCategories.push({
        Id: c.Id,
        Name: c.Name,
        Description: c.Description ?? null,
        ImageIds: Array.isArray(c.ImageIds) ? c.ImageIds : [],
        NormalBedCount: c.NormalBedCount ?? 0,
        ExtraBedCount: c.ExtraBedCount ?? 0,
        SpaceType: c.SpaceType ?? "Room",
        Property: key,
      });
    }
    for (const p of ent.Products ?? []) {
      if (!productMap.has(p.Id)) {
        productMap.set(p.Id, {
          Id: p.Id,
          Name: p.Name,
          Description: p.Description ?? null,
          CategoryId: p.CategoryId ?? null,
          ImageId: p.ImageId ?? null,
          AlwaysIncluded: !!p.AlwaysIncluded,
          Prices: { EUR: p.Prices?.EUR ?? null }, // cure EUR-only (réponse brute = ~80 devises)
          ChargingMode: p.ChargingMode ?? "",
        });
      }
    }
  }

  return json(
    {
      ImageBaseUrl: d.ImageBaseUrl ?? "",
      Id: primary.Id ?? env.MEWS_HOTEL_ID,
      Name: primary.Name ?? {},
      Description: primary.Description ?? null,
      DefaultCurrencyCode: d.CurrencyCode ?? "EUR",
      RoomCategories,
      Products: [...productMap.values()],
      PaymentGateway: null, // non fourni par configuration/get ; inutile pour la Voie A
      TermsAndConditionsUrl: locStr(primary.TermsAndConditionsUrl),
      // Liste des hébergements présents → alimente le sélecteur front.
      Properties: PROPERTIES.filter((p) => configs.some((c) => c.Id === p.configId)).map((p) => ({ key: p.key, label: p.label })),
    },
    200,
    "public, max-age=300",
  );
};

export const onRequestGet = handler;
export const onRequestPost = handler;
