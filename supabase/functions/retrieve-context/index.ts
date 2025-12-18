import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embedding for query
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

// Re-rank results using LLM
async function reRankResults(
  query: string, 
  results: any[], 
  apiKey: string
): Promise<any[]> {
  if (results.length <= 3) {
    return results; // No need to re-rank small result sets
  }

  const prompt = `Given the following query and document chunks, rank them by relevance from most to least relevant.

Query: "${query}"

Chunks:
${results.map((r, i) => `[${i}] ${r.content.substring(0, 300)}...`).join('\n\n')}

Return ONLY a JSON array of indices in order of relevance, e.g. [2, 0, 4, 1, 3]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a document relevance ranker. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.warn('[retrieve-context] Re-ranking failed, using original order');
      return results;
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse the JSON array
    const rankOrder = JSON.parse(content);
    
    if (Array.isArray(rankOrder)) {
      const reRanked = rankOrder
        .filter(i => i >= 0 && i < results.length)
        .map(i => results[i]);
      
      // Add any results that weren't included in ranking
      for (const result of results) {
        if (!reRanked.includes(result)) {
          reRanked.push(result);
        }
      }
      
      return reRanked;
    }
  } catch (error) {
    console.warn('[retrieve-context] Re-ranking error:', error);
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      project_id, 
      query, 
      match_count = 5,
      match_threshold = 0.6,
      include_reranking = true 
    } = await req.json();
    
    if (!project_id || !query) {
      return new Response(
        JSON.stringify({ error: 'project_id and query are required' }),
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

    console.log(`[retrieve-context] Searching for: "${query.substring(0, 50)}..." in project ${project_id}`);

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query, openaiKey);

    // Perform similarity search
    const { data: results, error: searchError } = await supabase.rpc(
      'search_document_chunks',
      {
        query_embedding: JSON.stringify(queryEmbedding),
        p_project_id: project_id,
        match_threshold,
        match_count: include_reranking ? match_count * 2 : match_count, // Get more for re-ranking
      }
    );

    if (searchError) {
      throw new Error(`Search error: ${searchError.message}`);
    }

    if (!results || results.length === 0) {
      console.log('[retrieve-context] No matching chunks found');
      return new Response(
        JSON.stringify({ 
          snippets: [],
          message: 'No relevant context found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[retrieve-context] Found ${results.length} initial matches`);

    // Re-rank results if enabled
    let finalResults = results;
    if (include_reranking && results.length > 3) {
      finalResults = await reRankResults(query, results, openaiKey);
      finalResults = finalResults.slice(0, match_count);
    }

    // Format snippets for use in prompts
    const snippets = finalResults.map((r: any, index: number) => ({
      id: r.id,
      text: r.content,
      source: r.metadata?.document_name || 'Unknown',
      relevanceScore: r.similarity,
      position: index + 1,
    }));

    console.log(`[retrieve-context] Returning ${snippets.length} snippets`);

    return new Response(
      JSON.stringify({ 
        snippets,
        query,
        project_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[retrieve-context] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
