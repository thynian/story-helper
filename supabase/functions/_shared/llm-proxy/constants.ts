// ============================================================================
// INVEST QUALITY RULES
// ============================================================================

export interface QualityRule {
  id: string;
  name: string;
  criteria: string;
}

export const INVEST_RULES: QualityRule[] = [
  { id: 'invest_independent', name: 'Independent', criteria: 'Story sollte unabhängig implementierbar sein' },
  { id: 'invest_negotiable', name: 'Negotiable', criteria: 'Keine Implementierungsdetails, Raum für Diskussion' },
  { id: 'invest_valuable', name: 'Valuable', criteria: 'Klarer Geschäftswert für Nutzer/Unternehmen' },
  { id: 'invest_estimable', name: 'Estimable', criteria: 'Genug Info für Aufwandsschätzung' },
  { id: 'invest_small', name: 'Small', criteria: 'Klein genug für einen Sprint' },
  { id: 'invest_testable', name: 'Testable', criteria: 'Klare Akzeptanzkriterien möglich' },
];

// ============================================================================
// VOCABULARY
// ============================================================================

export interface VocabularyEntry {
  term: string;
  def: string;
  avoid?: string[];
}

export const VOCABULARY: VocabularyEntry[] = [
  { term: 'Benutzer', def: 'Aktiver Systemnutzer', avoid: ['jemand', 'man'] },
  { term: 'Admin', def: 'Administrator mit erweiterten Rechten' },
  { term: 'möchte ich', def: 'Gewünschtes Ziel/Feature', avoid: ['brauche', 'muss haben'] },
  { term: 'damit', def: 'Business Value / Nutzen', avoid: ['weil', 'denn'] },
];

// ============================================================================
// FEW-SHOT EXAMPLES
// ============================================================================

export interface FewShotExamples {
  ambiguity: string;
  structure: string;
}

export const FEW_SHOT_EXAMPLES: FewShotExamples = {
  ambiguity: `Beispiel:
Input: "Als Benutzer möchte ich Daten schnell laden können."
Output: {"issues":[{"category":"ambiguity","textReference":"schnell","reasoning":"'Schnell' ist nicht messbar. Was bedeutet schnell?","clarificationQuestion":"Welche konkreten Ladezeiten sind akzeptabel?"}]}`,
  structure: `Beispiel:
Input: "User löschen können."
Output: {"issues":[{"category":"missing_role","reasoning":"Keine Rolle angegeben"},{"category":"missing_benefit","reasoning":"Kein Nutzen angegeben"}]}`,
};

// ============================================================================
// HELPER FUNCTIONS FOR FORMATTING
// ============================================================================

export function formatQualityRules(): string {
  return INVEST_RULES.map(r => `- ${r.name}: ${r.criteria}`).join('\n');
}

export function formatVocabulary(): string {
  return VOCABULARY.map(v => {
    let entry = `- ${v.term}: ${v.def}`;
    if (v.avoid) entry += ` (vermeide: ${v.avoid.join(', ')})`;
    return entry;
  }).join('\n');
}
