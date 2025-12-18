import { useEffect, useState } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { ArrowLeft, ArrowRight, Plus, ListChecks, Check, Pencil, X } from "lucide-react";
import { AcceptanceCriterion, generateId } from "@/types/storyState";
import { cn } from "@/lib/utils";

// Mock criteria generation
function generateCriteria(story: string): Promise<AcceptanceCriterion[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.1) {
        reject(new Error("Kriterien konnten nicht generiert werden"));
        return;
      }

      resolve([
        {
          id: generateId(),
          given: "ein registrierter Benutzer mit gültigen Anmeldedaten",
          when: "er seine E-Mail und sein Passwort eingibt und auf 'Anmelden' klickt",
          then: "wird er erfolgreich eingeloggt und zum Dashboard weitergeleitet",
        },
        {
          id: generateId(),
          given: "ein Benutzer mit ungültigen Anmeldedaten",
          when: "er versucht sich einzuloggen",
          then: "wird eine klare Fehlermeldung angezeigt und er bleibt auf der Login-Seite",
        },
        {
          id: generateId(),
          given: "ein eingeloggter Benutzer",
          when: "er auf 'Abmelden' klickt",
          then: "wird seine Session beendet und er zur Login-Seite weitergeleitet",
        },
        {
          id: generateId(),
          given: "ein Benutzer, der sein Passwort vergessen hat",
          when: "er auf 'Passwort vergessen' klickt",
          then: "kann er sein Passwort per E-Mail zurücksetzen",
        },
      ]);
    }, 2500);
  });
}

export function CriteriaStep() {
  const { state, actions } = useStory();
  const { optimisedStoryText, originalStoryText, acceptanceCriteria, userDecisions, isLoading, error } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ given: "", when: "", then: "" });

  const storyToUse = optimisedStoryText || originalStoryText;

  const generate = async () => {
    actions.setLoading(true);
    actions.setError(null);
    try {
      const generated = await generateCriteria(storyToUse);
      actions.setAcceptanceCriteria(generated);
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      actions.setLoading(false);
    }
  };

  useEffect(() => {
    if (acceptanceCriteria.length === 0) {
      generate();
    }
  }, []);

  const handleAccept = (criterion: AcceptanceCriterion) => {
    actions.acceptCriterion(criterion.id);
  };

  const handleStartEdit = (criterion: AcceptanceCriterion) => {
    setEditingId(criterion.id);
    setEditForm({
      given: criterion.given,
      when: criterion.when,
      then: criterion.then,
    });
  };

  const handleSaveEdit = (criterion: AcceptanceCriterion) => {
    actions.acceptCriterion(criterion.id, editForm);
    setEditingId(null);
  };

  const handleReject = (criterion: AcceptanceCriterion) => {
    actions.rejectCriterion(criterion.id);
  };

  const getDecisionForCriterion = (id: string) => {
    return userDecisions.find((d) => d.targetType === 'criterion' && d.targetId === id);
  };

  const acceptedCount = acceptanceCriteria.filter((c) => {
    const decision = getDecisionForCriterion(c.id);
    return decision && (decision.decision === 'accepted' || decision.decision === 'edited');
  }).length;

  const canProceed = acceptedCount > 0;

  if (isLoading) {
    return <LoadingState message="Akzeptanzkriterien werden generiert..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={generate} />;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Akzeptanzkriterien</h2>
        <p className="text-sm text-muted-foreground">
          Überprüfen Sie die generierten Kriterien im Given/When/Then-Format.
        </p>
      </div>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4 text-primary" />
          <span>{acceptanceCriteria.length} Kriterien generiert</span>
        </div>
        <div className="text-sm">
          <span className="text-success font-medium">{acceptedCount} übernommen</span>
        </div>
      </div>

      <div className="space-y-4">
        {acceptanceCriteria.map((criterion, index) => {
          const decision = getDecisionForCriterion(criterion.id);
          const isAccepted = decision && (decision.decision === 'accepted' || decision.decision === 'edited');
          const isEditing = editingId === criterion.id;

          return (
            <div
              key={criterion.id}
              className={cn(
                "rounded-lg border bg-card p-4 shadow-card transition-all duration-200",
                isAccepted && "border-success/50 bg-success/5",
                !isAccepted && "border-border hover:border-primary/30"
              )}
            >
              <p className="text-xs font-medium text-muted-foreground mb-3">
                Kriterium {index + 1}
              </p>

              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Given</label>
                    <Input
                      value={editForm.given}
                      onChange={(e) => setEditForm({ ...editForm, given: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">When</label>
                    <Input
                      value={editForm.when}
                      onChange={(e) => setEditForm({ ...editForm, when: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Then</label>
                    <Input
                      value={editForm.then}
                      onChange={(e) => setEditForm({ ...editForm, then: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Abbrechen
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(criterion)}>
                      Speichern & Übernehmen
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium text-primary">Given</span>{" "}
                      <span className="text-foreground">{criterion.given}</span>
                    </p>
                    <p>
                      <span className="font-medium text-primary">When</span>{" "}
                      <span className="text-foreground">{criterion.when}</span>
                    </p>
                    <p>
                      <span className="font-medium text-primary">Then</span>{" "}
                      <span className="text-foreground">{criterion.then}</span>
                    </p>
                  </div>

                  {isAccepted ? (
                    <p className="text-xs text-success flex items-center gap-1 mt-3">
                      <Check className="h-3 w-3" />{" "}
                      {decision?.decision === 'edited' ? 'Bearbeitet & übernommen' : 'Übernommen'}
                    </p>
                  ) : (
                    <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-success hover:text-success hover:bg-success/10 hover:border-success/50"
                        onClick={() => handleAccept(criterion)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Übernehmen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 hover:bg-primary/10 hover:border-primary/50"
                        onClick={() => handleStartEdit(criterion)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                        onClick={() => handleReject(criterion)}
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

      <Button variant="outline" className="w-full" onClick={generate}>
        <Plus className="h-4 w-4 mr-2" />
        Weitere Kriterien generieren
      </Button>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => actions.goToStep('rewrite')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button
          onClick={() => {
            actions.markStepCompleted('criteria');
            actions.goToStep('export');
          }}
          disabled={!canProceed}
        >
          Weiter zu Export
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {!canProceed && (
        <p className="text-xs text-center text-muted-foreground">
          Übernehmen Sie mindestens ein Kriterium, um fortzufahren.
        </p>
      )}
    </div>
  );
}
