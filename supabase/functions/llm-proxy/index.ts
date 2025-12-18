import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================

type PipelineStage = 
  | 'ambiguity_analysis'
  | 'structure_check'
  | 'quality_check'
  | 'acceptance_criteria'
  | 'business_value'
  | 'solution_bias';

type Operation = PipelineStage | 'rewrite' | 'analyze' | 'full_pipeline';
type PromptVersion = 'v1';

interface LLMRequest {
  operation: Operation;
  storyText: string;
  promptVersion?: PromptVersion;
  structuredStory?: {
    role?: string;
    goal?: string;
    benefit?: string;
    constraints?: string[];
  };
  context?: string;
  relevantIssues?: Array<{
    id?: string;
    category: string;
    reasoning: string;
    userNote?: string;
    textReference?: string;
  }>;
  previousResults?: Record<string, unknown>;
  runtimeConfig?: {
    temperature?: number;
    topK?: number;
    maxTokens?: number;
  };
}

// ============================================================================
// INVEST QUALITY RULES
// ============================================================================

const INVEST_RULES = [
  { id: 'invest_independent', name: 'Independent', criteria: 'Story sollte unabhängig implementierbar sein' },
  { id: 'invest_negotiable', name: 'Negotiable', criteria: 'Keine Implementierungsdetails, Raum für Diskussion' },
  { id: 'invest_valuable', name: 'Valuable', criteria: 'Klarer Geschäftswert für Nutzer/Unternehmen' },
  { id: 'invest_estimable', name: 'Estimable', criteria: 'Genug Info für Aufwandsschätzung' },
  { id: 'invest_small', name: 'Small', criteria: 'Klein genug für einen Sprint' },
  { id: 'invest_testable', name: 'Testable', criteria: 'Klare Akzeptanzkriterien möglich' },
];

const VOCABULARY = [
  { term: 'Benutzer', def: 'Aktiver Systemnutzer', avoid: ['jemand', 'man'] },
  { term: 'Admin', def: 'Administrator mit erweiterten Rechten' },
  { term: 'möchte ich', def: 'Gewünschtes Ziel/Feature', avoid: ['brauche', 'muss haben'] },
  { term: 'damit', def: 'Business Value / Nutzen', avoid: ['weil', 'denn'] },
];

const FEW_SHOT_EXAMPLES = {
  ambiguity: `Beispiel:
Input: "Als Benutzer möchte ich Daten schnell laden können."
Output: {"issues":[{"category":"ambiguity","textReference":"schnell","reasoning":"'Schnell' ist nicht messbar. Was bedeutet schnell?","clarificationQuestion":"Welche konkreten Ladezeiten sind akzeptabel?"}]}`,
  structure: `Beispiel:
Input: "User löschen können."
Output: {"issues":[{"category":"missing_role","reasoning":"Keine Rolle angegeben"},{"category":"missing_benefit","reasoning":"Kein Nutzen angegeben"}]}`,
};

// ============================================================================
// PROMPT TEMPLATES V1 - 6-Stage Pipeline
// ============================================================================

const PROMPT_V1: Record<string, string> = {
  // Stage 1: Ambiguity Analysis
  ambiguity_analysis: `Du bist ein Experte für User Story Qualität. Analysiere auf MEHRDEUTIGKEITEN.

INVEST-Kriterium: Estimable (Schätzbar)
- Sind alle Begriffe klar definiert?
- Gibt es Wörter mit mehreren Interpretationen?
- Fehlen Quantifizierungen?

QUALITÄTSREGELN (INVEST):
{{qualityRules}}

VOKABULAR:
{{vocabulary}}

{{fewShotExamples}}

WICHTIGE REGELN:
1. Analysiere NUR den gegebenen Text – KEINE neuen fachlichen Infos erfinden
2. Markiere Unsicherheiten mit "[UNSICHER]"
3. Zitiere konkrete Textstellen
4. Bei fehlendem Kontext → Klärungsfragen stellen
5. Antworte NUR mit validem JSON

AUSGABEFORMAT:
{
  "stage": "ambiguity_analysis",
  "issues": [{
    "id": "amb_1",
    "category": "ambiguity",
    "severity": "critical|major|minor|info",
    "textReference": "Exaktes Zitat",
    "reasoning": "Begründung",
    "clarificationQuestion": "Rückfrage",
    "confidence": "high|medium|low"
  }],
  "summary": "Zusammenfassung"
}`,

  // Stage 2: Structure Check
  structure_check: `Du bist ein User Story Struktur-Experte. Prüfe auf STRUKTURELLE VOLLSTÄNDIGKEIT.

INVEST-Kriterien: Independent, Valuable
- Hat die Story eine klare Rolle?
- Ist das Ziel verständlich?
- Ist der Nutzen angegeben?

QUALITÄTSREGELN:
{{qualityRules}}

VORHERIGE ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Prüfe auf "Als [Rolle] möchte ich [Ziel], damit [Nutzen]"
2. KEINE neuen Details erfinden
3. Antworte NUR mit validem JSON

AUSGABEFORMAT:
{
  "stage": "structure_check",
  "structuredModel": {
    "role": "Erkannte Rolle oder null",
    "goal": "Erkanntes Ziel oder null", 
    "benefit": "Erkannter Nutzen oder null",
    "constraints": [],
    "parseConfidence": "high|medium|low"
  },
  "issues": [{
    "id": "struct_1",
    "category": "missing_role|missing_goal|missing_benefit",
    "severity": "critical|major|minor|info",
    "affectedSection": "role|goal|benefit",
    "textReference": "Betroffene Stelle",
    "reasoning": "Begründung",
    "confidence": "high|medium|low"
  }],
  "summary": "Struktur-Zusammenfassung"
}`,

  // Stage 3: Quality Check
  quality_check: `Du bist ein QA-Experte für User Stories. Prüfe auf QUALITÄTSPROBLEME.

INVEST-Kriterien: Small, Testable, Negotiable
- Ist die Story klein genug?
- Kann sie getestet werden?
- Enthält sie Lösungsvorgaben?

QUALITÄTSREGELN (INVEST):
{{qualityRules}}

VORHERIGE ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Bewerte gegen INVEST-Kriterien
2. KEINE neuen Anforderungen erfinden
3. Markiere Unsicherheiten mit "[UNSICHER]"
4. Antworte NUR mit validem JSON

AUSGABEFORMAT:
{
  "stage": "quality_check",
  "issues": [{
    "id": "qual_1",
    "category": "too_broad_scope|not_testable|solution_bias|other",
    "severity": "critical|major|minor|info",
    "textReference": "Betroffene Stelle",
    "reasoning": "Begründung",
    "investCriterion": "I|N|V|E|S|T",
    "suggestedAction": "Vorschlag",
    "confidence": "high|medium|low"
  }],
  "overallScore": 0-100,
  "summary": "Qualitäts-Zusammenfassung"
}`,

  // Stage 4: Business Value Analysis
  business_value: `Du bist ein Business-Analyst. Prüfe auf BUSINESS VALUE.

INVEST-Kriterium: Valuable
- Ist der Geschäftswert erkennbar?
- Profitiert Nutzer oder Unternehmen?
- Ist der Nutzen messbar?

VORHERIGE ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Bewerte ob echter Business Value vorhanden ist
2. KEINE neuen Geschäftsziele erfinden
3. Antworte NUR mit validem JSON

AUSGABEFORMAT:
{
  "stage": "business_value",
  "issues": [{
    "id": "bv_1",
    "category": "business_value_gap",
    "severity": "critical|major|minor|info",
    "textReference": "Nutzen-Formulierung",
    "reasoning": "Warum Value unklar",
    "suggestedBenefit": "Verbesserungsvorschlag",
    "confidence": "high|medium|low"
  }],
  "valueAssessment": {
    "hasValue": true|false,
    "valueType": "user|business|technical",
    "clarity": "high|medium|low"
  },
  "summary": "Value-Bewertung"
}`,

  // Stage 5: Solution Bias Detection
  solution_bias: `Du bist ein Requirements-Engineer. Prüfe auf SOLUTION BIAS.

INVEST-Kriterium: Negotiable
- Beschreibt die Story ein Problem oder eine Lösung?
- Werden Implementierungsdetails vorgegeben?
- Bleibt Raum für Alternativen?

VORHERIGE ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Identifiziere technische Vorgaben im Ziel
2. Unterscheide Was (ok) vs Wie (problematisch)
3. Antworte NUR mit validem JSON

AUSGABEFORMAT:
{
  "stage": "solution_bias",
  "issues": [{
    "id": "sb_1",
    "category": "solution_bias",
    "severity": "critical|major|minor|info",
    "textReference": "Technische Vorgabe",
    "reasoning": "Warum Solution Bias",
    "alternativeFormulation": "Neutrale Formulierung",
    "confidence": "high|medium|low"
  }],
  "hasSolutionBias": true|false,
  "summary": "Solution Bias Bewertung"
}`,

  // Stage 6: Acceptance Criteria Generation
  acceptance_criteria: `Du bist ein AC-Experte. Generiere testbare Kriterien im Given-When-Then Format.

INVEST-Kriterium: Testable
- Jedes Kriterium muss testbar sein
- Decke Hauptfall, Fehler- und Grenzfälle ab

VORHERIGE ERGEBNISSE:
{{previousResults}}

WICHTIGE REGELN:
1. Leite Kriterien NUR aus der Story ab
2. KEINE neuen Business-Regeln erfinden
3. Markiere Annahmen mit "[ANNAHME]"
4. Antworte NUR mit validem JSON

AUSGABEFORMAT:
{
  "stage": "acceptance_criteria",
  "criteria": [{
    "id": "ac_1",
    "title": "Titel",
    "given": "Vorbedingung",
    "when": "Aktion",
    "then": "Erwartetes Ergebnis",
    "type": "happy_path|edge_case|error_case|negative_case",
    "priority": "must|should|could",
    "notes": "Anmerkungen",
    "confidence": "high|medium|low"
  }],
  "coverage": {
    "mainFlow": true|false,
    "errorCases": true|false,
    "edgeCases": true|false,
    "negativeCases": true|false
  },
  "openQuestions": []
}`,

  // Rewrite Operation
  rewrite: `Du bist ein User Story Experte. Erstelle verbesserte Versionen.

QUALITÄTSREGELN (INVEST):
{{qualityRules}}

ZU ADRESSIERENDE ISSUES:
{{relevantIssues}}

WICHTIGE REGELN:
1. Basiere Rewrites NUR auf gegebenen Informationen
2. Fehlende Infos → [PLATZHALTER: Beschreibung]
3. Erkläre jede Änderung
4. Erstelle 2-3 Varianten
5. Antworte NUR mit validem JSON

AUSGABEFORMAT:
{
  "candidates": [{
    "id": "rw_1",
    "text": "Verbesserte Story",
    "explanation": "Begründung",
    "addressedIssueIds": ["issue_1"],
    "changes": [{"type": "modified", "description": "Änderung"}],
    "confidence": "high|medium|low",
    "openQuestions": []
  }]
}`,

  // Legacy analyze operation (maps to full pipeline summary)
  analyze: `Du bist ein User Story Analyst. Führe eine umfassende Qualitätsanalyse durch.

QUALITÄTSREGELN (INVEST):
{{qualityRules}}

VOKABULAR:
{{vocabulary}}

WICHTIGE REGELN:
1. Analysiere NUR den gegebenen Text
2. Markiere Unsicherheiten mit "[UNSICHER]"
3. Beziehe dich auf konkrete Textstellen
4. Antworte NUR mit validem JSON

KATEGORIEN:
- completeness: Fehlende Infos (Rolle, Ziel, Nutzen)
- clarity/ambiguity: Unklare Formulierungen
- testability: Nicht testbar
- scope: Zu großer Umfang
- consistency: Widersprüche

AUSGABEFORMAT:
{
  "issues": [{
    "id": "issue_1",
    "category": "completeness|clarity|testability|scope|consistency",
    "severity": "low|medium|high",
    "textReference": "Betroffene Stelle",
    "reasoning": "Begründung",
    "clarificationQuestion": "Rückfrage",
    "confidence": "high|medium|low"
  }],
  "score": 0-100,
  "summary": "Zusammenfassung"
}`,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function fillTemplate(template: string, data: {
  qualityRules?: string;
  vocabulary?: string;
  previousResults?: string;
  relevantIssues?: string;
  fewShotExamples?: string;
  context?: string;
}): string {
  let filled = template;
  filled = filled.replace('{{qualityRules}}', data.qualityRules || formatQualityRules());
  filled = filled.replace('{{vocabulary}}', data.vocabulary || formatVocabulary());
  filled = filled.replace('{{previousResults}}', data.previousResults || 'Keine vorherigen Ergebnisse.');
  filled = filled.replace('{{relevantIssues}}', data.relevantIssues || 'Keine spezifischen Issues angegeben.');
  filled = filled.replace('{{fewShotExamples}}', data.fewShotExamples || '');
  filled = filled.replace('{{context}}', data.context || '');
  return filled;
}

function formatQualityRules(): string {
  return INVEST_RULES.map(r => `- ${r.name}: ${r.criteria}`).join('\n');
}

function formatVocabulary(): string {
  return VOCABULARY.map(v => {
    let entry = `- ${v.term}: ${v.def}`;
    if (v.avoid) entry += ` (vermeide: ${v.avoid.join(', ')})`;
    return entry;
  }).join('\n');
}

function getSystemPrompt(operation: Operation, version: PromptVersion = 'v1'): string {
  const templates = PROMPT_V1;
  return templates[operation] || templates.analyze;
}

function validateResponse(operation: Operation, data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  
  switch (operation) {
    case 'ambiguity_analysis':
    case 'structure_check':
    case 'quality_check':
    case 'business_value':
    case 'solution_bias':
      return Array.isArray(obj.issues);
    case 'acceptance_criteria':
      return Array.isArray(obj.criteria);
    case 'rewrite':
      return Array.isArray(obj.candidates) && (obj.candidates as unknown[]).length > 0;
    case 'analyze':
      return Array.isArray(obj.issues) && typeof obj.score === 'number';
    case 'full_pipeline':
      return typeof obj.stages === 'object';
    default:
      return false;
  }
}

async function callLLM(
  prompt: string, 
  systemPrompt: string, 
  apiKey: string,
  config?: { temperature?: number; maxTokens?: number }
): Promise<unknown> {
  const temperature = config?.temperature ?? 0.7;
  const maxTokens = config?.maxTokens ?? 2000;

  console.log(`Calling LLM with temperature=${temperature}, maxTokens=${maxTokens}`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LLM API error:', response.status, errorText);
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Empty response from LLM');
  }

  // Parse JSON from response
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  return JSON.parse(jsonStr);
}

function buildUserPrompt(body: LLMRequest): string {
  const { storyText, structuredStory, context, relevantIssues, previousResults } = body;
  
  let prompt = `User Story:\n${storyText}`;
  
  if (structuredStory) {
    prompt += `\n\nStrukturierte Felder:
- Rolle: ${structuredStory.role || 'nicht angegeben'}
- Ziel: ${structuredStory.goal || 'nicht angegeben'}
- Nutzen: ${structuredStory.benefit || 'nicht angegeben'}`;
    if (structuredStory.constraints?.length) {
      prompt += `\n- Einschränkungen: ${structuredStory.constraints.join(', ')}`;
    }
  }
  
  if (context) {
    prompt += `\n\nZusätzlicher Kontext:\n${context}`;
  }

  return prompt;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LLM_API_KEY');
    if (!apiKey) {
      throw new Error('LLM_API_KEY is not configured');
    }

    const body: LLMRequest = await req.json();
    const { 
      operation, 
      storyText, 
      promptVersion = 'v1', 
      relevantIssues,
      previousResults,
      runtimeConfig 
    } = body;

    const validOperations = [
      'analyze', 'rewrite', 'acceptance_criteria', 'full_pipeline',
      'ambiguity_analysis', 'structure_check', 'quality_check', 
      'business_value', 'solution_bias'
    ];

    if (!operation || !validOperations.includes(operation)) {
      return new Response(
        JSON.stringify({ error: `Invalid operation. Must be one of: ${validOperations.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!storyText) {
      return new Response(
        JSON.stringify({ error: 'storyText is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${operation} with promptVersion=${promptVersion}`);

    // Build user prompt
    let userPrompt = buildUserPrompt(body);

    // Get and contextualize system prompt
    let systemPrompt = getSystemPrompt(operation, promptVersion);
    
    // Fill template variables
    const templateData: Record<string, string> = {
      qualityRules: formatQualityRules(),
      vocabulary: formatVocabulary(),
    };

    // Add few-shot examples for certain operations
    if (operation === 'ambiguity_analysis') {
      templateData.fewShotExamples = FEW_SHOT_EXAMPLES.ambiguity;
    } else if (operation === 'structure_check') {
      templateData.fewShotExamples = FEW_SHOT_EXAMPLES.structure;
    }

    // Add previous results for pipeline stages
    if (previousResults) {
      templateData.previousResults = JSON.stringify(previousResults, null, 2);
    }

    // Add relevant issues for rewrite
    if (relevantIssues?.length) {
      templateData.relevantIssues = relevantIssues.map((issue, i) => 
        `${i + 1}. [${issue.category}] ${issue.reasoning}${issue.userNote ? ` (Nutzer: ${issue.userNote})` : ''}`
      ).join('\n');

      // Also add to user prompt for rewrite
      if (operation === 'rewrite') {
        userPrompt += `\n\nZu adressierende Issues:\n${templateData.relevantIssues}`;
      }
    }

    systemPrompt = fillTemplate(systemPrompt, templateData);

    console.log(`User prompt length: ${userPrompt.length}, System prompt length: ${systemPrompt.length}`);

    // First attempt
    let result: unknown;
    let isValid = false;
    
    try {
      result = await callLLM(userPrompt, systemPrompt, apiKey, runtimeConfig);
      isValid = validateResponse(operation, result);
      
      if (!isValid) {
        console.log('First attempt invalid, retrying...');
      }
    } catch (error) {
      console.error('First attempt failed:', error);
    }

    // Retry once if invalid
    if (!isValid) {
      try {
        result = await callLLM(
          userPrompt + '\n\nWICHTIG: Antworte NUR mit validem JSON gemäß dem Ausgabeformat.',
          systemPrompt,
          apiKey,
          runtimeConfig
        );
        isValid = validateResponse(operation, result);
      } catch (error) {
        console.error('Retry failed:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to get valid response after retry' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid response structure', rawResponse: result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${operation} completed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        meta: { 
          promptVersion,
          operation,
          timestamp: new Date().toISOString(),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in llm-proxy:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
