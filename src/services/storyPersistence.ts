import { supabase } from '@/integrations/supabase/client';
import type { StoryState } from '@/store/StoryContext';
import type { Json } from '@/integrations/supabase/types';

export interface SavedStory {
  id: string;
  original_text: string;
  optimised_text: string | null;
  structured_story: Json;
  analysis_issues: Json;
  rewrite_candidates: Json;
  acceptance_criteria: Json;
  quality_report: Json;
  user_decisions: Json;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryVersion {
  id: string;
  story_id: string;
  version_number: number;
  original_text: string;
  optimised_text: string | null;
  structured_story: Json;
  analysis_issues: Json;
  rewrite_candidates: Json;
  acceptance_criteria: Json;
  quality_report: Json;
  user_decisions: Json;
  created_at: string;
}

export async function saveStory(state: StoryState, existingStoryId?: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('save_story', {
    p_original_text: state.originalStoryText || '',
    p_optimised_text: state.optimisedStoryText || null,
    p_structured_story: state.structuredStory as unknown as Json,
    p_analysis_issues: state.analysisIssues as unknown as Json,
    p_rewrite_candidates: state.rewriteCandidates as unknown as Json,
    p_acceptance_criteria: state.acceptanceCriteria as unknown as Json,
    p_quality_report: state.qualityReport as unknown as Json,
    p_user_decisions: state.userDecisions as unknown as Json,
    p_project_id: state.meta.projectId || null,
    p_story_id: existingStoryId || null,
  });

  if (error) {
    console.error('Error saving story:', error);
    return null;
  }

  return data as string;
}

export async function fetchAllStories(): Promise<SavedStory[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching stories:', error);
    return [];
  }

  return data as SavedStory[];
}

export async function fetchStoryById(id: string): Promise<SavedStory | null> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching story:', error);
    return null;
  }

  return data as SavedStory | null;
}

export async function fetchStoryVersions(storyId: string): Promise<StoryVersion[]> {
  const { data, error } = await supabase
    .from('story_versions')
    .select('*')
    .eq('story_id', storyId)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('Error fetching story versions:', error);
    return [];
  }

  return data as StoryVersion[];
}

export async function deleteStory(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting story:', error);
    return false;
  }

  return true;
}
