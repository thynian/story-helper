import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import {
  StoryState,
  StoryAction,
  WizardStep,
  StructuredStory,
  ContextDocument,
  ContextSnippet,
  AnalysisIssue,
  RewriteCandidate,
  AcceptanceCriterion,
  UserDecision,
  VersionHistoryEntry,
  MetaInfo,
  generateId,
  createTimestamp,
} from '@/types/storyState';
import {
  analyzeStoryApi,
  rewriteStoryApi,
  generateAcceptanceCriteriaApi,
} from '@/services/llmProxyApi';

// ============================================
// Initial State
// ============================================
const initialState: StoryState = {
  // Core Story Data
  originalStoryText: '',
  optimisedStoryText: '',
  structuredStory: null,

  // Optional Context
  contextDocuments: [],
  contextSnippets: [],

  // Analysis Results
  analysisIssues: [],
  analysisScore: null,

  // Rewrite Options
  rewriteCandidates: [],
  selectedRewriteId: null,

  // Acceptance Criteria
  acceptanceCriteria: [],

  // User Decisions
  userDecisions: [],

  // Export
  exportMarkdown: '',

  // Version History
  versionHistory: [],

  // Meta Information
  meta: {
    projectId: generateId(),
    promptVersion: '1.0.0',
    modelId: 'mock-model',
    lastRunAt: null,
  },

  // UI State
  currentStep: 'input',
  completedSteps: [],
  isLoading: false,
  error: null,
};

// ============================================
// Reducer
// ============================================
function storyReducer(state: StoryState, action: StoryAction): StoryState {
  switch (action.type) {
    case 'SET_ORIGINAL_STORY':
      return {
        ...state,
        originalStoryText: action.payload,
        // Reset downstream data when original changes
        optimisedStoryText: '',
        structuredStory: null,
        analysisIssues: [],
        analysisScore: null,
        rewriteCandidates: [],
        selectedRewriteId: null,
        acceptanceCriteria: [],
      };

    case 'SET_OPTIMISED_STORY':
      return {
        ...state,
        optimisedStoryText: action.payload,
      };

    case 'SET_STRUCTURED_STORY':
      return {
        ...state,
        structuredStory: action.payload,
      };

    case 'ADD_CONTEXT_DOCUMENT':
      return {
        ...state,
        contextDocuments: [...state.contextDocuments, action.payload],
      };

    case 'REMOVE_CONTEXT_DOCUMENT':
      return {
        ...state,
        contextDocuments: state.contextDocuments.filter((d) => d.id !== action.payload),
      };

    case 'ADD_CONTEXT_SNIPPET':
      return {
        ...state,
        contextSnippets: [...state.contextSnippets, action.payload],
      };

    case 'REMOVE_CONTEXT_SNIPPET':
      return {
        ...state,
        contextSnippets: state.contextSnippets.filter((s) => s.id !== action.payload),
      };

    case 'SET_ANALYSIS_ISSUES':
      return {
        ...state,
        analysisIssues: action.payload,
      };

    case 'SET_ANALYSIS_SCORE':
      return {
        ...state,
        analysisScore: action.payload,
      };

    case 'SET_REWRITE_CANDIDATES':
      return {
        ...state,
        rewriteCandidates: action.payload,
      };

    case 'SELECT_REWRITE':
      return {
        ...state,
        selectedRewriteId: action.payload,
      };

    case 'SET_ACCEPTANCE_CRITERIA':
      return {
        ...state,
        acceptanceCriteria: action.payload,
      };

    case 'ADD_ACCEPTANCE_CRITERION':
      return {
        ...state,
        acceptanceCriteria: [...state.acceptanceCriteria, action.payload],
      };

    case 'UPDATE_ACCEPTANCE_CRITERION':
      return {
        ...state,
        acceptanceCriteria: state.acceptanceCriteria.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload.criterion } : c
        ),
      };

    case 'REMOVE_ACCEPTANCE_CRITERION':
      return {
        ...state,
        acceptanceCriteria: state.acceptanceCriteria.filter((c) => c.id !== action.payload),
      };

    case 'ADD_USER_DECISION':
      return {
        ...state,
        userDecisions: [...state.userDecisions, action.payload],
      };

    case 'SET_EXPORT_MARKDOWN':
      return {
        ...state,
        exportMarkdown: action.payload,
      };

    case 'ADD_VERSION_HISTORY':
      return {
        ...state,
        versionHistory: [...state.versionHistory, action.payload],
      };

    case 'UPDATE_META':
      return {
        ...state,
        meta: { ...state.meta, ...action.payload },
      };

    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStep: action.payload,
      };

    case 'MARK_STEP_COMPLETED':
      if (state.completedSteps.includes(action.payload)) {
        return state;
      }
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.payload],
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'RESET_STATE':
      return {
        ...initialState,
        meta: {
          ...initialState.meta,
          projectId: generateId(),
        },
      };

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
  
  // Convenience Actions
  actions: {
    setOriginalStory: (text: string) => void;
    setOptimisedStory: (text: string) => void;
    setStructuredStory: (story: StructuredStory | null) => void;
    addContextDocument: (doc: Omit<ContextDocument, 'id' | 'addedAt'>) => void;
    removeContextDocument: (id: string) => void;
    addContextSnippet: (snippet: Omit<ContextSnippet, 'id' | 'addedAt'>) => void;
    removeContextSnippet: (id: string) => void;
    setAnalysisResults: (issues: AnalysisIssue[], score: number) => void;
    setRewriteCandidates: (candidates: RewriteCandidate[]) => void;
    selectRewrite: (id: string | null) => void;
    acceptRewrite: (id: string, editedText?: string) => void;
    rejectRewrite: (id: string) => void;
    setAcceptanceCriteria: (criteria: AcceptanceCriterion[]) => void;
    acceptCriterion: (id: string, editedCriterion?: Partial<AcceptanceCriterion>) => void;
    rejectCriterion: (id: string) => void;
    addVersionHistory: (action: VersionHistoryEntry['action'], description: string) => void;
    goToStep: (step: WizardStep) => void;
    markStepCompleted: (step: WizardStep) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
    generateExportMarkdown: () => string;
    // LLM Proxy Actions
    analyzeStoryAction: () => Promise<void>;
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

  // Convenience action creators
  const setOriginalStory = useCallback((text: string) => {
    dispatch({ type: 'SET_ORIGINAL_STORY', payload: text });
  }, []);

  const setOptimisedStory = useCallback((text: string) => {
    dispatch({ type: 'SET_OPTIMISED_STORY', payload: text });
  }, []);

  const setStructuredStory = useCallback((story: StructuredStory | null) => {
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

  const setAnalysisResults = useCallback((issues: AnalysisIssue[], score: number) => {
    dispatch({ type: 'SET_ANALYSIS_ISSUES', payload: issues });
    dispatch({ type: 'SET_ANALYSIS_SCORE', payload: score });
    dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });
  }, []);

  const setRewriteCandidates = useCallback((candidates: RewriteCandidate[]) => {
    dispatch({ type: 'SET_REWRITE_CANDIDATES', payload: candidates });
  }, []);

  const selectRewrite = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_REWRITE', payload: id });
  }, []);

  const acceptRewrite = useCallback((id: string, editedText?: string) => {
    const candidate = state.rewriteCandidates.find((c) => c.id === id);
    if (!candidate) return;

    const finalText = editedText || candidate.suggestedText;
    
    dispatch({ type: 'SET_OPTIMISED_STORY', payload: finalText });
    dispatch({ type: 'SELECT_REWRITE', payload: id });
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
    const candidate = state.rewriteCandidates.find((c) => c.id === id);
    if (!candidate) return;

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

  const setAcceptanceCriteria = useCallback((criteria: AcceptanceCriterion[]) => {
    dispatch({ type: 'SET_ACCEPTANCE_CRITERIA', payload: criteria });
  }, []);

  const acceptCriterion = useCallback((id: string, editedCriterion?: Partial<AcceptanceCriterion>) => {
    const criterion = state.acceptanceCriteria.find((c) => c.id === id);
    if (!criterion) return;

    if (editedCriterion) {
      dispatch({ type: 'UPDATE_ACCEPTANCE_CRITERION', payload: { id, criterion: editedCriterion } });
    }

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
    const criterion = state.acceptanceCriteria.find((c) => c.id === id);
    if (!criterion) return;

    dispatch({ type: 'REMOVE_ACCEPTANCE_CRITERION', payload: id });
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
        structuredStory: state.structuredStory || undefined,
        action,
        description,
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

  const generateExportMarkdown = useCallback(() => {
    const { originalStoryText, optimisedStoryText, structuredStory, acceptanceCriteria, userDecisions, meta } = state;

    const criteriaText = acceptanceCriteria
      .map((c, i) => `### Kriterium ${i + 1}\n- **Given:** ${c.given}\n- **When:** ${c.when}\n- **Then:** ${c.then}${c.notes ? `\n- **Notizen:** ${c.notes}` : ''}`)
      .join('\n\n');

    const decisionsCount = {
      accepted: userDecisions.filter((d) => d.decision === 'accepted').length,
      edited: userDecisions.filter((d) => d.decision === 'edited').length,
      rejected: userDecisions.filter((d) => d.decision === 'rejected').length,
    };

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

## Akzeptanzkriterien
${criteriaText || '_Keine Akzeptanzkriterien definiert_'}

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
  // LLM Proxy Actions
  // ============================================
  const analyzeStoryAction = useCallback(async () => {
    const storyText = state.optimisedStoryText || state.originalStoryText;
    if (!storyText) {
      dispatch({ type: 'SET_ERROR', payload: 'Keine Story zum Analysieren vorhanden' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const result = await analyzeStoryApi(storyText, state.structuredStory, state.contextSnippets);
      dispatch({ type: 'SET_ANALYSIS_ISSUES', payload: result.issues });
      dispatch({ type: 'SET_ANALYSIS_SCORE', payload: result.score });
      dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler bei der Analyse';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.originalStoryText, state.optimisedStoryText, state.structuredStory, state.contextSnippets]);

  const rewriteStoryAction = useCallback(async () => {
    const storyText = state.optimisedStoryText || state.originalStoryText;
    if (!storyText) {
      dispatch({ type: 'SET_ERROR', payload: 'Keine Story zum Umschreiben vorhanden' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const result = await rewriteStoryApi(storyText, state.structuredStory, state.contextSnippets);
      dispatch({ type: 'SET_REWRITE_CANDIDATES', payload: result.candidates });
      dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Rewrite';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.originalStoryText, state.optimisedStoryText, state.structuredStory, state.contextSnippets]);

  const generateAcceptanceCriteriaAction = useCallback(async () => {
    const storyText = state.optimisedStoryText || state.originalStoryText;
    if (!storyText) {
      dispatch({ type: 'SET_ERROR', payload: 'Keine Story für Akzeptanzkriterien vorhanden' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const result = await generateAcceptanceCriteriaApi(storyText, state.structuredStory, state.contextSnippets);
      dispatch({ type: 'SET_ACCEPTANCE_CRITERIA', payload: result.criteria });
      dispatch({ type: 'UPDATE_META', payload: { lastRunAt: createTimestamp() } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler bei Akzeptanzkriterien';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.originalStoryText, state.optimisedStoryText, state.structuredStory, state.contextSnippets]);

  const actions = {
    setOriginalStory,
    setOptimisedStory,
    setStructuredStory,
    addContextDocument,
    removeContextDocument,
    addContextSnippet,
    removeContextSnippet,
    setAnalysisResults,
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
    generateExportMarkdown,
    // LLM Proxy Actions
    analyzeStoryAction,
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
