import { describe, expect, it } from "vitest";
import { catalogFromData } from "../catalogue/convert";
import { suggestFromText } from "./suggest";
import { extractFromFile, ImportError } from "./extract";

const codes = [...new Set(catalogFromData().map((c) => c.code))];
const s = (t: string) => suggestFromText(t, codes);

describe("soovitused tekstist", () => {
  it("tuvastab koodi, koguse, mõõdud ja ujukid ühelt realt", () => {
    const r = s("SET 02 12 04 SP 2,4 x 4 m, 4 floats, 3 pcs");
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ code: "02 12 04", variant: "SET", quantity: 3, statedWidthM: 2.4, statedLengthM: 4, statedFloatsPerModule: 4 });
  });

  it("2 x 02 12 04 ja koodi variatsioonid", () => {
    expect(s("2 x 021204").lines[0]).toMatchObject({ code: "02 12 04", quantity: 2, variant: null });
    expect(s("02-12-04 moodul x 5").lines[0]).toMatchObject({ quantity: 5, variant: "MODULE" });
  });

  it("nimest '4× 220ltr' saab ujukite arv, mitte kogus", () => {
    const r = s("02 12 04 SP 2.4× 4m, 4× 220ltr");
    expect(r.lines[0].statedFloatsPerModule).toBe(4);
    expect(r.lines[0].quantity).toBeNull();
  });

  it("tundmatud 6-kohalised numbrid (telefon, kuupäev, tundmatu kood) ignoreeritakse", () => {
    const r = s("Tel 530440 00\nKood 99 99 99 kogus 2\nKuupäev 010123");
    expect(r.lines).toHaveLength(0);
  });

  it("mitu koodi samal real -> kogust ega mõõte ei arvata", () => {
    const r = s("02 12 04 ja 02 14 04, 2 tk");
    expect(r.lines).toHaveLength(2);
    expect(r.lines.every((l) => l.quantity === null && l.statedWidthM === null)).toBe(true);
  });

  it("kogus puudub -> null (mitte 0 ega 1)", () => {
    expect(s("02 12 04").lines[0].quantity).toBeNull();
  });

  it("tarnekuupäev ainult märksõnaga reast; vigane kuupäev ei sobi", () => {
    expect(s("Soovitud tarne: 15.03.2027").deliveryDate?.value).toBe("2027-03-15");
    expect(s("Delivery date 2027-04-01").deliveryDate?.value).toBe("2027-04-01");
    expect(s("Arve kuupäev 15.03.2027").deliveryDate).toBeNull();
    expect(s("Tarne 31.02.2027").deliveryDate).toBeNull();
  });

  it("talv ja ankurdus tuvastatakse ainult selgelt", () => {
    expect(s("Kasutus talvel").winterMention).not.toBeNull();
    expect(s("Anchoring by chain").anchoring?.type).toBe("CHAIN");
    expect(s("Betoonankur 200 kg").anchoring?.type).toBe("CONCRETE");
    expect(s("chain or piles").anchoring).toBeNull();
    expect(s("midagi muud").anchoring).toBeNull();
  });
});

describe("faili lugemine", () => {
  const enc = (t: string) => new TextEncoder().encode(t);

  it("txt loetakse, tühi ja tundmatu tüüp lükatakse tagasi", async () => {
    expect((await extractFromFile("a.txt", enc("02 12 04 x 2"))).text).toContain("02 12 04");
    await expect(extractFromFile("a.txt", new Uint8Array())).rejects.toBeInstanceOf(ImportError);
    await expect(extractFromFile("a.exe", enc("x"))).rejects.toBeInstanceOf(ImportError);
  });

  it("võltsitud laiendused (sisu ei ole docx/pdf) lükatakse tagasi", async () => {
    await expect(extractFromFile("a.docx", enc("tavaline tekst"))).rejects.toBeInstanceOf(ImportError);
    await expect(extractFromFile("a.pdf", enc("tavaline tekst"))).rejects.toBeInstanceOf(ImportError);
  });

  it("liiga suur fail lükatakse tagasi", async () => {
    await expect(extractFromFile("a.txt", new Uint8Array(5 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(ImportError);
  });

  it("eml: teema ja kehatekst", async () => {
    const eml = "From: a@b.ee\r\nTo: c@d.ee\r\nSubject: Tellimus\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPalun 2 x 02 12 04\r\n";
    const r = await extractFromFile("m.eml", enc(eml));
    expect(r.text).toContain("Teema: Tellimus");
    expect(r.text).toContain("02 12 04");
  });
});
