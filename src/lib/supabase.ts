// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ochwubylbbpathtkwkqe.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jaHd1YnlsYmJwYXRodGt3a3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMjE1NzEsImV4cCI6MjA2NDg5NzU3MX0.oK0DtbCeeyZKEmqhmA0EDT7G4Vmj5eZMr7tLBZOWt_E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
