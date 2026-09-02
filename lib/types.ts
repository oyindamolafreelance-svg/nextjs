export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  is_approved: boolean;
  is_admin: boolean;
  is_exempt: boolean;
  clip_token: string | null;
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
  source_url: string | null;
  source_name: string | null;
  external_id: string | null;
  review_status: string;
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
