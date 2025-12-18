import { useState } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { ArrowLeft, ArrowRight, Sparkles, Check, Pencil, X, RefreshCw, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { RewriteSuggestion, IssueCategory, IssueSeverity } from "@/types/storyTypes";
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

export function RewriteStep() {
  const { state, actions } = useStory();
  const { 
    originalStoryText, 
    optimisedStoryText,
    analysisIssues,
    rewriteCandidates, 
    selectedRewriteId, 
    isLoading, 
    error 
  } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const relevantIssues = analysisIssues.filter(issue => issue.isRelevant);
  const storyText = optimisedStoryText || originalStoryText;
  const hasGenerated = rewriteCandidates.length > 0;

  const generateSuggestions = async () => {
    await actions.rewriteStoryAction();
  };

  const handleAccept = (candidate: RewriteSuggestion) => {
    actions.acceptRewrite(candidate.id);
    actions.addVersionHistory('rewrite_accepted', `Rewrite übernommen: "${candidate.suggestedText.slice(0, 50)}..."`);
    actions.markStepCompleted('rewrite');
  };

  const handleStartEdit = (candidate: RewriteSuggestion) => {
    setEditingId(candidate.id);
    setEditText(candidate.suggestedText);
  };

  const handleSaveEdit = (candidate: RewriteSuggestion) => {
    actions.acceptRewrite(candidate.id, editText);
    actions.addVersionHistory('rewrite_accepted', `Rewrite bearbeitet und übernommen`);
    actions.markStepCompleted('rewrite');
    setEditingId(null);
  };

  const handleReject = (candidate: RewriteSuggestion) => {
    actions.rejectRewrite(candidate.id);
  };

  const handleReanalyze = () => {
    actions.goToStep('analysis');
  };

  const getIssueIcon = (severity: IssueSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertOctagon className="h-3 w-3 text-destructive" />;
      case "major":
        return <AlertTriangle className="h-3 w-3 text-warning" />;
      case "minor":
        return <Info className="h-3 w-3 text-primary" />;
      case "info":
        return <Info className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const canProceed = !!optimisedStoryText;

  if (isLoading) {
    return <LoadingState message="Verbesserte Versionen werden generiert..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={generateSuggestions} />;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Story verbessern</h2>
        <p className="text-sm text-muted-foreground">
          Generieren Sie Verbesserungsvorschläge basierend auf der Analyse.
        </p>
      </div>

      {/* Original/Current Story Reference */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {optimisedStoryText ? "Aktuelle Story:" : "Original:"}
        </p>
        <p className="text-sm text-foreground">{storyText}</p>
      </div>

      {/* Relevant Issues Summary */}
      {relevantIssues.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-medium text-primary">
            Als relevant markierte Probleme ({relevantIssues.length})
          </p>
          <div className="space-y-2">
            {relevantIssues.map((issue) => (
              <div key={issue.id} className="flex items-start gap-2 text-sm">
                {getIssueIcon(issue.severity)}
                <div className="flex-1">
                  <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded mr-2">
                    {categoryLabels[issue.category]}
                  </span>
                  <span className="text-muted-foreground">{issue.reasoning}</span>
                  {issue.userNote && (
                    <p className="text-xs text-primary mt-1 italic">Notiz: {issue.userNote}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {relevantIssues.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            Keine Issues als relevant markiert. Die KI wird allgemeine Verbesserungen vorschlagen.
          </p>
        </div>
      )}

      {/* Generate Button */}
      {!hasGenerated ? (
        <Button onClick={generateSuggestions} className="w-full">
          <Sparkles className="h-4 w-4 mr-2" />
          Rewrite-Vorschläge generieren
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>{rewriteCandidates.length} Vorschläge generiert</span>
          </div>

          {/* Rewrite Candidates */}
          <div className="space-y-4">
            {rewriteCandidates.map((candidate, index) => {
              const isSelected = selectedRewriteId === candidate.id;
              const isEditing = editingId === candidate.id;
              const isRejected = state.userDecisions.some(
                (d) => d.targetId === candidate.id && d.decision === 'rejected'
              );

              if (isRejected) {
                return (
                  <div key={candidate.id} className="rounded-lg border border-border bg-muted/30 p-4 opacity-50">
                    <p className="text-sm text-muted-foreground line-through">{candidate.suggestedText}</p>
                    <p className="text-xs text-muted-foreground mt-2">Verworfen</p>
                  </div>
                );
              }

              return (
                <div
                  key={candidate.id}
                  className={cn(
                    "rounded-lg border bg-card p-4 shadow-card transition-all duration-200",
                    isSelected && "border-success/50 bg-success/5",
                    !isSelected && "border-border hover:border-primary/30"
                  )}
                >
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Vorschlag {index + 1}
                  </p>

                  {isEditing ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[100px] text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Abbrechen
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(candidate)}>
                          Speichern & Übernehmen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground whitespace-pre-wrap mb-2">
                        {candidate.suggestedText}
                      </p>
                      <p className="text-xs text-muted-foreground italic mb-4">
                        {candidate.explanation}
                      </p>

                      {isSelected ? (
                        <p className="text-xs text-success flex items-center gap-1">
                          <Check className="h-3 w-3" /> Übernommen
                        </p>
                      ) : (
                        <div className="flex gap-2 pt-3 border-t border-border">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-success hover:text-success hover:bg-success/10 hover:border-success/50"
                            onClick={() => handleAccept(candidate)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Übernehmen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 hover:bg-primary/10 hover:border-primary/50"
                            onClick={() => handleStartEdit(candidate)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Bearbeiten
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                            onClick={() => handleReject(candidate)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Verwerfen
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Regenerate Button */}
          <Button variant="outline" className="w-full" onClick={generateSuggestions}>
            <Sparkles className="h-4 w-4 mr-2" />
            Neue Vorschläge generieren
          </Button>
        </>
      )}

      {/* Re-analyze Button (only if optimised story exists) */}
      {optimisedStoryText && (
        <Button 
          variant="ghost" 
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={handleReanalyze}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Erneut analysieren (mit optimierter Story)
        </Button>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => actions.goToStep('analysis')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button onClick={() => actions.goToStep('criteria')} disabled={!canProceed}>
          Weiter zu Akzeptanzkriterien
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {!canProceed && hasGenerated && (
        <p className="text-xs text-center text-muted-foreground">
          Bitte übernehmen Sie einen Vorschlag, um fortzufahren.
        </p>
      )}
    </div>
  );
}
