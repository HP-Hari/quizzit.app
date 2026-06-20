/**
 * Generate a unique 6-digit game PIN
 */
export function generatePin(): string {
  const min = 100000;
  const max = 999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * Calculate time-decay score
 * Faster answers earn more points (max = pointsBase, min = pointsBase * 0.5)
 */
export function calculateScore(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitMs: number,
  pointsBase: number,
  streak: number
): { points: number; streakBonus: number } {
  if (!isCorrect) {
    return { points: 0, streakBonus: 0 };
  }

  // Time factor: 1.0 (instant) → 0.5 (at time limit)
  const timeFactor = Math.max(0.5, 1 - (responseTimeMs / timeLimitMs) * 0.5);
  let points = Math.round(pointsBase * timeFactor);

  // Streak multiplier: 1x, 1.1x, 1.2x, 1.3x... (max 2x)
  const streakMultiplier = Math.min(2, 1 + streak * 0.1);
  const streakBonus = Math.round(points * (streakMultiplier - 1));
  points += streakBonus;

  return { points, streakBonus };
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}

/**
 * Generate a random avatar seed string
 */
export function generateAvatarSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Sanitize user input - strip HTML tags
 */
export function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Assign players to teams evenly
 */
export function assignTeams(
  playerIds: string[],
  teamCount: number
): Map<string, number> {
  const shuffled = shuffle(playerIds);
  const assignments = new Map<string, number>();
  shuffled.forEach((id, index) => {
    assignments.set(id, index % teamCount);
  });
  return assignments;
}

/**
 * Team color palette
 */
export const TEAM_COLORS = [
  "#E53E3E", "#3182CE", "#D69E2E", "#38A169",
  "#9F7AEA", "#ED64A6", "#DD6B20", "#319795",
  "#E53E3E", "#4C51BF", "#C05621", "#2F855A",
  "#805AD5", "#D53F8C", "#C53030", "#2B6CB0",
  "#B7791F", "#276749", "#6B46C1", "#B83280",
];

export const TEAM_NAMES = [
  "Phoenix", "Dragons", "Wolves", "Eagles",
  "Titans", "Panthers", "Falcons", "Lions",
  "Hawks", "Bears", "Sharks", "Cobras",
  "Vipers", "Tigers", "Foxes", "Ravens",
  "Storm", "Thunder", "Blaze", "Frost",
];
