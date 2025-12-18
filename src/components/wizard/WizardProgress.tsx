import { cn } from "@/lib/utils";
import { WIZARD_STEPS, WizardStep } from "@/types/story";
import { Check } from "lucide-react";

interface WizardProgressProps {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  onStepClick: (step: WizardStep) => void;
  canNavigateTo: (step: WizardStep) => boolean;
}

export function WizardProgress({ 
  currentStep, 
  completedSteps, 
  onStepClick,
  canNavigateTo 
}: WizardProgressProps) {
  const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);

  return (
    <nav className="mb-8">
      <ol className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const isClickable = canNavigateTo(step.id);

          return (
            <li key={step.id} className="flex-1 relative">
              {/* Connector Line */}
              {index > 0 && (
                <div 
                  className={cn(
                    "absolute left-0 top-4 -translate-y-1/2 h-0.5 w-full -translate-x-1/2",
                    index <= currentIndex ? "bg-primary" : "bg-border"
                  )}
                  style={{ width: 'calc(100% - 2rem)', left: 'calc(-50% + 1rem)' }}
                />
              )}
              
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "relative flex flex-col items-center group",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-not-allowed"
                )}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200",
                    isCompleted && "bg-step-completed border-step-completed",
                    isCurrent && !isCompleted && "bg-primary border-primary",
                    !isCurrent && !isCompleted && "bg-card border-border",
                    isClickable && !isCurrent && "group-hover:border-primary/50"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 text-success-foreground" />
                  ) : (
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isCurrent ? "text-primary-foreground" : "text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isCurrent ? "text-foreground" : "text-muted-foreground",
                      isClickable && !isCurrent && "group-hover:text-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
