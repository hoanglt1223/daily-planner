/**
 * Client-side helpers for the booking system.
 * All calls go through apiFetch which handles auth headers + error normalization.
 */
import { apiFetch } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookingEventType {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  active: boolean;
  createdAt: string;
}

export interface AvailabilityWindow {
  id?: string;
  weekday: number; // 0 = Sunday, 6 = Saturday
  startMinute: number;
  endMinute: number;
}

export interface BookingSettings {
  bookingBufferMinutes: number;
  bookingMinNoticeMinutes: number;
  bookingHorizonDays: number;
}

export interface SlotEntry {
  startAt: string;
  endAt: string;
}

export interface PublicOwner {
  name: string;
  timezone: string;
}

export interface PublicEventType {
  id: string;
  name: string;
  durationMinutes: number;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Owner: event type CRUD
// ---------------------------------------------------------------------------

export function listEventTypes(): Promise<BookingEventType[]> {
  return apiFetch<BookingEventType[]>('/api/bookings/event-types');
}

export function createEventType(data: {
  name: string;
  durationMinutes: number;
  description?: string;
  active?: boolean;
}): Promise<BookingEventType> {
  return apiFetch<BookingEventType>('/api/bookings/event-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateEventType(id: string, data: {
  name?: string;
  durationMinutes?: number;
  description?: string | null;
  active?: boolean;
}): Promise<BookingEventType> {
  return apiFetch<BookingEventType>(`/api/bookings/event-types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteEventType(id: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/api/bookings/event-types/${id}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Owner: availability windows
// ---------------------------------------------------------------------------

export function listAvailability(): Promise<AvailabilityWindow[]> {
  return apiFetch<AvailabilityWindow[]>('/api/bookings/availability');
}

export function replaceAvailability(windows: Omit<AvailabilityWindow, 'id'>[]): Promise<AvailabilityWindow[]> {
  return apiFetch<AvailabilityWindow[]>('/api/bookings/availability', {
    method: 'PUT',
    body: JSON.stringify({ windows }),
  });
}

// ---------------------------------------------------------------------------
// Owner: booking settings
// ---------------------------------------------------------------------------

export function updateBookingSettings(data: Partial<BookingSettings>): Promise<BookingSettings> {
  return apiFetch<BookingSettings>('/api/bookings/booking-settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Public: visitor-facing
// ---------------------------------------------------------------------------

export function getPublicEventTypes(token: string): Promise<{ owner: PublicOwner; eventTypes: PublicEventType[] }> {
  return apiFetch<{ owner: PublicOwner; eventTypes: PublicEventType[] }>(
    `/api/bookings/event-types-public?token=${encodeURIComponent(token)}`
  );
}

export function getSlotsV2(token: string, eventTypeId: string): Promise<{
  owner: PublicOwner;
  eventType: PublicEventType;
  slots: SlotEntry[];
}> {
  return apiFetch<{ owner: PublicOwner; eventType: PublicEventType; slots: SlotEntry[] }>(
    `/api/bookings/slots?token=${encodeURIComponent(token)}&eventTypeId=${encodeURIComponent(eventTypeId)}`
  );
}

export function getBookingByRescheduleToken(rescheduleToken: string) {
  return apiFetch<{
    id: string; title: string; startAt: string; endAt: string;
    status: string; visitorName: string; ownerUserId: string; eventTypeId: string | null;
  }>(`/api/bookings/booking-by-token?rescheduleToken=${encodeURIComponent(rescheduleToken)}`);
}

export function getBookingByCancelToken(cancelToken: string) {
  return apiFetch<{
    id: string; title: string; startAt: string; endAt: string;
    status: string; visitorName: string; ownerUserId: string; eventTypeId: string | null;
  }>(`/api/bookings/booking-by-token?cancelToken=${encodeURIComponent(cancelToken)}`);
}

export function cancelByToken(cancelToken: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/api/bookings/cancel-by-token', {
    method: 'POST',
    body: JSON.stringify({ cancelToken }),
  });
}

export function rescheduleByToken(data: {
  rescheduleToken: string;
  startAt: string;
  endAt: string;
}): Promise<{ status: string; rescheduleToken: string; cancelToken: string }> {
  return apiFetch<{ status: string; rescheduleToken: string; cancelToken: string }>(
    '/api/bookings/reschedule-by-token',
    { method: 'POST', body: JSON.stringify(data) }
  );
}

/**
 * Fetch available slots for rescheduling using only the rescheduleToken.
 * The current booking's slot is excluded from the busy list so the visitor
 * can re-select it if they just want to confirm the same time.
 */
export function getRescheduleSlots(rescheduleToken: string): Promise<{
  owner: PublicOwner;
  slots: SlotEntry[];
}> {
  return apiFetch<{ owner: PublicOwner; slots: SlotEntry[] }>(
    `/api/bookings/reschedule-slots?rescheduleToken=${encodeURIComponent(rescheduleToken)}`
  );
}
