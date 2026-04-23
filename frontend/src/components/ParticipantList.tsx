import { KeyboardEvent, useRef, useState } from "react";

interface Props {
  participants: string[];
  setParticipants: (p: string[]) => void;
  max?: number;
}

export default function ParticipantList({
  participants,
  setParticipants,
  max = 20,
}: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setError("Máximo 50 caracteres por nombre.");
      return;
    }
    if (
      participants.some((p) => p.toLowerCase() === trimmed.toLowerCase())
    ) {
      setError(`"${trimmed}" ya está en la lista.`);
      return;
    }
    if (participants.length >= max) {
      setError(`Máximo ${max} participantes.`);
      return;
    }
    setParticipants([...participants, trimmed]);
    setInput("");
    setError(null);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add(input);
    }
  }

  function remove(idx: number) {
    setParticipants(participants.filter((_, i) => i !== idx));
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const names = text
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      const next: string[] = [...participants];
      const seen = new Set(next.map((n) => n.toLowerCase()));
      for (const name of names) {
        if (next.length >= max) break;
        if (name.length > 50) continue;
        if (seen.has(name.toLowerCase())) continue;
        next.push(name);
        seen.add(name.toLowerCase());
      }
      setParticipants(next);
      setError(null);
    };
    reader.readAsText(file);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Participantes</h2>
        <span className="chip mono">
          {participants.length} / {max}
        </span>
      </div>
      <div className="flex gap-2 mb-2">
        <input
          className="input flex-1"
          placeholder="Agregá un nombre y presioná Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          className="btn btn-primary"
          onClick={() => add(input)}
          disabled={!input.trim() || participants.length >= max}
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
          className="btn btn-ghost text-sm"
          onClick={() => fileRef.current?.click()}
        >
          Importar CSV/TXT
        </button>
        {participants.length > 0 && (
          <button
            className="btn btn-ghost text-sm"
            onClick={() => setParticipants([])}
          >
            Limpiar
          </button>
        )}
      </div>
      {error && <p className="text-coral text-sm mb-2">{error}</p>}
      {participants.length === 0 ? (
        <p className="text-slate-500 text-sm">
          Agregá al menos 2 participantes para continuar.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {participants.map((p, i) => (
            <li
              key={`${p}-${i}`}
              className="flex items-center justify-between bg-bg/60 border border-soft/60 rounded-md px-3 py-1.5 animate-fadeUp"
            >
              <span className="flex items-center gap-2">
                <span className="mono text-slate-500 text-xs w-6">
                  {i + 1}.
                </span>
                <span>{p}</span>
              </span>
              <button
                aria-label={`Quitar ${p}`}
                className="text-slate-400 hover:text-coral px-2"
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
