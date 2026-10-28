"use server";

import { redirect } from "next/navigation";
import { buildDemoCases } from "@/lib/demo";
import { deleteSubmission, runCheck, saveSubmission } from "@/lib/repo";
import { parseSubmission, type RawSubmission } from "@/lib/validation/input";

export interface SaveResult {
  errors: string[];
}

const DB_ERROR = "Andmebaasiga ühendus ebaõnnestus või salvestamine ei õnnestunud. Proovi mõne hetke pärast uuesti.";

export async function saveAction(id: string | null, intent: "save" | "check", raw: RawSubmission): Promise<SaveResult> {
  const parsed = parseSubmission(raw);
  if (!parsed.ok) return { errors: parsed.errors };

  let savedId: string;
  try {
    savedId = await saveSubmission(parsed.data, id);
    if (intent === "check") await runCheck(savedId);
  } catch (e) {
    console.error("saveAction failed", e);
    return { errors: [DB_ERROR] };
  }
  redirect(`/submissions/${savedId}`);
}

export async function recheckAction(id: string): Promise<void> {
  try {
    await runCheck(id);
  } catch (e) {
    console.error("recheckAction failed", e);
    throw new Error(DB_ERROR);
  }
  redirect(`/submissions/${id}`);
}

export async function deleteAction(id: string): Promise<void> {
  try {
    await deleteSubmission(id);
  } catch (e) {
    console.error("deleteAction failed", e);
    throw new Error(DB_ERROR);
  }
  redirect("/history");
}

export async function loadDemoAction(key: "A" | "B" | "C"): Promise<void> {
  const demo = buildDemoCases(new Date()).find((d) => d.key === key);
  if (!demo) throw new Error("Tundmatu näidisjuhtum.");
  let id: string;
  try {
    id = await saveSubmission(demo.input, null, true);
  } catch (e) {
    console.error("loadDemoAction failed", e);
    throw new Error(DB_ERROR);
  }
  redirect(`/submissions/${id}/edit`);
}
