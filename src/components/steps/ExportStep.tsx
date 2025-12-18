import { useState, useEffect } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Download, Check, FileText, FileJson, RotateCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ExportFormat = "markdown" | "json";

export function ExportStep() {
  const { state, actions } = useStory();
  const { 
    originalStoryText, 
    optimisedStoryText, 
    structuredStory,
    acceptanceCriteria,
    analysisIssues,
    userDecisions,
  } = state;

  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

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

  // Get relevant issues for summary
  const relevantIssues = analysisIssues.filter((issue) => issue.isRelevant);

  const generateMarkdown = () => {
    const storyText = optimisedStoryText || originalStoryText;
    
    // Format acceptance criteria
    const criteriaList = acceptedCriteria.length > 0
      ? acceptedCriteria
          .map((c, i) => `### Kriterium ${i + 1}\n- **Given:** ${c.given}\n- **When:** ${c.when}\n- **Then:** ${c.then}`)
          .join('\n\n')
      : '_Keine Akzeptanzkriterien definiert_';

    // Format issues summary (optional section)
    const issuesSummary = relevantIssues.length > 0
      ? `## Wichtige Hinweise\n\n${relevantIssues
          .map((issue) => `- **${issue.category}:** ${issue.reasoning}`)
          .join('\n')}`
      : '';

    return `# User Story

## Story
${storyText}

${structuredStory ? `### Strukturiert
- **Als:** ${structuredStory.role}
- **Möchte ich:** ${structuredStory.goal}
- **Damit:** ${structuredStory.benefit}
${structuredStory.constraints?.length ? `- **Constraints:** ${structuredStory.constraints.join(', ')}` : ''}` : ''}

---

## Akzeptanzkriterien

${criteriaList}

${issuesSummary ? `---\n\n${issuesSummary}` : ''}

---

_Generiert mit User Story Quality Assistant_
`;
  };

  const generateJSON = () => {
    return JSON.stringify(
      {
        story: {
          text: optimisedStoryText || originalStoryText,
          structured: structuredStory,
        },
        acceptanceCriteria: acceptedCriteria.map((c) => ({
          given: c.given,
          when: c.when,
          then: c.then,
        })),
        relevantIssues: relevantIssues.map((issue) => ({
          category: issue.category,
          reasoning: issue.reasoning,
        })),
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
        description: "Kopieren fehlgeschlagen.",
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const savedId = await actions.saveStoryAction();
      if (savedId) {
        toast({
          title: "Gespeichert!",
          description: "Die Story wurde erfolgreich in der Datenbank gespeichert.",
        });
      } else {
        toast({
          title: "Fehler",
          description: "Story konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Speichern fehlgeschlagen.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Export</h2>
        <p className="text-sm text-muted-foreground">
          Exportieren Sie Ihre User Story mit Akzeptanzkriterien.
        </p>
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

      {/* Markdown Preview */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-card">
        <p className="text-xs font-medium text-muted-foreground mb-3">Vorschau:</p>
        <pre className="text-sm text-foreground whitespace-pre-wrap font-mono overflow-x-auto max-h-96 leading-relaxed">
          {getExportContent()}
        </pre>
      </div>

      {/* Save Button */}
      <Button 
        className="w-full" 
        size="lg" 
        onClick={handleSave}
        disabled={isSaving}
        variant="default"
      >
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? "Speichert..." : "In Datenbank speichern"}
      </Button>

      {/* Copy Button */}
      <Button className="w-full" size="lg" variant="outline" onClick={handleCopy}>
        {copied ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <Copy className="h-4 w-4 mr-2" />
        )}
        {copied ? "Kopiert!" : "In Zwischenablage kopieren"}
      </Button>

      {/* Secondary Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={handleDownload}>
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
