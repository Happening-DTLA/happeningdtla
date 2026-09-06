import { pacificToday } from "@dtlahappening/core";

/**
 * Lower bound for a Postgres `date` query selecting the current/future night.
 *
 * `Night.date` is a wall-calendar date stored by Prisma as midnight UTC. The
 * day deciding whether it is past is nevertheless Los Angeles's day: between
 * 5pm and midnight Pacific, UTC is already tomorrow. Converting
 * `pacificToday()` back to UTC midnight preserves both meanings.
 */
export function currentNightDate(now: Date = new Date()): Date {
  return new Date(`${pacificToday(now)}T00:00:00Z`);
}
