import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Operation = 'analyze' | 'rewrite' | 'acceptance_criteria';
type PromptVersion = 'v1';

// ============================================================================
// VERSIONED PROMPT TEMPLATES
// ============================================================================

const PROMPT_V1_ANALYZE = `Du bist ein erfahrener User Story Analyst. Deine Aufgabe ist es, User Stories auf Qualitätsprobleme zu analysieren.

WICHTIGE REGELN:
1. Analysiere NUR den gegebenen Text – erfinde KEINE neuen fachlichen Informationen
2. Markiere Unsicherheiten explizit mit "[UNSICHER]" wenn du dir nicht sicher bist
3. Beziehe dich auf konkrete Textstellen (Zeilenreferenz oder Zitat)
4. Antworte AUSSCHLIESSLICH mit validem JSON

KATEGORIEN für Issues:
- "completeness": Fehlende Informationen (Rolle, Ziel, Nutzen)
- "clarity": Unklare oder mehrdeutige Formulierungen
- "testability": Nicht testbare oder zu vage Kriterien
- "scope": Zu großer oder vermischter Umfang
- "consistency": Widersprüche im Text

AUSGABEFORMAT (JSON):
{
  "issues": [
    {
      "id": "issue_1",
      "category": "completeness|clarity|testability|scope|consistency",
      "severity": "low|medium|high",
      "textReference": "Betroffene Textstelle oder Zitat",
      "reasoning": "Begründung warum dies ein Problem ist",
      "clarificationQuestion": "Optionale Rückfrage an den Autor",
      "confidence": "high|medium|low"
    }
  ],
  "score": 0-100,
  "summary": "Kurze Zusammenfassung der Hauptprobleme"
}`;

const PROMPT_V1_REWRITE = `Du bist ein User Story Experte. Deine Aufgabe ist es, verbesserte Versionen einer User Story zu erstellen.

WICHTIGE REGELN:
1. Basiere Rewrites NUR auf den gegebenen Informationen – erfinde KEINE neuen fachlichen Details
2. Wenn Informationen fehlen, markiere Lücken mit [PLATZHALTER: Beschreibung]
3. Erkläre jede Änderung nachvollziehbar
4. Markiere Unsicherheiten mit "[UNSICHER]"
5. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "candidates": [
    {
      "id": "candidate_1",
      "text": "Als [Rolle] möchte ich [Ziel], damit [Nutzen].",
      "explanation": "Begründung für diese Version",
      "addressedIssues": ["issue_1", "issue_2"],
      "changes": [
        {"type": "added|removed|modified", "description": "Was wurde geändert"}
      ],
      "confidence": "high|medium|low",
      "openQuestions": ["Fragen die noch geklärt werden müssen"]
    }
  ]
}

Erstelle 2-3 verschiedene Varianten mit unterschiedlichen Schwerpunkten.`;

const PROMPT_V1_AC = `Du bist ein Experte für Akzeptanzkriterien. Deine Aufgabe ist es, testbare Akzeptanzkriterien im Given-When-Then Format zu erstellen.

WICHTIGE REGELN:
1. Leite Kriterien NUR aus der gegebenen Story ab – erfinde KEINE neuen fachlichen Anforderungen
2. Jedes Kriterium muss konkret testbar sein
3. Markiere Annahmen explizit mit "[ANNAHME]"
4. Markiere Unsicherheiten mit "[UNSICHER]"
5. Antworte AUSSCHLIESSLICH mit validem JSON

AUSGABEFORMAT (JSON):
{
  "criteria": [
    {
      "id": "ac_1",
      "title": "Kurzer beschreibender Titel",
      "given": "Vorbedingung/Ausgangssituation",
      "when": "Auslösende Aktion",
      "then": "Erwartetes Ergebnis",
      "notes": "Optionale Anmerkungen oder Annahmen",
      "priority": "must|should|could",
      "confidence": "high|medium|low"
    }
  ],
  "coverage": {
    "mainFlow": true|false,
    "errorCases": true|false,
    "edgeCases": true|false
  },
  "openQuestions": ["Fragen die für vollständige AC geklärt werden müssen"]
}

Erstelle 3-5 relevante Kriterien. Priorisiere den Hauptanwendungsfall.`;

// ============================================================================
// PROMPT VERSION REGISTRY
// ============================================================================

const PROMPT_TEMPLATES: Record<PromptVersion, Record<Operation, string>> = {
  v1: {
    analyze: PROMPT_V1_ANALYZE,
    rewrite: PROMPT_V1_REWRITE,
    acceptance_criteria: PROMPT_V1_AC,
  },
};

// ============================================================================
// TYPES
// ============================================================================

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
    category: string;
    reasoning: string;
    userNote?: string;
  }>;
}

interface AnalyzeResponse {
  issues: Array<{
    id: string;
    category: string;
    severity: 'low' | 'medium' | 'high';
    textReference?: string;
    reasoning: string;
    clarificationQuestion?: string;
    confidence?: string;
  }>;
  score: number;
  summary?: string;
}

interface RewriteResponse {
  candidates: Array<{
    id: string;
    text: string;
    explanation: string;
    addressedIssues?: string[];
    changes?: Array<{ type: string; description: string }>;
    confidence?: string;
    openQuestions?: string[];
  }>;
}

interface AcceptanceCriteriaResponse {
  criteria: Array<{
    id: string;
    title: string;
    given: string;
    when: string;
    then: string;
    notes?: string;
    priority?: string;
    confidence?: string;
  }>;
  coverage?: {
    mainFlow: boolean;
    errorCases: boolean;
    edgeCases: boolean;
  };
  openQuestions?: string[];
}

type LLMResponse = AnalyzeResponse | RewriteResponse | AcceptanceCriteriaResponse;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSystemPrompt(operation: Operation, version: PromptVersion = 'v1'): string {
  const templates = PROMPT_TEMPLATES[version];
  if (!templates) {
    console.warn(`Unknown prompt version: ${version}, falling back to v1`);
    return PROMPT_TEMPLATES.v1[operation];
  }
  return templates[operation];
}

function validateResponse(operation: Operation, data: unknown): data is LLMResponse {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  switch (operation) {
    case 'analyze':
      return Array.isArray(obj.issues) && typeof obj.score === 'number';
    case 'rewrite':
      return Array.isArray(obj.candidates) && obj.candidates.length > 0;
    case 'acceptance_criteria':
      return Array.isArray(obj.criteria) && obj.criteria.length > 0;
    default:
      return false;
  }
}

async function callLLM(prompt: string, systemPrompt: string, apiKey: string): Promise<unknown> {
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
      temperature: 0.7,
      max_tokens: 2000,
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

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  return JSON.parse(jsonStr);
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
    const { operation, storyText, promptVersion = 'v1', structuredStory, context, relevantIssues } = body;

    if (!operation || !['analyze', 'rewrite', 'acceptance_criteria'].includes(operation)) {
      return new Response(
        JSON.stringify({ error: 'Invalid operation. Must be: analyze, rewrite, or acceptance_criteria' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!storyText) {
      return new Response(
        JSON.stringify({ error: 'storyText is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${operation} request with promptVersion=${promptVersion}`);

    const systemPrompt = getSystemPrompt(operation, promptVersion);
    let userPrompt = `User Story:\n${storyText}`;
    
    if (structuredStory) {
      userPrompt += `\n\nStrukturierte Felder:\n- Rolle: ${structuredStory.role || 'nicht angegeben'}\n- Ziel: ${structuredStory.goal || 'nicht angegeben'}\n- Nutzen: ${structuredStory.benefit || 'nicht angegeben'}`;
      if (structuredStory.constraints?.length) {
        userPrompt += `\n- Einschränkungen: ${structuredStory.constraints.join(', ')}`;
      }
    }
    
    if (context) {
      userPrompt += `\n\nZusätzlicher Kontext vom Nutzer:\n${context}`;
    }

    // Include relevant issues for rewrite operation
    if (operation === 'rewrite' && relevantIssues?.length) {
      userPrompt += `\n\nRelevante Analyse-Issues die adressiert werden sollen:`;
      relevantIssues.forEach((issue, i) => {
        userPrompt += `\n${i + 1}. [${issue.category}] ${issue.reasoning}`;
        if (issue.userNote) {
          userPrompt += ` (Nutzer-Notiz: ${issue.userNote})`;
        }
      });
    }

    console.log(`User prompt length: ${userPrompt.length} chars`);

    // First attempt
    let result: unknown;
    let isValid = false;
    
    try {
      result = await callLLM(userPrompt, systemPrompt, apiKey);
      isValid = validateResponse(operation, result);
      
      if (!isValid) {
        console.log('First attempt invalid response structure, retrying...');
      }
    } catch (error) {
      console.error('First attempt failed:', error);
    }

    // Retry once if invalid
    if (!isValid) {
      try {
        result = await callLLM(
          userPrompt + '\n\nWICHTIG: Antworte NUR mit validem JSON gemäß dem vorgegebenen Format.',
          systemPrompt,
          apiKey
        );
        isValid = validateResponse(operation, result);
      } catch (error) {
        console.error('Retry attempt failed:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to get valid response from LLM after retry' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid response structure from LLM', rawResponse: result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${operation} completed successfully with promptVersion=${promptVersion}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        meta: { promptVersion }
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
