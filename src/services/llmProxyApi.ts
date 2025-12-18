import { supabase } from "@/integrations/supabase/client";
import { AnalysisIssue, RewriteCandidate, AcceptanceCriterion, StructuredStory, ContextSnippet, generateId, createTimestamp } from "@/types/storyState";

// ============================================
// Request Types
// ============================================
interface LLMProxyRequest {
  operation: 'analyze' | 'rewrite' | 'acceptance_criteria';
  storyText: string;
  structuredStory?: {
    role?: string;
    goal?: string;
    benefit?: string;
    constraints?: string[];
  };
  context?: string;
}

// ============================================
// Response Types from Backend
// ============================================
interface AnalyzeApiResponse {
  issues: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
  score: number;
  suggestions: string[];
}

interface RewriteApiResponse {
  candidates: Array<{
    id: string;
    text: string;
    improvements: string[];
  }>;
}

interface AcceptanceCriteriaApiResponse {
  criteria: Array<{
    id: string;
    title: string;
    given: string;
    when: string;
    then: string;
  }>;
}

// ============================================
// Mapped Response Types
// ============================================
export interface AnalyzeResult {
  issues: AnalysisIssue[];
  score: number;
}

export interface RewriteResult {
  candidates: RewriteCandidate[];
}

export interface AcceptanceCriteriaResult {
  criteria: AcceptanceCriterion[];
}

// ============================================
// API Call Helper
// ============================================
async function callLLMProxy<T>(request: LLMProxyRequest): Promise<T> {
  const { data, error } = await supabase.functions.invoke('llm-proxy', {
    body: request,
  });

  if (error) {
    console.error('LLM Proxy error:', error);
    throw new Error(error.message || 'Fehler beim Aufrufen des LLM-Proxy');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Ungültige Antwort vom LLM-Proxy');
  }

  return data.data as T;
}

// ============================================
// Map severity from API to internal format
// ============================================
function mapSeverity(severity: 'low' | 'medium' | 'high'): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'info';
  }
}

// ============================================
// Map category from API to internal format
// ============================================
function mapCategory(category: string): AnalysisIssue['category'] {
  const categoryMap: Record<string, AnalysisIssue['category']> = {
    'completeness': 'missing_context',
    'clarity': 'vague_language',
    'testability': 'not_testable',
    'scope': 'too_long',
  };
  return categoryMap[category] || 'other';
}

// ============================================
// Build context string from snippets
// ============================================
function buildContextString(snippets: ContextSnippet[]): string | undefined {
  if (!snippets || snippets.length === 0) return undefined;
  return snippets.map(s => `${s.source ? `[${s.source}] ` : ''}${s.text}`).join('\n\n');
}

// ============================================
// API Functions
// ============================================
export async function analyzeStoryApi(
  storyText: string,
  structuredStory: StructuredStory | null,
  contextSnippets: ContextSnippet[]
): Promise<AnalyzeResult> {
  const response = await callLLMProxy<AnalyzeApiResponse>({
    operation: 'analyze',
    storyText,
    structuredStory: structuredStory ? {
      role: structuredStory.role,
      goal: structuredStory.goal,
      benefit: structuredStory.benefit,
      constraints: structuredStory.constraints,
    } : undefined,
    context: buildContextString(contextSnippets),
  });

  // Map API response to internal format
  const issues: AnalysisIssue[] = response.issues.map((issue, index) => ({
    id: generateId(),
    category: mapCategory(issue.category),
    textReference: issue.message,
    reasoning: issue.message,
    severity: mapSeverity(issue.severity),
  }));

  return {
    issues,
    score: response.score,
  };
}

export async function rewriteStoryApi(
  storyText: string,
  structuredStory: StructuredStory | null,
  contextSnippets: ContextSnippet[]
): Promise<RewriteResult> {
  const response = await callLLMProxy<RewriteApiResponse>({
    operation: 'rewrite',
    storyText,
    structuredStory: structuredStory ? {
      role: structuredStory.role,
      goal: structuredStory.goal,
      benefit: structuredStory.benefit,
      constraints: structuredStory.constraints,
    } : undefined,
    context: buildContextString(contextSnippets),
  });

  // Map API response to internal format
  const candidates: RewriteCandidate[] = response.candidates.map((candidate) => ({
    id: candidate.id || generateId(),
    suggestedText: candidate.text,
    explanation: candidate.improvements.join(', '),
    createdAt: createTimestamp(),
  }));

  return { candidates };
}

export async function generateAcceptanceCriteriaApi(
  storyText: string,
  structuredStory: StructuredStory | null,
  contextSnippets: ContextSnippet[]
): Promise<AcceptanceCriteriaResult> {
  const response = await callLLMProxy<AcceptanceCriteriaApiResponse>({
    operation: 'acceptance_criteria',
    storyText,
    structuredStory: structuredStory ? {
      role: structuredStory.role,
      goal: structuredStory.goal,
      benefit: structuredStory.benefit,
      constraints: structuredStory.constraints,
    } : undefined,
    context: buildContextString(contextSnippets),
  });

  // Map API response to internal format
  const criteria: AcceptanceCriterion[] = response.criteria.map((c) => ({
    id: c.id || generateId(),
    given: c.given,
    when: c.when,
    then: c.then,
    notes: c.title,
  }));

  return { criteria };
}
