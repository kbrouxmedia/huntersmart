export type OutreachStatus = "SCHEDULED" | "SENT" | "RESPONDED" | "REJECTED";

export interface OutreachMessage {
  day: number;
  content: string;
  sent_at?: string;
}

export interface Outreach {
  id?: string;
  lead_id: string;
  agency_id: string;
  messages: OutreachMessage[];
  status: OutreachStatus;
  created_at: string;
}
