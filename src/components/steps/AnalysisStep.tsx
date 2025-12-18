import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { StoryAnalysis, AnalysisIssue } from "@/types/story";
import { cn } from "@/lib/utils";

interface AnalysisStepProps {
  story: string;
  analysis: StoryAnalysis | null;
  onAnalysisComplete: (analysis: StoryAnalysis) => void;
  onNext: () => void;
  onBack: () => void;
}

// Mock analysis function - in production, this would call an API
function analyzeStory(story: string): Promise<StoryAnalysis> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate occasional errors
      if (Math.random() < 0.1) {
        reject(new Error("Verbindung zum Server fehlgeschlagen"));
        return;
      }

      const issues: AnalysisIssue[] = [];
      let score = 100;

      // Check for role
      if (!story.toLowerCase().includes("als ")) {
        issues.push({
          id: "1",
          type: "error",
          message: "Keine Rolle gefunden",
          suggestion: "Beginnen Sie mit 'Als [Rolle]...'",
        });
        score -= 30;
      }

      // Check for action
      if (!story.toLowerCase().includes("möchte ich")) {
        issues.push({
          id: "2",
          type: "error",
          message: "Keine Aktion gefunden",
          suggestion: "Fügen Sie 'möchte ich [Aktion]' hinzu",
        });
        score -= 30;
      }

      // Check for benefit
      if (!story.toLowerCase().includes("damit")) {
        issues.push({
          id: "3",
          type: "warning",
          message: "Kein Nutzen angegeben",
          suggestion: "Ergänzen Sie 'damit [Nutzen]'",
        });
        score -= 20;
      }

      // Check length
      if (story.length < 30) {
        issues.push({
          id: "4",
          type: "info",
          message: "Story ist sehr kurz",
          suggestion: "Erwägen Sie, mehr Details hinzuzufügen",
        });
        score -= 10;
      }

      resolve({
        score: Math.max(0, score),
        issues,
        suggestions: [
          "Spezifischere Rollenbeschreibung verwenden",
          "Messbare Erfolgskriterien hinzufügen",
        ],
      });
    }, 1500);
  });
}

export function AnalysisStep({
  story,
  analysis,
  onAnalysisComplete,
  onNext,
  onBack,
}: AnalysisStepProps) {
  const [loading, setLoading] = useState(!analysis);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeStory(story);
      onAnalysisComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!analysis) {
      runAnalysis();
    }
  }, []);

  if (loading) {
    return <LoadingState message="Story wird analysiert..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={runAnalysis} />;
  }

  if (!analysis) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  const getIssueIcon = (type: AnalysisIssue["type"]) => {
    switch (type) {
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
        <p className="text-sm text-foreground">{story}</p>
      </div>

      {/* Score */}
      <div className="rounded-lg border border-border bg-card p-6 text-center shadow-card">
        <p className="text-sm text-muted-foreground mb-2">Qualitätsscore</p>
        <p className={cn("text-5xl font-bold", getScoreColor(analysis.score))}>
          {analysis.score}
          <span className="text-2xl text-muted-foreground">/100</span>
        </p>
      </div>

      {/* Issues */}
      {analysis.issues.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Gefundene Probleme</h3>
          {analysis.issues.map((issue) => (
            <div
              key={issue.id}
              className={cn(
                "rounded-lg border p-4",
                issue.type === "error" && "border-destructive/30 bg-destructive/5",
                issue.type === "warning" && "border-warning/30 bg-warning/5",
                issue.type === "info" && "border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex items-start gap-3">
                {getIssueIcon(issue.type)}
                <div>
                  <p className="text-sm font-medium text-foreground">{issue.message}</p>
                  {issue.suggestion && (
                    <p className="text-xs text-muted-foreground mt-1">{issue.suggestion}</p>
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
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button onClick={onNext}>
          Weiter zu Rewrite
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
