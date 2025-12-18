import { supabase } from "@/integrations/supabase/client";
import { AnalysisIssue, RewriteCandidate, AcceptanceCriterion, StructuredStory, ContextSnippet, generateId, createTimestamp } from "@/types/storyState";

// ============================================
// Request Types
// ============================================
interface LLMProxyRequest {
  operation: 'analyze' | 'rewrite' | 'acceptance_criteria';
  storyText: string;
  promptVersion?: string;
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

// ============================================
// Response Types from Backend (v1)
// ============================================
interface AnalyzeApiResponse {
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

interface RewriteApiResponse {
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

interface AcceptanceCriteriaApiResponse {
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
    'consistency': 'other',
  };
  return categoryMap[category] || 'other';
}

// ============================================
// Build context string from snippets
// ============================================
function buildContextString(snippets: ContextSnippet[], additionalContext?: string): string | undefined {
  const parts: string[] = [];
  
  if (snippets && snippets.length > 0) {
    parts.push(snippets.map(s => `${s.source ? `[${s.source}] ` : ''}${s.text}`).join('\n\n'));
  }
  
  if (additionalContext?.trim()) {
    parts.push(additionalContext.trim());
  }
  
  return parts.length > 0 ? parts.join('\n\n---\n\n') : undefined;
}

// ============================================
// API Functions
// ============================================
export async function analyzeStoryApi(
  storyText: string,
  structuredStory: StructuredStory | null,
  contextSnippets: ContextSnippet[],
  additionalContext?: string,
  promptVersion: string = 'v1'
): Promise<AnalyzeResult> {
  const response = await callLLMProxy<AnalyzeApiResponse>({
    operation: 'analyze',
    storyText,
    promptVersion,
    structuredStory: structuredStory ? {
      role: structuredStory.role,
      goal: structuredStory.goal,
      benefit: structuredStory.benefit,
      constraints: structuredStory.constraints,
    } : undefined,
    context: buildContextString(contextSnippets, additionalContext),
  });

  // Map API response to internal format
  const issues: AnalysisIssue[] = response.issues.map((issue) => ({
    id: issue.id || generateId(),
    category: mapCategory(issue.category),
    textReference: issue.textReference || '',
    reasoning: issue.reasoning,
    severity: mapSeverity(issue.severity),
    clarificationQuestion: issue.clarificationQuestion,
    isRelevant: false,
    userNote: '',
  }));

  return {
    issues,
    score: response.score,
  };
}

export interface RelevantIssue {
  category: string;
  reasoning: string;
  userNote?: string;
}

export async function rewriteStoryApi(
  storyText: string,
  structuredStory: StructuredStory | null,
  contextSnippets: ContextSnippet[],
  relevantIssues?: RelevantIssue[],
  promptVersion: string = 'v1'
): Promise<RewriteResult> {
  const response = await callLLMProxy<RewriteApiResponse>({
    operation: 'rewrite',
    storyText,
    promptVersion,
    structuredStory: structuredStory ? {
      role: structuredStory.role,
      goal: structuredStory.goal,
      benefit: structuredStory.benefit,
      constraints: structuredStory.constraints,
    } : undefined,
    context: buildContextString(contextSnippets),
    relevantIssues,
  });

  // Map API response to internal format
  const candidates: RewriteCandidate[] = response.candidates.map((candidate) => ({
    id: candidate.id || generateId(),
    suggestedText: candidate.text,
    explanation: candidate.explanation,
    createdAt: createTimestamp(),
  }));

  return { candidates };
}

export async function generateAcceptanceCriteriaApi(
  storyText: string,
  structuredStory: StructuredStory | null,
  contextSnippets: ContextSnippet[],
  promptVersion: string = 'v1'
): Promise<AcceptanceCriteriaResult> {
  const response = await callLLMProxy<AcceptanceCriteriaApiResponse>({
    operation: 'acceptance_criteria',
    storyText,
    promptVersion,
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
    notes: c.notes || c.title,
  }));

  return { criteria };
}
