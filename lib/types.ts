export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  is_approved: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  language_pair: string;
  domain: string;
  work_type: string;
  experience_required: string | null;
  apply_contact: string;
  description: string | null;
  application_instructions: string | null;
  source: string | null;
  posted_by: string | null;
  date_posted: string;
  expires_at: string | null;
  is_active: boolean;
}

// Fields the AI auto-fill helper parses out of pasted job text. Mirrors the
// editable inputs on the admin post-job form (everything except source, dates
// and is_active, which the admin sets directly).
export interface ParsedJobFields {
  title: string;
  language_pair: string;
  domain: string;
  work_type: string;
  experience_required: string;
  apply_contact: string;
  description: string;
  application_instructions: string;
}
