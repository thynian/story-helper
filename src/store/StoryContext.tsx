import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useRef } from 'react';
import {
  UserStoryInput,
  StructuredStoryModel,
  ContextDocument,
  ContextSnippet,
  QualityIssue,
  RewriteSuggestion,
  AcceptanceCriterionItem,
  OptimizedStory,
  QualityReport,
  UserDecision,
  VersionHistoryEntry,
  PipelineStage,
  PipelineStageResult,
  LLMRuntimeConfig,
  DEFAULT_LLM_CONFIG,
  generateId,
  createTimestamp,
  createEmptyStructuredModel,
} from '@/types/storyTypes';
import {
  analyzeStoryApi,
  rewriteStoryApi,
  generateAcceptanceCriteriaApi,
  runFullPipeline,
  runPipelineStage,
  PipelineStageResultData,
} from '@/services/llmProxyApi';
import { saveStory } from '@/services/storyPersistence';

// ============================================
// State Interface
// ============================================
export interface StoryState {
  // Core Story Data
  storyInput: UserStoryInput | null;
  originalStoryText: string;
  optimisedStoryText: string;
  structuredStory: StructuredStoryModel | null;

  // Optional Context
  contextDocuments: ContextDocument[];
  contextSnippets: ContextSnippet[];
  additionalContext: string;

  // Pipeline Results
  pipelineStages: PipelineStageResult[];
  currentPipelineStage: PipelineStage | null;
  
  // Analysis Results
  analysisIssues: QualityIssue[];
  analysisScore: number | null;

  // Rewrite Options
  rewriteCandidates: RewriteSuggestion[];
  selectedRewriteId: string | null;

  // Acceptance Criteria
  acceptanceCriteria: AcceptanceCriterionItem[];

  // User Decisions
  userDecisions: UserDecision[];

  // Export
  exportMarkdown: string;

  // Quality Report
  qualityReport: QualityReport | null;

  // Version History
  versionHistory: VersionHistoryEntry[];

  // Meta Information
  meta: {
    projectId: string;
    promptVersion: string;
    modelId: string;
    lastRunAt: string | null;
  };

  // LLM Runtime Config
  runtimeConfig: LLMRuntimeConfig;

  // UI State
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  isLoading: boolean;
  loadingStage: string | null;
  error: string | null;
}

export type WizardStep = 'input' | 'analysis' | 'rewrite' | 'criteria' | 'export';

export const WIZARD_STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: 'input', label: 'Story Input', description: 'User Story eingeben' },
  { id: 'analysis', label: 'Analyse', description: 'Qualität prüfen' },
  { id: 'rewrite', label: 'Rewrite', description: 'Story verbessern' },
  { id: 'criteria', label: 'Akzeptanzkriterien', description: 'Kriterien generieren' },
  { id: 'export', label: 'Export', description: 'Ergebnisse exportieren' },
];

// ============================================
// Initial State
// ============================================
const initialState: StoryState = {
  storyInput: null,
  originalStoryText: '',
  optimisedStoryText: '',
  structuredStory: null,
  contextDocuments: [],
  contextSnippets: [],
  additionalContext: '',
  pipelineStages: [],
  currentPipelineStage: null,
  analysisIssues: [],
  analysisScore: null,
  rewriteCandidates: [],
  selectedRewriteId: null,
  acceptanceCriteria: [],
  userDecisions: [],
  exportMarkdown: '',
  qualityReport: null,
  versionHistory: [],
  meta: {
    projectId: generateId(),
    promptVersion: 'v1',
    modelId: 'gpt-4o-mini',
    lastRunAt: null,
  },
  runtimeConfig: DEFAULT_LLM_CONFIG,
  currentStep: 'input',
  completedSteps: [],
  isLoading: false,
  loadingStage: null,
  error: null,
};

// ============================================
// Action Types
// ============================================
type StoryAction =
  | { type: 'SET_STORY_INPUT'; payload: UserStoryInput }
  | { type: 'SET_ORIGINAL_STORY'; payload: string }
  | { type: 'SET_OPTIMISED_STORY'; payload: string }
  | { type: 'SET_STRUCTURED_STORY'; payload: StructuredStoryModel | null }
  | { type: 'ADD_CONTEXT_DOCUMENT'; payload: ContextDocument }
  | { type: 'REMOVE_CONTEXT_DOCUMENT'; payload: string }
  | { type: 'ADD_CONTEXT_SNIPPET'; payload: ContextSnippet }
  | { type: 'REMOVE_CONTEXT_SNIPPET'; payload: string }
  | { type: 'SET_ADDITIONAL_CONTEXT'; payload: string }
  | { type: 'SET_PIPELINE_STAGES'; payload: PipelineStageResult[] }
  | { type: 'ADD_PIPELINE_STAGE'; payload: PipelineStageResult }
  | { type: 'SET_CURRENT_PIPELINE_STAGE'; payload: PipelineStage | null }
  | { type: 'SET_ANALYSIS_ISSUES'; payload: QualityIssue[] }
  | { type: 'SET_ANALYSIS_SCORE'; payload: number }
  | { type: 'UPDATE_ANALYSIS_ISSUE'; payload: { id: string; updates: Partial<QualityIssue> } }
  | { type: 'SET_REWRITE_CANDIDATES'; payload: RewriteSuggestion[] }
  | { type: 'UPDATE_REWRITE_CANDIDATE'; payload: { id: string; updates: Partial<RewriteSuggestion> } }
  | { type: 'SELECT_REWRITE'; payload: string | null }
  | { type: 'SET_ACCEPTANCE_CRITERIA'; payload: AcceptanceCriterionItem[] }
  | { type: 'ADD_ACCEPTANCE_CRITERION'; payload: AcceptanceCriterionItem }
  | { type: 'UPDATE_ACCEPTANCE_CRITERION'; payload: { id: string; criterion: Partial<AcceptanceCriterionItem> } }
  | { type: 'REMOVE_ACCEPTANCE_CRITERION'; payload: string }
  | { type: 'ADD_USER_DECISION'; payload: UserDecision }
  | { type: 'SET_EXPORT_MARKDOWN'; payload: string }
  | { type: 'SET_QUALITY_REPORT'; payload: QualityReport | null }
  | { type: 'ADD_VERSION_HISTORY'; payload: VersionHistoryEntry }
  | { type: 'UPDATE_META'; payload: Partial<StoryState['meta']> }
  | { type: 'SET_RUNTIME_CONFIG'; payload: Partial<LLMRuntimeConfig> }
  | { type: 'SET_CURRENT_STEP'; payload: WizardStep }
  | { type: 'MARK_STEP_COMPLETED'; payload: WizardStep }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_STAGE'; payload: string | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

// ============================================
// Reducer
// ============================================
function storyReducer(state: StoryState, action: StoryAction): StoryState {
  switch (action.type) {
    case 'SET_STORY_INPUT':
      return { ...state, storyInput: action.payload };

    case 'SET_ORIGINAL_STORY':
      return {
        ...state,
        originalStoryText: action.payload,
        optimisedStoryText: '',
        structuredStory: null,
        analysisIssues: [],
        analysisScore: null,
        rewriteCandidates: [],
        selectedRewriteId: null,
        acceptanceCriteria: [],
        pipelineStages: [],
      };

    case 'SET_OPTIMISED_STORY':
      return { ...state, optimisedStoryText: action.payload };

    case 'SET_STRUCTURED_STORY':
      return { ...state, structuredStory: action.payload };

    case 'ADD_CONTEXT_DOCUMENT':
      return { ...state, contextDocuments: [...state.contextDocuments, action.payload] };

    case 'REMOVE_CONTEXT_DOCUMENT':
      return { ...state, contextDocuments: state.contextDocuments.filter(d => d.id !== action.payload) };

    case 'ADD_CONTEXT_SNIPPET':
      return { ...state, contextSnippets: [...state.contextSnippets, action.payload] };

    case 'REMOVE_CONTEXT_SNIPPET':
      return { ...state, contextSnippets: state.contextSnippets.filter(s => s.id !== action.payload) };

    case 'SET_ADDITIONAL_CONTEXT':
      return { ...state, additionalContext: action.payload };

    case 'SET_PIPELINE_STAGES':
      return { ...state, pipelineStages: action.payload };

    case 'ADD_PIPELINE_STAGE':
      return { ...state, pipelineStages: [...state.pipelineStages, action.payload] };

    case 'SET_CURRENT_PIPELINE_STAGE':
      return { ...state, currentPipelineStage: action.payload };

    case 'SET_ANALYSIS_ISSUES':
      return { ...state, analysisIssues: action.payload };

    case 'SET_ANALYSIS_SCORE':
      return { ...state, analysisScore: action.payload };

    case 'UPDATE_ANALYSIS_ISSUE':
      return {
        ...state,
        analysisIssues: state.analysisIssues.map(issue =>
          issue.id === action.payload.id ? { ...issue, ...action.payload.updates } : issue
        ),
      };

    case 'SET_REWRITE_CANDIDATES':
      return { ...state, rewriteCandidates: action.payload };

    case 'UPDATE_REWRITE_CANDIDATE':
      return {
        ...state,
        rewriteCandidates: state.rewriteCandidates.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload.updates } : c
        ),
      };

    case 'SELECT_REWRITE':
      return { ...state, selectedRewriteId: action.payload };

    case 'SET_ACCEPTANCE_CRITERIA':
      return { ...state, acceptanceCriteria: action.payload };

    case 'ADD_ACCEPTANCE_CRITERION':
      return { ...state, acceptanceCriteria: [...state.acceptanceCriteria, action.payload] };

    case 'UPDATE_ACCEPTANCE_CRITERION':
      return {
        ...state,
        acceptanceCriteria: state.acceptanceCriteria.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload.criterion } : c
        ),
      };

    case 'REMOVE_ACCEPTANCE_CRITERION':
      return { ...state, acceptanceCriteria: state.acceptanceCriteria.filter(c => c.id !== action.payload) };

    case 'ADD_USER_DECISION':
      return { ...state, userDecisions: [...state.userDecisions, action.payload] };

    case 'SET_EXPORT_MARKDOWN':
      return { ...state, exportMarkdown: action.payload };

    case 'SET_QUALITY_REPORT':
      return { ...state, qualityReport: action.payload };

    case 'ADD_VERSION_HISTORY':
      return { ...state, versionHistory: [...state.versionHistory, action.payload] };

    case 'UPDATE_META':
      return { ...state, meta: { ...state.meta, ...action.payload } };

    case 'SET_RUNTIME_CONFIG':
      return { ...state, runtimeConfig: { ...state.runtimeConfig, ...action.payload } };

    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };

    case 'MARK_STEP_COMPLETED':
      if (state.completedSteps.includes(action.payload)) return state;
      return { ...state, completedSteps: [...state.completedSteps, action.payload] };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_LOADING_STAGE':
      return { ...state, loadingStage: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'RESET_STATE':
      return { ...initialState, meta: { ...initialState.meta, projectId: generateId() } };

    default:
      return state;
  }
}

// ============================================
// Context Types
// ============================================
interface StoryContextValue {
  state: StoryState;
  dispatch: React.Dispatch<StoryAction>;
  actions: {
    // Story Input
    setOriginalStory: (text: string) => void;
    setOptimisedStory: (text: string) => void;
    setStructuredStory: (story: StructuredStoryModel | null) => void;
    
    // Context Management
    addContextDocument: (doc: Omit<ContextDocument, 'id' | 'addedAt'>) => void;
    removeContextDocument: (id: string) => void;
    addContextSnippet: (snippet: Omit<ContextSnippet, 'id' | 'addedAt'>) => void;
    removeContextSnippet: (id: string) => void;
    setAdditionalContext: (context: string) => void;
    
    // Analysis
    setAnalysisResults: (issues: QualityIssue[], score: number) => void;
    updateAnalysisIssue: (id: string, updates: Partial<QualityIssue>) => void;
    
    // Rewrite
    setRewriteCandidates: (candidates: RewriteSuggestion[]) => void;
    selectRewrite: (id: string | null) => void;
    acceptRewrite: (id: string, editedText?: string) => void;
    rejectRewrite: (id: string) => void;
    
    // Acceptance Criteria
    setAcceptanceCriteria: (criteria: AcceptanceCriterionItem[]) => void;
    acceptCriterion: (id: string, editedCriterion?: Partial<AcceptanceCriterionItem>) => void;
    rejectCriterion: (id: string) => void;
    
    // Version & Navigation
    addVersionHistory: (action: VersionHistoryEntry['action'], description: string) => void;
    goToStep: (step: WizardStep) => void;
    markStepCompleted: (step: WizardStep) => void;
    
    // UI State
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
    
    // Runtime Config
    setRuntimeConfig: (config: Partial<LLMRuntimeConfig>) => void;
    
    // Export
    generateExportMarkdown: () => string;
    
    // Persistence
    saveStoryAction: () => Promise<string | null>;
    
    // LLM Actions
    analyzeStoryAction: () => Promise<void>;
    runFullPipelineAction: () => Promise<void>;
    rewriteStoryAction: () => Promise<void>;
    generateAcceptanceCriteriaAction: () => Promise<void>;
  };
}

// ============================================
// Context
// ============================================
const StoryContext = createContext<StoryContextValue | undefined>(undefined);

// ============================================
// Provider
// ============================================
interface StoryProviderProps {
  children: ReactNode;
}

export function StoryProvider({ children }: StoryProviderProps) {
  const [state, dispatch] = useReducer(storyReducer, initialState);
  const storyIdRef = useRef<string | null>(null);

  const setOriginalStory = useCallback((text: string) => {
    dispatch({ type: 'SET_ORIGINAL_STORY', payload: text });
  }, []);

  const setOptimisedStory = useCallback((text: string) => {
    dispatch({ type: 'SET_OPTIMISED_STORY', payload: text });
  }, []);

  const setStructuredStory = useCallback((story: StructuredStoryModel | null) => {
    dispatch({ type: 'SET_STRUCTURED_STORY', payload: story });
  }, []);

  const addContextDocument = useCallback((doc: Omit<ContextDocument, 'id' | 'addedAt'>) => {
    dispatch({
      type: 'ADD_CONTEXT_DOCUMENT',
      payload: { ...doc, id: generateId(), addedAt: createTimestamp() },
    });
  }, []);

  const removeContextDocument = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_CONTEXT_DOCUMENT', payload: id });
  }, []);

  const addContextSnippet = useCallback((snippet: Omit<ContextSnippet, 'id' | 'addedAt'>) => {
    dispatch({
      type: 'ADD_CONTEXT_SNIPPET',
      payload: { ...snippet, id: generateId(), addedAt: createTimestamp() },
    });
  }, []);

  const removeContextSnippet = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_CONTEXT_SNIPPET', payload: id });
  }, []);

  const setAdditionalContext = useCallback((context: string) => {
    dispatch({ type: 'SET_ADDITIONAL_CONTEXT', payload: context });
  }, []);

  const setAnalysisResults = useCallback((issues: QualityIssue[], score: number) => {
    dispatch({ type: 'SET_ANALYSIS_ISSUES', payload: issues });
    dispatch({ type: 'SET_ANALYSIS_SCORE', payload: score });
    dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });
  }, []);

  const updateAnalysisIssue = useCallback((id: string, updates: Partial<QualityIssue>) => {
    dispatch({ type: 'UPDATE_ANALYSIS_ISSUE', payload: { id, updates } });
  }, []);

  const setRewriteCandidates = useCallback((candidates: RewriteSuggestion[]) => {
    dispatch({ type: 'SET_REWRITE_CANDIDATES', payload: candidates });
  }, []);

  const selectRewrite = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_REWRITE', payload: id });
  }, []);

  const acceptRewrite = useCallback((id: string, editedText?: string) => {
    const candidate = state.rewriteCandidates.find(c => c.id === id);
    if (!candidate) return;

    const finalText = editedText || candidate.suggestedText;
    
    dispatch({ type: 'SET_OPTIMISED_STORY', payload: finalText });
    dispatch({ type: 'SELECT_REWRITE', payload: id });
    dispatch({
      type: 'UPDATE_REWRITE_CANDIDATE',
      payload: { id, updates: { status: editedText ? 'edited' : 'accepted', editedText, decidedAt: createTimestamp() } },
    });
    dispatch({
      type: 'ADD_USER_DECISION',
      payload: {
        id: generateId(),
        targetType: 'rewrite',
        targetId: id,
        decision: editedText ? 'edited' : 'accepted',
        originalValue: candidate.suggestedText,
        editedValue: editedText,
        timestamp: createTimestamp(),
      },
    });
  }, [state.rewriteCandidates]);

  const rejectRewrite = useCallback((id: string) => {
    const candidate = state.rewriteCandidates.find(c => c.id === id);
    if (!candidate) return;

    dispatch({
      type: 'UPDATE_REWRITE_CANDIDATE',
      payload: { id, updates: { status: 'rejected', decidedAt: createTimestamp() } },
    });
    dispatch({
      type: 'ADD_USER_DECISION',
      payload: {
        id: generateId(),
        targetType: 'rewrite',
        targetId: id,
        decision: 'rejected',
        originalValue: candidate.suggestedText,
        timestamp: createTimestamp(),
      },
    });
  }, [state.rewriteCandidates]);

  const setAcceptanceCriteria = useCallback((criteria: AcceptanceCriterionItem[]) => {
    dispatch({ type: 'SET_ACCEPTANCE_CRITERIA', payload: criteria });
  }, []);

  const acceptCriterion = useCallback((id: string, editedCriterion?: Partial<AcceptanceCriterionItem>) => {
    const criterion = state.acceptanceCriteria.find(c => c.id === id);
    if (!criterion) return;

    dispatch({
      type: 'UPDATE_ACCEPTANCE_CRITERION',
      payload: {
        id,
        criterion: {
          ...editedCriterion,
          status: editedCriterion ? 'edited' : 'accepted',
          editedCriterion,
          decidedAt: createTimestamp(),
        },
      },
    });
    dispatch({
      type: 'ADD_USER_DECISION',
      payload: {
        id: generateId(),
        targetType: 'criterion',
        targetId: id,
        decision: editedCriterion ? 'edited' : 'accepted',
        originalValue: `Given ${criterion.given}, When ${criterion.when}, Then ${criterion.then}`,
        editedValue: editedCriterion
          ? `Given ${editedCriterion.given || criterion.given}, When ${editedCriterion.when || criterion.when}, Then ${editedCriterion.then || criterion.then}`
          : undefined,
        timestamp: createTimestamp(),
      },
    });
  }, [state.acceptanceCriteria]);

  const rejectCriterion = useCallback((id: string) => {
    const criterion = state.acceptanceCriteria.find(c => c.id === id);
    if (!criterion) return;

    dispatch({
      type: 'UPDATE_ACCEPTANCE_CRITERION',
      payload: { id, criterion: { status: 'rejected', decidedAt: createTimestamp() } },
    });
    dispatch({
      type: 'ADD_USER_DECISION',
      payload: {
        id: generateId(),
        targetType: 'criterion',
        targetId: id,
        decision: 'rejected',
        originalValue: `Given ${criterion.given}, When ${criterion.when}, Then ${criterion.then}`,
        timestamp: createTimestamp(),
      },
    });
  }, [state.acceptanceCriteria]);

  const addVersionHistory = useCallback((action: VersionHistoryEntry['action'], description: string) => {
    dispatch({
      type: 'ADD_VERSION_HISTORY',
      payload: {
        id: generateId(),
        timestamp: createTimestamp(),
        storyText: state.optimisedStoryText || state.originalStoryText,
        structuredModel: state.structuredStory || undefined,
        action,
        description,
        changedBy: 'user',
      },
    });
  }, [state.optimisedStoryText, state.originalStoryText, state.structuredStory]);

  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: step });
  }, []);

  const markStepCompleted = useCallback((step: WizardStep) => {
    dispatch({ type: 'MARK_STEP_COMPLETED', payload: step });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const setRuntimeConfig = useCallback((config: Partial<LLMRuntimeConfig>) => {
    dispatch({ type: 'SET_RUNTIME_CONFIG', payload: config });
  }, []);

  const generateExportMarkdown = useCallback(() => {
    const { originalStoryText, optimisedStoryText, structuredStory, acceptanceCriteria, userDecisions, meta, pipelineStages, analysisIssues, contextSnippets } = state;

    const acceptedCriteria = acceptanceCriteria.filter(c => c.status === 'accepted' || c.status === 'edited');
    const criteriaText = acceptedCriteria
      .map((c, i) => `### Kriterium ${i + 1}: ${c.title}
- **Given:** ${c.given}
- **When:** ${c.when}
- **Then:** ${c.then}
- **Typ:** ${c.type}
- **Priorität:** ${c.priority}
${c.notes ? `- **Notizen:** ${c.notes}` : ''}`)
      .join('\n\n');

    const issuesSummary = analysisIssues
      .filter(i => i.severity === 'critical' || i.severity === 'major')
      .map(i => `- [${i.severity.toUpperCase()}] ${i.category}: ${i.reasoning}`)
      .join('\n');

    const contextText = contextSnippets.length > 0
      ? contextSnippets.map(s => `- ${s.documentName || 'Snippet'}: "${s.text.substring(0, 100)}..."`).join('\n')
      : '_Keine Kontextdokumente_';

    const decisionsCount = {
      accepted: userDecisions.filter(d => d.decision === 'accepted').length,
      edited: userDecisions.filter(d => d.decision === 'edited').length,
      rejected: userDecisions.filter(d => d.decision === 'rejected').length,
    };

    const pipelineSummary = pipelineStages
      .map(s => `- ${s.stage}: ${s.status} (${s.issues.length} Issues)`)
      .join('\n');

    const markdown = `# User Story Quality Report

## Meta
- **Projekt-ID:** ${meta.projectId}
- **Prompt-Version:** ${meta.promptVersion}
- **Model:** ${meta.modelId}
- **Zuletzt ausgeführt:** ${meta.lastRunAt || 'N/A'}

---

## Original Story
${originalStoryText}

## Optimierte Story
${optimisedStoryText || '_Keine optimierte Version gewählt_'}

${structuredStory ? `## Strukturierte Story
- **Als:** ${structuredStory.role}
- **Möchte ich:** ${structuredStory.goal}
- **Damit:** ${structuredStory.benefit}
${structuredStory.constraints?.length ? `- **Constraints:** ${structuredStory.constraints.join(', ')}` : ''}` : ''}

---

## Pipeline-Ergebnisse
${pipelineSummary || '_Keine Pipeline ausgeführt_'}

## Wichtige Issues
${issuesSummary || '_Keine kritischen Issues_'}

---

## Akzeptanzkriterien
${criteriaText || '_Keine Akzeptanzkriterien definiert_'}

---

## Kontext-Referenzen
${contextText}

---

## Entscheidungen
- Übernommen: ${decisionsCount.accepted}
- Bearbeitet: ${decisionsCount.edited}
- Verworfen: ${decisionsCount.rejected}
`;

    dispatch({ type: 'SET_EXPORT_MARKDOWN', payload: markdown });
    return markdown;
  }, [state]);

  // ============================================
  // LLM Actions
  // ============================================

  // Legacy single analyze action
  const analyzeStoryAction = useCallback(async () => {
    const storyText = state.optimisedStoryText || state.originalStoryText;
    if (!storyText) {
      dispatch({ type: 'SET_ERROR', payload: 'Keine Story zum Analysieren vorhanden' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const result = await analyzeStoryApi(
        storyText,
        state.structuredStory,
        state.contextSnippets,
        state.additionalContext,
        state.meta.promptVersion
      );
      dispatch({ type: 'SET_ANALYSIS_ISSUES', payload: result.issues });
      dispatch({ type: 'SET_ANALYSIS_SCORE', payload: result.score });
      dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler bei der Analyse';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.originalStoryText, state.optimisedStoryText, state.structuredStory, state.contextSnippets, state.additionalContext, state.meta.promptVersion]);

  // Full 6-stage pipeline action
  const runFullPipelineAction = useCallback(async () => {
    const storyText = state.optimisedStoryText || state.originalStoryText;
    if (!storyText) {
      dispatch({ type: 'SET_ERROR', payload: 'Keine Story zum Analysieren vorhanden' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_PIPELINE_STAGES', payload: [] });

    const stageLabels: Record<PipelineStage, string> = {
      ambiguity_analysis: 'Ambiguitäts-Analyse',
      structure_check: 'Struktur-Prüfung',
      quality_check: 'Qualitäts-Check',
      business_value: 'Business Value',
      solution_bias: 'Solution Bias',
      acceptance_criteria: 'Akzeptanzkriterien',
    };

    try {
      const result = await runFullPipeline(
        storyText,
        state.structuredStory,
        state.contextSnippets,
        state.additionalContext,
        state.meta.promptVersion,
        state.runtimeConfig,
        // Progress callback
        (stage, stageResult) => {
          dispatch({ type: 'SET_LOADING_STAGE', payload: stageLabels[stage] || stage });
          dispatch({
            type: 'ADD_PIPELINE_STAGE',
            payload: {
              stage,
              status: 'completed',
              issues: stageResult.issues.map(i => i.id),
              duration: stageResult.duration,
            },
          });
        }
      );

      // Update state with results
      dispatch({ type: 'SET_ANALYSIS_ISSUES', payload: result.allIssues });
      dispatch({ type: 'SET_ANALYSIS_SCORE', payload: result.overallScore });
      
      if (result.structuredModel) {
        dispatch({ type: 'SET_STRUCTURED_STORY', payload: result.structuredModel });
      }

      // Create quality report
      const qualityReport: QualityReport = {
        id: generateId(),
        storyId: state.meta.projectId,
        executedAt: createTimestamp(),
        pipelineStages: result.stages.map(s => ({
          stage: s.stage,
          status: 'completed',
          issues: s.issues.map(i => i.id),
          duration: s.duration,
        })),
        allIssues: result.allIssues,
        prioritizedIssues: result.allIssues
          .sort((a, b) => {
            const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
          })
          .map(i => i.id),
        issuesByCategory: result.allIssues.reduce((acc, issue) => {
          acc[issue.category] = (acc[issue.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        overallScore: result.overallScore,
        recommendations: [],
        userDecisions: [],
        promptVersion: state.meta.promptVersion,
        modelId: state.meta.modelId,
      };

      dispatch({ type: 'SET_QUALITY_REPORT', payload: qualityReport });
      dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler bei der Pipeline';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_LOADING_STAGE', payload: null });
    }
  }, [state.originalStoryText, state.optimisedStoryText, state.structuredStory, state.contextSnippets, state.additionalContext, state.meta.promptVersion, state.meta.projectId, state.meta.modelId, state.runtimeConfig]);

  const rewriteStoryAction = useCallback(async () => {
    const storyText = state.optimisedStoryText || state.originalStoryText;
    if (!storyText) {
      dispatch({ type: 'SET_ERROR', payload: 'Keine Story zum Umschreiben vorhanden' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const relevantIssues = state.analysisIssues
        .filter(issue => issue.isRelevant)
        .map(issue => ({
          id: issue.id,
          category: issue.category,
          reasoning: issue.reasoning,
          userNote: issue.userNote || undefined,
          textReference: issue.textReference,
        }));

      const result = await rewriteStoryApi(
        storyText,
        state.structuredStory,
        state.contextSnippets,
        relevantIssues.length > 0 ? relevantIssues : undefined,
        state.meta.promptVersion
      );
      dispatch({ type: 'SET_REWRITE_CANDIDATES', payload: result.candidates });
      dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Rewrite';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.originalStoryText, state.optimisedStoryText, state.structuredStory, state.contextSnippets, state.analysisIssues, state.meta.promptVersion]);

  const generateAcceptanceCriteriaAction = useCallback(async () => {
    const storyText = state.optimisedStoryText || state.originalStoryText;
    if (!storyText) {
      dispatch({ type: 'SET_ERROR', payload: 'Keine Story für Akzeptanzkriterien vorhanden' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const result = await generateAcceptanceCriteriaApi(
        storyText,
        state.structuredStory,
        state.contextSnippets,
        state.meta.promptVersion
      );
      dispatch({ type: 'SET_ACCEPTANCE_CRITERIA', payload: result.criteria });
      dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler bei Akzeptanzkriterien';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.originalStoryText, state.optimisedStoryText, state.structuredStory, state.contextSnippets, state.meta.promptVersion]);

  // Manual save action
  const saveStoryAction = useCallback(async (): Promise<string | null> => {
    if (!state.originalStoryText || state.originalStoryText.trim() === '') {
      return null;
    }

    console.log('[Save] Saving story...');
    const savedId = await saveStory(state, storyIdRef.current || undefined);
    
    if (savedId) {
      storyIdRef.current = savedId;
      console.log('[Save] Story saved with ID:', savedId);
    }
    
    return savedId;
  }, [state]);

  const actions = {
    setOriginalStory,
    setOptimisedStory,
    setStructuredStory,
    addContextDocument,
    removeContextDocument,
    addContextSnippet,
    removeContextSnippet,
    setAdditionalContext,
    setAnalysisResults,
    updateAnalysisIssue,
    setRewriteCandidates,
    selectRewrite,
    acceptRewrite,
    rejectRewrite,
    setAcceptanceCriteria,
    acceptCriterion,
    rejectCriterion,
    addVersionHistory,
    goToStep,
    markStepCompleted,
    setLoading,
    setError,
    reset,
    setRuntimeConfig,
    generateExportMarkdown,
    saveStoryAction,
    analyzeStoryAction,
    runFullPipelineAction,
    rewriteStoryAction,
    generateAcceptanceCriteriaAction,
  };

  return (
    <StoryContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </StoryContext.Provider>
  );
}

// ============================================
// Hook
// ============================================
export function useStory(): StoryContextValue {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
}
