import { supabase } from './supabaseClient.js';

export const databaseService = {
  table: tableName => supabase.from(tableName)
};
