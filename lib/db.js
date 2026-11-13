// Database connection and schema. The schema is applied on every boot (all statements are idempotent).
const { Pool, types } = require('pg');
const crypto = require('crypto');
const client = require('./client');

types.setTypeParser(1082, v => v); // DATE as 'YYYY-MM-DD'

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add a PostgreSQL service on Railway and reference its DATABASE_URL.');
  process.exit(1);
}
const needsSsl = /sslmode=require/.test(connectionString) || /proxy\.rlwy\.net/.test(connectionString);
const pool = new Pool({ connectionString, ssl: needsSsl ? { rejectUnauthorized: false } : false, max: 10 });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

-- The register. Built from the people who open the course link; the office can also add names it expects.
CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  ref TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  employer TEXT,
  site TEXT,
  role TEXT,
  source TEXT NOT NULL DEFAULT 'link',
  identity_confirmed_by TEXT,
  identity_confirmed_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS people_phone_idx ON people (phone);

-- One enrolment per person per course revision: the training record itself.
CREATE TABLE IF NOT EXISTS enrolments (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  revision INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  modules JSONB NOT NULL DEFAULT '{}',
  passed_at TIMESTAMPTZ,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  extra_attempts INTEGER NOT NULL DEFAULT 0,
  declared_at TIMESTAMPTZ,
  declared_name TEXT,
  declaration TEXT,
  signature TEXT,
  completed_at TIMESTAMPTZ,
  device TEXT,
  UNIQUE (person_id, course_code, revision)
);

-- Every assessment attempt: the questions presented, in the order presented, and the answers given.
CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  enrolment_id INTEGER NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  presented JSONB NOT NULL,
  answers JSONB,
  score INTEGER,
  total INTEGER,
  critical_wrong JSONB,
  passed BOOLEAN,
  review JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS attempts_enrolment_idx ON attempts (enrolment_id);

-- Supervisory follow-up: additional instruction after a failed assessment, chasers and notes.
CREATE TABLE IF NOT EXISTS followups (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  by_name TEXT NOT NULL,
  by_role TEXT,
  happened_on DATE,
  notes TEXT,
  unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Practical records, kept apart from the training record: face-fit tests carried out by a competent fit tester.
CREATE TABLE IF NOT EXISTS fit_records (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  tested_on DATE NOT NULL,
  rpe_type TEXT,
  make_model TEXT NOT NULL,
  size TEXT,
  method TEXT,
  tester TEXT,
  certificate_ref TEXT,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const q = (text, params) => pool.query(text, params);
const UPGRADES = `ALTER TABLE fit_records ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'Pass';`;

async function migrate() {
  await pool.query(SCHEMA);
  await pool.query(UPGRADES);
  const seed = async (k, v) => q('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING', [k, v]);
  await seed('link_token', crypto.randomBytes(9).toString('base64url'));
  await seed('sites', JSON.stringify(client.sites || []));
  await seed('expected_headcount', String(client.expected_headcount || ''));
  // Safety Simplified's master account, from MASTER_EMAIL and MASTER_PASSWORD on Railway.
  if (process.env.MASTER_EMAIL && process.env.MASTER_PASSWORD) {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(process.env.MASTER_PASSWORD, 10);
    await q(`INSERT INTO users (name, email, password_hash, role) VALUES ('Safety Simplified', LOWER($1), $2, 'owner')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'owner'`, [process.env.MASTER_EMAIL, hashed]);
  }
}

module.exports = { pool, q, migrate };
