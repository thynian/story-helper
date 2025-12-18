// ============================================
// User Story Quality Assistant - Core Types
// ============================================

// ============================================
// 1. USER STORY INPUT
// Die eingereichte Story in ihrer ursprünglichen Form
// ============================================
export interface UserStoryInput {
  id: string;
  rawText: string;
  existingAcceptanceCriteria?: string[];
  metadata: StoryMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface StoryMetadata {
  author?: string;
  projectId: string;
  timestamp: string;
  source?: 'manual' | 'import' | 'api';
  tags?: string[];
}

// ============================================
// 2. STRUKTURIERTES STORY-MODELL
// Nach dem Parsing als strukturierte Einheit
// ============================================
export interface StructuredStoryModel {
  role: string;
  goal: string;
  benefit: string;
  constraints: string[];
  existingAcceptanceCriteria: string[];
  implicitAssumptions: ImplicitAssumption[];
  parseConfidence: 'high' | 'medium' | 'low';
  parseWarnings?: string[];
}

export interface ImplicitAssumption {
  id: string;
  text: string;
  source: 'inferred' | 'llm_detected';
  confidence: 'high' | 'medium' | 'low';
}

// ============================================
// 3. KONTEXT-SNIPPET
// Auszüge aus Dokumenten/Wissensquellen
// ============================================
export interface ContextSnippet {
  id: string;
  text: string;
  documentId?: string;
  documentName?: string;
  position?: {
    startLine?: number;
    endLine?: number;
    page?: number;
  };
  relevanceScore?: number;
  addedAt: string;
}

export interface ContextDocument {
  id: string;
  name: string;
  content: string;
  type: 'file' | 'url' | 'text';
  mimeType?: string;
  addedAt: string;
}

// ============================================
// 4. ANALYSE-RESULTAT
// Strukturierte LLM-Ausgabe mit Befunden
// ============================================
export interface AnalysisResult {
  id: string;
  issues: QualityIssue[];
  overallScore: number;
  summary: string;
  analyzedAt: string;
  promptVersion: string;
  modelId: string;
  pipelineStage: PipelineStage;
  contextCitations?: ContextCitation[];
}

export interface ContextCitation {
  snippetId: string;
  quote: string;
  relevance: string;
}

// ============================================
// 5. QUALITÄTSBEFUND / ISSUE
// Einzelne Qualitätsprobleme
// ============================================
export interface QualityIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  affectedSection: AffectedSection;
  textReference: string;
  reasoning: string;
  clarificationQuestion?: string;
  suggestedAction?: string;
  confidence: 'high' | 'medium' | 'low';
  contextCitations?: string[];
  // Human-in-the-loop Felder
  isRelevant?: boolean;
  userNote?: string;
  userResponse?: string;
  resolvedAt?: string;
}

export type IssueCategory =
  | 'ambiguity'           // Mehrdeutige Formulierungen
  | 'missing_role'        // Fehlende Rollenangabe
  | 'missing_goal'        // Fehlendes Ziel
  | 'missing_benefit'     // Fehlender Nutzen
  | 'vague_language'      // Unklare Sprache
  | 'too_broad_scope'     // Zu großer Umfang
  | 'solution_bias'       // Lösungsvorgabe statt Problem
  | 'persona_unclear'     // Persona nicht klar definiert
  | 'business_value_gap'  // Geschäftswert unklar
  | 'not_testable'        // Nicht testbar
  | 'inconsistency'       // Widersprüche
  | 'missing_context'     // Fehlender Kontext
  | 'technical_debt'      // Technische Schulden
  | 'other';

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'info';

export type AffectedSection = 
  | 'role' 
  | 'goal' 
  | 'benefit' 
  | 'constraint' 
  | 'acceptance_criteria' 
  | 'overall';

// ============================================
// 6. REWRITE-VORSCHLAG
// Verbesserungsoptionen vom LLM
// ============================================
export interface RewriteSuggestion {
  id: string;
  originalSection: AffectedSection;
  suggestedText: string;
  explanation: string;
  addressedIssueIds: string[];
  changes: RewriteChange[];
  confidence: 'high' | 'medium' | 'low';
  openQuestions?: string[];
  createdAt: string;
  // User Entscheidung
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
  editedText?: string;
  decidedAt?: string;
}

export interface RewriteChange {
  type: 'added' | 'removed' | 'modified' | 'clarified';
  description: string;
  beforeText?: string;
  afterText?: string;
}

// ============================================
// 7. OPTIMIERTE USER STORY
// Konsolidierte Story nach Verbesserungen
// ============================================
export interface OptimizedStory {
  id: string;
  text: string;
  structuredModel: StructuredStoryModel;
  acceptanceCriteria: AcceptanceCriterionItem[];
  appliedSuggestions: string[]; // IDs der übernommenen Rewrites
  resolvedIssues: string[];     // IDs der behobenen Issues
  remainingIssues: string[];    // IDs noch offener Issues
  version: number;
  createdAt: string;
  basedOnVersion?: string;
}

// ============================================
// 8. AKZEPTANZKRITERIEN-SET
// Given/When/Then mit Varianten
// ============================================
export interface AcceptanceCriteriaSet {
  id: string;
  storyId: string;
  criteria: AcceptanceCriterionItem[];
  coverage: CriterionCoverage;
  openQuestions?: string[];
  generatedAt: string;
  promptVersion: string;
}

export interface AcceptanceCriterionItem {
  id: string;
  title: string;
  given: string;
  when: string;
  then: string;
  notes?: string;
  type: CriterionType;
  priority: 'must' | 'should' | 'could';
  confidence: 'high' | 'medium' | 'low';
  linkedIssueIds?: string[];
  // User Entscheidung
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
  editedCriterion?: Partial<AcceptanceCriterionItem>;
  decidedAt?: string;
}

export type CriterionType = 
  | 'happy_path'     // Hauptanwendungsfall
  | 'edge_case'      // Grenzfall
  | 'error_case'     // Fehlerfall
  | 'negative_case'  // Negativ-Szenario
  | 'performance'    // Performance-Kriterium
  | 'security';      // Sicherheits-Kriterium

export interface CriterionCoverage {
  mainFlow: boolean;
  errorCases: boolean;
  edgeCases: boolean;
  negativeCases: boolean;
  securityCases: boolean;
}

// ============================================
// 9. QUALITY REPORT
// Zusammenfassung am Ende einer Analyse
// ============================================
export interface QualityReport {
  id: string;
  storyId: string;
  executedAt: string;
  pipelineStages: PipelineStageResult[];
  allIssues: QualityIssue[];
  prioritizedIssues: string[]; // IDs in Prioritätsreihenfolge
  issuesByCategory: Record<IssueCategory, number>;
  overallScore: number;
  recommendations: string[];
  optimizedStory?: OptimizedStory;
  userDecisions: UserDecision[];
  promptVersion: string;
  modelId: string;
}

export interface PipelineStageResult {
  stage: PipelineStage;
  status: 'completed' | 'skipped' | 'failed';
  issues: string[]; // Issue IDs
  duration: number; // ms
  error?: string;
}

// ============================================
// 10. EXPORT-REPRÄSENTATION
// Endzustand für Export
// ============================================
export interface ExportRepresentation {
  format: 'markdown' | 'text' | 'json' | 'jira';
  content: string;
  optimizedStory: OptimizedStory;
  acceptanceCriteria: AcceptanceCriterionItem[];
  contextReferences: ContextCitation[];
  metadata: ExportMetadata;
  generatedAt: string;
}

export interface ExportMetadata {
  projectId: string;
  promptVersion: string;
  modelId: string;
  exportedBy?: string;
  includeOriginal: boolean;
  includeAnalysis: boolean;
}

// ============================================
// 11. PROMPT-VORLAGE
// Versionierte Textbausteine
// ============================================
export interface PromptTemplate {
  id: string;
  version: string;
  stage: PipelineStage;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema: object;
  variables: PromptVariable[];
  examples?: FewShotExample[];
  qualityRules?: QualityRule[];
  vocabulary?: VocabularyEntry[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'object' | 'array' | 'boolean';
  required: boolean;
  description: string;
}

export interface FewShotExample {
  id: string;
  input: string;
  expectedOutput: string;
  explanation?: string;
}

export interface QualityRule {
  id: string;
  name: string;
  description: string;
  category: IssueCategory;
  checkCriteria: string;
}

export interface VocabularyEntry {
  term: string;
  definition: string;
  synonyms?: string[];
  avoidTerms?: string[];
}

// ============================================
// PIPELINE STAGES
// ============================================
export type PipelineStage = 
  | 'ambiguity_analysis'
  | 'structure_check'
  | 'quality_check'
  | 'acceptance_criteria'
  | 'business_value'
  | 'solution_bias';

export const PIPELINE_STAGES: PipelineStage[] = [
  'ambiguity_analysis',
  'structure_check',
  'quality_check',
  'acceptance_criteria',
  'business_value',
  'solution_bias',
];

// ============================================
// USER DECISION TRACKING
// ============================================
export interface UserDecision {
  id: string;
  targetType: 'issue' | 'rewrite' | 'criterion';
  targetId: string;
  decision: 'accepted' | 'rejected' | 'edited' | 'deferred';
  originalValue: string;
  editedValue?: string;
  reason?: string;
  timestamp: string;
}

// ============================================
// VERSION HISTORY
// ============================================
export interface VersionHistoryEntry {
  id: string;
  timestamp: string;
  storyText: string;
  structuredModel?: StructuredStoryModel;
  action: 'initial' | 'rewrite_accepted' | 'manual_edit' | 'criteria_added';
  description: string;
  changedBy: 'user' | 'system';
}

// ============================================
// LLM RUNTIME CONFIG
// ============================================
export interface LLMRuntimeConfig {
  temperature: number;
  topK: number;
  maxTokens: number;
  modelId: string;
  promptVersion: string;
}

export const DEFAULT_LLM_CONFIG: LLMRuntimeConfig = {
  temperature: 0.7,
  topK: 40,
  maxTokens: 2000,
  modelId: 'gpt-4o-mini',
  promptVersion: 'v1',
};

// ============================================
// HELPER FUNCTIONS
// ============================================
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createTimestamp(): string {
  return new Date().toISOString();
}

export function createEmptyStructuredModel(): StructuredStoryModel {
  return {
    role: '',
    goal: '',
    benefit: '',
    constraints: [],
    existingAcceptanceCriteria: [],
    implicitAssumptions: [],
    parseConfidence: 'low',
  };
}

export function createEmptyOptimizedStory(): OptimizedStory {
  return {
    id: generateId(),
    text: '',
    structuredModel: createEmptyStructuredModel(),
    acceptanceCriteria: [],
    appliedSuggestions: [],
    resolvedIssues: [],
    remainingIssues: [],
    version: 1,
    createdAt: createTimestamp(),
  };
}
