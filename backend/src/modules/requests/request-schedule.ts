export interface RequestSchedule {
  departureAt: Date;
  durationMin: number;
}

export const MAX_OVERLAPPING_PENDING_REQUESTS = 3;

export function schedulesOverlap(
  first: RequestSchedule,
  second: RequestSchedule,
): boolean {
  const firstStartsAt = first.departureAt.getTime();
  const firstEndsAt = firstStartsAt + first.durationMin * 60_000;
  const secondStartsAt = second.departureAt.getTime();
  const secondEndsAt = secondStartsAt + second.durationMin * 60_000;

  return firstStartsAt < secondEndsAt && secondStartsAt < firstEndsAt;
}
