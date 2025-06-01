/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_PINECONE_API_KEY: string
  readonly VITE_PINECONE_ENVIRONMENT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}