import { apiFetch } from '@/lib/api-client';

export type CapacityDay = {
  date: string; // yyyy-MM-dd UTC
  bookedMinutes: number;
  freeMinutes: number;
};

export type CapacityUser = {
  userId: string;
  name: string;
  email: string;
  privacy: string;
  days: CapacityDay[];
};

export type TeamCapacityResponse = {
  from: string;
  to: string;
  workdayMinutes: number;
  users: CapacityUser[];
};

export async function fetchTeamCapacity(from: Date, to: Date): Promise<TeamCapacityResponse> {
  const params = new URLSearchParams({
    kind: 'team-capacity',
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return apiFetch<TeamCapacityResponse>(`/api/reports?${params}`);
}
