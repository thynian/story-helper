import { useEffect, useRef, useCallback } from 'react';
import { saveStory } from '@/services/storyPersistence';
import type { StoryState } from '@/store/StoryContext';

const AUTO_SAVE_DELAY = 5000; // 5 seconds debounce

export function useAutoSave(state: StoryState) {
  const storyIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  const performSave = useCallback(async () => {
    // Only save if there's content
    if (!state.originalStoryText || state.originalStoryText.trim() === '') {
      return;
    }

    // Create a hash of the current state to check if anything changed
    const stateHash = JSON.stringify({
      originalStoryText: state.originalStoryText,
      optimisedStoryText: state.optimisedStoryText,
      structuredStory: state.structuredStory,
      analysisIssues: state.analysisIssues,
      rewriteCandidates: state.rewriteCandidates,
      acceptanceCriteria: state.acceptanceCriteria,
      userDecisions: state.userDecisions,
    });

    // Skip if nothing changed
    if (stateHash === lastSavedRef.current) {
      return;
    }

    console.log('[AutoSave] Saving story...');
    const savedId = await saveStory(state, storyIdRef.current || undefined);
    
    if (savedId) {
      storyIdRef.current = savedId;
      lastSavedRef.current = stateHash;
      console.log('[AutoSave] Story saved with ID:', savedId);
    }
  }, [state]);

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new debounced save
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [performSave]);

  // Return the current story ID for reference
  return storyIdRef.current;
}
