import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Download, Check, FileText, FileJson, RotateCcw } from "lucide-react";
import { Suggestion } from "@/types/story";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ExportStepProps {
  originalStory: string;
  rewrittenStory: string;
  criteria: Suggestion[];
  onBack: () => void;
  onReset: () => void;
}

type ExportFormat = "markdown" | "json";

export function ExportStep({
  originalStory,
  rewrittenStory,
  criteria,
  onBack,
  onReset,
}: ExportStepProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const acceptedCriteria = criteria.filter(
    (c) => c.status === "accepted" || c.status === "edited"
  );

  const generateMarkdown = () => {
    const criteriaList = acceptedCriteria
      .map((c, i) => `${i + 1}. ${c.editedText || c.suggested}`)
      .join("\n");

    return `# User Story

## Original
${originalStory}

## Verbesserte Version
${rewrittenStory}

## Akzeptanzkriterien
${criteriaList}
`;
  };

  const generateJSON = () => {
    return JSON.stringify(
      {
        userStory: {
          original: originalStory,
          rewritten: rewrittenStory,
        },
        acceptanceCriteria: acceptedCriteria.map((c) => ({
          text: c.editedText || c.suggested,
          wasEdited: c.status === "edited",
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
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Verbesserte Story</h3>
          <p className="text-sm text-foreground">{rewrittenStory}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Akzeptanzkriterien ({acceptedCriteria.length})
          </h3>
          <ul className="space-y-2">
            {acceptedCriteria.map((c, i) => (
              <li key={c.id} className="text-sm text-foreground flex gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span>{c.editedText || c.suggested}</span>
              </li>
            ))}
          </ul>
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
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Neue Story
        </Button>
      </div>
    </div>
  );
}
