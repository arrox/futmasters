import type { Player } from "../api/client";
import { api } from "../api/client";

type Tier = "gold" | "silver" | "bronze" | "totw" | "icon" | "hero";

interface Props {
  player: Player;
  size?: "sm" | "md" | "lg";
  tierOverride?: Tier;
  className?: string;
}

function tierFor(ovr: number, teamType: "club" | "nation"): Tier {
  // Regla FUT: solo elite (Real Madrid / Messi-like) → Icon; alto → Gold;
  // medio → Silver; bajo → Bronze. Las selecciones fuertes entran como
  // TOTW para romper la monotonía visual cuando son tier 2.
  if (ovr >= 87) return "icon";
  if (ovr >= 84) return "gold";
  if (ovr >= 82 && teamType === "nation") return "totw";
  if (ovr >= 82) return "silver";
  return "bronze";
}

function positionFor(player: Player): string {
  const { team_att: att, team_mid: mid, team_def: def } = player;
  if (att >= mid && att >= def) return "DEL";
  if (def >= mid) return "DEF";
  return "MED";
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function FutCard({
  player,
  size = "md",
  tierOverride,
  className = "",
}: Props) {
  const tier = tierOverride ?? tierFor(player.team_ovr, player.team_type);
  const photo = api.mediaUrl(player.photo_filename);
  const sizeClass = size === "sm" ? "fut-card--sm" : size === "lg" ? "fut-card--lg" : "";

  return (
    <div className={`fut-card fut-card--${tier} ${sizeClass} ${className}`}>
      <div className="fut-card__top">
        <div>
          <div className="fut-card__ovr">{player.team_ovr}</div>
          <div className="fut-card__pos">{positionFor(player)}</div>
        </div>
        <div className="fut-card__crest">
          {photo ? <img src={photo} alt={player.display_name} /> : initials(player.display_name)}
        </div>
      </div>
      <div className="fut-card__mid" />
      <div className="fut-card__name">{player.display_name}</div>
      <div className="fut-card__team">
        {player.team_type === "club" ? "🏆" : "🏳️"} {player.team_name}
      </div>
      <div className="fut-card__stats">
        <div>
          <div className="s-val">{player.team_att}</div>
          <div className="s-lbl">ATA</div>
        </div>
        <div>
          <div className="s-val">{player.team_mid}</div>
          <div className="s-lbl">MED</div>
        </div>
        <div>
          <div className="s-val">{player.team_def}</div>
          <div className="s-lbl">DEF</div>
        </div>
      </div>
    </div>
  );
}

export { tierFor };
export type { Tier };
