import { StructuredStory } from '@/types/storyState';

/**
 * Heuristic parser to extract Role/Goal/Benefit from a user story text.
 * Supports German "Als/Möchte ich/Damit" and English "As a/I want/So that" formats.
 */
export function parseUserStory(text: string): StructuredStory | null {
  const normalizedText = text.trim();
  
  if (!normalizedText) {
    return null;
  }

  // German patterns
  const germanPatterns = {
    role: /als\s+(?:ein(?:e|er|em|en)?\s+)?(.+?)(?:\s+möchte|\s+will|\s+wünsche|\s+brauche)/i,
    goal: /(?:möchte ich|will ich|wünsche ich|brauche ich)\s+(.+?)(?:\s*,?\s*damit|\s*,?\s*um\s+zu|\s*,?\s*sodass|\s*\.|$)/i,
    benefit: /(?:damit|um zu|sodass)\s+(.+?)(?:\.|$)/i,
  };

  // English patterns
  const englishPatterns = {
    role: /as\s+(?:a|an)?\s*(.+?)(?:\s*,?\s*i\s+want|\s*,?\s*i\s+need|\s*,?\s*i\s+would\s+like)/i,
    goal: /(?:i\s+want|i\s+need|i\s+would\s+like)\s+(?:to\s+)?(.+?)(?:\s*,?\s*so\s+that|\s*,?\s*in\s+order\s+to|\s*\.|$)/i,
    benefit: /(?:so\s+that|in\s+order\s+to)\s+(.+?)(?:\.|$)/i,
  };

  let role = '';
  let goal = '';
  let benefit = '';

  // Try German patterns first
  const germanRoleMatch = normalizedText.match(germanPatterns.role);
  const germanGoalMatch = normalizedText.match(germanPatterns.goal);
  const germanBenefitMatch = normalizedText.match(germanPatterns.benefit);

  if (germanRoleMatch || germanGoalMatch) {
    role = germanRoleMatch?.[1]?.trim() || '';
    goal = germanGoalMatch?.[1]?.trim() || '';
    benefit = germanBenefitMatch?.[1]?.trim() || '';
  } else {
    // Try English patterns
    const englishRoleMatch = normalizedText.match(englishPatterns.role);
    const englishGoalMatch = normalizedText.match(englishPatterns.goal);
    const englishBenefitMatch = normalizedText.match(englishPatterns.benefit);

    role = englishRoleMatch?.[1]?.trim() || '';
    goal = englishGoalMatch?.[1]?.trim() || '';
    benefit = englishBenefitMatch?.[1]?.trim() || '';
  }

  // Clean up extracted parts
  role = cleanExtractedText(role);
  goal = cleanExtractedText(goal);
  benefit = cleanExtractedText(benefit);

  // If we couldn't extract anything meaningful, return null
  if (!role && !goal && !benefit) {
    return null;
  }

  // Extract constraints (look for "aber", "jedoch", "außer", "nicht")
  const constraints: string[] = [];
  const constraintPatterns = [
    /(?:aber|jedoch|allerdings)\s+(.+?)(?:\.|$)/gi,
    /(?:außer|ausgenommen)\s+(.+?)(?:\.|$)/gi,
    /(?:nicht|ohne)\s+(.+?)(?:\.|$)/gi,
  ];

  constraintPatterns.forEach(pattern => {
    const matches = normalizedText.matchAll(pattern);
    for (const match of matches) {
      const constraint = cleanExtractedText(match[1]);
      if (constraint && !constraints.includes(constraint)) {
        constraints.push(constraint);
      }
    }
  });

  return {
    role: role || 'Nicht erkannt',
    goal: goal || 'Nicht erkannt',
    benefit: benefit || 'Nicht angegeben',
    constraints: constraints.length > 0 ? constraints : undefined,
  };
}

/**
 * Clean up extracted text by removing trailing punctuation and extra whitespace
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(/[,;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate completeness score for a structured story
 */
export function calculateCompletenessScore(story: StructuredStory): number {
  let score = 0;
  
  if (story.role && story.role !== 'Nicht erkannt') score += 35;
  if (story.goal && story.goal !== 'Nicht erkannt') score += 40;
  if (story.benefit && story.benefit !== 'Nicht angegeben') score += 25;
  
  return score;
}
