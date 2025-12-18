import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { fetchAllStories, fetchStoryVersions, deleteStory, SavedStory, StoryVersion } from '@/services/storyPersistence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { LogOut, FileText, History, Trash2, Eye, Loader2, AlertTriangle, CheckCircle, Clock, FolderOpen, Home } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { StructuredStoryModel } from '@/types/storyTypes';
import type { Json } from '@/integrations/supabase/types';
import { ProjectManagement } from '@/components/admin/ProjectManagement';

export default function Admin() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stories, setStories] = useState<SavedStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<SavedStory | null>(null);
  const [versions, setVersions] = useState<StoryVersion[]>([]);
  const [isVersionsLoading, setIsVersionsLoading] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/auth');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadStories();
    }
  }, [isAdmin]);

  const loadStories = async () => {
    setIsLoading(true);
    const data = await fetchAllStories();
    setStories(data);
    setIsLoading(false);
  };

  const handleViewDetails = (story: SavedStory) => {
    setSelectedStory(story);
    setShowDetailsDialog(true);
  };

  const handleViewVersions = async (story: SavedStory) => {
    setSelectedStory(story);
    setIsVersionsLoading(true);
    setShowVersionsDialog(true);
    const versionData = await fetchStoryVersions(story.id);
    setVersions(versionData);
    setIsVersionsLoading(false);
  };

  const handleDelete = async (id: string) => {
    const success = await deleteStory(id);
    if (success) {
      toast({ title: 'Story gelöscht' });
      loadStories();
    } else {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getIssueCount = (issues: Json): number => {
    if (Array.isArray(issues)) return issues.length;
    return 0;
  };

  const getStructuredStory = (story: Json): StructuredStoryModel | null => {
    if (story && typeof story === 'object' && !Array.isArray(story)) {
      return story as unknown as StructuredStoryModel;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              Zur Hauptseite
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="stories" className="space-y-6">
          <TabsList>
            <TabsTrigger value="stories" className="gap-2">
              <FileText className="h-4 w-4" />
              Stories
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Projekte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stories">
            <Card>
          <CardHeader>
            <CardTitle>Alle User Stories</CardTitle>
            <CardDescription>
              {stories.length} Stories in der Datenbank
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : stories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Noch keine Stories vorhanden
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Story</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Kriterien</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Aktualisiert</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stories.map((story) => (
                    <TableRow key={story.id}>
                      <TableCell className="max-w-xs">
                        <p className="truncate font-medium">
                          {story.original_text.substring(0, 80)}...
                        </p>
                        {story.project_id && (
                          <Badge variant="outline" className="mt-1">
                            {story.project_id}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getIssueCount(story.analysis_issues) > 0 ? 'destructive' : 'secondary'}>
                          {getIssueCount(story.analysis_issues)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getIssueCount(story.acceptance_criteria)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(story.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(story.updated_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(story)}
                            title="Details anzeigen"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewVersions(story)}
                            title="Versionen anzeigen"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(story.id)}
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="projects">
            <ProjectManagement />
          </TabsContent>
        </Tabs>
      </main>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Story Details</DialogTitle>
            <DialogDescription>
              Erstellt am {selectedStory && format(new Date(selectedStory.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedStory && (
              <div className="space-y-4 pr-4">
                <div>
                  <h4 className="font-medium mb-2">Original Text</h4>
                  <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                    {selectedStory.original_text}
                  </p>
                </div>

                {selectedStory.optimised_text && (
                  <div>
                    <h4 className="font-medium mb-2">Optimierter Text</h4>
                    <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                      {selectedStory.optimised_text}
                    </p>
                  </div>
                )}

                {getStructuredStory(selectedStory.structured_story) && (
                  <div>
                    <h4 className="font-medium mb-2">Strukturierte Story</h4>
                    <div className="text-sm bg-muted p-3 rounded-md space-y-1">
                      {(() => {
                        const s = getStructuredStory(selectedStory.structured_story);
                        return s ? (
                          <>
                            <p><strong>Rolle:</strong> {s.role || '-'}</p>
                            <p><strong>Ziel:</strong> {s.goal || '-'}</p>
                            <p><strong>Nutzen:</strong> {s.benefit || '-'}</p>
                            {s.constraints && s.constraints.length > 0 && (
                              <p><strong>Constraints:</strong> {s.constraints.join(', ')}</p>
                            )}
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}

                {Array.isArray(selectedStory.analysis_issues) && selectedStory.analysis_issues.length > 0 && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="issues">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          Analyse-Issues ({(selectedStory.analysis_issues as unknown[]).length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {(selectedStory.analysis_issues as unknown[]).map((issue: unknown, idx) => {
                            const i = issue as { category?: string; reasoning?: string };
                            return (
                              <div key={idx} className="text-sm bg-muted p-2 rounded">
                                <Badge variant="outline" className="mb-1">{i.category || 'unknown'}</Badge>
                                <p>{i.reasoning || '-'}</p>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {Array.isArray(selectedStory.acceptance_criteria) && selectedStory.acceptance_criteria.length > 0 && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="criteria">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          Akzeptanzkriterien ({(selectedStory.acceptance_criteria as unknown[]).length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {(selectedStory.acceptance_criteria as unknown[]).map((ac: unknown, idx) => {
                            const c = ac as { given?: string; when?: string; then?: string };
                            return (
                              <div key={idx} className="text-sm bg-muted p-2 rounded font-mono">
                                <p><strong>Given:</strong> {c.given || '-'}</p>
                                <p><strong>When:</strong> {c.when || '-'}</p>
                                <p><strong>Then:</strong> {c.then || '-'}</p>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Versions Dialog */}
      <Dialog open={showVersionsDialog} onOpenChange={setShowVersionsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Versionshistorie
            </DialogTitle>
            <DialogDescription>
              Alle Versionen dieser Story
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {isVersionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Keine früheren Versionen vorhanden
              </div>
            ) : (
              <div className="space-y-4 pr-4">
                {versions.map((version) => (
                  <Card key={version.id}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <Badge>Version {version.version_number}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(version.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {version.original_text}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {getIssueCount(version.analysis_issues)} Issues
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getIssueCount(version.acceptance_criteria)} Kriterien
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
