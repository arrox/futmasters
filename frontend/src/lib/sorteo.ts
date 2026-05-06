import type {
  Assignment,
  BombosPreview,
  Group,
  Mode,
  Team,
} from "../api/client";
import { bomboOfTeam, buildBombos } from "./bombos";
import { selectEffectivePool } from "./poolSelector";
import { makeRng } from "./rng";

export const MODE_SIMPLE: Mode = "simple";
export const MODE_BOMBO_EQUILIBRADO: Mode = "bombo_equilibrado";
export const MODE_DRAFT: Mode = "draft_bombos";
export const VALID_MODES: Mode[] = [MODE_SIMPLE, MODE_BOMBO_EQUILIBRADO, MODE_DRAFT];

export function availableModes(n: number, numBombos: number): Mode[] {
  const modes: Mode[] = [MODE_SIMPLE, MODE_DRAFT];
  if (numBombos > 0 && n % numBombos === 0) {
    modes.splice(1, 0, MODE_BOMBO_EQUILIBRADO);
  }
  return modes;
}

function groupLabel(idx: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return idx < letters.length ? `Grupo ${letters[idx]}` : `Grupo ${idx + 1}`;
}

export interface ParticipantIn {
  name: string;
  email?: string | null;
}

function normalizeParticipants(input: Array<string | ParticipantIn>): ParticipantIn[] {
  return input.map((p) =>
    typeof p === "string" ? { name: p, email: null } : { name: p.name, email: p.email ?? null },
  );
}

function sortearSimple(
  participants: string[],
  pool: Team[],
  bombos: BombosPreview[],
  seed: number | null,
): { assignments: Assignment[]; groups: Group[] | null } {
  const rng = makeRng(seed);
  const shuffled = [...pool];
  rng.shuffle(shuffled);
  const assignments: Assignment[] = participants.map((participant, i) => {
    const team = shuffled[i];
    return {
      participant,
      team: team.name,
      ovr: team.ovr,
      bombo: bomboOfTeam(bombos, team.name),
      pick_order: i + 1,
    };
  });
  return { assignments, groups: null };
}

function sortearBomboEquilibrado(
  participants: string[],
  _pool: Team[],
  bombos: BombosPreview[],
  seed: number | null,
): { assignments: Assignment[]; groups: Group[] | null } {
  const n = participants.length;
  const b = bombos.length;
  if (b === 0 || n % b !== 0) {
    throw new Error("Modo bombo_equilibrado requiere N múltiplo del número de bombos");
  }
  const rng = makeRng(seed);
  const numGrupos = n / b;

  const participantesIdx = Array.from({ length: n }, (_, i) => i);
  rng.shuffle(participantesIdx);
  const gruposParticipantes: number[][] = [];
  for (let i = 0; i < numGrupos; i++) {
    gruposParticipantes.push(participantesIdx.slice(i * b, (i + 1) * b));
  }

  const equiposPorGrupo: Team[][] = Array.from({ length: numGrupos }, () => []);
  for (const bombo of bombos) {
    const equipos = [...bombo.equipos];
    rng.shuffle(equipos);
    if (equipos.length < numGrupos) {
      throw new Error("Bombo con menos equipos que grupos — inconsistente");
    }
    for (let g = 0; g < numGrupos; g++) equiposPorGrupo[g].push(equipos[g]);
  }

  const assignments: (Assignment | null)[] = Array(n).fill(null);
  const groupsOut: Group[] = [];
  let pickOrder = 0;
  gruposParticipantes.forEach((grupo, gIdx) => {
    const idxParts = [...grupo];
    rng.shuffle(idxParts);
    const equiposDelGrupo = equiposPorGrupo[gIdx];
    const integrantes: Group["integrantes"] = [];
    for (let k = 0; k < equiposDelGrupo.length; k++) {
      const team = equiposDelGrupo[k];
      const pIdx = idxParts[k];
      pickOrder += 1;
      const bombo = bomboOfTeam(bombos, team.name);
      const assignment: Assignment = {
        participant: participants[pIdx],
        team: team.name,
        ovr: team.ovr,
        bombo,
        pick_order: pickOrder,
      };
      assignments[pIdx] = assignment;
      integrantes.push({
        participant: participants[pIdx],
        team: team.name,
        ovr: team.ovr,
        bombo,
      });
    }
    groupsOut.push({ nombre: groupLabel(gIdx), integrantes });
  });

  const result = assignments.filter((a): a is Assignment => a !== null);
  if (result.length !== n) throw new Error("Asignaciones incompletas en bombo_equilibrado");
  return { assignments: result, groups: groupsOut };
}

function sortearDraftBombos(
  participants: string[],
  _pool: Team[],
  bombos: BombosPreview[],
  seed: number | null,
): { assignments: Assignment[]; groups: Group[] | null } {
  const n = participants.length;
  const total = bombos.reduce((s, b) => s + b.equipos.length, 0);
  if (total !== n) {
    throw new Error("Cantidad de equipos en bombos no coincide con participantes");
  }
  const rng = makeRng(seed);
  const ordenPick = Array.from({ length: n }, (_, i) => i);
  rng.shuffle(ordenPick);

  const assignments: (Assignment | null)[] = Array(n).fill(null);
  let cursor = 0;
  for (const bombo of bombos) {
    const equipos = [...bombo.equipos];
    rng.shuffle(equipos);
    for (const team of equipos) {
      const pIdx = ordenPick[cursor];
      assignments[pIdx] = {
        participant: participants[pIdx],
        team: team.name,
        ovr: team.ovr,
        bombo: bombo.numero,
        pick_order: cursor + 1,
      };
      cursor += 1;
    }
  }
  const result = assignments.filter((a): a is Assignment => a !== null);
  if (result.length !== n) throw new Error("Asignaciones incompletas en draft_bombos");
  return { assignments: result, groups: null };
}

export interface EjecutarSorteoResult {
  pool: Team[];
  bombos: BombosPreview[];
  assignments: Array<Assignment & { email: string | null }>;
  groups: Array<Group & { integrantes: Array<Group["integrantes"][number] & { email: string | null }> }> | null;
  participants_ext: ParticipantIn[];
}

export function ejecutarSorteo(
  participants: Array<string | ParticipantIn>,
  mode: Mode,
  seed: number | null = null,
): EjecutarSorteoResult {
  if (!VALID_MODES.includes(mode)) throw new Error(`Modo inválido: ${mode}`);
  const n = participants.length;
  if (n < 2 || n > 20) throw new Error("Cantidad de participantes debe estar entre 2 y 20");

  const norm = normalizeParticipants(participants);
  const names = norm.map((p) => p.name);

  const pool = selectEffectivePool(n);
  const bombos = buildBombos(pool);

  let res: { assignments: Assignment[]; groups: Group[] | null };
  if (mode === MODE_SIMPLE) res = sortearSimple(names, pool, bombos, seed);
  else if (mode === MODE_BOMBO_EQUILIBRADO) res = sortearBomboEquilibrado(names, pool, bombos, seed);
  else res = sortearDraftBombos(names, pool, bombos, seed);

  const emailByName = new Map(norm.map((p) => [p.name, p.email ?? null]));
  const assignments = res.assignments.map((a) => ({ ...a, email: emailByName.get(a.participant) ?? null }));
  const groups =
    res.groups === null
      ? null
      : res.groups.map((g) => ({
          ...g,
          integrantes: g.integrantes.map((i) => ({
            ...i,
            email: emailByName.get(i.participant) ?? null,
          })),
        }));

  return { pool, bombos, assignments, groups, participants_ext: norm };
}
