import { Database } from '@/types/database';

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

export type Academy = Tables<'academies'>;
export type Instructor = Tables<'instructors'>;
export type Class = Tables<'classes'>;
export type Schedule = Tables<'schedules'>;
export type Hall = Tables<'halls'>;
export type User = Tables<'users'>;
export type Ticket = Tables<'tickets'>;
export type UserTicket = Tables<'user_tickets'>;
export type Booking = Tables<'bookings'>;

