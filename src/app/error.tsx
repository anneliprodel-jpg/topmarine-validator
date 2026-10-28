"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card border-red-700">
      <h1 className="text-xl font-bold">Midagi läks valesti</h1>
      <p className="my-2">
        Andmeid ei õnnestunud laadida või salvestada (võimalik andmebaasi viga). Teenus võib olla ärkamas - proovi mõne hetke pärast uuesti.
        Varem salvestatud andmeid see ei kustuta.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Proovi uuesti
      </button>
    </div>
  );
}
