export interface UserStory {
  id: string;
  original: string;
  rewritten?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  analysis?: StoryAnalysis;
}

export interface StoryAnalysis {
  score: number;
  issues: AnalysisIssue[];
  suggestions: string[];
}

export interface AnalysisIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
  status: 'pending' | 'accepted' | 'edited' | 'discarded';
  editedText?: string;
}

export interface Suggestion {
  id: string;
  type: 'rewrite' | 'criterion';
  original?: string;
  suggested: string;
  status: 'pending' | 'accepted' | 'edited' | 'discarded';
  editedText?: string;
}

export type WizardStep = 'input' | 'analysis' | 'rewrite' | 'criteria' | 'export';

export const WIZARD_STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: 'input', label: 'Story Input', description: 'User Story eingeben' },
  { id: 'analysis', label: 'Analyse', description: 'Qualität prüfen' },
  { id: 'rewrite', label: 'Rewrite', description: 'Story verbessern' },
  { id: 'criteria', label: 'Akzeptanzkriterien', description: 'Kriterien generieren' },
  { id: 'export', label: 'Export', description: 'Ergebnisse exportieren' },
];
