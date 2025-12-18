import { useState, useCallback } from "react";
import { WizardProgress } from "./wizard/WizardProgress";
import { StoryInputStep } from "./steps/StoryInputStep";
import { AnalysisStep } from "./steps/AnalysisStep";
import { RewriteStep } from "./steps/RewriteStep";
import { CriteriaStep } from "./steps/CriteriaStep";
import { ExportStep } from "./steps/ExportStep";
import { WizardStep, StoryAnalysis, Suggestion, WIZARD_STEPS } from "@/types/story";

export function StoryWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("input");
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  
  // Data state
  const [story, setStory] = useState("");
  const [analysis, setAnalysis] = useState<StoryAnalysis | null>(null);
  const [rewriteSuggestion, setRewriteSuggestion] = useState<Suggestion | null>(null);
  const [criteria, setCriteria] = useState<Suggestion[]>([]);

  const markStepCompleted = (step: WizardStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
  };

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
  };

  const canNavigateTo = (step: WizardStep): boolean => {
    const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
    
    // Can always go back
    if (stepIndex <= currentIndex) return true;
    
    // Can only go forward if previous steps are completed
    for (let i = 0; i < stepIndex; i++) {
      if (!completedSteps.includes(WIZARD_STEPS[i].id)) {
        return false;
      }
    }
    return true;
  };

  // Step handlers
  const handleStorySubmit = (newStory: string) => {
    setStory(newStory);
    // Reset downstream data if story changed
    setAnalysis(null);
    setRewriteSuggestion(null);
    setCriteria([]);
    markStepCompleted("input");
    goToStep("analysis");
  };

  const handleAnalysisComplete = (newAnalysis: StoryAnalysis) => {
    setAnalysis(newAnalysis);
    markStepCompleted("analysis");
  };

  const handleRewriteGenerated = (suggestion: Suggestion) => {
    setRewriteSuggestion(suggestion);
  };

  const handleRewriteUpdate = (suggestion: Suggestion) => {
    setRewriteSuggestion(suggestion);
    if (suggestion.status === "accepted" || suggestion.status === "edited") {
      markStepCompleted("rewrite");
    }
  };

  const handleCriteriaGenerated = (newCriteria: Suggestion[]) => {
    setCriteria(newCriteria);
  };

  const handleCriteriaUpdate = (newCriteria: Suggestion[]) => {
    setCriteria(newCriteria);
    const hasAccepted = newCriteria.some(
      (c) => c.status === "accepted" || c.status === "edited"
    );
    if (hasAccepted) {
      markStepCompleted("criteria");
    }
  };

  const handleReset = () => {
    setStory("");
    setAnalysis(null);
    setRewriteSuggestion(null);
    setCriteria([]);
    setCompletedSteps([]);
    setCurrentStep("input");
  };

  const getFinalStory = (): string => {
    if (rewriteSuggestion?.status === "edited" && rewriteSuggestion.editedText) {
      return rewriteSuggestion.editedText;
    }
    if (rewriteSuggestion?.status === "accepted") {
      return rewriteSuggestion.suggested;
    }
    return story;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <WizardProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
        canNavigateTo={canNavigateTo}
      />

      <div className="bg-card rounded-xl border border-border shadow-soft p-6 sm:p-8">
        {currentStep === "input" && (
          <StoryInputStep initialStory={story} onSubmit={handleStorySubmit} />
        )}

        {currentStep === "analysis" && (
          <AnalysisStep
            story={story}
            analysis={analysis}
            onAnalysisComplete={handleAnalysisComplete}
            onNext={() => goToStep("rewrite")}
            onBack={() => goToStep("input")}
          />
        )}

        {currentStep === "rewrite" && (
          <RewriteStep
            story={story}
            rewriteSuggestion={rewriteSuggestion}
            onSuggestionGenerated={handleRewriteGenerated}
            onSuggestionUpdate={handleRewriteUpdate}
            onNext={() => goToStep("criteria")}
            onBack={() => goToStep("analysis")}
          />
        )}

        {currentStep === "criteria" && (
          <CriteriaStep
            story={getFinalStory()}
            criteria={criteria}
            onCriteriaGenerated={handleCriteriaGenerated}
            onCriteriaUpdate={handleCriteriaUpdate}
            onNext={() => {
              markStepCompleted("export");
              goToStep("export");
            }}
            onBack={() => goToStep("rewrite")}
          />
        )}

        {currentStep === "export" && (
          <ExportStep
            originalStory={story}
            rewrittenStory={getFinalStory()}
            criteria={criteria}
            onBack={() => goToStep("criteria")}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
