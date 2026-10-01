/** Badges and short names for the teams, keyed by the name the family uses (see espn.ts). */
interface Team {
  abbr: string;
  /** ESPN team id, used for the badge image. */
  espnId: string;
}

const LIGA_MX: Record<string, Team> = {
  América: { abbr: "AME", espnId: "227" },
  Atlante: { abbr: "ATE", espnId: "226" },
  Atlas: { abbr: "ATS", espnId: "216" },
  Chivas: { abbr: "CHI", espnId: "219" },
  "Cruz Azul": { abbr: "CAZ", espnId: "218" },
  Juárez: { abbr: "JUA", espnId: "17851" },
  León: { abbr: "LEO", espnId: "228" },
  Monterrey: { abbr: "MTY", espnId: "220" },
  Necaxa: { abbr: "NEC", espnId: "229" },
  Pachuca: { abbr: "PAC", espnId: "234" },
  Puebla: { abbr: "PUE", espnId: "231" },
  Pumas: { abbr: "PUM", espnId: "233" },
  Querétaro: { abbr: "QRO", espnId: "222" },
  "San Luis": { abbr: "SL", espnId: "15720" },
  Santos: { abbr: "SAN", espnId: "225" },
  Tigres: { abbr: "TIG", espnId: "232" },
  Tijuana: { abbr: "TIJ", espnId: "10125" },
  Toluca: { abbr: "TOL", espnId: "223" },
};

export interface TeamBadge {
  abbr: string;
  /** null when we have no image for the team; show the abbreviation instead. */
  logo: string | null;
}

export function teamBadge(name: string): TeamBadge {
  const team = LIGA_MX[name];
  if (!team) return { abbr: name.slice(0, 3).toUpperCase(), logo: null };
  return {
    abbr: team.abbr,
    logo: `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${team.espnId}.png&h=48&w=48`,
  };
}
