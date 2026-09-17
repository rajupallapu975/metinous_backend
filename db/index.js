const { Pool } = require('pg');
const pgvector = require('pgvector/pg');
const fs = require('fs');
const path = require('path');

/**
 * Metinous AI — PostgreSQL & pgvector Database Client Layer
 */
class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.hasVectorExtension = false;
    this.lastError = null;
    this._initPromise = null;
  }

  /**
   * Initializes PostgreSQL pool connection & executes migrations
   */
  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    const connectionString = process.env.DATABASE_URL || null;
    const host = process.env.PGHOST || 'localhost';
    const port = parseInt(process.env.PGPORT || '5432', 10);
    const user = process.env.PGUSER || 'postgres';
    const password = process.env.PGPASSWORD || 'postgres';
    const database = process.env.PGDATABASE || 'metinous_ai';

    const poolConfig = connectionString
      ? { connectionString, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false }
      : {
          host,
          port,
          user,
          password,
          database,
          ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 4000,
        };

    try {
      this.pool = new Pool(poolConfig);

      // Setup client connection handler for pgvector registration
      this.pool.on('connect', async (client) => {
        try {
          await pgvector.registerType(client);
        } catch (_) {}
      });

      this.pool.on('error', (err) => {
        console.warn(`[POSTGRES WARNING] Idle client error: ${err.message}`);
      });

      // Test connection
      const client = await this.pool.connect();
      try {
        await pgvector.registerType(client);
        this.isConnected = true;
        this.lastError = null;

        // Run migrations from schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const sql = fs.readFileSync(schemaPath, 'utf8');
          await client.query(sql);
          this.hasVectorExtension = true;
          console.log(`\x1b[32m[POSTGRES SUCCESS]\x1b[0m Connected to PostgreSQL & pgvector schema initialized successfully.`);
        }
      } finally {
        client.release();
      }

      return true;
    } catch (err) {
      this.isConnected = false;
      this.lastError = err.message;
      if (this.pool) {
        try {
          await this.pool.end();
        } catch (_) {}
        this.pool = null;
      }
      console.warn(`\x1b[33m[POSTGRES INFO]\x1b[0m PostgreSQL not reachable at ${connectionString || `${host}:${port}/${database}`} (${err.message}). Running with in-memory fallback.`);
      return false;
    }
  }

  /**
   * Executes a parameterized query
   */
  async query(text, params = []) {
    if (!this.isConnected || !this.pool) {
      throw new Error(`PostgreSQL is offline. (${this.lastError || 'Not connected'})`);
    }
    return await this.pool.query(text, params);
  }

  /**
   * Health status inspection
   */
  getStatus() {
    return {
      connected: this.isConnected,
      hasVectorExtension: this.hasVectorExtension,
      lastError: this.lastError,
      target: process.env.DATABASE_URL ? 'DATABASE_URL' : `${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'metinous_ai'}`,
    };
  }
}

const db = new DatabaseManager();

module.exports = {
  db,
  DatabaseManager,
};
