import type { Match, Player } from "../api/client";

interface Props {
  matches: Match[];
  players: Player[];
}

const KO_STAGES = ["round_of_16", "quarter", "semi", "final"] as const;

const STAGE_LABEL: Record<string, string> = {
  round_of_16: "Octavos",
  quarter: "Cuartos",
  semi: "Semifinales",
  final: "Final",
};

export default function BracketView({ matches, players }: Props) {
  const pMap = new Map(players.map((p) => [p.id, p]));
  const ko = matches.filter((m) =>
    (KO_STAGES as readonly string[]).includes(m.stage),
  );
  if (ko.length === 0) {
    return (
      <div className="fm-surface">
        <div className="fm-eyebrow mb-2">Knockout</div>
        <p style={{ color: "var(--fm-ink-muted)", fontSize: 13 }}>
          Todavía no se sorteó la eliminatoria. Completá los partidos de grupo y
          presioná "Sortear llaves".
        </p>
      </div>
    );
  }
  const byStage: Record<string, Match[]> = {};
  for (const m of ko) {
    (byStage[m.stage] ||= []).push(m);
    byStage[m.stage].sort(
      (x, y) => (x.bracket_position ?? 0) - (y.bracket_position ?? 0),
    );
  }
  const stages = KO_STAGES.filter((s) => byStage[s]);

  return (
    <div className="fm-surface overflow-x-auto">
      <div className="mb-4">
        <div className="fm-eyebrow">Knockout bracket</div>
        <h2 className="fm-h2" style={{ marginTop: 2 }}>
          Llaves
        </h2>
        <div className="fm-bar-gold" style={{ marginTop: 8, width: 60 }} />
      </div>
      <div className="flex gap-6 min-w-fit pb-2">
        {stages.map((stage) => (
          <div
            key={stage}
            className="flex flex-col justify-around gap-4 min-w-[220px]"
          >
            <h3
              className="fm-display"
              style={{
                fontSize: 14,
                color: "var(--fm-gold)",
              }}
            >
              {STAGE_LABEL[stage]}
            </h3>
            {byStage[stage].map((m) => (
              <BracketCard
                key={m.id}
                match={m}
                home={m.home_player_id ? pMap.get(m.home_player_id) : undefined}
                away={m.away_player_id ? pMap.get(m.away_player_id) : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketCard({
  match,
  home,
  away,
}: {
  match: Match;
  home?: Player;
  away?: Player;
}) {
  const hs = match.home_score;
  const as_ = match.away_score;
  const played = match.status === "played";
  const homeWins = played && hs! > as_!;
  const awayWins = played && as_! > hs!;

  return (
    <div
      style={{
        border: "1px solid rgba(240,196,96,0.22)",
        borderRadius: 10,
        background: "rgba(5,7,12,0.5)",
        overflow: "hidden",
      }}
    >
      <Side
        name={home?.display_name ?? match.slot_home ?? "?"}
        team={home?.team_name ?? ""}
        score={hs}
        winner={homeWins}
      />
      <div style={{ borderTop: "1px solid rgba(240,196,96,0.2)" }} />
      <Side
        name={away?.display_name ?? match.slot_away ?? "?"}
        team={away?.team_name ?? ""}
        score={as_}
        winner={awayWins}
      />
    </div>
  );
}

function Side({
  name,
  team,
  score,
  winner,
}: {
  name: string;
  team: string;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2"
      style={
        winner
          ? {
              background: "rgba(240,196,96,0.1)",
              color: "var(--fm-gold)",
            }
          : undefined
      }
    >
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        {team && (
          <div className="text-[10px] text-slate-400 truncate">{team}</div>
        )}
      </div>
      <div className="mono text-xl font-bold w-8 text-right">
        {score ?? "—"}
      </div>
    </div>
  );
}
