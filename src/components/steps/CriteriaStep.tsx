import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { SuggestionCard } from "@/components/wizard/SuggestionCard";
import { ArrowLeft, ArrowRight, Plus, ListChecks } from "lucide-react";
import { Suggestion } from "@/types/story";

interface CriteriaStepProps {
  story: string;
  criteria: Suggestion[];
  onCriteriaGenerated: (criteria: Suggestion[]) => void;
  onCriteriaUpdate: (criteria: Suggestion[]) => void;
  onNext: () => void;
  onBack: () => void;
}

// Mock criteria generation
function generateCriteria(story: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.1) {
        reject(new Error("Kriterien konnten nicht generiert werden"));
        return;
      }

      resolve([
        "Gegeben ein registrierter Benutzer mit gültigen Anmeldedaten, wenn er seine E-Mail und sein Passwort eingibt, dann wird er erfolgreich eingeloggt.",
        "Gegeben ein Benutzer mit ungültigen Anmeldedaten, wenn er versucht sich einzuloggen, dann wird eine Fehlermeldung angezeigt.",
        "Gegeben ein eingeloggter Benutzer, wenn er auf 'Abmelden' klickt, dann wird er ausgeloggt und zur Login-Seite weitergeleitet.",
        "Gegeben ein Benutzer, der sein Passwort vergessen hat, wenn er auf 'Passwort vergessen' klickt, dann kann er sein Passwort zurücksetzen.",
      ]);
    }, 2500);
  });
}

export function CriteriaStep({
  story,
  criteria,
  onCriteriaGenerated,
  onCriteriaUpdate,
  onNext,
  onBack,
}: CriteriaStepProps) {
  const [loading, setLoading] = useState(criteria.length === 0);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateCriteria(story);
      const suggestions: Suggestion[] = generated.map((text, i) => ({
        id: `criterion-${i}`,
        type: "criterion",
        suggested: text,
        status: "pending",
      }));
      onCriteriaGenerated(suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (criteria.length === 0) {
      generate();
    }
  }, []);

  const handleAccept = (id: string) => {
    const updated = criteria.map((c) =>
      c.id === id ? { ...c, status: "accepted" as const } : c
    );
    onCriteriaUpdate(updated);
  };

  const handleEdit = (id: string, newText: string) => {
    const updated = criteria.map((c) =>
      c.id === id ? { ...c, status: "edited" as const, editedText: newText } : c
    );
    onCriteriaUpdate(updated);
  };

  const handleDiscard = (id: string) => {
    const updated = criteria.map((c) =>
      c.id === id ? { ...c, status: "discarded" as const } : c
    );
    onCriteriaUpdate(updated);
  };

  const acceptedCount = criteria.filter(
    (c) => c.status === "accepted" || c.status === "edited"
  ).length;

  const pendingCount = criteria.filter((c) => c.status === "pending").length;

  const canProceed = acceptedCount > 0;

  if (loading) {
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
          Überprüfen Sie die generierten Kriterien und wählen Sie die passenden aus.
        </p>
      </div>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4 text-primary" />
          <span>{criteria.length} Kriterien generiert</span>
        </div>
        <div className="text-sm">
          <span className="text-success font-medium">{acceptedCount} übernommen</span>
          {pendingCount > 0 && (
            <span className="text-muted-foreground"> · {pendingCount} ausstehend</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {criteria.map((criterion, index) => (
          <div key={criterion.id}>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Kriterium {index + 1}
            </p>
            <SuggestionCard
              suggestion={criterion}
              onAccept={handleAccept}
              onEdit={handleEdit}
              onDiscard={handleDiscard}
            />
          </div>
        ))}
      </div>

      <Button variant="outline" className="w-full" onClick={generate}>
        <Plus className="h-4 w-4 mr-2" />
        Weitere Kriterien generieren
      </Button>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
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
