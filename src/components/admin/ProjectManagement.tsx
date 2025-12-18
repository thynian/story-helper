import { useState, useEffect, useRef } from 'react';
import { 
  fetchProjects, 
  createProject, 
  deleteProject,
  fetchProjectDocuments,
  uploadDocument,
  deleteDocument,
  Project, 
  ProjectDocument 
} from '@/services/projectService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Upload, 
  Loader2, 
  FolderOpen,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export function ProjectManagement() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Create project dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectDocuments(selectedProject.id);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    setIsLoading(true);
    const data = await fetchProjects();
    setProjects(data);
    setIsLoading(false);
  };

  const loadProjectDocuments = async (projectId: string) => {
    setIsLoadingDocs(true);
    const docs = await fetchProjectDocuments(projectId);
    setProjectDocs(docs);
    setIsLoadingDocs(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    setIsCreating(true);
    const project = await createProject(newProjectName.trim(), newProjectDesc.trim() || undefined);
    setIsCreating(false);
    
    if (project) {
      toast({ title: 'Projekt erstellt' });
      setShowCreateDialog(false);
      setNewProjectName('');
      setNewProjectDesc('');
      loadProjects();
    } else {
      toast({ title: 'Fehler beim Erstellen', variant: 'destructive' });
    }
  };

  const handleDeleteProject = async (id: string) => {
    const success = await deleteProject(id);
    if (success) {
      toast({ title: 'Projekt gelöscht' });
      if (selectedProject?.id === id) {
        setSelectedProject(null);
        setProjectDocs([]);
      }
      loadProjects();
    } else {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject) return;
    
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    for (const file of files) {
      await uploadDocument(selectedProject.id, file);
    }
    setIsUploading(false);
    loadProjectDocuments(selectedProject.id);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (doc: ProjectDocument) => {
    const success = await deleteDocument(doc.id, doc.file_path);
    if (success) {
      toast({ title: 'Dokument gelöscht' });
      if (selectedProject) {
        loadProjectDocuments(selectedProject.id);
      }
    } else {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Projects List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Projekte</CardTitle>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Neu
            </Button>
          </div>
          <CardDescription>{projects.length} Projekte</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Projekte vorhanden
            </p>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedProject?.id === project.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedProject(project)}
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {project.description}
                      </p>
                    )}
                  </div>
                  {selectedProject?.id === project.id && (
                    <ChevronRight className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Documents */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {selectedProject ? selectedProject.name : 'Projekt auswählen'}
              </CardTitle>
              <CardDescription>
                {selectedProject 
                  ? `${projectDocs.length} Dokumente`
                  : 'Wählen Sie ein Projekt aus der Liste'}
              </CardDescription>
            </div>
            {selectedProject && (
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".txt,.md,.doc,.docx,.pdf"
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => loadProjectDocuments(selectedProject.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Hochladen
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDeleteProject(selectedProject.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedProject ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Wählen Sie ein Projekt aus</p>
            </div>
          ) : isLoadingDocs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : projectDocs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Keine Dokumente in diesem Projekt</p>
              <p className="text-xs mt-1">
                Laden Sie Dokumente hoch, um sie zu indexieren
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dokument</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Größe</TableHead>
                  <TableHead>Hochgeladen</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(doc.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDocument(doc)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Projekt erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie ein neues Projekt für Ihre User Stories und Dokumente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Projektname</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="z.B. E-Commerce Platform"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">Beschreibung (optional)</Label>
              <Input
                id="project-desc"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Kurze Beschreibung des Projekts"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim() || isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
