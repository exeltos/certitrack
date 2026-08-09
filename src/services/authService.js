import { supabase } from './supabaseClient.js';

export const authService = {
  getSession: () => supabase.auth.getSession(),
  getUser: () => supabase.auth.getUser(),
  signInWithPassword: credentials => supabase.auth.signInWithPassword(credentials),
  signUp: options => supabase.auth.signUp(options),
  signOut: () => supabase.auth.signOut(),
  resetPasswordForEmail: (email, options) => supabase.auth.resetPasswordForEmail(email, options),
  updateUser: attributes => supabase.auth.updateUser(attributes),
  resend: payload => supabase.auth.resend(payload),
  setSession: session => supabase.auth.setSession(session),
  exchangeCodeForSession: code => supabase.auth.exchangeCodeForSession(code)
};
