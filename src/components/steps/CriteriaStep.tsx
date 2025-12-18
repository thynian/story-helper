import { useState } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { ArrowLeft, ArrowRight, Plus, ListChecks, Check, Pencil, X, Sparkles, CheckCircle } from "lucide-react";
import { AcceptanceCriterion } from "@/types/storyState";
import { cn } from "@/lib/utils";

export function CriteriaStep() {
  const { state, actions } = useStory();
  const { optimisedStoryText, originalStoryText, acceptanceCriteria, userDecisions, isLoading, error } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ given: "", when: "", then: "" });

  const storyToUse = optimisedStoryText || originalStoryText;
  const hasGenerated = acceptanceCriteria.length > 0;

  const generate = async () => {
    await actions.generateAcceptanceCriteriaAction();
  };

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

  // Get all accepted/edited criteria (final criteria)
  const finalAcceptanceCriteria = acceptanceCriteria.filter((c) => {
    const decision = getDecisionForCriterion(c.id);
    return decision && (decision.decision === 'accepted' || decision.decision === 'edited');
  });

  // Get criteria still pending decision
  const pendingCriteria = acceptanceCriteria.filter((c) => {
    const decision = getDecisionForCriterion(c.id);
    return !decision;
  });

  const canProceed = finalAcceptanceCriteria.length > 0;

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
          Generieren und überprüfen Sie Akzeptanzkriterien im Given/When/Then-Format.
        </p>
      </div>

      {/* Story Reference */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Basierend auf:</p>
        <p className="text-sm text-foreground">{storyToUse}</p>
      </div>

      {/* Generate Button */}
      {!hasGenerated ? (
        <Button onClick={generate} className="w-full">
          <Sparkles className="h-4 w-4 mr-2" />
          Kriterien generieren
        </Button>
      ) : (
        <>
          {/* Status Summary */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListChecks className="h-4 w-4 text-primary" />
              <span>{acceptanceCriteria.length} Kriterien generiert</span>
            </div>
            <div className="text-sm">
              <span className="text-success font-medium">{finalAcceptanceCriteria.length} übernommen</span>
              {pendingCriteria.length > 0 && (
                <span className="text-muted-foreground ml-2">• {pendingCriteria.length} ausstehend</span>
              )}
            </div>
          </div>

          {/* Final Accepted Criteria */}
          {finalAcceptanceCriteria.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-success flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Übernommene Kriterien ({finalAcceptanceCriteria.length})
              </h3>
              <div className="space-y-3">
                {finalAcceptanceCriteria.map((criterion, index) => {
                  const decision = getDecisionForCriterion(criterion.id);
                  return (
                    <div
                      key={criterion.id}
                      className="rounded-lg border border-success/50 bg-success/5 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-success">
                          Kriterium {index + 1}
                        </p>
                        <span className="text-xs text-success/70">
                          {decision?.decision === 'edited' ? 'Bearbeitet' : 'Übernommen'}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium text-success">Given</span>{" "}
                          <span className="text-foreground">{criterion.given}</span>
                        </p>
                        <p>
                          <span className="font-medium text-success">When</span>{" "}
                          <span className="text-foreground">{criterion.when}</span>
                        </p>
                        <p>
                          <span className="font-medium text-success">Then</span>{" "}
                          <span className="text-foreground">{criterion.then}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Criteria */}
          {pendingCriteria.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Ausstehende Kriterien ({pendingCriteria.length})
              </h3>
              <div className="space-y-4">
                {pendingCriteria.map((criterion, index) => {
                  const isEditing = editingId === criterion.id;

                  return (
                    <div
                      key={criterion.id}
                      className="rounded-lg border border-border bg-card p-4 shadow-card hover:border-primary/30 transition-all duration-200"
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-3">
                        Vorschlag {index + 1}
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
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate More Button */}
          <Button variant="outline" className="w-full" onClick={generate}>
            <Plus className="h-4 w-4 mr-2" />
            Weitere Kriterien generieren
          </Button>
        </>
      )}

      {/* Navigation */}
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

      {!canProceed && hasGenerated && (
        <p className="text-xs text-center text-muted-foreground">
          Übernehmen Sie mindestens ein Kriterium, um fortzufahren.
        </p>
      )}
    </div>
  );
}
