import { Pinecone } from 'npm:@pinecone-database/pinecone@1.1.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    const pinecone = new Pinecone({
      apiKey: Deno.env.get('PINECONE_API_KEY') || '',
      environment: Deno.env.get('PINECONE_ENVIRONMENT') || ''
    });

    const index = pinecone.index('school-info');
    
    const queryResponse = await index.query({
      vector: Array(1536).fill(0),  // Default vector dimension for similarity search
      topK: 3,
      includeMetadata: true
    });

    const schoolInfo = queryResponse.matches
      .map(match => match.metadata?.content || '')
      .join('\n');

    return new Response(
      JSON.stringify({ schoolInfo }),
      { 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});