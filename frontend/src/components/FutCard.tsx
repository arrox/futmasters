import type { Player } from "../api/client";
import { api } from "../api/client";

interface Props {
  player: Player;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

type Tier = "icon" | "gold" | "silver" | "bronze";

function tier(ovr: number): Tier {
  if (ovr >= 87) return "icon";
  if (ovr >= 84) return "gold";
  if (ovr >= 82) return "silver";
  return "bronze";
}

const tierStyles: Record<Tier, string> = {
  icon: "from-[#f6e4b3] via-[#e7c96a] to-[#a67a2a]",
  gold: "from-[#fff0b3] via-[#f4c757] to-[#9a7626]",
  silver: "from-[#f4f4f6] via-[#b8b9c0] to-[#6b6d7a]",
  bronze: "from-[#f1cfa4] via-[#b97a43] to-[#6a3d1f]",
};

const tierText: Record<Tier, string> = {
  icon: "text-[#3a2b05]",
  gold: "text-[#3a2b05]",
  silver: "text-[#222331]",
  bronze: "text-[#2b1506]",
};

const sizes = {
  sm: { card: "w-40 h-56", ovr: "text-3xl", name: "text-sm", stat: "text-[10px]" },
  md: { card: "w-52 h-72", ovr: "text-4xl", name: "text-base", stat: "text-xs" },
  lg: { card: "w-72 h-96", ovr: "text-6xl", name: "text-xl", stat: "text-sm" },
};

export default function FutCard({
  player,
  size = "md",
  showName = true,
}: Props) {
  const t = tier(player.team_ovr);
  const s = sizes[size];
  const photo = api.mediaUrl(player.photo_filename);
  // Abreviación "posicional" según tipo + stats dominante
  const pos = positionFor(player);
  return (
    <div
      className={`${s.card} relative rounded-2xl overflow-hidden shadow-lg
        border border-white/30 shrink-0 select-none`}
    >
      {/* Fondo gradient tipo FUT */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${tierStyles[t]}`}
      />
      {/* Patrón decorativo */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 1px, transparent 1px, transparent 12px)",
        }}
      />
      <div className={`relative h-full flex flex-col ${tierText[t]}`}>
        {/* Top: OVR + posición */}
        <div className="flex-none flex items-start justify-between px-4 pt-4">
          <div className="flex flex-col items-center leading-none">
            <span className={`${s.ovr} font-bold`}>{player.team_ovr}</span>
            <span className={`${s.stat} font-semibold tracking-widest`}>
              {pos}
            </span>
          </div>
          <div
            className={`text-right ${s.stat} font-bold leading-tight flex flex-col items-end`}
          >
            <span className="text-lg">{player.team_type === "club" ? "🏆" : "🏳️"}</span>
            {player.bombo > 0 && (
              <span className="opacity-80">B{player.bombo}</span>
            )}
          </div>
        </div>
        {/* Foto */}
        <div className="flex-1 flex items-center justify-center px-3 relative">
          {photo ? (
            <img
              src={photo}
              alt={player.display_name}
              className="w-full h-full object-contain drop-shadow-xl"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-60">
              <svg viewBox="0 0 64 64" className="w-1/2 h-1/2 fill-current">
                <circle cx="32" cy="22" r="12" />
                <path d="M10 58c0-12 10-20 22-20s22 8 22 20H10z" />
              </svg>
            </div>
          )}
        </div>
        {/* Bottom: nombre + equipo + stats */}
        <div className="flex-none px-4 pb-4">
          {showName && (
            <div className="text-center border-b border-black/40 pb-1 mb-2">
              <div
                className={`${s.name} font-bold uppercase tracking-wide truncate`}
              >
                {player.display_name}
              </div>
              <div className={`${s.stat} opacity-80 truncate`}>
                {player.team_name}
              </div>
            </div>
          )}
          <div
            className={`grid grid-cols-3 gap-1 ${s.stat} font-semibold text-center`}
          >
            <div>
              <div className="font-bold text-sm">{player.team_att}</div>
              <div className="uppercase opacity-80">ATA</div>
            </div>
            <div>
              <div className="font-bold text-sm">{player.team_mid}</div>
              <div className="uppercase opacity-80">MED</div>
            </div>
            <div>
              <div className="font-bold text-sm">{player.team_def}</div>
              <div className="uppercase opacity-80">DEF</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function positionFor(player: Player): string {
  const { team_att: att, team_mid: mid, team_def: def } = player;
  const max = Math.max(att, mid, def);
  if (max === att) return "ATA";
  if (max === mid) return "MED";
  return "DEF";
}
