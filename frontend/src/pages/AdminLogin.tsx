import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminToken, api } from "../api/client";

export default function AdminLogin() {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    api.adminStatus().then((s) => {
      setConfigured(s.configured);
      if (!s.configured) {
        // Dev mode sin password → pasa directo
        adminToken.set("");
        nav("/admin");
      }
    });
  }, [nav]);

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const { token } = await api.adminLogin(pwd);
      adminToken.set(token);
      nav("/admin");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (configured === null) {
    return <div className="card">Cargando…</div>;
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">Ingreso de administrador</h1>
        <p className="text-slate-400 text-sm mb-4">
          Ingresa la contraseña definida por la variable de entorno{" "}
          <code className="mono">ADMIN_PASSWORD</code>.
        </p>
        <input
          type="password"
          className="input w-full mb-3"
          placeholder="Contraseña"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <button
          className="btn btn-primary w-full"
          onClick={submit}
          disabled={!pwd || loading}
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
        {err && <p className="text-coral text-sm mt-3">{err}</p>}
      </div>
    </div>
  );
}
