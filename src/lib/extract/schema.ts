// Mudeli väljundi skeem (struktureeritud väljund). Kõik väited peavad sisaldama viidet ja täpset katkendit allikatekstist.
import * as z from "zod";

export const EXTRACTION_VERSION = "extract-1";

const Cite = z.object({
  unit_id: z.string().describe("Tekstilõigu ID nurksulgudest, nt D1-U6"),
  excerpt: z.string().describe("Täpne sõnasõnaline katkend selle lõigu tekstist, mis väidet toetab"),
});

/** Üks selgesõnaline väide koos väärtuse, algse sõnastuse ja viitega. */
const statement = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    original: z.string().describe("Väite algne sõnastus allikatekstis (sõnasõnaliselt)"),
    cite: Cite,
  });

/** Rea väli: normaliseeritud väärtus + algne sõnastus; null = dokumendis ei ole öeldud. */
const field = <T extends z.ZodType>(value: T) => z.object({ value, original: z.string() }).nullable();

export const LineSchema = z.object({
  cites: z.array(Cite).describe("Kõik lõigud, millest see tootrida koosneb (vähemalt üks), samast dokumendist"),
  product_code: field(z.string()),
  product_name: field(z.string()),
  variant: field(z.enum(["MODULE", "SET", "ACCESSORY", "CUSTOM"])),
  quantity: field(z.number()),
  width_m: field(z.number()),
  length_m: field(z.number()),
  floats_per_module: field(z.number()),
  floats_total: field(z.number()),
});

export const ExtractionSchema = z.object({
  document_type: z.array(statement(z.enum(["ENQUIRY", "ORDER"]))),
  customer_name: z.array(statement(z.string())),
  project_name: z.array(statement(z.string())),
  requested_delivery_date: z.array(statement(z.string().describe("ISO YYYY-MM-DD"))),
  lines: z.array(LineSchema),
  modules_connected: z.array(statement(z.enum(["YES", "NO", "UNKNOWN"]))),
  connection_description: z.array(statement(z.string())),
  anchoring_type: z.array(statement(z.enum(["CHAIN", "PILES", "CONCRETE", "OTHER", "UNKNOWN"]))),
  anchoring_details: z.array(statement(z.string())),
  shore_connection: z.array(statement(z.enum(["YES", "NO", "UNKNOWN"]))),
  gangway_details: z.array(statement(z.string())),
  shore_support_details: z.array(statement(z.string())),
  winter_use: z.array(statement(z.boolean())),
  wave_height_m: z.array(statement(z.number())),
  current_speed_ms: z.array(statement(z.number())),
  boat_length_m: z.array(statement(z.number())),
  other_conditions: z.array(z.object({ text: z.string(), cite: Cite })),
});

export type RawExtraction = z.infer<typeof ExtractionSchema>;
export type RawLine = z.infer<typeof LineSchema>;
export type RawCite = z.infer<typeof Cite>;
