import { PRODUCTS, SOURCES } from "./data";
import type { CatalogProduct } from "../validation/types";

const sourceLabel = (key: string) => {
  const s = SOURCES.find((x) => x.key === key);
  return s ? `${s.filename}, ${s.location}` : key;
};

/** Koodis hoitavast kataloogist mootori sisend (testid ja seed). Rakendus loeb DB-st sama kuju. */
export function catalogFromData(): CatalogProduct[] {
  return PRODUCTS.map((p) => ({
    internalId: p.internalId,
    code: p.code,
    variant: p.variant,
    kind: p.kind,
    name: p.name,
    widthM: p.widthM,
    lengthM: p.lengthM,
    floatsPerModule: p.floatsPerModule,
    reviewRequired: p.reviewRequired,
    sourceLabel: sourceLabel(p.sourceKey),
  }));
}
