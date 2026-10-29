// Semantilise väljavõtte pakkuja (Anthropic Claude). Võti ainult serveri keskkonnamuutujast; ei logita ega saadeta brauserisse.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SYSTEM_PROMPT } from "./prompt";
import { ExtractionSchema, EXTRACTION_VERSION, type RawExtraction } from "./schema";

export interface LlmConfig {
  provider: "anthropic";
  model: string;
  effort: "low" | "medium" | "high";
  apiKey: string;
}

export const NOT_CONFIGURED_MESSAGE = "Automaatne analüüs pole seadistatud";

/** null = seadistamata. Nõutud keskkonnamuutuja: ANTHROPIC_API_KEY. Valikulised: LLM_PROVIDER, LLM_MODEL, LLM_EFFORT. */
export function getLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const provider = (env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  if (provider !== "anthropic") return null;
  const effort = (["low", "medium", "high"] as const).find((e) => e === env.LLM_EFFORT) ?? "medium";
  return { provider: "anthropic", model: env.LLM_MODEL?.trim() || "claude-opus-5-5", effort, apiKey };
}

export interface ExtractorMeta {
  provider: string;
  model: string;
  extractionVersion: string;
}

export interface Extractor {
  meta: ExtractorMeta;
  extract(userContent: string): Promise<RawExtraction>;
}

export class ExtractorError extends Error {}

export function createAnthropicExtractor(cfg: LlmConfig): Extractor {
  const client = new Anthropic({ apiKey: cfg.apiKey, timeout: 150_000, maxRetries: 1 });
  return {
    meta: { provider: cfg.provider, model: cfg.model, extractionVersion: EXTRACTION_VERSION },
    async extract(userContent) {
      let res;
      try {
        res = await client.messages.parse({
          model: cfg.model,
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
          output_config: { effort: cfg.effort, format: zodOutputFormat(ExtractionSchema) },
        });
      } catch (e) {
        // Sisu ega võtit ei logita
        const status = (e as { status?: number })?.status;
        console.error("llm request failed", status ?? "", (e as Error)?.name ?? "");
        if (status === 401 || status === 403) throw new ExtractorError("Analüüsiteenuse võti on vigane või puudub õigus (kontrolli ANTHROPIC_API_KEY).");
        if (status === 429) throw new ExtractorError("Analüüsiteenuse päringupiir on täis. Proovi mõne minuti pärast uuesti.");
        throw new ExtractorError("Analüüsiteenus ei vastanud. Proovi hiljem uuesti.");
      }
      if (res.stop_reason === "refusal") throw new ExtractorError("Analüüsiteenus keeldus dokumendi töötlemisest.");
      if (res.stop_reason === "max_tokens") throw new ExtractorError("Dokument on liiga mahukas; väljavõte jäi pooleli. Jaga tellimus väiksemateks osadeks.");
      if (!res.parsed_output) throw new ExtractorError("Analüüsiteenuse vastus ei vastanud nõutud kujule.");
      return res.parsed_output;
    },
  };
}
