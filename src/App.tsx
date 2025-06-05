import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const SUBJECTS = [
  'Математика', 'Українська мова', 'Історія', 'Фізика',
  'Хімія', 'Біологія', 'Географія', 'Інформатика', 'Англійська мова'
];

async function queryAI(input: string) {
  try {
    const schoolInfo = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-school`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: input })
    }).then(res => res.json()).then(data => data.schoolInfo || '');

    const prompt = `Ви - шкільний помічник, який допомагає учням та вчителям з різними питаннями.
Будь ласка, дайте відповідь на наступне запитання або запит, використовуючи доступну інформацію про школу:

${input}

Інформація про заклад:
${schoolInfo}

Відповідайте українською мовою, чітко та зрозуміло. Якщо інформація відсутня або ви не впевнені, чесно про це скажіть.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error:', error);
    return "Вибачте, але зараз я маю проблеми з підключенням. Будь ласка, спробуйте пізніше.";
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError('Будь ласка, встановіть ваш Gemini API ключ у файлі .env');
      return;
    }

    const userMessage = { id: Date.now(), text: input, sender: 'user' as const, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await queryAI(input);
      const botMessage = { id: Date.now() + 1, text: response, sender: 'bot' as const, timestamp: new Date() };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      setError('Не вдалося отримати відповідь від ШІ. Будь ласка, спробуйте ще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white shadow-md p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-800">Шкільний помічник</h1>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full p-4 overflow-y-auto">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-4 ${
                message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
              } shadow-md`}>
                <p>{message.text}</p>
                <span className="text-xs opacity-75 mt-1 block">{message.timestamp.toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-800 rounded-lg p-4 shadow-md">
                <div className="flex items-center gap-2">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div key={i} className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" 
                         style={{ animationDelay: `${delay}s` }} />
                  ))}
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
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
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