import { useState, useRef } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowRight, 
  Lightbulb, 
  Upload, 
  X, 
  FileText, 
  User, 
  Target, 
  Sparkles,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { parseUserStory, calculateCompletenessScore } from "@/lib/storyParser";
import { StructuredStoryModel, generateId, createTimestamp } from "@/types/storyTypes";
import { cn } from "@/lib/utils";

const EXAMPLE_STORY = `Als Benutzer möchte ich mich einloggen können, damit ich auf mein Konto zugreifen kann.`;

export function StoryInputStep() {
  const { state, dispatch, actions } = useStory();
  const [story, setStory] = useState(state.originalStoryText);
  const [projectId, setProjectId] = useState(state.meta.projectId);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [parsedPreview, setParsedPreview] = useState<StructuredStoryModel | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
    
    // Add to context documents in state
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        actions.addContextDocument({
          name: file.name,
          content: reader.result as string,
          type: 'file',
        });
      };
      reader.readAsText(file);
    });
  };

  const removeFile = (index: number) => {
    const fileToRemove = uploadedFiles[index];
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    
    // Find and remove from state
    const docToRemove = state.contextDocuments.find(d => d.name === fileToRemove.name);
    if (docToRemove) {
      actions.removeContextDocument(docToRemove.id);
    }
  };

  const handleSaveAndStructure = () => {
    if (!story.trim()) return;

    // Update project ID if changed
    if (projectId !== state.meta.projectId) {
      dispatch({ type: 'UPDATE_META', payload: { projectId } });
    }

    // Set original story
    actions.setOriginalStory(story.trim());
    
    // Set optimisedStoryText initially equal to originalStoryText
    actions.setOptimisedStory(story.trim());

    // Parse and structure the story
    const structured = parseUserStory(story.trim());
    if (structured) {
      actions.setStructuredStory(structured);
      setParsedPreview(structured);
    }

    // Add version history
    actions.addVersionHistory('initial', 'Original Story eingegeben und strukturiert');
    
    // Show preview
    setShowPreview(true);
  };

  const handleContinue = () => {
    actions.markStepCompleted('input');
    actions.goToStep('analysis');
  };

  const handleUseExample = () => {
    setStory(EXAMPLE_STORY);
    setShowPreview(false);
    setParsedPreview(null);
  };

  const completenessScore = parsedPreview ? calculateCompletenessScore(parsedPreview) : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">User Story eingeben</h2>
        <p className="text-sm text-muted-foreground">
          Geben Sie Ihre User Story ein und strukturieren Sie sie automatisch.
        </p>
      </div>

      {/* Story Text Input */}
      <div className="space-y-2">
        <Label htmlFor="story-text" className="text-sm font-medium">
          User Story Text <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="story-text"
          value={story}
          onChange={(e) => {
            setStory(e.target.value);
            setShowPreview(false);
            setParsedPreview(null);
          }}
          placeholder="Als [Rolle] möchte ich [Funktion], damit [Nutzen]..."
          className="min-h-[140px] text-base resize-none"
        />
        <button
          onClick={handleUseExample}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <Lightbulb className="h-4 w-4" />
          Beispiel verwenden
        </button>
      </div>

      {/* Project ID (optional) */}
      <div className="space-y-2">
        <Label htmlFor="project-id" className="text-sm font-medium">
          Projekt-ID <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          id="project-id"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="z.B. PRJ-001 oder Projektname"
          className="max-w-sm"
        />
      </div>

      {/* Context Documents Upload (optional) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Kontext-Dokumente <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Laden Sie zusätzliche Dokumente hoch, die Kontext zur Story liefern.
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          accept=".txt,.md,.doc,.docx,.pdf"
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Dokumente hochladen
        </Button>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-destructive/10 rounded text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save & Structure Button */}
      <div className="pt-2">
        <Button 
          onClick={handleSaveAndStructure} 
          disabled={!story.trim()}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Speichern & Strukturieren
        </Button>
      </div>

      {/* Structured Preview */}
      {showPreview && parsedPreview && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Strukturierte Story</h3>
            <div className="flex items-center gap-2">
              {completenessScore >= 80 ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-warning" />
              )}
              <span className={cn(
                "text-xs font-medium",
                completenessScore >= 80 ? "text-success" : "text-warning"
              )}>
                {completenessScore}% vollständig
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Role */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">Als (Rolle)</p>
                <p className={cn(
                  "text-sm",
                  parsedPreview.role === 'Nicht erkannt' 
                    ? "text-warning italic" 
                    : "text-foreground"
                )}>
                  {parsedPreview.role}
                </p>
              </div>
            </div>

            {/* Goal */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">Möchte ich (Ziel)</p>
                <p className={cn(
                  "text-sm",
                  parsedPreview.goal === 'Nicht erkannt' 
                    ? "text-warning italic" 
                    : "text-foreground"
                )}>
                  {parsedPreview.goal}
                </p>
              </div>
            </div>

            {/* Benefit */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">Damit (Nutzen)</p>
                <p className={cn(
                  "text-sm",
                  parsedPreview.benefit === 'Nicht angegeben' 
                    ? "text-muted-foreground italic" 
                    : "text-foreground"
                )}>
                  {parsedPreview.benefit}
                </p>
              </div>
            </div>

            {/* Constraints (if any) */}
            {parsedPreview.constraints && parsedPreview.constraints.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Einschränkungen</p>
                <ul className="space-y-1">
                  {parsedPreview.constraints.map((constraint, i) => (
                    <li key={i} className="text-sm text-foreground flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      {constraint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Continue Button */}
          <div className="mt-5 pt-4 border-t border-border flex justify-end">
            <Button onClick={handleContinue} size="lg">
              Zur Analyse
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
