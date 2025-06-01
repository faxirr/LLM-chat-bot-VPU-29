// src/utils/uploadKnowledge.ts
// Утиліта для завантаження вашої бази знань у Pinecone

// Поліфіл для браузерного середовища
if (typeof global === 'undefined') {
    (window as any).global = globalThis;
}

import { SUBJECTS, LEARNING_RESOURCES } from '../config/knowledge';
import { Pinecone } from '@pinecone-database/pinecone';
import type { Topic } from '../types/knowledge';

const GEMINI_EMBEDDING_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY;
const PINECONE_INDEX_NAME = 'vpu29';
const PINECONE_NAMESPACE = 'INFO';

const pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY || '',
});

// Створення embeddings через Gemini
async function createEmbedding(text: string): Promise<number[]> {
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

    if (!response.ok) {
        throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding.values;
}

// Конвертація knowledge.ts у тексти для векторизації
function convertKnowledgeToTexts(): Array<{id: string, text: string, metadata: Record<string, any>}> {
    const texts: Array<{id: string, text: string, metadata: Record<string, any>}> = [];
    let counter = 0;

    // Обробка SUBJECTS
    Object.entries(SUBJECTS).forEach(([subjectKey, subject]) => {
        subject.topics.forEach((topic: Topic) => {
            // Основна інформація про тему
            const topicText = `
Предмет: ${subjectKey === 'mathematics' ? 'Математика' : 'Фізика'}
Розділ: ${topic.name}
Підтеми: ${topic.subtopics.join(', ')}

Це основна тема з предмету ${subjectKey === 'mathematics' ? 'математики' : 'фізики'} під назвою "${topic.name}". 
Вона включає наступні підтеми: ${topic.subtopics.join(', ')}.
      `.trim();

            texts.push({
                id: `subject-${subjectKey}-${counter++}`,
                text: topicText,
                metadata: {
                    type: 'subject_topic',
                    subject: subjectKey,
                    topic: topic.name,
                    subtopics: topic.subtopics,
                    text: topicText
                }
            });

            // Приклади (якщо є)
            if ('examples' in topic && topic.examples) {
                Object.entries(topic.examples as Record<string, string>).forEach(([exampleKey, example]) => {
                    const exampleText = `
Предмет: ${subjectKey === 'mathematics' ? 'Математика' : 'Фізика'}
Тема: ${exampleKey}
Приклад: ${example}

Для вивчення теми "${exampleKey}" з предмету ${subjectKey === 'mathematics' ? 'математики' : 'фізики'} 
можна використати наступний приклад: ${example}
          `.trim();

                    texts.push({
                        id: `example-${subjectKey}-${counter++}`,
                        text: exampleText,
                        metadata: {
                            type: 'example',
                            subject: subjectKey,
                            topic: topic.name,
                            subtopic: exampleKey,
                            example: example,
                            text: exampleText
                        }
                    });
                });
            }

            // Формули (якщо є)
            if ('formulas' in topic && topic.formulas) {
                Object.entries(topic.formulas as Record<string, string>).forEach(([formulaKey, formula]) => {
                    const formulaText = `
Предмет: ${subjectKey === 'mathematics' ? 'Математика' : 'Фізика'}
Розділ: ${topic.name}
Формула для обчислення: ${formulaKey}
Формула: ${formula}

Для розв'язання задач на тему "${formulaKey}" використовується формула: ${formula}
Ця формула належить до розділу "${topic.name}" предмету ${subjectKey === 'mathematics' ? 'математики' : 'фізики'}.
          `.trim();

                    texts.push({
                        id: `formula-${subjectKey}-${counter++}`,
                        text: formulaText,
                        metadata: {
                            type: 'formula',
                            subject: subjectKey,
                            topic: topic.name,
                            formula_name: formulaKey,
                            formula: formula,
                            text: formulaText
                        }
                    });
                });
            }
        });
    });

    // Обробка LEARNING_RESOURCES
    LEARNING_RESOURCES.websites.forEach((website) => {
        const websiteText = `
Навчальний ресурс: ${website.name}
Опис: ${website.description}
Посилання: ${website.url}

${website.name} - це корисний освітній ресурс для навчання. ${website.description}
Ви можете знайти його за посиланням: ${website.url}
    `.trim();

        texts.push({
            id: `website-${counter++}`,
            text: websiteText,
            metadata: {
                type: 'learning_resource',
                resource_type: 'website',
                name: website.name,
                url: website.url,
                description: website.description,
                text: websiteText
            }
        });
    });

    LEARNING_RESOURCES.books.forEach((book) => {
        const bookText = `
Рекомендована книга: ${book.title}
Автор: ${book.author}
Рік видання: ${book.year}

"${book.title}" автора ${book.author} (${book.year} рік) - це рекомендований підручник для навчання.
Ця книга допоможе поглибити знання з відповідного предмету.
    `.trim();

        texts.push({
            id: `book-${counter++}`,
            text: bookText,
            metadata: {
                type: 'learning_resource',
                resource_type: 'book',
                title: book.title,
                author: book.author,
                year: book.year,
                text: bookText
            }
        });
    });

    return texts;
}

// Основна функція завантаження у Pinecone
export async function uploadKnowledgeToPinecone(): Promise<string> {
    try {
        if (!GEMINI_API_KEY) {
            return '❌ Відсутній VITE_GEMINI_API_KEY';
        }

        if (!PINECONE_API_KEY) {
            return '❌ Відсутній VITE_PINECONE_API_KEY';
        }

        console.log('🚀 Початок завантаження знань у Pinecone...');

        const knowledgeTexts = convertKnowledgeToTexts();
        console.log(`📚 Підготовлено ${knowledgeTexts.length} текстів для векторизації`);

        const index = pinecone.index(PINECONE_INDEX_NAME);
        const vectors = [];

        // Створюємо embeddings для кожного тексту
        for (let i = 0; i < knowledgeTexts.length; i++) {
            const item = knowledgeTexts[i];
            console.log(`🔄 Обробка ${i + 1}/${knowledgeTexts.length}: ${item.metadata.type} - ${item.metadata.subject || item.metadata.name || 'resource'}`);

            try {
                const embedding = await createEmbedding(item.text);

                vectors.push({
                    id: item.id,
                    values: embedding,
                    metadata: {
                        ...item.metadata,
                        source: 'knowledge_base',
                        created_at: new Date().toISOString(),
                        content_length: item.text.length
                    }
                });

                // Пауза для уникнення rate limits
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (embeddingError) {
                console.error(`❌ Помилка створення embedding для ${item.id}:`, embeddingError);
                continue; // Пропускаємо цей елемент і продовжуємо
            }
        }

        if (vectors.length === 0) {
            return '❌ Не вдалося створити жодного вектора';
        }

        console.log(`✅ Створено ${vectors.length} векторів. Завантаження у Pinecone...`);

        // Завантажуємо у Pinecone батчами
        const batchSize = 50; // Зменшуємо розмір батчу для надійності
        let uploadedCount = 0;

        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize);

            try {
                await index.upsert(batch, { namespace: PINECONE_NAMESPACE });
                uploadedCount += batch.length;
                console.log(`✅ Завантажено батч ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)} (${uploadedCount}/${vectors.length})`);

                // Пауза між батчами
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (uploadError) {
                console.error(`❌ Помилка завантаження батчу ${Math.floor(i / batchSize) + 1}:`, uploadError);
            }
        }

        return `✅ Завантаження завершено! Створено ${uploadedCount} векторів у Pinecone (namespace: ${PINECONE_NAMESPACE})`;

    } catch (error) {
        console.error('❌ Критична помилка завантаження:', error);
        return `❌ Критична помилка: ${error instanceof Error ? error.message : 'Невідома помилка'}`;
    }
}

// Функція для очищення namespace (опціонально)
export async function clearPineconeNamespace(): Promise<string> {
    try {
        if (!PINECONE_API_KEY) {
            return '❌ Відсутній VITE_PINECONE_API_KEY';
        }

        const index = pinecone.index(PINECONE_INDEX_NAME);
        await index.deleteAll({ namespace: PINECONE_NAMESPACE });
        return `✅ Namespace "${PINECONE_NAMESPACE}" очищено`;
    } catch (error) {
        console.error('❌ Помилка очищення:', error);
        return `❌ Помилка очищення: ${error instanceof Error ? error.message : 'Невідома помилка'}`;
    }
}

// Функція для перевірки стану namespace
export async function checkNamespaceStats(): Promise<string> {
    try {
        if (!PINECONE_API_KEY) {
            return '❌ Відсутній VITE_PINECONE_API_KEY';
        }

        const index = pinecone.index(PINECONE_INDEX_NAME);
        const stats = await index.describeIndexStats();

        const namespaceStats = stats.namespaces?.[PINECONE_NAMESPACE];
        if (!namespaceStats) {
            return `📊 Namespace "${PINECONE_NAMESPACE}" порожній або не існує`;
        }

        return `📊 Статистика namespace "${PINECONE_NAMESPACE}":
- Кількість векторів: ${namespaceStats.vectorCount}
- Розмір: ${(namespaceStats.vectorCount || 0)} records`;

    } catch (error) {
        return `❌ Помилка отримання статистики: ${error instanceof Error ? error.message : 'Невідома помилка'}`;
    }
}