import { KeyboardEvent, useRef, useState } from "react";

export interface ParticipantEntry {
  name: string;
  email: string | null;
}

interface Props {
  participants: ParticipantEntry[];
  setParticipants: (p: ParticipantEntry[]) => void;
  max?: number;
  requireEmail?: boolean;
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ParticipantList({
  participants,
  setParticipants,
  max = 20,
  requireEmail = true,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function add() {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName) {
      setError("Ingresá un nombre.");
      return;
    }
    if (cleanName.length > 50) {
      setError("Máximo 50 caracteres por nombre.");
      return;
    }
    if (requireEmail) {
      if (!cleanEmail) {
        setError("El email es obligatorio.");
        return;
      }
      if (!validEmail(cleanEmail)) {
        setError("Email inválido.");
        return;
      }
    }
    const lowerEmail = cleanEmail.toLowerCase();
    if (
      participants.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())
    ) {
      setError(`"${cleanName}" ya está en la lista.`);
      return;
    }
    if (
      cleanEmail &&
      participants.some((p) => p.email?.toLowerCase() === lowerEmail)
    ) {
      setError(`Email "${cleanEmail}" ya está en la lista.`);
      return;
    }
    if (participants.length >= max) {
      setError(`Máximo ${max} participantes.`);
      return;
    }
    setParticipants([
      ...participants,
      { name: cleanName, email: cleanEmail ? lowerEmail : null },
    ]);
    setName("");
    setEmail("");
    setError(null);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  function remove(idx: number) {
    setParticipants(participants.filter((_, i) => i !== idx));
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      // Formato: una entrada por línea, "nombre, email" o solo "nombre" o solo "email"
      const lines = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const next: ParticipantEntry[] = [...participants];
      const seenNames = new Set(next.map((p) => p.name.toLowerCase()));
      const seenEmails = new Set(
        next.filter((p) => p.email).map((p) => p.email!.toLowerCase()),
      );
      for (const line of lines) {
        if (next.length >= max) break;
        const parts = line.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
        let n = "";
        let e: string | null = null;
        for (const part of parts) {
          if (validEmail(part) && !e) e = part.toLowerCase();
          else if (!n) n = part;
        }
        if (!n) continue;
        if (n.length > 50) continue;
        if (seenNames.has(n.toLowerCase())) continue;
        if (e && seenEmails.has(e)) continue;
        next.push({ name: n, email: e });
        seenNames.add(n.toLowerCase());
        if (e) seenEmails.add(e);
      }
      setParticipants(next);
      setError(null);
    };
    reader.readAsText(file);
  }

  const canAdd =
    name.trim().length > 0 &&
    (requireEmail ? validEmail(email.trim()) : true) &&
    participants.length < max;

  return (
    <div className="fm-surface">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="fm-eyebrow">Squad</div>
          <h2 className="fm-h2" style={{ marginTop: 2 }}>
            Participantes
          </h2>
        </div>
        <span className="chip mono">
          {participants.length} / {max}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-2">
        <input
          className="input"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKey}
        />
        <input
          className="input"
          type="email"
          placeholder={requireEmail ? "Email (obligatorio)" : "Email (opcional)"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          className="btn btn-primary"
          onClick={add}
          disabled={!canAdd}
        >
          Agregar
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/plain,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <button
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: "6px 12px" }}
          onClick={() => fileRef.current?.click()}
        >
          Importar CSV/TXT
        </button>
        {participants.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "6px 12px" }}
            onClick={() => setParticipants([])}
          >
            Limpiar
          </button>
        )}
        <span
          className="ml-auto text-[11px]"
          style={{ color: "var(--fm-ink-dim)" }}
        >
          CSV: una línea por persona, "nombre, email"
        </span>
      </div>
      {error && (
        <p
          style={{
            color: "var(--fm-danger)",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          {error}
        </p>
      )}
      {participants.length === 0 ? (
        <p
          style={{
            color: "var(--fm-ink-dim)",
            fontSize: 13,
          }}
        >
          Agregá al menos 2 participantes (nombre + email) para continuar.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {participants.map((p, i) => (
            <li
              key={`${p.name}-${i}`}
              className="flex items-center justify-between animate-fadeUp"
              style={{
                background: "rgba(5,7,12,0.5)",
                border: "1px solid rgba(240,196,96,0.15)",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="mono"
                  style={{
                    color: "var(--fm-ink-dim)",
                    fontSize: 11,
                    width: 24,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div
                    style={{
                      fontFamily: "var(--fm-font-sans)",
                      fontWeight: 500,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="mono text-xs truncate"
                    style={{ color: "var(--fm-ink-muted)" }}
                  >
                    {p.email ?? "sin email"}
                  </div>
                </div>
              </div>
              <button
                aria-label={`Quitar ${p.name}`}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--fm-ink-dim)",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: "4px 8px",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--fm-danger)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--fm-ink-dim)")
                }
                onClick={() => remove(i)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
