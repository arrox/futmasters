import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import NewSorteo from "./pages/NewSorteo";
import Resultado from "./pages/Resultado";
import Historial from "./pages/Historial";
import AdminLogin from "./pages/AdminLogin";
import AdminHome from "./pages/AdminHome";
import AdminTournament from "./pages/AdminTournament";
import TournamentPublic from "./pages/TournamentPublic";
import TradeConfirm from "./pages/TradeConfirm";
import { adminToken } from "./api/client";

function RequireAdmin({ children }: { children: JSX.Element }) {
  if (adminToken.get() === null) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

export default function App() {
  const { pathname } = useLocation();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  const NavItem = ({ to, label }: { to: string; label: string }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        style={{
          border: 0,
          background: active ? "rgba(240,196,96,0.12)" : "transparent",
          color: active ? "var(--fm-gold)" : "var(--fm-ink-muted)",
          padding: "8px 16px",
          borderRadius: 6,
          cursor: "pointer",
          fontFamily: "var(--fm-font-sans)",
          fontWeight: 600,
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          borderBottom: active
            ? "2px solid var(--fm-gold)"
            : "2px solid transparent",
          textDecoration: "none",
          transition: "color 0.15s, background 0.15s",
          display: "inline-block",
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "16px 32px",
          borderBottom: "1px solid rgba(240,196,96,0.15)",
          background:
            "linear-gradient(180deg, rgba(5,7,12,0.95), rgba(5,7,12,0.7))",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "var(--fm-gold-metal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--fm-font-display)",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "0.02em",
              color: "#2a1e08",
              boxShadow: "0 0 20px rgba(240,196,96,0.4)",
            }}
          >
            FC
          </div>
          <div>
            <div
              className="fm-display fm-gold-metal-text"
              style={{ fontSize: 20, lineHeight: 1 }}
            >
              SORTEO FC 26
            </div>
            <div className="fm-eyebrow" style={{ fontSize: 9, marginTop: 2 }}>
              ULTIMATE DRAW · EDITION 26
            </div>
          </div>
        </Link>
        <nav
          style={{
            display: "flex",
            gap: 4,
            marginLeft: 24,
            flexWrap: "wrap",
          }}
        >
          <NavItem to="/" label="Inicio" />
          <NavItem to="/historial" label="Historial" />
          <NavItem to="/admin" label="Admin" />
        </nav>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span className="chip chip--green">● ONLINE</span>
        </div>
      </header>
      <main
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "32px",
        }}
      >
        <Routes>
          <Route path="/" element={<NewSorteo />} />
          <Route path="/resultado/:id" element={<Resultado />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminHome />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/tournaments/:id"
            element={
              <RequireAdmin>
                <AdminTournament />
              </RequireAdmin>
            }
          />
          <Route path="/t/:id" element={<TournamentPublic />} />
          <Route path="/trade/:token" element={<TradeConfirm />} />
        </Routes>
      </main>
      <footer
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "40px 32px",
          textAlign: "center",
          fontFamily: "var(--fm-font-sans)",
          fontSize: 11,
          letterSpacing: "0.1em",
          color: "var(--fm-ink-dim)",
          textTransform: "uppercase",
        }}
      >
        CSPRNG · SHA-256 · FAIR DRAW · BACKEND ES LA FUENTE DE VERDAD
      </footer>
    </div>
  );
}
