import { useEffect } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { AnalysisIssue, IssueCategory, generateId } from "@/types/storyState";
import { cn } from "@/lib/utils";

// Mock analysis function - in production, this would call an API
function analyzeStory(story: string): Promise<{ issues: AnalysisIssue[]; score: number }> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.1) {
        reject(new Error("Verbindung zum Server fehlgeschlagen"));
        return;
      }

      const issues: AnalysisIssue[] = [];
      let score = 100;

      // Check for role
      if (!story.toLowerCase().includes("als ")) {
        issues.push({
          id: generateId(),
          category: "missing_role",
          textReference: story,
          reasoning: "Die Story enthält keine explizite Rollenangabe.",
          clarificationQuestion: "Wer ist der primäre Nutzer dieser Funktion?",
          severity: "error",
        });
        score -= 30;
      }

      // Check for action
      if (!story.toLowerCase().includes("möchte ich")) {
        issues.push({
          id: generateId(),
          category: "missing_goal",
          textReference: story,
          reasoning: "Die Story enthält kein klares Ziel oder keine Aktion.",
          clarificationQuestion: "Was genau soll der Nutzer tun können?",
          severity: "error",
        });
        score -= 30;
      }

      // Check for benefit
      if (!story.toLowerCase().includes("damit")) {
        issues.push({
          id: generateId(),
          category: "missing_benefit",
          textReference: story,
          reasoning: "Der Nutzen oder Mehrwert ist nicht explizit angegeben.",
          clarificationQuestion: "Welchen Mehrwert hat diese Funktion für den Nutzer?",
          severity: "warning",
        });
        score -= 20;
      }

      // Check length
      if (story.length < 30) {
        issues.push({
          id: generateId(),
          category: "too_short",
          textReference: story,
          reasoning: "Die Story ist sehr kurz und könnte mehr Details enthalten.",
          severity: "info",
        });
        score -= 10;
      }

      resolve({
        issues,
        score: Math.max(0, score),
      });
    }, 1500);
  });
}

const categoryLabels: Record<IssueCategory, string> = {
  missing_role: "Fehlende Rolle",
  missing_goal: "Fehlendes Ziel",
  missing_benefit: "Fehlender Nutzen",
  vague_language: "Unklare Sprache",
  too_long: "Zu lang",
  too_short: "Zu kurz",
  missing_context: "Fehlender Kontext",
  technical_debt: "Technische Schuld",
  not_testable: "Nicht testbar",
  other: "Sonstiges",
};

export function AnalysisStep() {
  const { state, actions } = useStory();
  const { originalStoryText, analysisIssues, analysisScore, isLoading, error } = state;

  const runAnalysis = async () => {
    actions.setLoading(true);
    actions.setError(null);
    try {
      const result = await analyzeStory(originalStoryText);
      actions.setAnalysisResults(result.issues, result.score);
      actions.markStepCompleted('analysis');
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      actions.setLoading(false);
    }
  };

  useEffect(() => {
    if (analysisScore === null) {
      runAnalysis();
    }
  }, []);

  if (isLoading) {
    return <LoadingState message="Story wird analysiert..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={runAnalysis} />;
  }

  if (analysisScore === null) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  const getIssueIcon = (severity: AnalysisIssue["severity"]) => {
    switch (severity) {
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "info":
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Analyse-Ergebnis</h2>
        <p className="text-sm text-muted-foreground">
          Überprüfen Sie die Qualität Ihrer User Story.
        </p>
      </div>

      {/* Original Story */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Ihre Story:</p>
        <p className="text-sm text-foreground">{originalStoryText}</p>
      </div>

      {/* Score */}
      <div className="rounded-lg border border-border bg-card p-6 text-center shadow-card">
        <p className="text-sm text-muted-foreground mb-2">Qualitätsscore</p>
        <p className={cn("text-5xl font-bold", getScoreColor(analysisScore))}>
          {analysisScore}
          <span className="text-2xl text-muted-foreground">/100</span>
        </p>
      </div>

      {/* Issues */}
      {analysisIssues.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            Gefundene Probleme ({analysisIssues.length})
          </h3>
          {analysisIssues.map((issue) => (
            <div
              key={issue.id}
              className={cn(
                "rounded-lg border p-4",
                issue.severity === "error" && "border-destructive/30 bg-destructive/5",
                issue.severity === "warning" && "border-warning/30 bg-warning/5",
                issue.severity === "info" && "border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex items-start gap-3">
                {getIssueIcon(issue.severity)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">
                      {categoryLabels[issue.category]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{issue.reasoning}</p>
                  {issue.clarificationQuestion && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Klärungsfrage: {issue.clarificationQuestion}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-success" />
            <p className="text-sm font-medium text-foreground">
              Keine Probleme gefunden! Ihre Story entspricht den Best Practices.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => actions.goToStep('input')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button onClick={() => actions.goToStep('rewrite')}>
          Weiter zu Rewrite
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
