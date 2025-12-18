import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  INVEST_RULES, 
  VOCABULARY, 
  FEW_SHOT_EXAMPLES,
  formatQualityRules,
  formatVocabulary 
} from "../_shared/llm-proxy/constants.ts";
import { 
  PROMPT_V1, 
  getSystemPrompt,
  type Operation,
  type PromptVersion 
} from "../_shared/llm-proxy/prompts-v1.ts";

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
  const { storyText, structuredStory, context } = body;
  
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
