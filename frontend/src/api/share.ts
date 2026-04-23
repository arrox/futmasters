/**
 * Helpers para compartir contenido en WhatsApp / X / otros.
 *
 * Usa wa.me deep links (no requiere Business API). El usuario hace clic,
 * elige el contacto/grupo destino y manda el mensaje con un clic más.
 */

export function publicBase(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function matchHighlightUrl(matchId: number): string {
  return `${publicBase()}/api/matches/${matchId}/highlight.png`;
}

export function tournamentPublicUrl(tournamentId: string): string {
  return `${publicBase()}/t/${tournamentId}`;
}

export function registrationUrl(): string {
  return `${publicBase()}/`;
}

export function whatsappShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Abre WhatsApp con el mensaje listo. WhatsApp hace fetch de la URL
 * para mostrar un OG preview del highlight PNG.
 */
export function shareMatchResult(params: {
  matchId: number;
  tournamentId: string;
  tournamentName: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  stageLabel: string;
}): string {
  const {
    matchId,
    tournamentId,
    tournamentName,
    homeName,
    awayName,
    homeScore,
    awayScore,
    stageLabel,
  } = params;
  const image = matchHighlightUrl(matchId);
  const site = tournamentPublicUrl(tournamentId);
  const winner =
    homeScore === awayScore
      ? "¡Empate!"
      : homeScore > awayScore
        ? `Ganó ${homeName}`
        : `Ganó ${awayName}`;
  const text =
    `🏆 ${tournamentName} · ${stageLabel}\n` +
    `⚽ ${homeName} ${homeScore} — ${awayScore} ${awayName}\n` +
    `${winner}\n\n` +
    `Ver torneo: ${site}\n` +
    `Imagen: ${image}`;
  return whatsappShare(text);
}

export function shareRegistration(text?: string): string {
  const body =
    text ??
    `⚽ Inscríbete al sorteo FC 26 · FutMasters\n${registrationUrl()}`;
  return whatsappShare(body);
}

export function shareTournament(params: {
  tournamentId: string;
  tournamentName: string;
  status?: string;
}): string {
  const { tournamentId, tournamentName, status } = params;
  const url = tournamentPublicUrl(tournamentId);
  const text =
    `🏆 ${tournamentName}` +
    (status ? ` · ${status}` : "") +
    `\nSigue el torneo: ${url}`;
  return whatsappShare(text);
}
