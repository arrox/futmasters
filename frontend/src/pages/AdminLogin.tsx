import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminToken, api } from "../api/client";

export default function AdminLogin() {
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    api.adminStatus().then((s) => {
      setConfigured(s.configured);
      if (!s.configured) {
        adminToken.set("");
        nav("/admin");
      }
    });
  }, [nav]);

  async function submit() {
    if (!pwd || loading) return;
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
    return (
      <div className="login-shell">
        <div className="login-shell__pulse" aria-hidden />
        <div className="login-card">
          <div className="login-card__loading">Cargando…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-shell__pitch" aria-hidden />
      <div className="login-shell__glow" aria-hidden />
      <div className="login-card">
        <div className="login-card__header">
          <div className="login-card__crest" aria-hidden>
            <span className="login-card__crest-top">FC</span>
            <span className="login-card__crest-bot">26</span>
          </div>
          <div className="fm-eyebrow">Panel privado</div>
          <h1 className="login-card__title">Acceso administrador</h1>
          <p className="login-card__subtitle">
            Ingresá la clave definida en{" "}
            <code className="mono">ADMIN_PASSWORD</code> del backend.
          </p>
        </div>

        <form
          className="login-card__form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="login-card__field">
            <span className="login-card__label">Contraseña</span>
            <div className="login-card__input-wrap">
              <svg
                className="login-card__icon"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9zm3 4a2 2 0 0 1 1 3.73V19h-2v-1.27A2 2 0 0 1 12 14z"
                  fill="currentColor"
                />
              </svg>
              <input
                type={showPwd ? "text" : "password"}
                className="login-card__input"
                placeholder="••••••••"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-card__toggle"
                onClick={() => setShowPwd((s) => !s)}
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPwd ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="login-card__submit"
            disabled={!pwd || loading}
          >
            {loading ? (
              <span className="login-card__spinner" aria-hidden />
            ) : (
              <>
                Ingresar
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 12h14m-6-6 6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>

          {err && (
            <div className="login-card__error" role="alert">
              <span>⚠</span> {err}
            </div>
          )}
        </form>

        <div className="login-card__footer">
          <span className="chip chip--green">🔒 Sesión segura</span>
          <span className="login-card__hint">
            Tu sesión queda guardada en este dispositivo.
          </span>
        </div>
      </div>
    </div>
  );
}
