import { supabase } from '@/integrations/supabase/client';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  error_message: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// Projects
export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }

  return data as Project[];
}

export async function createProject(name: string, description?: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description })
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    return null;
  }

  return data as Project;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating project:', error);
    return false;
  }

  return true;
}

export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting project:', error);
    return false;
  }

  return true;
}

// Documents
export async function fetchProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }

  return data as ProjectDocument[];
}

export async function uploadDocument(
  projectId: string,
  file: File
): Promise<ProjectDocument | null> {
  // Upload file to storage
  const filePath = `${projectId}/${Date.now()}_${file.name}`;
  
  const { error: uploadError } = await supabase.storage
    .from('project-documents')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    return null;
  }

  // Create document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      project_id: projectId,
      name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating document record:', error);
    return null;
  }

  // Trigger embedding in background
  triggerDocumentEmbedding(data.id);

  return data as ProjectDocument;
}

export async function deleteDocument(id: string, filePath: string): Promise<boolean> {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('project-documents')
    .remove([filePath]);

  if (storageError) {
    console.error('Error deleting file from storage:', storageError);
  }

  // Delete record (cascades to chunks)
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting document:', error);
    return false;
  }

  return true;
}

// Trigger document embedding via edge function
async function triggerDocumentEmbedding(documentId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('embed-document', {
      body: { document_id: documentId },
    });

    if (error) {
      console.error('Error triggering embedding:', error);
    }
  } catch (err) {
    console.error('Error calling embed-document function:', err);
  }
}

// Retrieve context for a query
export async function retrieveContext(
  projectId: string,
  query: string,
  options?: {
    matchCount?: number;
    matchThreshold?: number;
    includeReranking?: boolean;
  }
): Promise<{ snippets: Array<{ id: string; text: string; source: string; relevanceScore: number }> }> {
  try {
    const { data, error } = await supabase.functions.invoke('retrieve-context', {
      body: {
        project_id: projectId,
        query,
        match_count: options?.matchCount ?? 5,
        match_threshold: options?.matchThreshold ?? 0.6,
        include_reranking: options?.includeReranking ?? true,
      },
    });

    if (error) {
      console.error('Error retrieving context:', error);
      return { snippets: [] };
    }

    return data;
  } catch (err) {
    console.error('Error calling retrieve-context function:', err);
    return { snippets: [] };
  }
}
