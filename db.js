/**
 * MongoDB Atlas Connection Helper
 * Uses connection pooling — safe for serverless (Vercel)
 */

const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI;
const DB_NAME = 'algolab';

let client = null;
let db     = null;

async function connectDB() {
  if (db) return db; // return cached connection
  if (!URI) {
    console.warn('[DB] MONGODB_URI not set — history will not persist');
    return null;
  }
  try {
    client = new MongoClient(URI, { maxPoolSize: 10 });
    await client.connect();
    db = client.db(DB_NAME);
    console.log('[DB] Connected to MongoDB Atlas');
    return db;
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    return null;
  }
}

module.exports = { connectDB };
