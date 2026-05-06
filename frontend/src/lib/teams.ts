import type { Team } from "../api/client";

export const TEAMS: Team[] = [
  { name: "Real Madrid",         type: "club",   ovr: 88, att: 86, mid: 83, def: 86, bombo: 1, priority: 1 },
  { name: "Manchester City",     type: "club",   ovr: 85, att: 85, mid: 82, def: 84, bombo: 1, priority: 2 },
  { name: "Paris Saint-Germain", type: "club",   ovr: 85, att: 85, mid: 86, def: 85, bombo: 1, priority: 3 },
  { name: "FC Barcelona",        type: "club",   ovr: 85, att: 86, mid: 84, def: 81, bombo: 1, priority: 4 },
  { name: "Francia",             type: "nation", ovr: 85, att: 87, mid: 83, def: 85, bombo: 1, priority: 5 },
  { name: "España",              type: "nation", ovr: 85, att: 82, mid: 86, def: 83, bombo: 2, priority: 6 },
  { name: "Bayern Munich",       type: "club",   ovr: 84, att: 85, mid: 83, def: 84, bombo: 2, priority: 7 },
  { name: "Arsenal",             type: "club",   ovr: 84, att: 84, mid: 83, def: 84, bombo: 2, priority: 8 },
  { name: "Liverpool",           type: "club",   ovr: 84, att: 84, mid: 83, def: 85, bombo: 2, priority: 9 },
  { name: "Argentina",           type: "nation", ovr: 84, att: 85, mid: 82, def: 83, bombo: 2, priority: 10 },
  { name: "Inglaterra",          type: "nation", ovr: 84, att: 85, mid: 84, def: 81, bombo: 3, priority: 11 },
  { name: "Portugal",            type: "nation", ovr: 84, att: 85, mid: 84, def: 83, bombo: 3, priority: 12 },
  { name: "Inter de Milán",      type: "club",   ovr: 83, att: 83, mid: 82, def: 83, bombo: 3, priority: 13 },
  { name: "Países Bajos",        type: "nation", ovr: 83, att: 83, mid: 82, def: 83, bombo: 3, priority: 14 },
  { name: "Alemania",            type: "nation", ovr: 83, att: 82, mid: 82, def: 84, bombo: 3, priority: 15 },
  { name: "Chelsea",             type: "club",   ovr: 83, att: 83, mid: 82, def: 82, bombo: 4, priority: 16 },
  { name: "Atlético Madrid",     type: "club",   ovr: 83, att: 82, mid: 82, def: 84, bombo: 4, priority: 17 },
  { name: "Napoli",              type: "club",   ovr: 83, att: 82, mid: 82, def: 83, bombo: 4, priority: 18 },
  { name: "Italia",              type: "nation", ovr: 83, att: 82, mid: 83, def: 84, bombo: 4, priority: 19 },
  { name: "Manchester United",   type: "club",   ovr: 82, att: 82, mid: 81, def: 82, bombo: 4, priority: 20 },
];

export function getTeamsSorted(): Team[] {
  return [...TEAMS].sort((a, b) => a.priority - b.priority);
}
