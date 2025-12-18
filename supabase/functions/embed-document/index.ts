import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// Sanitize text to remove invalid Unicode escape sequences that PostgreSQL doesn't support
function sanitizeText(text: string): string {
  // Remove null characters and other problematic Unicode escape sequences
  return text
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters except tab, newline, carriage return
    .replace(/\\u0000/g, ''); // Remove escaped null character sequences
}

// Semantic chunking: split by paragraphs/sentences while respecting size limits
function semanticChunk(text: string): string[] {
  const chunks: string[] = [];
  
  // First split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;
    
    // If adding this paragraph exceeds chunk size
    if (currentChunk.length + trimmedPara.length > CHUNK_SIZE) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        // Keep overlap from end of current chunk
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 5));
        currentChunk = overlapWords.join(' ') + '\n\n';
      }
      
      // If single paragraph is too long, split by sentences
      if (trimmedPara.length > CHUNK_SIZE) {
        const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > CHUNK_SIZE) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
          }
          currentChunk += sentence + ' ';
        }
      } else {
        currentChunk += trimmedPara + '\n\n';
      }
    } else {
      currentChunk += trimmedPara + '\n\n';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 50); // Filter out tiny chunks
}

// Generate embeddings using OpenAI
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json();
    
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'document_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPEN_AI_API_KEY') || Deno.env.get('LLM_API_KEY');
    
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get document info
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    console.log(`[embed-document] Processing document: ${document.name}`);

    // Update status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', document_id);

    // Download file from storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('project-documents')
      .download(document.file_path);

    if (fileError || !fileData) {
      throw new Error(`Failed to download file: ${fileError?.message}`);
    }

    // Extract text (for now, assume text-based files)
    let text = await fileData.text();
    
    if (!text || text.length < 10) {
      throw new Error('Document is empty or too short');
    }

    // Sanitize text to remove problematic characters
    text = sanitizeText(text);
    console.log(`[embed-document] Extracted ${text.length} characters`);

    // Semantic chunking
    const chunks = semanticChunk(text);
    console.log(`[embed-document] Created ${chunks.length} chunks`);

    // Delete existing chunks for this document
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', document_id);

    // Process chunks and generate embeddings
    const chunkRecords = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = sanitizeText(chunks[i]); // Extra sanitization for safety
      console.log(`[embed-document] Embedding chunk ${i + 1}/${chunks.length}`);
      
      const embedding = await generateEmbedding(chunk, openaiKey);
      
      chunkRecords.push({
        document_id,
        project_id: document.project_id,
        chunk_index: i,
        content: chunk,
        embedding: JSON.stringify(embedding),
        metadata: {
          document_name: sanitizeText(document.name),
          chunk_position: i,
          total_chunks: chunks.length,
        },
        token_count: Math.ceil(chunk.length / 4), // Rough estimate
      });

      // Small delay to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Insert chunks
    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    // Update document status
    await supabase
      .from('documents')
      .update({ 
        status: 'indexed',
        metadata: {
          ...document.metadata,
          chunk_count: chunks.length,
          indexed_at: new Date().toISOString(),
        }
      })
      .eq('id', document_id);

    console.log(`[embed-document] Successfully indexed document with ${chunks.length} chunks`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks_created: chunks.length,
        document_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[embed-document] Error:', error);
    
    // Try to update document status to error
    try {
      const { document_id } = await req.clone().json();
      if (document_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('documents')
          .update({ 
            status: 'error',
            error_message: error.message 
          })
          .eq('id', document_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
