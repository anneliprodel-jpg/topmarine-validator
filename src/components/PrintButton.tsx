"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()}>
      Prindi / salvesta PDF-ina
    </button>
  );
}
