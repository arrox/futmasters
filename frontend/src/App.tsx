import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import NewSorteo from "./pages/NewSorteo";
import Resultado from "./pages/Resultado";
import Historial from "./pages/Historial";
import AdminLogin from "./pages/AdminLogin";
import AdminHome from "./pages/AdminHome";
import AdminTournament from "./pages/AdminTournament";
import TournamentPublic from "./pages/TournamentPublic";
import { adminToken } from "./api/client";

function RequireAdmin({ children }: { children: JSX.Element }) {
  if (adminToken.get() === null) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

export default function App() {
  const { pathname } = useLocation();
  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
        pathname === to
          ? "bg-accent/15 text-accent border border-soft"
          : "text-slate-300 hover:text-accent"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="min-h-screen">
      <header className="border-b border-soft/60 backdrop-blur sticky top-0 z-20 bg-bg/70">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-accent text-2xl">⚽</span>
            <div className="leading-tight">
              <div className="font-semibold">Sorteo FC 26</div>
              <div className="mono text-[11px] text-slate-500">
                bombos · auditoría · fair-play
              </div>
            </div>
          </Link>
          <nav className="flex gap-1">
            {navLink("/", "Nuevo sorteo")}
            {navLink("/historial", "Historial")}
            {navLink("/admin", "Admin")}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-5 py-8">
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
        </Routes>
      </main>
      <footer className="max-w-6xl mx-auto px-5 py-10 text-center text-xs text-slate-500">
        <p>
          CSPRNG + SHA-256 · el backend es la fuente de verdad. Ver README para
          modelo de seguridad completo.
        </p>
      </footer>
    </div>
  );
}
