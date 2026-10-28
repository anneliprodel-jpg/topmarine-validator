import { describe, expect, it } from "vitest";
import { emptyRawLine, emptyRawSubmission, parseOptionalPositive, parseQuantity, parseSubmission, toRaw } from "./input";

const raw = (o: Record<string, unknown> = {}) => ({ ...emptyRawSubmission("ORDER"), projectName: "P", ...o }) as ReturnType<typeof emptyRawSubmission>;
const withLine = (l: Partial<ReturnType<typeof emptyRawLine>>) => raw({ lines: [{ ...emptyRawLine(), variant: "MODULE", code: "02 12 04", quantity: "1", ...l }] });

describe("kogus", () => {
  it.each(["1", "2", " 10 ", "100000"])("aktsepteerib %s", (q) => {
    expect(parseQuantity(q).error).toBeUndefined();
    expect(parseQuantity(q).value).toBeGreaterThan(0);
  });
  it.each(["0", "-1", "1.5", "1,5", "abc", "1e3", "٣", "+2", "100001", "0001x"])("lükkab tagasi %s", (q) => {
    expect(parseQuantity(q).error).toBeTruthy();
  });
  it("tühi kogus on luba draftis (null, mitte 0)", () => {
    expect(parseQuantity("")).toEqual({ value: null });
  });
});

describe("valikulised arvud", () => {
  it("tühi -> null; koma kümnendmärk; 0 ja negatiivne tagasi", () => {
    expect(parseOptionalPositive("")).toEqual({ value: null });
    expect(parseOptionalPositive("2,4").value).toBe(2.4);
    expect(parseOptionalPositive("0").error).toBeTruthy();
    expect(parseOptionalPositive("-3").error).toBeTruthy();
    expect(parseOptionalPositive("x").error).toBeTruthy();
    expect(parseOptionalPositive("4.5", true).error).toBeTruthy();
    expect(parseOptionalPositive("5000").error).toBeTruthy();
  });
});

describe("parseSubmission piirid", () => {
  it("tühi sisestus lükatakse tagasi", () => {
    const r = parseSubmission(emptyRawSubmission());
    expect(r.ok).toBe(false);
  });

  it("ainult projekti nimega mustand salvestub", () => {
    const r = parseSubmission(raw());
    expect(r.ok).toBe(true);
  });

  it("vigane kogus annab rea numbriga vea", () => {
    const r = parseSubmission(withLine({ quantity: "0" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/Rida 1/);
  });

  it("puuduvad valikulised arvud jäävad null (mitte 0)", () => {
    const r = parseSubmission(withLine({}));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.lines[0].statedWidthM).toBeNull();
      expect(r.data.lines[0].statedLengthM).toBeNull();
      expect(r.data.lines[0].statedFloatsPerModule).toBeNull();
      expect(r.data.lines[0].code).toBe("02 12 04");
    }
  });

  it("komaga laius ja täisarvuline ujukite arv; ujukid komaga lükatakse tagasi", () => {
    const ok = parseSubmission(withLine({ statedWidthM: "2,4", statedFloatsPerModule: "4" }));
    expect(ok.ok && ok.data.lines[0].statedWidthM).toBe(2.4);
    expect(parseSubmission(withLine({ statedFloatsPerModule: "4,5" })).ok).toBe(false);
  });

  it("tühjad read jäetakse välja; kood säilitab eesnullid stringina", () => {
    const r = parseSubmission(raw({ lines: [emptyRawLine(), { ...emptyRawLine(), code: "02 10 04" }] }));
    expect(r.ok && r.data.lines).toHaveLength(1);
    expect(r.ok && r.data.lines[0].code).toBe("02 10 04");
  });

  it("vigased enumid ja kuupäevad lükatakse tagasi", () => {
    expect(parseSubmission(raw({ type: "X" })).ok).toBe(false);
    expect(parseSubmission(raw({ requestedDeliveryDate: "2026-02-30" })).ok).toBe(false);
    expect(parseSubmission(raw({ requestedDeliveryDate: "31.12.2026" })).ok).toBe(false);
    expect(parseSubmission(raw({ modulesConnected: "MAYBE" })).ok).toBe(false);
    expect(parseSubmission(raw({ anchoringType: "ROPE" })).ok).toBe(false);
    expect(parseSubmission(raw({ relevantProperties: ["COLOR"] })).ok).toBe(false);
    expect(parseSubmission(withLine({ variant: "BOX" })).ok).toBe(false);
  });

  it("liiga pikk tekst ja liiga palju ridu lükatakse tagasi", () => {
    expect(parseSubmission(raw({ comments: "x".repeat(5001) })).ok).toBe(false);
    expect(parseSubmission(raw({ lines: Array.from({ length: 51 }, () => ({ ...emptyRawLine(), code: "02 10 04" })) })).ok).toBe(false);
  });

  it("toRaw -> parseSubmission teekond säilitab andmed", () => {
    const first = parseSubmission(withLine({ statedWidthM: "2,4", statedLengthM: "4", statedFloatsPerModule: "4" }));
    if (!first.ok) throw new Error("oodati ok");
    const second = parseSubmission(toRaw(first.data));
    expect(second.ok && second.data).toEqual(first.data);
  });
});
