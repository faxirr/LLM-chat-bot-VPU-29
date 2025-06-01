import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY;
const PINECONE_ENVIRONMENT = import.meta.env.VITE_PINECONE_ENVIRONMENT;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!PINECONE_API_KEY || !PINECONE_ENVIRONMENT || !OPENAI_API_KEY) {
  console.error('Missing required environment variables');
}

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY || '',
  environment: PINECONE_ENVIRONMENT || ''
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true
});

let schoolInfoIndex: any = null;

try {
  schoolInfoIndex = pinecone.index('school-info');
} catch (error) {
  console.error('Error initializing Pinecone index:', error);
}

export async function querySchoolInfo(query: string) {
  if (!schoolInfoIndex) {
    return "Система тимчасово недоступна";
  }

  try {
    const queryEmbedding = await generateEmbedding(query);
    const results = await schoolInfoIndex.query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true
    });
    
    if (!results.matches.length) {
      return "Інформація про заклад недоступна";
    }

    return results.matches.map(match => match.metadata).join('\n');
  } catch (error) {
    console.error('Error querying school information:', error);
    return "Помилка при отриманні інформації про заклад";
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Array(1536).fill(0);
  }
}