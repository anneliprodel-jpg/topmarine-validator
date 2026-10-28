"use client";

export function ConfirmDelete({ action, label = "Kustuta" }: { action: () => Promise<void>; label?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Kas oled kindel? Päring, selle read ja kõik kontrollide ajalugu kustutatakse jäädavalt.")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn btn-danger">{label}</button>
    </form>
  );
}
