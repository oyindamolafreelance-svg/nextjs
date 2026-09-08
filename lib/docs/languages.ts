// Target languages offered by the document translator, plus a "low-resource"
// flag. Free LLM quality drops noticeably on low-resource pairs, so the UI
// warns and marks those outputs as mandatory human-review (per the spec).

export interface LanguageDef {
  name: string;
  lowResource?: boolean;
}

export const LANGUAGES: LanguageDef[] = [
  { name: "English" },
  { name: "Spanish" },
  { name: "French" },
  { name: "German" },
  { name: "Portuguese" },
  { name: "Italian" },
  { name: "Dutch" },
  { name: "Russian" },
  { name: "Arabic" },
  { name: "Chinese (Simplified)" },
  { name: "Chinese (Traditional)" },
  { name: "Japanese" },
  { name: "Korean" },
  { name: "Hindi" },
  { name: "Turkish" },
  { name: "Polish" },
  { name: "Ukrainian" },
  { name: "Vietnamese" },
  { name: "Indonesian" },
  { name: "Thai" },
  { name: "Hebrew" },
  { name: "Greek" },
  { name: "Swedish" },
  { name: "Romanian" },
  { name: "Czech" },
  // African & other lower-resource languages relevant to the community.
  { name: "Yoruba", lowResource: true },
  { name: "Igbo", lowResource: true },
  { name: "Hausa", lowResource: true },
  { name: "Swahili", lowResource: true },
  { name: "Amharic", lowResource: true },
  { name: "Zulu", lowResource: true },
  { name: "Mongolian", lowResource: true },
  { name: "Khmer", lowResource: true },
  { name: "Lao", lowResource: true },
  { name: "Pashto", lowResource: true },
];

export function isLowResource(name: string): boolean {
  return Boolean(LANGUAGES.find((l) => l.name === name)?.lowResource);
}
