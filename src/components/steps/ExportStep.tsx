import { useState, useEffect } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Download, Check, FileText, FileJson, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ExportFormat = "markdown" | "json";

export function ExportStep() {
  const { state, actions } = useStory();
  const { 
    originalStoryText, 
    optimisedStoryText, 
    structuredStory,
    acceptanceCriteria, 
    userDecisions,
    meta 
  } = state;

  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate export on mount
  useEffect(() => {
    actions.generateExportMarkdown();
    actions.markStepCompleted('export');
  }, []);

  const acceptedCriteria = acceptanceCriteria.filter((c) => {
    const decision = userDecisions.find(
      (d) => d.targetType === 'criterion' && d.targetId === c.id
    );
    return decision && (decision.decision === 'accepted' || decision.decision === 'edited');
  });

  const generateMarkdown = () => {
    const criteriaList = acceptedCriteria
      .map((c, i) => `### Kriterium ${i + 1}\n- **Given:** ${c.given}\n- **When:** ${c.when}\n- **Then:** ${c.then}`)
      .join('\n\n');

    const decisionsCount = {
      accepted: userDecisions.filter((d) => d.decision === 'accepted').length,
      edited: userDecisions.filter((d) => d.decision === 'edited').length,
      rejected: userDecisions.filter((d) => d.decision === 'rejected').length,
    };

    return `# User Story Quality Report

## Meta
- **Projekt-ID:** ${meta.projectId}
- **Prompt-Version:** ${meta.promptVersion}
- **Model:** ${meta.modelId}
- **Zuletzt ausgeführt:** ${meta.lastRunAt || 'N/A'}

---

## Original Story
${originalStoryText}

## Optimierte Story
${optimisedStoryText || '_Keine optimierte Version gewählt_'}

${structuredStory ? `## Strukturierte Story
- **Als:** ${structuredStory.role}
- **Möchte ich:** ${structuredStory.goal}
- **Damit:** ${structuredStory.benefit}
${structuredStory.constraints?.length ? `- **Constraints:** ${structuredStory.constraints.join(', ')}` : ''}` : ''}

---

## Akzeptanzkriterien (${acceptedCriteria.length})
${criteriaList || '_Keine Akzeptanzkriterien definiert_'}

---

## Entscheidungen
- Übernommen: ${decisionsCount.accepted}
- Bearbeitet: ${decisionsCount.edited}
- Verworfen: ${decisionsCount.rejected}

---

_Generiert mit User Story Quality Assistant_
`;
  };

  const generateJSON = () => {
    const decisionsCount = {
      accepted: userDecisions.filter((d) => d.decision === 'accepted').length,
      edited: userDecisions.filter((d) => d.decision === 'edited').length,
      rejected: userDecisions.filter((d) => d.decision === 'rejected').length,
    };

    return JSON.stringify(
      {
        meta,
        userStory: {
          original: originalStoryText,
          optimised: optimisedStoryText,
          structured: structuredStory,
        },
        acceptanceCriteria: acceptedCriteria.map((c) => ({
          given: c.given,
          when: c.when,
          then: c.then,
          notes: c.notes,
        })),
        decisions: {
          summary: decisionsCount,
          details: userDecisions,
        },
        versionHistory: state.versionHistory,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  };

  const getExportContent = () => {
    return format === "markdown" ? generateMarkdown() : generateJSON();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getExportContent());
      setCopied(true);
      toast({
        title: "Kopiert!",
        description: "Der Inhalt wurde in die Zwischenablage kopiert.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Fehler",
        description: "Kopieren fehlgeschlagen. Bitte manuell kopieren.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const content = getExportContent();
    const filename = format === "markdown" ? "user-story.md" : "user-story.json";
    const mimeType = format === "markdown" ? "text/markdown" : "application/json";

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Heruntergeladen!",
      description: `${filename} wurde heruntergeladen.`,
    });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Export</h2>
        <p className="text-sm text-muted-foreground">
          Exportieren Sie Ihre verbesserte User Story mit Akzeptanzkriterien.
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-card space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Optimierte Story</h3>
          <p className="text-sm text-foreground">{optimisedStoryText || originalStoryText}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Akzeptanzkriterien ({acceptedCriteria.length})
          </h3>
          <ul className="space-y-2">
            {acceptedCriteria.map((c, i) => (
              <li key={c.id} className="text-sm text-foreground">
                <span className="text-muted-foreground font-medium">{i + 1}.</span>{" "}
                Given {c.given}, When {c.when}, Then {c.then}
              </li>
            ))}
          </ul>
        </div>
        <div className="pt-3 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Entscheidungen</h3>
          <div className="flex gap-4 text-xs">
            <span className="text-success">
              {userDecisions.filter((d) => d.decision === 'accepted').length} übernommen
            </span>
            <span className="text-primary">
              {userDecisions.filter((d) => d.decision === 'edited').length} bearbeitet
            </span>
            <span className="text-destructive">
              {userDecisions.filter((d) => d.decision === 'rejected').length} verworfen
            </span>
          </div>
        </div>
      </div>

      {/* Format Selection */}
      <div className="flex gap-2">
        <Button
          variant={format === "markdown" ? "default" : "outline"}
          onClick={() => setFormat("markdown")}
          className="flex-1"
        >
          <FileText className="h-4 w-4 mr-2" />
          Markdown
        </Button>
        <Button
          variant={format === "json" ? "default" : "outline"}
          onClick={() => setFormat("json")}
          className="flex-1"
        >
          <FileJson className="h-4 w-4 mr-2" />
          JSON
        </Button>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Vorschau:</p>
        <pre className="text-xs text-foreground whitespace-pre-wrap font-mono overflow-x-auto max-h-48">
          {getExportContent()}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={handleCopy}>
          {copied ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? "Kopiert!" : "Kopieren"}
        </Button>
        <Button className="flex-1" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Herunterladen
        </Button>
      </div>

      <div className="flex justify-between pt-4 border-t border-border">
        <Button variant="outline" onClick={() => actions.goToStep('criteria')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button variant="ghost" onClick={actions.reset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Neue Story
        </Button>
      </div>
    </div>
  );
}
