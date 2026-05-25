export type AgencyTier = "TIER1" | "TIER2" | "TIER3";

export interface Agency {
  id?: string;
  lead_id?: string;
  agency_name: string;
  website: string;
  location: string;
  specialization: string[];
  tier: AgencyTier;
  contact_name: string;
  contact_email: string;
  contact_linkedin: string;
  crm_status: string;
  created_at: string;
}

