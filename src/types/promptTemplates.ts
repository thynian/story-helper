// ============================================
// Prompt Templates - Versioned Pipeline Prompts
// ============================================

import { PipelineStage, QualityRule, VocabularyEntry, FewShotExample } from './storyTypes';

// ============================================
// INVEST QUALITY RULES
// ============================================
export const INVEST_RULES: QualityRule[] = [
  {
    id: 'invest_independent',
    name: 'Independent',
    description: 'Die Story sollte unabhängig von anderen Stories sein und eigenständig Wert liefern.',
    category: 'too_broad_scope',
    checkCriteria: 'Prüfe ob die Story Abhängigkeiten zu anderen Stories hat oder eigenständig implementiert werden kann.',
  },
  {
    id: 'invest_negotiable',
    name: 'Negotiable',
    description: 'Die Story sollte verhandelbar sein - keine detaillierten Spezifikationen, sondern Raum für Diskussion.',
    category: 'solution_bias',
    checkCriteria: 'Prüfe ob die Story Implementierungsdetails vorgibt statt das gewünschte Ergebnis zu beschreiben.',
  },
  {
    id: 'invest_valuable',
    name: 'Valuable',
    description: 'Die Story muss einen klaren Geschäftswert für den Endnutzer oder das Unternehmen liefern.',
    category: 'business_value_gap',
    checkCriteria: 'Prüfe ob der Nutzen klar formuliert ist und einen echten Mehrwert darstellt.',
  },
  {
    id: 'invest_estimable',
    name: 'Estimable',
    description: 'Die Story sollte gut genug verstanden werden, um den Aufwand schätzen zu können.',
    category: 'ambiguity',
    checkCriteria: 'Prüfe ob genug Informationen vorhanden sind, um den Aufwand zu schätzen.',
  },
  {
    id: 'invest_small',
    name: 'Small',
    description: 'Die Story sollte klein genug sein, um in einem Sprint umgesetzt zu werden.',
    category: 'too_broad_scope',
    checkCriteria: 'Prüfe ob die Story in kleinere Stories aufgeteilt werden sollte.',
  },
  {
    id: 'invest_testable',
    name: 'Testable',
    description: 'Es muss möglich sein, die Story zu testen und festzustellen, wann sie fertig ist.',
    category: 'not_testable',
    checkCriteria: 'Prüfe ob klare Akzeptanzkriterien definiert werden können.',
  },
];

// ============================================
// VOCABULARY / GLOSSAR
// ============================================
export const DEFAULT_VOCABULARY: VocabularyEntry[] = [
  {
    term: 'Benutzer',
    definition: 'Die Person, die das System aktiv nutzt',
    synonyms: ['User', 'Anwender', 'Nutzer'],
    avoidTerms: ['jemand', 'man'],
  },
  {
    term: 'Admin',
    definition: 'Administrator mit erweiterten Berechtigungen',
    synonyms: ['Administrator', 'Systemverwalter'],
  },
  {
    term: 'möchte ich',
    definition: 'Beschreibt das gewünschte Ziel/Feature',
    avoidTerms: ['brauche', 'muss haben', 'soll können'],
  },
  {
    term: 'damit',
    definition: 'Beschreibt den Business Value / Nutzen',
    synonyms: ['um zu', 'sodass'],
    avoidTerms: ['weil', 'denn'],
  },
];

// ============================================
// FEW-SHOT EXAMPLES
// ============================================
export const ANALYSIS_EXAMPLES: FewShotExample[] = [
  {
    id: 'example_ambiguity_1',
    input: 'Als Benutzer möchte ich Daten schnell laden können.',
    expectedOutput: JSON.stringify({
      issues: [{
        category: 'ambiguity',
        severity: 'major',
        textReference: 'schnell laden',
        reasoning: '"Schnell" ist nicht messbar definiert. Was bedeutet schnell? Unter 1 Sekunde? Unter 5 Sekunden?',
        clarificationQuestion: 'Welche konkreten Ladezeiten gelten als akzeptabel?',
      }],
    }, null, 2),
    explanation: 'Vage Zeitangaben müssen quantifiziert werden.',
  },
  {
    id: 'example_missing_benefit',
    input: 'Als Admin möchte ich User löschen können.',
    expectedOutput: JSON.stringify({
      issues: [{
        category: 'missing_benefit',
        severity: 'major',
        textReference: 'User löschen können',
        reasoning: 'Der Nutzen/Wert dieser Funktion ist nicht angegeben. Warum ist diese Funktion wichtig?',
        clarificationQuestion: 'Welches Problem wird durch das Löschen von Usern gelöst?',
      }],
    }, null, 2),
    explanation: 'Jede Story braucht einen klaren Nutzen.',
  },
];

export const REWRITE_EXAMPLES: FewShotExample[] = [
  {
    id: 'rewrite_example_1',
    input: JSON.stringify({
      story: 'Als Benutzer möchte ich Daten schnell laden können.',
      issues: [{ category: 'ambiguity', textReference: 'schnell' }],
    }),
    expectedOutput: JSON.stringify({
      candidates: [{
        text: 'Als Benutzer möchte ich, dass die Datenliste innerhalb von 2 Sekunden geladen wird, damit ich effizient arbeiten kann.',
        explanation: 'Die vage Angabe "schnell" wurde durch eine konkrete, messbare Zeitangabe (2 Sekunden) ersetzt.',
        changes: [{ type: 'modified', description: '"schnell" → "innerhalb von 2 Sekunden"' }],
        openQuestions: ['Ist 2 Sekunden die gewünschte Zielzeit?'],
      }],
    }, null, 2),
  },
];

// ============================================
// PIPELINE PROMPT TEMPLATES V1
// ============================================

export const PROMPT_V1_AMBIGUITY = `Du bist ein Experte für User Story Qualität. Analysiere die folgende Story auf MEHRDEUTIGKEITEN und UNKLARHEITEN.

INVEST-Kriterium: Estimable (Schätzbar)
- Sind alle Begriffe klar definiert?
- Gibt es Wörter mit mehreren Interpretationsmöglichkeiten?
- Fehlen Quantifizierungen bei Mengenangaben oder Zeiträumen?

QUALITÄTSREGELN:
{{qualityRules}}

VOKABULAR-PRÜFUNG:
{{vocabulary}}

KONTEXT:
{{context}}

WICHTIGE REGELN:
1. Analysiere NUR den gegebenen Text – erfinde KEINE neuen fachlichen Informationen
2. Markiere Unsicherheiten explizit mit "[UNSICHER]"
3. Beziehe dich auf konkrete Textstellen (Zitat)
4. Wenn Kontext fehlt → stelle Klärungsfragen
5. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "stage": "ambiguity_analysis",
  "issues": [
    {
      "id": "amb_1",
      "category": "ambiguity",
      "severity": "critical|major|minor|info",
      "textReference": "Exaktes Zitat aus dem Text",
      "reasoning": "Begründung warum mehrdeutig",
      "clarificationQuestion": "Rückfrage zur Klärung",
      "confidence": "high|medium|low"
    }
  ],
  "summary": "Zusammenfassung der Ambiguitäts-Analyse"
}`;

export const PROMPT_V1_STRUCTURE = `Du bist ein User Story Struktur-Experte. Prüfe die folgende Story auf STRUKTURELLE VOLLSTÄNDIGKEIT.

INVEST-Kriterien: Independent, Valuable
- Hat die Story eine klare Rolle/Persona?
- Ist das Ziel verständlich formuliert?
- Ist der Nutzen (Business Value) angegeben?
- Gibt es implizite Abhängigkeiten?

QUALITÄTSREGELN:
{{qualityRules}}

KONTEXT:
{{context}}

VORHERIGE ANALYSE-ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Prüfe auf die Struktur "Als [Rolle] möchte ich [Ziel], damit [Nutzen]"
2. Erfinde KEINE neuen fachlichen Details
3. Markiere fehlende Elemente klar
4. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "stage": "structure_check",
  "structuredModel": {
    "role": "Erkannte Rolle oder null",
    "goal": "Erkanntes Ziel oder null",
    "benefit": "Erkannter Nutzen oder null",
    "constraints": ["Erkannte Einschränkungen"],
    "parseConfidence": "high|medium|low"
  },
  "issues": [
    {
      "id": "struct_1",
      "category": "missing_role|missing_goal|missing_benefit",
      "severity": "critical|major|minor|info",
      "affectedSection": "role|goal|benefit|constraint",
      "textReference": "Betroffene Stelle",
      "reasoning": "Warum fehlt das Element",
      "clarificationQuestion": "Rückfrage",
      "confidence": "high|medium|low"
    }
  ],
  "summary": "Struktur-Zusammenfassung"
}`;

export const PROMPT_V1_QUALITY = `Du bist ein Qualitätssicherungs-Experte für User Stories. Prüfe auf QUALITÄTSPROBLEME.

INVEST-Kriterien: Small, Testable, Negotiable
- Ist die Story klein genug für einen Sprint?
- Kann die Story getestet werden?
- Enthält sie Lösungsvorgaben statt Problembeschreibungen?

QUALITÄTSREGELN (INVEST):
{{qualityRules}}

KONTEXT:
{{context}}

VORHERIGE ANALYSE-ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Bewerte gegen INVEST-Kriterien
2. Erfinde KEINE neuen Anforderungen
3. Markiere Unsicherheiten mit "[UNSICHER]"
4. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "stage": "quality_check",
  "issues": [
    {
      "id": "qual_1",
      "category": "too_broad_scope|not_testable|solution_bias|other",
      "severity": "critical|major|minor|info",
      "textReference": "Betroffene Stelle",
      "reasoning": "Begründung des Problems",
      "suggestedAction": "Vorgeschlagene Korrektur",
      "clarificationQuestion": "Rückfrage bei Unsicherheit",
      "investCriterion": "I|N|V|E|S|T",
      "confidence": "high|medium|low"
    }
  ],
  "overallScore": 0-100,
  "summary": "Qualitäts-Zusammenfassung"
}`;

export const PROMPT_V1_BUSINESS_VALUE = `Du bist ein Business-Analyst. Prüfe die Story auf BUSINESS VALUE und NUTZENFORMULIERUNG.

INVEST-Kriterium: Valuable
- Ist der Geschäftswert klar erkennbar?
- Profitiert der Endnutzer oder das Unternehmen?
- Ist der Nutzen messbar oder zumindest beschreibbar?

KONTEXT:
{{context}}

VORHERIGE ANALYSE-ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Bewerte ob echter Business Value vorhanden ist
2. Erfinde KEINE neuen Geschäftsziele
3. Schlage Verbesserungen vor wenn Value unklar
4. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "stage": "business_value",
  "issues": [
    {
      "id": "bv_1",
      "category": "business_value_gap",
      "severity": "critical|major|minor|info",
      "textReference": "Betroffene Nutzen-Formulierung",
      "reasoning": "Warum ist der Value unklar",
      "suggestedBenefit": "Vorschlag für bessere Formulierung",
      "clarificationQuestion": "Rückfrage zum Business Value",
      "confidence": "high|medium|low"
    }
  ],
  "valueAssessment": {
    "hasValue": true|false,
    "valueType": "user|business|technical",
    "clarity": "high|medium|low"
  },
  "summary": "Business Value Bewertung"
}`;

export const PROMPT_V1_SOLUTION_BIAS = `Du bist ein Requirements-Engineer. Prüfe die Story auf LÖSUNGSVORGABEN (Solution Bias).

INVEST-Kriterium: Negotiable
- Beschreibt die Story ein Problem oder eine Lösung?
- Werden Implementierungsdetails vorgegeben?
- Bleibt Raum für alternative Umsetzungen?

KONTEXT:
{{context}}

VORHERIGE ANALYSE-ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Identifiziere technische Vorgaben im Ziel
2. Unterscheide zwischen Was (erlaubt) und Wie (problematisch)
3. Schlage neutrale Formulierungen vor
4. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "stage": "solution_bias",
  "issues": [
    {
      "id": "sb_1",
      "category": "solution_bias",
      "severity": "critical|major|minor|info",
      "textReference": "Technische/Lösungsvorgabe",
      "reasoning": "Warum ist dies ein Solution Bias",
      "alternativeFormulation": "Neutrale Problem-Formulierung",
      "confidence": "high|medium|low"
    }
  ],
  "hasSolutionBias": true|false,
  "summary": "Solution Bias Bewertung"
}`;

export const PROMPT_V1_ACCEPTANCE_CRITERIA = `Du bist ein Experte für Akzeptanzkriterien. Generiere testbare Kriterien im Given-When-Then Format.

INVEST-Kriterium: Testable
- Jedes Kriterium muss konkret testbar sein
- Decke Hauptfall, Fehlerfälle und Grenzfälle ab
- Basiere NUR auf der gegebenen Story

FEW-SHOT BEISPIELE:
{{examples}}

KONTEXT:
{{context}}

VORHERIGE ANALYSE-ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Leite Kriterien NUR aus der Story ab
2. Erfinde KEINE neuen Business-Regeln
3. Markiere Annahmen mit "[ANNAHME]"
4. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "stage": "acceptance_criteria",
  "criteria": [
    {
      "id": "ac_1",
      "title": "Beschreibender Titel",
      "given": "Vorbedingung",
      "when": "Auslösende Aktion",
      "then": "Erwartetes Ergebnis",
      "type": "happy_path|edge_case|error_case|negative_case",
      "priority": "must|should|could",
      "notes": "Anmerkungen oder Annahmen",
      "confidence": "high|medium|low"
    }
  ],
  "coverage": {
    "mainFlow": true|false,
    "errorCases": true|false,
    "edgeCases": true|false,
    "negativeCases": true|false
  },
  "openQuestions": ["Fragen für vollständige Abdeckung"]
}`;

export const PROMPT_V1_REWRITE = `Du bist ein User Story Experte. Erstelle verbesserte Versionen basierend auf den erkannten Issues.

QUALITÄTSREGELN:
{{qualityRules}}

ZU ADRESSIERENDE ISSUES:
{{relevantIssues}}

KONTEXT:
{{context}}

WICHTIGE REGELN:
1. Basiere Rewrites NUR auf den gegebenen Informationen
2. Wenn Informationen fehlen, markiere mit [PLATZHALTER: Beschreibung]
3. Erkläre jede Änderung nachvollziehbar
4. Erstelle 2-3 verschiedene Varianten
5. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "candidates": [
    {
      "id": "rw_1",
      "text": "Verbesserte Story im Als/Möchte/Damit Format",
      "explanation": "Begründung für diese Version",
      "addressedIssueIds": ["issue_1", "issue_2"],
      "changes": [
        {"type": "added|removed|modified|clarified", "description": "Was wurde geändert"}
      ],
      "confidence": "high|medium|low",
      "openQuestions": ["Noch zu klärende Fragen"]
    }
  ]
}`;

// ============================================
// TEMPLATE REGISTRY
// ============================================
export interface PromptTemplateRegistry {
  version: string;
  templates: Record<PipelineStage | 'rewrite', string>;
  qualityRules: QualityRule[];
  vocabulary: VocabularyEntry[];
  examples: Record<string, FewShotExample[]>;
}

export const PROMPT_REGISTRY_V1: PromptTemplateRegistry = {
  version: 'v1',
  templates: {
    ambiguity_analysis: PROMPT_V1_AMBIGUITY,
    structure_check: PROMPT_V1_STRUCTURE,
    quality_check: PROMPT_V1_QUALITY,
    business_value: PROMPT_V1_BUSINESS_VALUE,
    solution_bias: PROMPT_V1_SOLUTION_BIAS,
    acceptance_criteria: PROMPT_V1_ACCEPTANCE_CRITERIA,
    rewrite: PROMPT_V1_REWRITE,
  },
  qualityRules: INVEST_RULES,
  vocabulary: DEFAULT_VOCABULARY,
  examples: {
    analysis: ANALYSIS_EXAMPLES,
    rewrite: REWRITE_EXAMPLES,
  },
};

export const PROMPT_REGISTRIES: Record<string, PromptTemplateRegistry> = {
  v1: PROMPT_REGISTRY_V1,
};
