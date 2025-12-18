import { supabase } from "@/integrations/supabase/client";
import { 
  QualityIssue, 
  RewriteSuggestion, 
  AcceptanceCriterionItem,
  StructuredStoryModel,
  ContextSnippet,
  PipelineStage,
  PIPELINE_STAGES,
  PipelineStageResult,
  generateId, 
  createTimestamp,
  LLMRuntimeConfig,
  DEFAULT_LLM_CONFIG,
} from "@/types/storyTypes";

// ============================================
// Request Types
// ============================================
interface LLMProxyRequest {
  operation: PipelineStage | 'analyze' | 'rewrite' | 'acceptance_criteria';
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
    id?: string;
    category: string;
    reasoning: string;
    userNote?: string;
    textReference?: string;
  }>;
  previousResults?: Record<string, unknown>;
  runtimeConfig?: Partial<LLMRuntimeConfig>;
}

// ============================================
// Response Types from Backend
// ============================================
interface BaseStageResponse {
  stage: PipelineStage;
  issues: Array<{
    id: string;
    category: string;
    severity: string;
    textReference?: string;
    reasoning: string;
    clarificationQuestion?: string;
    suggestedAction?: string;
    confidence?: string;
    affectedSection?: string;
    investCriterion?: string;
    alternativeFormulation?: string;
    suggestedBenefit?: string;
  }>;
  summary?: string;
}

interface AmbiguityResponse extends BaseStageResponse {
  stage: 'ambiguity_analysis';
}

interface StructureResponse extends BaseStageResponse {
  stage: 'structure_check';
  structuredModel?: {
    role: string | null;
    goal: string | null;
    benefit: string | null;
    constraints: string[];
    parseConfidence: string;
  };
}

interface QualityResponse extends BaseStageResponse {
  stage: 'quality_check';
  overallScore?: number;
}

interface BusinessValueResponse extends BaseStageResponse {
  stage: 'business_value';
  valueAssessment?: {
    hasValue: boolean;
    valueType: string;
    clarity: string;
  };
}

interface SolutionBiasResponse extends BaseStageResponse {
  stage: 'solution_bias';
  hasSolutionBias?: boolean;
}

interface AcceptanceCriteriaResponse {
  stage: 'acceptance_criteria';
  criteria: Array<{
    id: string;
    title: string;
    given: string;
    when: string;
    then: string;
    type?: string;
    priority?: string;
    notes?: string;
    confidence?: string;
  }>;
  coverage?: {
    mainFlow: boolean;
    errorCases: boolean;
    edgeCases: boolean;
    negativeCases?: boolean;
  };
  openQuestions?: string[];
}

interface RewriteResponse {
  candidates: Array<{
    id: string;
    text: string;
    explanation: string;
    addressedIssueIds?: string[];
    changes?: Array<{ type: string; description: string }>;
    confidence?: string;
    openQuestions?: string[];
  }>;
}

// Legacy analyze response (for backward compatibility)
interface LegacyAnalyzeResponse {
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

// ============================================
// Mapped Result Types
// ============================================
export interface PipelineStageResultData {
  stage: PipelineStage;
  issues: QualityIssue[];
  structuredModel?: StructuredStoryModel;
  overallScore?: number;
  summary?: string;
  duration: number;
}

export interface FullPipelineResult {
  stages: PipelineStageResultData[];
  allIssues: QualityIssue[];
  structuredModel?: StructuredStoryModel;
  overallScore: number;
  summary: string;
}

export interface RewriteResult {
  candidates: RewriteSuggestion[];
}

export interface AcceptanceCriteriaResult {
  criteria: AcceptanceCriterionItem[];
  coverage?: {
    mainFlow: boolean;
    errorCases: boolean;
    edgeCases: boolean;
    negativeCases: boolean;
  };
  openQuestions?: string[];
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
// Mapping Functions
// ============================================
function mapSeverity(severity: string): 'critical' | 'major' | 'minor' | 'info' {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high': return 'critical';
    case 'major':
    case 'medium': return 'major';
    case 'minor':
    case 'low': return 'minor';
    default: return 'info';
  }
}

function mapCategory(category: string): QualityIssue['category'] {
  const categoryMap: Record<string, QualityIssue['category']> = {
    'ambiguity': 'ambiguity',
    'clarity': 'ambiguity',
    'missing_role': 'missing_role',
    'missing_goal': 'missing_goal',
    'missing_benefit': 'missing_benefit',
    'completeness': 'missing_context',
    'vague_language': 'vague_language',
    'too_broad_scope': 'too_broad_scope',
    'scope': 'too_broad_scope',
    'solution_bias': 'solution_bias',
    'persona_unclear': 'persona_unclear',
    'business_value_gap': 'business_value_gap',
    'not_testable': 'not_testable',
    'testability': 'not_testable',
    'inconsistency': 'inconsistency',
    'consistency': 'inconsistency',
    'missing_context': 'missing_context',
    'technical_debt': 'technical_debt',
  };
  return categoryMap[category] || 'other';
}

function mapAffectedSection(section?: string): QualityIssue['affectedSection'] {
  if (!section) return 'overall';
  const sectionMap: Record<string, QualityIssue['affectedSection']> = {
    'role': 'role',
    'goal': 'goal',
    'benefit': 'benefit',
    'constraint': 'constraint',
    'acceptance_criteria': 'acceptance_criteria',
  };
  return sectionMap[section] || 'overall';
}

function mapConfidence(conf?: string): 'high' | 'medium' | 'low' {
  if (!conf) return 'medium';
  const c = conf.toLowerCase();
  if (c === 'high') return 'high';
  if (c === 'low') return 'low';
  return 'medium';
}

function mapIssueFromResponse(issue: BaseStageResponse['issues'][0], stage: PipelineStage): QualityIssue {
  return {
    id: issue.id || generateId(),
    category: mapCategory(issue.category),
    severity: mapSeverity(issue.severity),
    affectedSection: mapAffectedSection(issue.affectedSection),
    textReference: issue.textReference || '',
    reasoning: issue.reasoning,
    clarificationQuestion: issue.clarificationQuestion,
    suggestedAction: issue.suggestedAction || issue.alternativeFormulation || issue.suggestedBenefit,
    confidence: mapConfidence(issue.confidence),
    isRelevant: false,
    userNote: '',
  };
}

function buildContextString(snippets: ContextSnippet[], additionalContext?: string): string | undefined {
  const parts: string[] = [];
  
  if (snippets && snippets.length > 0) {
    parts.push(snippets.map(s => {
      let text = s.text;
      if (s.documentName) text = `[${s.documentName}] ${text}`;
      return text;
    }).join('\n\n'));
  }
  
  if (additionalContext?.trim()) {
    parts.push(additionalContext.trim());
  }
  
  return parts.length > 0 ? parts.join('\n\n---\n\n') : undefined;
}

// ============================================
// Single Stage API Call
// ============================================
export async function runPipelineStage(
  stage: PipelineStage,
  storyText: string,
  structuredStory: StructuredStoryModel | null,
  contextSnippets: ContextSnippet[],
  previousResults?: Record<string, unknown>,
  promptVersion: string = 'v1',
  runtimeConfig?: Partial<LLMRuntimeConfig>
): Promise<PipelineStageResultData> {
  const startTime = Date.now();

  const response = await callLLMProxy<BaseStageResponse>({
    operation: stage,
    storyText,
    promptVersion,
    structuredStory: structuredStory ? {
      role: structuredStory.role,
      goal: structuredStory.goal,
      benefit: structuredStory.benefit,
      constraints: structuredStory.constraints,
    } : undefined,
    context: buildContextString(contextSnippets),
    previousResults,
    runtimeConfig,
  });

  const issues = response.issues.map(issue => mapIssueFromResponse(issue, stage));
  
  const result: PipelineStageResultData = {
    stage,
    issues,
    summary: response.summary,
    duration: Date.now() - startTime,
  };

  // Handle stage-specific data
  if (stage === 'structure_check') {
    const structResp = response as StructureResponse;
    if (structResp.structuredModel) {
      result.structuredModel = {
        role: structResp.structuredModel.role || '',
        goal: structResp.structuredModel.goal || '',
        benefit: structResp.structuredModel.benefit || '',
        constraints: structResp.structuredModel.constraints || [],
        existingAcceptanceCriteria: [],
        implicitAssumptions: [],
        parseConfidence: mapConfidence(structResp.structuredModel.parseConfidence),
      };
    }
  }

  if (stage === 'quality_check') {
    const qualResp = response as QualityResponse;
    result.overallScore = qualResp.overallScore;
  }

  return result;
}

// ============================================
// Full Pipeline Execution
// ============================================
export async function runFullPipeline(
  storyText: string,
  structuredStory: StructuredStoryModel | null,
  contextSnippets: ContextSnippet[],
  additionalContext?: string,
  promptVersion: string = 'v1',
  runtimeConfig?: Partial<LLMRuntimeConfig>,
  onStageComplete?: (stage: PipelineStage, result: PipelineStageResultData) => void
): Promise<FullPipelineResult> {
  const stages: PipelineStageResultData[] = [];
  const allIssues: QualityIssue[] = [];
  let currentStructuredModel = structuredStory;
  let overallScore = 0;
  
  // Build accumulated results for each stage
  const accumulatedResults: Record<string, unknown> = {};

  // Run stages sequentially
  for (const stage of PIPELINE_STAGES) {
    console.log(`Running pipeline stage: ${stage}`);
    
    try {
      const result = await runPipelineStage(
        stage,
        storyText,
        currentStructuredModel,
        contextSnippets,
        accumulatedResults,
        promptVersion,
        runtimeConfig
      );

      stages.push(result);
      allIssues.push(...result.issues);

      // Update structured model if returned from structure_check
      if (result.structuredModel) {
        currentStructuredModel = result.structuredModel;
      }

      // Track overall score from quality_check
      if (result.overallScore !== undefined) {
        overallScore = result.overallScore;
      }

      // Accumulate results for next stages
      accumulatedResults[stage] = {
        issues: result.issues.map(i => ({
          id: i.id,
          category: i.category,
          severity: i.severity,
          textReference: i.textReference,
          reasoning: i.reasoning,
        })),
        summary: result.summary,
      };

      // Callback for progress updates
      if (onStageComplete) {
        onStageComplete(stage, result);
      }

    } catch (error) {
      console.error(`Pipeline stage ${stage} failed:`, error);
      // Continue with next stage even if one fails
      stages.push({
        stage,
        issues: [],
        duration: 0,
        summary: `Stage fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      });
    }
  }

  // Build summary
  const summary = stages
    .filter(s => s.summary)
    .map(s => `**${s.stage}**: ${s.summary}`)
    .join('\n\n');

  return {
    stages,
    allIssues,
    structuredModel: currentStructuredModel || undefined,
    overallScore: overallScore || calculateScoreFromIssues(allIssues),
    summary,
  };
}

function calculateScoreFromIssues(issues: QualityIssue[]): number {
  if (issues.length === 0) return 100;
  
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 20; break;
      case 'major': score -= 10; break;
      case 'minor': score -= 5; break;
      case 'info': score -= 2; break;
    }
  }
  return Math.max(0, score);
}

// ============================================
// Legacy Analyze API (backward compatible)
// ============================================
export async function analyzeStoryApi(
  storyText: string,
  structuredStory: StructuredStoryModel | null,
  contextSnippets: ContextSnippet[],
  additionalContext?: string,
  promptVersion: string = 'v1'
): Promise<{ issues: QualityIssue[]; score: number }> {
  const response = await callLLMProxy<LegacyAnalyzeResponse>({
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

  const issues: QualityIssue[] = response.issues.map((issue) => ({
    id: issue.id || generateId(),
    category: mapCategory(issue.category),
    severity: mapSeverity(issue.severity),
    affectedSection: 'overall' as const,
    textReference: issue.textReference || '',
    reasoning: issue.reasoning,
    clarificationQuestion: issue.clarificationQuestion,
    confidence: mapConfidence(issue.confidence),
    isRelevant: false,
    userNote: '',
  }));

  return { issues, score: response.score };
}

// ============================================
// Rewrite API
// ============================================
export interface RelevantIssue {
  id?: string;
  category: string;
  reasoning: string;
  userNote?: string;
  textReference?: string;
}

export async function rewriteStoryApi(
  storyText: string,
  structuredStory: StructuredStoryModel | null,
  contextSnippets: ContextSnippet[],
  relevantIssues?: RelevantIssue[],
  promptVersion: string = 'v1'
): Promise<RewriteResult> {
  const response = await callLLMProxy<RewriteResponse>({
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

  const candidates: RewriteSuggestion[] = response.candidates.map((candidate) => ({
    id: candidate.id || generateId(),
    originalSection: 'overall',
    suggestedText: candidate.text,
    explanation: candidate.explanation,
    addressedIssueIds: candidate.addressedIssueIds || [],
    changes: (candidate.changes || []).map(c => ({
      type: c.type as 'added' | 'removed' | 'modified' | 'clarified',
      description: c.description,
    })),
    confidence: mapConfidence(candidate.confidence),
    openQuestions: candidate.openQuestions,
    createdAt: createTimestamp(),
    status: 'pending',
  }));

  return { candidates };
}

// ============================================
// Acceptance Criteria API
// ============================================
export async function generateAcceptanceCriteriaApi(
  storyText: string,
  structuredStory: StructuredStoryModel | null,
  contextSnippets: ContextSnippet[],
  promptVersion: string = 'v1'
): Promise<AcceptanceCriteriaResult> {
  const response = await callLLMProxy<AcceptanceCriteriaResponse>({
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

  const criteria: AcceptanceCriterionItem[] = response.criteria.map((c) => ({
    id: c.id || generateId(),
    title: c.title || '',
    given: c.given,
    when: c.when,
    then: c.then,
    notes: c.notes,
    type: (c.type as AcceptanceCriterionItem['type']) || 'happy_path',
    priority: (c.priority as 'must' | 'should' | 'could') || 'should',
    confidence: mapConfidence(c.confidence),
    status: 'pending',
  }));

  return { 
    criteria,
    coverage: response.coverage ? {
      mainFlow: response.coverage.mainFlow,
      errorCases: response.coverage.errorCases,
      edgeCases: response.coverage.edgeCases,
      negativeCases: response.coverage.negativeCases || false,
    } : undefined,
    openQuestions: response.openQuestions,
  };
}
