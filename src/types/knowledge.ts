// src/types/knowledge.ts
// Типи для структури бази знань

export interface Topic {
    name: string;
    subtopics: string[];
    examples?: Record<string, string>;
    formulas?: Record<string, string>;
}

export interface Subject {
    topics: Topic[];
}

export interface Website {
    name: string;
    url: string;
    description: string;
}

export interface Book {
    title: string;
    author: string;
    year: number;
}

export interface LearningResources {
    websites: Website[];
    books: Book[];
}

export interface KnowledgeBase {
    mathematics: Subject;
    physics: Subject;
}