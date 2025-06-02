import { Pinecone } from '@pinecone-database/pinecone';

const pineconeApiKey = import.meta.env.VITE_PINECONE_API_KEY;
const pineconeEnvironment = import.meta.env.VITE_PINECONE_ENVIRONMENT;

if (!pineconeApiKey || !pineconeEnvironment) {
  throw new Error('Missing required environment variables');
}

const pinecone = new Pinecone({
  apiKey: pineconeApiKey,
  environment: pineconeEnvironment
});

export async function querySchoolInfo(query: string): Promise<string> {
  try {
    const index = pinecone.index('school-info');
    const queryEmbedding = await generateEmbedding(query);
    
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true
    });

    return queryResponse.matches
      .map(match => match.metadata?.content || '')
      .join('\n');
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    return '';
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key is not set');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-ada-002'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Array(1536).fill(0); // Return zero vector as fallback
  }
}