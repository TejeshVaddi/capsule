// Deployment configuration.
//
// To enable accounts + cloud sync, create a free Supabase project
// (see README "Going live" section), then paste your project's URL and
// anon public key here. With these left empty, Capsule runs in
// device-only mode: everything stays in this browser's IndexedDB.
//
// The anon key is safe to ship in client code, data access is enforced
// by row-level security policies on the server (supabase-schema.sql).

export const SUPABASE_URL = "https://bahoqmqygvlxfouohfbg.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaG9xbXF5Z3ZseGZvdW9oZmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODE0MDcsImV4cCI6MjEwMjY1NzQwN30.i3N8DQTvL9uxdhL42IYgjBVuNbXH_c0O1UBK0R6fsxk";

export const cloudConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
