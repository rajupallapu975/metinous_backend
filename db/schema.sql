-- Metinous AI PostgreSQL + pgvector Database Schema

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Conversations Table (Session Management)
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    title TEXT NOT NULL DEFAULT 'New Conversation',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- 3. Messages Table (Chat History & Metadata)
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    text TEXT NOT NULL,
    route VARCHAR(50),
    tool_used BOOLEAN DEFAULT FALSE,
    tools JSONB DEFAULT '[]'::jsonb,
    domain VARCHAR(50),
    domain_badge VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);

-- 4. Conversation Embeddings Table (Semantic Search via pgvector)
CREATE TABLE IF NOT EXISTS conversation_embeddings (
    id TEXT PRIMARY KEY,
    message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    sender VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON conversation_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_conversation_id ON conversation_embeddings(conversation_id);

-- 5. HNSW Vector Index for High-Speed Cosine Similarity Search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw 
ON conversation_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
