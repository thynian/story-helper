import { useEffect, useState } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { ArrowLeft, ArrowRight, Sparkles, Check, Pencil, X } from "lucide-react";
import { RewriteCandidate, generateId, createTimestamp } from "@/types/storyState";
import { cn } from "@/lib/utils";

// Mock rewrite function
function generateRewrites(story: string): Promise<RewriteCandidate[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.1) {
        reject(new Error("KI-Service vorübergehend nicht verfügbar"));
        return;
      }

      const candidates: RewriteCandidate[] = [
        {
          id: generateId(),
          suggestedText: `Als registrierter Benutzer möchte ich mich sicher mit E-Mail und Passwort authentifizieren können, damit ich auf mein persönliches Dashboard zugreifen und meine Daten verwalten kann.`,
          explanation: "Präzisere Rollendefinition, klarer Authentifizierungsmechanismus und erweiterter Nutzen.",
          createdAt: createTimestamp(),
        },
        {
          id: generateId(),
          suggestedText: `Als Benutzer möchte ich mich mit meinen Anmeldedaten einloggen können, damit ich Zugriff auf meine personalisierten Einstellungen und gespeicherten Daten habe.`,
          explanation: "Fokus auf Personalisierung und Datenzugriff als Hauptnutzen.",
          createdAt: createTimestamp(),
        },
      ];

      resolve(candidates);
    }, 2000);
  });
}

export function RewriteStep() {
  const { state, actions } = useStory();
  const { originalStoryText, rewriteCandidates, selectedRewriteId, optimisedStoryText, isLoading, error } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const generateSuggestions = async () => {
    actions.setLoading(true);
    actions.setError(null);
    try {
      const candidates = await generateRewrites(originalStoryText);
      actions.setRewriteCandidates(candidates);
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      actions.setLoading(false);
    }
  };

  useEffect(() => {
    if (rewriteCandidates.length === 0) {
      generateSuggestions();
    }
  }, []);

  const handleAccept = (candidate: RewriteCandidate) => {
    actions.acceptRewrite(candidate.id);
    actions.addVersionHistory('rewrite_accepted', `Rewrite übernommen: "${candidate.suggestedText.slice(0, 50)}..."`);
    actions.markStepCompleted('rewrite');
  };

  const handleStartEdit = (candidate: RewriteCandidate) => {
    setEditingId(candidate.id);
    setEditText(candidate.suggestedText);
  };

  const handleSaveEdit = (candidate: RewriteCandidate) => {
    actions.acceptRewrite(candidate.id, editText);
    actions.addVersionHistory('rewrite_accepted', `Rewrite bearbeitet und übernommen`);
    actions.markStepCompleted('rewrite');
    setEditingId(null);
  };

  const handleReject = (candidate: RewriteCandidate) => {
    actions.rejectRewrite(candidate.id);
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
          Wählen Sie einen Vorschlag oder bearbeiten Sie ihn nach Ihren Wünschen.
        </p>
      </div>

      {/* Original Story Reference */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Original:</p>
        <p className="text-sm text-foreground">{originalStoryText}</p>
      </div>

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

      <Button variant="outline" className="w-full" onClick={generateSuggestions}>
        <Sparkles className="h-4 w-4 mr-2" />
        Neue Vorschläge generieren
      </Button>

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

      {!canProceed && (
        <p className="text-xs text-center text-muted-foreground">
          Bitte übernehmen Sie einen Vorschlag, um fortzufahren.
        </p>
      )}
    </div>
  );
}
