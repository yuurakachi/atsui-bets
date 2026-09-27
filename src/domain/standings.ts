import type { ProfileId } from "./types";

export interface StandingEntry {
  profileId: ProfileId;
  points: number;
}

/**
 * Participants with the same points, occupying positions `from`..`to` (1-based, inclusive).
 * Three people tied behind five others occupy positions 6–8.
 */
export interface StandingGroup {
  from: number;
  to: number;
  points: number;
  profileIds: ProfileId[];
}

export function rankEntries(entries: readonly StandingEntry[]): StandingGroup[] {
  const sorted = [...entries].sort(
    (a, b) => b.points - a.points || a.profileId.localeCompare(b.profileId),
  );

  const groups: StandingGroup[] = [];
  for (const entry of sorted) {
    const last = groups.at(-1);
    if (last && last.points === entry.points) {
      last.to++;
      last.profileIds.push(entry.profileId);
    } else {
      const position = (last?.to ?? 0) + 1;
      groups.push({ from: position, to: position, points: entry.points, profileIds: [entry.profileId] });
    }
  }
  return groups;
}
