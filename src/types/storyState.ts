// ============================================
// Global Story State Types
// ============================================

// Structured Story (Role/Goal/Benefit format)
export interface StructuredStory {
  role: string;
  goal: string;
  benefit: string;
  constraints?: string[];
}

// Context Documents (optional attachments)
export interface ContextDocument {
  id: string;
  name: string;
  content: string;
  type: 'file' | 'url' | 'text';
  addedAt: string;
}

// Context Snippets (optional text snippets)
export interface ContextSnippet {
  id: string;
  text: string;
  source?: string;
  addedAt: string;
}

// Analysis Issue Categories
export type IssueCategory = 
  | 'missing_role'
  | 'missing_goal'
  | 'missing_benefit'
  | 'vague_language'
  | 'too_long'
  | 'too_short'
  | 'missing_context'
  | 'technical_debt'
  | 'not_testable'
  | 'other';

// Analysis Issue
export interface AnalysisIssue {
  id: string;
  category: IssueCategory;
  textReference: string; // The specific text portion with the issue
  reasoning: string;
  clarificationQuestion?: string;
  severity: 'error' | 'warning' | 'info';
  // Human-in-the-loop fields
  isRelevant?: boolean; // Marked as relevant for rewrite
  userNote?: string; // User notes/feedback on the issue
}

// Rewrite Candidate
export interface RewriteCandidate {
  id: string;
  suggestedText: string;
  explanation: string;
  createdAt: string;
}

// Acceptance Criterion (Given/When/Then format)
export interface AcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
  notes?: string;
}

// User Decision Types
export type DecisionType = 'accepted' | 'rejected' | 'edited';
export type DecisionTarget = 'rewrite' | 'criterion' | 'issue';

// User Decision Record
export interface UserDecision {
  id: string;
  targetType: DecisionTarget;
  targetId: string;
  decision: DecisionType;
  originalValue: string;
  editedValue?: string;
  timestamp: string;
}

// Version History Entry
export interface VersionHistoryEntry {
  id: string;
  timestamp: string;
  storyText: string;
  structuredStory?: StructuredStory;
  action: 'initial' | 'rewrite_accepted' | 'manual_edit';
  description: string;
}

// Meta Information
export interface MetaInfo {
  projectId: string;
  promptVersion: string;
  modelId: string;
  lastRunAt: string | null;
}

// ============================================
// Main Global State Interface
// ============================================
export interface StoryState {
  // Core Story Data
  originalStoryText: string;
  optimisedStoryText: string;
  structuredStory: StructuredStory | null;

  // Optional Context
  contextDocuments: ContextDocument[];
  contextSnippets: ContextSnippet[];
  additionalContext: string; // User-provided additional context for analysis

  // Analysis Results
  analysisIssues: AnalysisIssue[];
  analysisScore: number | null;

  // Rewrite Options
  rewriteCandidates: RewriteCandidate[];
  selectedRewriteId: string | null;

  // Acceptance Criteria
  acceptanceCriteria: AcceptanceCriterion[];

  // User Decisions
  userDecisions: UserDecision[];

  // Export
  exportMarkdown: string;

  // Version History
  versionHistory: VersionHistoryEntry[];

  // Meta Information
  meta: MetaInfo;

  // UI State
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  isLoading: boolean;
  error: string | null;
}

// Wizard Steps
export type WizardStep = 'input' | 'analysis' | 'rewrite' | 'criteria' | 'export';

export const WIZARD_STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: 'input', label: 'Story Input', description: 'User Story eingeben' },
  { id: 'analysis', label: 'Analyse', description: 'Qualität prüfen' },
  { id: 'rewrite', label: 'Rewrite', description: 'Story verbessern' },
  { id: 'criteria', label: 'Akzeptanzkriterien', description: 'Kriterien generieren' },
  { id: 'export', label: 'Export', description: 'Ergebnisse exportieren' },
];

// ============================================
// Action Types
// ============================================
export type StoryAction =
  | { type: 'SET_ORIGINAL_STORY'; payload: string }
  | { type: 'SET_OPTIMISED_STORY'; payload: string }
  | { type: 'SET_STRUCTURED_STORY'; payload: StructuredStory | null }
  | { type: 'ADD_CONTEXT_DOCUMENT'; payload: ContextDocument }
  | { type: 'REMOVE_CONTEXT_DOCUMENT'; payload: string }
  | { type: 'ADD_CONTEXT_SNIPPET'; payload: ContextSnippet }
  | { type: 'REMOVE_CONTEXT_SNIPPET'; payload: string }
  | { type: 'SET_ANALYSIS_ISSUES'; payload: AnalysisIssue[] }
  | { type: 'SET_ANALYSIS_SCORE'; payload: number }
  | { type: 'UPDATE_ANALYSIS_ISSUE'; payload: { id: string; updates: Partial<AnalysisIssue> } }
  | { type: 'SET_REWRITE_CANDIDATES'; payload: RewriteCandidate[] }
  | { type: 'SELECT_REWRITE'; payload: string | null }
  | { type: 'SET_ACCEPTANCE_CRITERIA'; payload: AcceptanceCriterion[] }
  | { type: 'ADD_ACCEPTANCE_CRITERION'; payload: AcceptanceCriterion }
  | { type: 'UPDATE_ACCEPTANCE_CRITERION'; payload: { id: string; criterion: Partial<AcceptanceCriterion> } }
  | { type: 'REMOVE_ACCEPTANCE_CRITERION'; payload: string }
  | { type: 'ADD_USER_DECISION'; payload: UserDecision }
  | { type: 'SET_EXPORT_MARKDOWN'; payload: string }
  | { type: 'ADD_VERSION_HISTORY'; payload: VersionHistoryEntry }
  | { type: 'UPDATE_META'; payload: Partial<MetaInfo> }
  | { type: 'SET_CURRENT_STEP'; payload: WizardStep }
  | { type: 'MARK_STEP_COMPLETED'; payload: WizardStep }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ADDITIONAL_CONTEXT'; payload: string }
  | { type: 'RESET_STATE' };

// ============================================
// Helper Functions
// ============================================
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createTimestamp(): string {
  return new Date().toISOString();
}
