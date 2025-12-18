import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/wizard/LoadingState";
import { ErrorState } from "@/components/wizard/ErrorState";
import { SuggestionCard } from "@/components/wizard/SuggestionCard";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Suggestion } from "@/types/story";

interface RewriteStepProps {
  story: string;
  rewriteSuggestion: Suggestion | null;
  onSuggestionGenerated: (suggestion: Suggestion) => void;
  onSuggestionUpdate: (suggestion: Suggestion) => void;
  onNext: () => void;
  onBack: () => void;
}

// Mock rewrite function
function generateRewrite(story: string): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.1) {
        reject(new Error("KI-Service vorübergehend nicht verfügbar"));
        return;
      }

      // Simple mock rewrite
      let rewritten = story;
      
      if (!story.toLowerCase().includes("als ")) {
        rewritten = "Als Benutzer " + rewritten;
      }
      
      if (!story.toLowerCase().includes("möchte ich")) {
        rewritten = rewritten.replace(/will |wünsche |brauche /i, "möchte ich ");
      }
      
      if (!story.toLowerCase().includes("damit")) {
        rewritten = rewritten + ", damit ich effizienter arbeiten kann";
      }

      // Add some improvements
      rewritten = rewritten
        .replace("einloggen", "mich sicher authentifizieren")
        .replace("Konto", "persönliches Dashboard");

      resolve(rewritten);
    }, 2000);
  });
}

export function RewriteStep({
  story,
  rewriteSuggestion,
  onSuggestionGenerated,
  onSuggestionUpdate,
  onNext,
  onBack,
}: RewriteStepProps) {
  const [loading, setLoading] = useState(!rewriteSuggestion);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestion = async () => {
    setLoading(true);
    setError(null);
    try {
      const rewritten = await generateRewrite(story);
      onSuggestionGenerated({
        id: "rewrite-1",
        type: "rewrite",
        original: story,
        suggested: rewritten,
        status: "pending",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rewriteSuggestion) {
      generateSuggestion();
    }
  }, []);

  const handleAccept = (id: string) => {
    if (rewriteSuggestion) {
      onSuggestionUpdate({ ...rewriteSuggestion, status: "accepted" });
    }
  };

  const handleEdit = (id: string, newText: string) => {
    if (rewriteSuggestion) {
      onSuggestionUpdate({ 
        ...rewriteSuggestion, 
        status: "edited", 
        editedText: newText 
      });
    }
  };

  const handleDiscard = (id: string) => {
    if (rewriteSuggestion) {
      onSuggestionUpdate({ ...rewriteSuggestion, status: "discarded" });
    }
  };

  const canProceed = rewriteSuggestion && 
    (rewriteSuggestion.status === "accepted" || rewriteSuggestion.status === "edited");

  if (loading) {
    return <LoadingState message="Verbesserte Version wird generiert..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={generateSuggestion} />;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Story verbessern</h2>
        <p className="text-sm text-muted-foreground">
          Überprüfen Sie den Vorschlag und entscheiden Sie, ob Sie ihn übernehmen möchten.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Die KI hat eine verbesserte Version Ihrer Story erstellt.</span>
      </div>

      {rewriteSuggestion && (
        <SuggestionCard
          suggestion={rewriteSuggestion}
          onAccept={handleAccept}
          onEdit={handleEdit}
          onDiscard={handleDiscard}
          showOriginal
        />
      )}

      {rewriteSuggestion?.status === "discarded" && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Sie haben den Vorschlag verworfen. Möchten Sie einen neuen generieren?
          </p>
          <Button variant="outline" onClick={generateSuggestion}>
            <Sparkles className="h-4 w-4 mr-2" />
            Neuen Vorschlag generieren
          </Button>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Weiter zu Akzeptanzkriterien
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {!canProceed && rewriteSuggestion?.status === "pending" && (
        <p className="text-xs text-center text-muted-foreground">
          Bitte übernehmen oder bearbeiten Sie den Vorschlag, um fortzufahren.
        </p>
      )}
    </div>
  );
}
