import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Operation = 'analyze' | 'rewrite' | 'acceptance_criteria';

interface LLMRequest {
  operation: Operation;
  storyText: string;
  structuredStory?: {
    role?: string;
    goal?: string;
    benefit?: string;
    constraints?: string[];
  };
  context?: string;
}

interface AnalyzeResponse {
  issues: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
  score: number;
  suggestions: string[];
}

interface RewriteResponse {
  candidates: Array<{
    id: string;
    text: string;
    improvements: string[];
  }>;
}

interface AcceptanceCriteriaResponse {
  criteria: Array<{
    id: string;
    title: string;
    given: string;
    when: string;
    then: string;
  }>;
}

type LLMResponse = AnalyzeResponse | RewriteResponse | AcceptanceCriteriaResponse;

function getSystemPrompt(operation: Operation): string {
  switch (operation) {
    case 'analyze':
      return `Du bist ein User Story Analyst. Analysiere die gegebene User Story und identifiziere Probleme.
Antworte NUR mit validem JSON in diesem Format:
{
  "issues": [{"category": "completeness|clarity|testability|scope", "severity": "low|medium|high", "message": "Beschreibung"}],
  "score": 0-100,
  "suggestions": ["Verbesserungsvorschlag 1", "Verbesserungsvorschlag 2"]
}`;
    
    case 'rewrite':
      return `Du bist ein User Story Experte. Erstelle verbesserte Versionen der User Story.
Antworte NUR mit validem JSON in diesem Format:
{
  "candidates": [
    {"id": "1", "text": "Als [Rolle] möchte ich [Ziel], damit [Nutzen].", "improvements": ["Verbesserung 1", "Verbesserung 2"]}
  ]
}
Erstelle 2-3 Varianten.`;
    
    case 'acceptance_criteria':
      return `Du bist ein Akzeptanzkriterien-Experte. Erstelle Akzeptanzkriterien im Given-When-Then Format.
Antworte NUR mit validem JSON in diesem Format:
{
  "criteria": [
    {"id": "1", "title": "Kriterium Titel", "given": "Vorbedingung", "when": "Aktion", "then": "Erwartetes Ergebnis"}
  ]
}
Erstelle 3-5 relevante Kriterien.`;
  }
}

function validateResponse(operation: Operation, data: unknown): data is LLMResponse {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  switch (operation) {
    case 'analyze':
      return Array.isArray(obj.issues) && typeof obj.score === 'number' && Array.isArray(obj.suggestions);
    case 'rewrite':
      return Array.isArray(obj.candidates) && obj.candidates.length > 0;
    case 'acceptance_criteria':
      return Array.isArray(obj.criteria) && obj.criteria.length > 0;
    default:
      return false;
  }
}

async function callLLM(prompt: string, systemPrompt: string, apiKey: string): Promise<unknown> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const body: LLMRequest = await req.json();
    const { operation, storyText, structuredStory, context } = body;

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

    const systemPrompt = getSystemPrompt(operation);
    let userPrompt = `User Story:\n${storyText}`;
    
    if (structuredStory) {
      userPrompt += `\n\nStrukturierte Felder:\n- Rolle: ${structuredStory.role || 'nicht angegeben'}\n- Ziel: ${structuredStory.goal || 'nicht angegeben'}\n- Nutzen: ${structuredStory.benefit || 'nicht angegeben'}`;
      if (structuredStory.constraints?.length) {
        userPrompt += `\n- Einschränkungen: ${structuredStory.constraints.join(', ')}`;
      }
    }
    
    if (context) {
      userPrompt += `\n\nZusätzlicher Kontext:\n${context}`;
    }

    console.log(`Processing ${operation} request for story: ${storyText.substring(0, 100)}...`);

    // First attempt
    let result: unknown;
    let isValid = false;
    
    try {
      result = await callLLM(userPrompt, systemPrompt, apiKey);
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
        result = await callLLM(userPrompt + '\n\nWICHTIG: Antworte NUR mit validem JSON, ohne zusätzlichen Text.', systemPrompt, apiKey);
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

    console.log(`${operation} completed successfully`);

    return new Response(
      JSON.stringify({ success: true, data: result }),
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
