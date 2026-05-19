export type Priority = "HIGH" | "MEDIUM" | "LOW";

export type LeadStatus =
  | "READY_FOR_AUDIT"
  | "READY_FOR_OUTREACH"
  | "READY_FOR_CLOSING"
  | "OUTREACH_ACTIVE"
  | "MEETING_SCHEDULED"
  | "CONVERTED"
  | "ARCHIVED";

export interface Lead {
  id?: string;
  company_name: string;
  industry: string;
  estimated_employees: number;
  website_url: string;
  location: string;
  detected_deficiencies: string[];
  opportunity_score: number;
  priority: Priority;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id?: string;
  technical_score: number;
  deficiencies: string[];
  current_stack: Record<string, string>;
  modernization_plan: string[];
  total_estimated_monthly_loss: number;
  executive_summary: string;
  audit_date: string;
  status: string;
}
