export type MeetingStatus = "CONFIRMED" | "PENDING" | "CANCELLED" | "RESCHEDULED";
export type MeetingChannel = "Zoom" | "Meet" | "Teams";

export interface Meeting {
  id?: string;
  lead_id: string;
  agency_id: string;
  scheduled_date: string;
  scheduled_time: string;
  timezone: string;
  duration_minutes: number;
  channel: MeetingChannel;
  meeting_url: string;
  status: MeetingStatus;
}
