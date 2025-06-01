import React, { useState } from 'react';
import { MessageCircle, Send, Database, Upload, Trash2 } from 'lucide-react';
import { generatePrompt, generateContextPrompt, detectQuestionType, QUESTION_TYPES } from './config/prompt';
// { SUBJECTS, LEARNING_RESOURCES } from './/src/config/knowledge';
import { Pinecone } from '@pinecone-database/pinecone';
import { uploadKnowledgeToPinecone, /*clearPineconeNamespace*/ } from './utils/uploadKnowledge';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  context?: string[]; // Додано для показу контексту з Pinecone
}

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_EMBEDDING_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY;

// Налаштування вашої Pinecone бази
const PINECONE_INDEX_NAME = 'vpu29';
const PINECONE_NAMESPACE = 'INFO';

// Ініціалізація Pinecone (тільки якщо є API ключ)
let pinecone: Pinecone | null = null;
if (PINECONE_API_KEY) {
  pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY,
  });
}

// Функція для створення embeddings через Gemini
async function createGeminiEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!GEMINI_API_KEY) return null;

    const response = await fetch(`${GEMINI_EMBEDDING_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text: text.substring(0, 5000) }]
        }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.embedding.values;
  } catch (error) {
    console.error('Error creating Gemini embedding:', error);
    return null;
  }
}

// Пошук у Pinecone (опціональний)
async function searchInPinecone(query: string): Promise<{ texts: string[]; scores: number[] }> {
  try {
    if (!pinecone || !PINECONE_API_KEY) {
      return { texts: [], scores: [] };
    }

    const index = pinecone.index(PINECONE_INDEX_NAME);
    const queryEmbedding = await createGeminiEmbedding(query);

    if (!queryEmbedding) {
      return { texts: [], scores: [] };
    }

    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true,
      includeValues: false,
      namespace: PINECONE_NAMESPACE,
    });

    const texts: string[] = [];
    const scores: number[] = [];

    searchResults.matches?.forEach(match => {
      const text = match.metadata?.text ||
          match.metadata?.content ||
          match.metadata?.description ||
          'Текст недоступний';

      texts.push(text);
      scores.push(match.score || 0);
    });

    return { texts, scores };
  } catch (error) {
    console.error('Error searching in Pinecone:', error);
    return { texts: [], scores: [] };
  }
}

// Покращена функція запиту до Gemini (з опціональним Pinecone)
async function queryGeminiAPI(prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not set');
  }

  try {
    let finalPrompt = generatePrompt(prompt);
    let usedContext: string[] = [];

    // Якщо є Pinecone, спробуємо знайти релевантну інформацію
    if (PINECONE_API_KEY && pinecone) {
      const searchResults = await searchInPinecone(prompt);

      if (searchResults.texts.length > 0) {
        // Використовуємо функцію з вашого prompt.ts
        const contextData = searchResults.texts.map((text, index) => ({
          text,
          score: searchResults.scores[index]
        }));

        finalPrompt = generateContextPrompt(prompt, contextData);
        usedContext = searchResults.texts;

        // Додаємо спеціальні інструкції для типу питання
        const questionType = detectQuestionType(prompt);
        if (questionType && QUESTION_TYPES[questionType as keyof typeof QUESTION_TYPES]) {
          const specialInstructions = QUESTION_TYPES[questionType as keyof typeof QUESTION_TYPES].specialInstructions;
          finalPrompt += `\n\nДодаткові інструкції: ${specialInstructions}`;
        }
      }
    }

    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: finalPrompt }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1500,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', errorData);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.candidates[0].content.parts[0].text,
      context: usedContext
    };
  } catch (error) {
    console.error('Error querying Gemini API:', error);
    return {
      text: "Вибачте, але зараз я маю проблеми з підключенням до бази знань. Будь ласка, спробуйте пізніше.",
      context: []
    };
  }
}

// Тестування підключення до Pinecone
async function testPineconeConnection(): Promise<string> {
  try {
    if (!pinecone || !PINECONE_API_KEY) {
      return "❌ Pinecone не налаштовано (відсутній API ключ)";
    }

    const index = pinecone.index(PINECONE_INDEX_NAME);
    const stats = await index.describeIndexStats();

    const namespaceStats = stats.namespaces?.[PINECONE_NAMESPACE];
    const vectorCount = namespaceStats?.vectorCount || 0;

    return `✅ Pinecone підключено! У namespace "${PINECONE_NAMESPACE}" знайдено ${vectorCount} векторів.`;
  } catch (error) {
    return `❌ Помилка підключення до Pinecone: ${error instanceof Error ? error.message : 'Невідома помилка'}`;
  }
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [showContext, setShowContext] = useState(false);

  // Тестування Pinecone
  const handleTestConnection = async () => {
    setIsLoading(true);
    const status = await testPineconeConnection();
    setConnectionStatus(status);
    setIsLoading(false);
  };

  // Завантаження статичних знань у Pinecone
  const handleUploadKnowledge = async () => {
    setIsLoading(true);
    const result = await uploadKnowledgeToPinecone();
    setConnectionStatus(result);
    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!GEMINI_API_KEY) {
      setError('Будь ласка, встановіть ваш Gemini API ключ у файлі .env');
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await queryGeminiAPI(input);

      const botMessage: Message = {
        id: Date.now() + 1,
        text: response.text,
        sender: 'bot',
        timestamp: new Date(),
        context: response.context // Додаємо контекст з Pinecone
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error handling message:', error);
      setError('Не вдалося отримати відповідь від ШІ. Будь ласка, спробуйте ще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
      <div className="flex flex-col h-screen bg-gray-100">
        <header className="bg-white shadow-md p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Шкільний помічник</h1>

            {/* Додаткові кнопки для Pinecone */}
            <div className="ml-auto flex gap-2">
              <button
                  onClick={handleTestConnection}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                  title="Перевірити підключення до Pinecone"
              >
                <Database className="w-4 h-4" />
                Тест
              </button>
              <button
                  onClick={handleUploadKnowledge}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                  title="Завантажити knowledge.ts у Pinecone"
              >
                <Upload className="w-4 h-4" />
                Завантажити
              </button>
              <button
                  onClick={() => setShowContext(!showContext)}
                  className={`px-3 py-1 text-sm rounded ${
                      showContext ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                  title="Показати/сховати контекст з бази знань"
              >
                Контекст
              </button>
            </div>
          </div>

          {/* Статус підключення */}
          {connectionStatus && (
              <div className={`max-w-4xl mx-auto mt-2 px-3 py-2 rounded text-sm ${
                  connectionStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {connectionStatus}
              </div>
          )}
        </header>

        <div className="flex-1 max-w-4xl mx-auto w-full p-4 overflow-y-auto">
          {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                <span className="block sm:inline">{error}</span>
              </div>
          )}

          <div className="space-y-4">
            {messages.map((message) => (
                <div key={message.id}>
                  {/* Оригінальне повідомлення */}
                  <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-4 ${
                        message.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-800'
                    } shadow-md`}>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p>
                      <span className="text-xs opacity-75 mt-1 block">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                    </div>
                  </div>

                  {/* Показ контексту з Pinecone (опціонально) */}
                  {showContext && message.sender === 'bot' && message.context && message.context.length > 0 && (
                      <div className="mt-2 ml-4">
                        <details className="bg-gray-50 rounded p-3 text-sm">
                          <summary className="font-medium text-gray-600 cursor-pointer">
                            📚 Використаний контекст з Pinecone ({message.context.length} джерел)
                          </summary>
                          <div className="mt-2 space-y-2">
                            {message.context.map((ctx, idx) => (
                                <div key={idx} className="bg-white p-2 rounded border-l-4 border-purple-300">
                                  <span className="text-xs text-purple-600 font-medium">Джерело {idx + 1}:</span>
                                  <p className="text-gray-700 mt-1">{ctx.substring(0, 200)}...</p>
                                </div>
                            ))}
                          </div>
                        </details>
                      </div>
                  )}
                </div>
            ))}

            {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 rounded-lg p-4 shadow-md">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
            )}
          </div>
        </div>

        <div className="bg-white border-t">
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex gap-2">
              <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Запитайте щось..."
                  className="flex-1 rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
              />
              <button
                  onClick={handleSend}
                  disabled={isLoading}
                  className={`text-white rounded-lg px-4 py-2 transition-colors ${
                      isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}

export default App;