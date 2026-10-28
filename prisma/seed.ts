// Idempotentne kataloogi seed: upsert looduslike võtmete järgi.
// Ei puutu Submission / SubmissionLine / ValidationRun andmeid.
import { PrismaClient } from "@prisma/client";
import { CONFLICTS, PRODUCTS, RULES, SOURCES } from "../src/lib/catalogue/data";

async function main() {
  const prisma = new PrismaClient();
  try {
    const ids = new Map<string, string>();
    for (const s of SOURCES) {
      const { key, ...rest } = s;
      const row = await prisma.sourceReference.upsert({ where: { key }, create: { key, ...rest }, update: rest });
      ids.set(key, row.id);
    }
    for (const p of PRODUCTS) {
      const { sourceKey, ...rest } = p;
      const data = { ...rest, sourceId: ids.get(sourceKey)! };
      await prisma.productVariant.upsert({ where: { internalId: p.internalId }, create: data, update: data });
    }
    for (const c of CONFLICTS) {
      const { key, ...rest } = c;
      await prisma.sourceConflict.upsert({ where: { key }, create: { key, ...rest }, update: rest });
    }
    for (const r of RULES) {
      const { sourceKey, ...rest } = r;
      const data = { ...rest, sourceId: sourceKey ? ids.get(sourceKey)! : null };
      await prisma.validationRule.upsert({ where: { ruleId: r.ruleId }, create: data, update: data });
    }
    console.log(
      `Seed OK: ${SOURCES.length} allikat, ${PRODUCTS.length} toodet, ${CONFLICTS.length} vastuolu, ${RULES.length} reeglit.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Seed ebaõnnestus:", e);
  process.exit(1);
});
