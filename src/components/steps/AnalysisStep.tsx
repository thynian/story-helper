import { useState } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, Info, Play, RefreshCw, AlertOctagon } from "lucide-react";
import { IssueCategory, IssueSeverity } from "@/types/storyTypes";
import { cn } from "@/lib/utils";

const categoryLabels: Record<IssueCategory, string> = {
  ambiguity: "Mehrdeutigkeit",
  missing_role: "Fehlende Rolle",
  missing_goal: "Fehlendes Ziel",
  missing_benefit: "Fehlender Nutzen",
  vague_language: "Unklare Sprache",
  too_broad_scope: "Zu breiter Umfang",
  solution_bias: "Lösungsvorgabe",
  persona_unclear: "Unklare Persona",
  business_value_gap: "Fehlender Business Value",
  not_testable: "Nicht testbar",
  inconsistency: "Widerspruch",
  missing_context: "Fehlender Kontext",
  technical_debt: "Technische Schuld",
  other: "Sonstiges",
};

const severityColors: Record<IssueSeverity, string> = {
  critical: "border-destructive/50 bg-destructive/10",
  major: "border-warning/50 bg-warning/10",
  minor: "border-primary/30 bg-primary/5",
  info: "border-muted-foreground/30 bg-muted/30",
};

export function AnalysisStep() {
  const { state, actions } = useStory();
  const { 
    originalStoryText, 
    optimisedStoryText,
    analysisIssues, 
    analysisScore, 
    additionalContext,
    isLoading, 
    error 
  } = state;

  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  const storyText = optimisedStoryText || originalStoryText;
  const hasAnalysisRun = analysisScore !== null;
  const relevantIssuesCount = analysisIssues.filter(i => i.isRelevant).length;

  const handleStartAnalysis = async () => {
    await actions.analyzeStoryAction();
    actions.markStepCompleted('analysis');
  };

  const handleToggleRelevant = (issueId: string, isRelevant: boolean) => {
    actions.updateAnalysisIssue(issueId, { isRelevant });
  };

  const handleUpdateNote = (issueId: string, userNote: string) => {
    actions.updateAnalysisIssue(issueId, { userNote });
  };

  const getIssueIcon = (severity: IssueSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertOctagon className="h-4 w-4 text-destructive" />;
      case "major":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "minor":
        return <Info className="h-4 w-4 text-primary" />;
      case "info":
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  if (isLoading) {
    return <LoadingState message="Story wird analysiert..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={handleStartAnalysis} />;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Story-Analyse</h2>
        <p className="text-sm text-muted-foreground">
          Analysieren Sie Ihre User Story auf Qualitätsprobleme und Verbesserungspotenzial.
        </p>
      </div>

      {/* Original Story Display */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Ihre Story:</p>
        <p className="text-sm text-foreground">{storyText}</p>
      </div>

      {/* Additional Context Field */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Ergänzungen / Antworten
        </label>
        <Textarea
          placeholder="Fügen Sie hier zusätzliche Informationen, Antworten auf Klärungsfragen oder Kontext hinzu, der in die nächste Analyse einfließen soll..."
          value={additionalContext}
          onChange={(e) => actions.setAdditionalContext(e.target.value)}
          className="min-h-[80px]"
        />
        <p className="text-xs text-muted-foreground">
          Diese Informationen werden bei der nächsten Analyse berücksichtigt.
        </p>
      </div>

      {/* Analysis Actions */}
      <div className="flex gap-3">
        {!hasAnalysisRun ? (
          <Button onClick={handleStartAnalysis} className="flex-1">
            <Play className="h-4 w-4 mr-2" />
            Analyse starten
          </Button>
        ) : (
          <Button onClick={handleStartAnalysis} variant="outline" className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Analyse wiederholen
          </Button>
        )}
      </div>

      {/* Score Display */}
      {hasAnalysisRun && (
        <div className="rounded-lg border border-border bg-card p-6 text-center shadow-card">
          <p className="text-sm text-muted-foreground mb-2">Qualitätsscore</p>
          <p className={cn("text-5xl font-bold", getScoreColor(analysisScore))}>
            {analysisScore}
            <span className="text-2xl text-muted-foreground">/100</span>
          </p>
        </div>
      )}

      {/* Issues List */}
      {hasAnalysisRun && (
        <>
          {analysisIssues.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  Gefundene Probleme ({analysisIssues.length})
                </h3>
                {relevantIssuesCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {relevantIssuesCount} als relevant markiert
                  </span>
                )}
              </div>

              {analysisIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={cn(
                    "rounded-lg border p-4 transition-all",
                    severityColors[issue.severity],
                    issue.isRelevant && "ring-2 ring-primary/50"
                  )}
                >
                  <div className="space-y-3">
                    {/* Issue Header */}
                    <div className="flex items-start gap-3">
                      {getIssueIcon(issue.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">
                            {categoryLabels[issue.category]}
                          </span>
                        </div>
                        
                        {/* Text Reference */}
                        {issue.textReference && (
                          <div className="mt-2 p-2 rounded bg-background/50 border border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Betroffene Textstelle:</p>
                            <p className="text-sm font-mono text-foreground">"{issue.textReference}"</p>
                          </div>
                        )}

                        {/* Reasoning */}
                        <p className="text-sm font-medium text-foreground mt-2">{issue.reasoning}</p>

                        {/* Clarification Question */}
                        {issue.clarificationQuestion && (
                          <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20">
                            <p className="text-xs font-medium text-primary mb-1">Klärungsfrage:</p>
                            <p className="text-sm text-foreground italic">{issue.clarificationQuestion}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Human-in-the-loop Controls */}
                    <div className="border-t border-border/50 pt-3 space-y-3">
                      {/* Relevance Toggle */}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`relevant-${issue.id}`}
                          checked={issue.isRelevant || false}
                          onCheckedChange={(checked) => handleToggleRelevant(issue.id, checked === true)}
                        />
                        <label 
                          htmlFor={`relevant-${issue.id}`}
                          className="text-sm text-foreground cursor-pointer"
                        >
                          Als relevant für Rewrite markieren
                        </label>
                      </div>

                      {/* User Note */}
                      <div className="space-y-1">
                        <button
                          onClick={() => setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expandedIssueId === issue.id ? "Notiz ausblenden" : "Notiz hinzufügen"}
                        </button>
                        {(expandedIssueId === issue.id || issue.userNote) && (
                          <Input
                            placeholder="Ihre Notiz zu diesem Problem..."
                            value={issue.userNote || ""}
                            onChange={(e) => handleUpdateNote(issue.id, e.target.value)}
                            className="text-sm"
                          />
                        )}
                      </div>
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
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => actions.goToStep('input')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button 
          onClick={() => actions.goToStep('rewrite')}
          disabled={!hasAnalysisRun}
        >
          Weiter zu Rewrite
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
