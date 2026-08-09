import { supabase } from './supabaseClient.js';

export const storageService = {
  upload(bucket, path, file, options = {}) {
    return supabase.storage.from(bucket).upload(path, file, options);
  },
  remove(bucket, paths) {
    return supabase.storage.from(bucket).remove(paths);
  },
  createSignedUrl(bucket, path, expiresIn) {
    return supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  }
};
