import { useStory } from "@/store/StoryContext";
import { WizardProgress } from "./wizard/WizardProgress";
import { StoryInputStep } from "./steps/StoryInputStep";
import { AnalysisStep } from "./steps/AnalysisStep";
import { RewriteStep } from "./steps/RewriteStep";
import { CriteriaStep } from "./steps/CriteriaStep";
import { ExportStep } from "./steps/ExportStep";
import { WIZARD_STEPS, WizardStep } from "@/types/storyState";

export function StoryWizard() {
  const { state, actions } = useStory();
  const { currentStep, completedSteps } = state;

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

  return (
    <div className="max-w-2xl mx-auto">
      <WizardProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={actions.goToStep}
        canNavigateTo={canNavigateTo}
      />

      <div className="bg-card rounded-xl border border-border shadow-soft p-6 sm:p-8">
        {currentStep === "input" && <StoryInputStep />}
        {currentStep === "analysis" && <AnalysisStep />}
        {currentStep === "rewrite" && <RewriteStep />}
        {currentStep === "criteria" && <CriteriaStep />}
        {currentStep === "export" && <ExportStep />}
      </div>

      {/* Version History Debug (nur für MVP sichtbar) */}
      {state.versionHistory.length > 0 && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Version History ({state.versionHistory.length} Einträge)
          </p>
          <div className="space-y-1">
            {state.versionHistory.map((v) => (
              <p key={v.id} className="text-xs text-muted-foreground">
                {new Date(v.timestamp).toLocaleTimeString()}: {v.description}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
