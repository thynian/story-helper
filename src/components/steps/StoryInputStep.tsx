import { useState, useRef, useEffect } from "react";
import { useStory } from "@/store/StoryContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  AlertCircle,
  Loader2,
  FolderOpen
} from "lucide-react";
import { parseUserStory, calculateCompletenessScore } from "@/lib/storyParser";
import { StructuredStoryModel } from "@/types/storyTypes";
import { cn } from "@/lib/utils";
import { 
  fetchProjects, 
  fetchProjectDocuments, 
  uploadDocument,
  Project, 
  ProjectDocument 
} from "@/services/projectService";

const EXAMPLE_STORY = `Als Benutzer möchte ich mich einloggen können, damit ich auf mein Konto zugreifen kann.`;

export function StoryInputStep() {
  const { state, dispatch, actions } = useStory();
  const { toast } = useToast();
  const [story, setStory] = useState(state.originalStoryText);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [parsedPreview, setParsedPreview] = useState<StructuredStoryModel | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Load documents when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDocuments(selectedProjectId);
      dispatch({ type: 'UPDATE_META', payload: { projectId: selectedProjectId } });
    } else {
      setProjectDocuments([]);
    }
  }, [selectedProjectId, dispatch]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    const data = await fetchProjects();
    setProjects(data);
    setIsLoadingProjects(false);
  };

  const loadProjectDocuments = async (projectId: string) => {
    setIsLoadingDocs(true);
    const docs = await fetchProjectDocuments(projectId);
    setProjectDocuments(docs);
    setIsLoadingDocs(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types - only allow .txt and .md
    const allowedExtensions = ['.txt', '.md'];
    const invalidFiles = files.filter(f => !allowedExtensions.some(ext => f.name.toLowerCase().endsWith(ext)));
    
    if (invalidFiles.length > 0) {
      toast({ 
        title: 'Ungültiges Dateiformat', 
        description: 'Nur .txt und .md Dateien werden unterstützt.',
        variant: 'destructive' 
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // If no project selected, use local state only
    if (!selectedProjectId) {
      setUploadedFiles(prev => [...prev, ...files]);
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
      return;
    }

    // Upload to project storage
    setIsUploading(true);
    for (const file of files) {
      await uploadDocument(selectedProjectId, file);
    }
    setIsUploading(false);
    
    // Reload project documents
    loadProjectDocuments(selectedProjectId);
  };

  const removeFile = (index: number) => {
    const fileToRemove = uploadedFiles[index];
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    
    const docToRemove = state.contextDocuments.find(d => d.name === fileToRemove.name);
    if (docToRemove) {
      actions.removeContextDocument(docToRemove.id);
    }
  };

  const handleSaveAndStructure = () => {
    if (!story.trim()) return;

    actions.setOriginalStory(story.trim());
    actions.setOptimisedStory(story.trim());

    const structured = parseUserStory(story.trim());
    if (structured) {
      actions.setStructuredStory(structured);
      setParsedPreview(structured);
    }

    actions.addVersionHistory('initial', 'Original Story eingegeben und strukturiert');
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

  const getStatusBadge = (status: ProjectDocument['status']) => {
    switch (status) {
      case 'indexed':
        return <Badge variant="default" className="bg-success text-success-foreground">Indexiert</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />Verarbeitung</Badge>;
      case 'error':
        return <Badge variant="destructive">Fehler</Badge>;
      default:
        return <Badge variant="outline">Ausstehend</Badge>;
    }
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

      {/* Project Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Projekt auswählen <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Select value={selectedProjectId || "__none__"} onValueChange={(val) => setSelectedProjectId(val === "__none__" ? "" : val)}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder={isLoadingProjects ? "Lade Projekte..." : "Projekt auswählen"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Kein Projekt</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedProjectId && (
          <p className="text-xs text-muted-foreground">
            Dokumente aus diesem Projekt werden automatisch als Kontext verwendet.
          </p>
        )}
      </div>

      {/* Project Documents (if project selected) */}
      {selectedProjectId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Projekt-Dokumente
            </Label>
            {isLoadingDocs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          
          {projectDocuments.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {projectDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{doc.name}</span>
                  {getStatusBadge(doc.status)}
                </div>
              ))}
            </div>
          ) : !isLoadingDocs ? (
            <p className="text-sm text-muted-foreground italic">
              Keine Dokumente in diesem Projekt
            </p>
          ) : null}
        </div>
      )}

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

      {/* Context Documents Upload */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {selectedProjectId ? 'Neue Dokumente hochladen' : 'Kontext-Dokumente'}{' '}
          <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          {selectedProjectId 
            ? 'Dokumente werden dem Projekt hinzugefügt und automatisch indexiert.'
            : 'Laden Sie zusätzliche Dokumente hoch, die Kontext zur Story liefern.'}
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          accept=".txt,.md"
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isUploading ? 'Wird hochgeladen...' : 'Dokumente hochladen'}
        </Button>

        {/* Local Uploaded Files List (when no project) */}
        {!selectedProjectId && uploadedFiles.length > 0 && (
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
          type="button"
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
