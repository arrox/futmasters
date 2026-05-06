import { useState } from "react";
import type { Player, StandingRow } from "../api/client";
import { api } from "../api/client";

type Tier = "gold" | "silver" | "bronze" | "totw" | "icon" | "hero";

interface Props {
  player: Player;
  size?: "sm" | "md" | "lg";
  tierOverride?: Tier;
  className?: string;
  standing?: StandingRow | null;
  flippable?: boolean;
}

function tierFor(ovr: number, teamType: "club" | "nation"): Tier {
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
  standing = null,
  flippable = false,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const tier = tierOverride ?? tierFor(player.team_ovr, player.team_type);
  const photo = api.mediaUrl(player.photo_filename);
  const sizeClass = size === "sm" ? "fut-card--sm" : size === "lg" ? "fut-card--lg" : "";

  const canFlip = flippable && !!standing;

  const front = (
    <div
      className={`fut-card fut-card--${tier} ${sizeClass} ${className} ${photo ? "has-photo" : ""}`}
    >
      {photo && (
        <div className="fut-card__photo" aria-hidden>
          <img src={photo} alt="" />
        </div>
      )}
      <div className="fut-card__top">
        <div className="fut-card__meta">
          <div className="fut-card__ovr">{player.team_ovr}</div>
          <div className="fut-card__pos">{positionFor(player)}</div>
        </div>
        {!photo && (
          <div className="fut-card__crest">{initials(player.display_name)}</div>
        )}
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
      {canFlip && (
        <button
          type="button"
          className="fut-card__flip-hint"
          onClick={(e) => {
            e.stopPropagation();
            setFlipped(true);
          }}
          aria-label="Ver estadísticas del torneo"
        >
          ↻
        </button>
      )}
    </div>
  );

  if (!canFlip) return front;

  const back = (
    <div className={`stats-back ${sizeClass}`}>
      <div className="stats-back__header">
        <div className="stats-back__pos">
          {standing!.group_position || "—"}
        </div>
        <div className="stats-back__id">
          <div className="stats-back__name">{player.display_name}</div>
          <div className="stats-back__scope">
            {player.group_label ? `Grupo ${player.group_label}` : "Torneo"}
          </div>
        </div>
      </div>
      <div className="stats-back__grid">
        <BackStat label="PJ" value={standing!.pj} />
        <BackStat label="PTS" value={standing!.pts} highlight="gold" />
        <BackStat label="G" value={standing!.pg} highlight="green" />
        <BackStat label="E" value={standing!.pe} />
        <BackStat label="P" value={standing!.pp} highlight="red" />
        <BackStat label="GF" value={standing!.gf} />
        <BackStat label="GC" value={standing!.gc} />
        <BackStat
          label="DIF"
          value={`${standing!.dif > 0 ? "+" : ""}${standing!.dif}`}
          highlight={standing!.dif > 0 ? "green" : standing!.dif < 0 ? "red" : undefined}
        />
      </div>
      <button
        type="button"
        className="stats-back__close"
        onClick={(e) => {
          e.stopPropagation();
          setFlipped(false);
        }}
        aria-label="Volver al frente"
      >
        ↻
      </button>
    </div>
  );

  return (
    <div
      className={`fut-card-flip ${sizeClass} ${flipped ? "fut-card-flip--flipped" : ""}`}
      onClick={() => setFlipped((f) => !f)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }}
    >
      <div className="fut-card-flip__inner">
        <div className="fut-card-flip__face fut-card-flip__front">{front}</div>
        <div className="fut-card-flip__face fut-card-flip__back">{back}</div>
      </div>
    </div>
  );
}

function BackStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: "green" | "red" | "gold";
}) {
  return (
    <div className={`stats-back__stat ${highlight ? `stats-back__stat--${highlight}` : ""}`}>
      <span className="stats-back__stat-v">{value}</span>
      <span className="stats-back__stat-k">{label}</span>
    </div>
  );
}

export { tierFor };
export type { Tier };
