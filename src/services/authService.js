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
  exchangeCodeForSession: code => supabase.auth.exchangeCodeForSession(code),

  // --- Multi-factor authentication (TOTP) -----------------------------
  // Supabase Auth has native MFA support; no custom backend needed.
  // https://supabase.com/docs/guides/auth/auth-mfa

  mfaListFactors: () => supabase.auth.mfa.listFactors(),
  mfaEnroll: (friendlyName = 'Authenticator app') =>
    supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName }),
  mfaChallenge: factorId => supabase.auth.mfa.challenge({ factorId }),
  mfaVerify: (factorId, challengeId, code) =>
    supabase.auth.mfa.verify({ factorId, challengeId, code }),
  mfaUnenroll: factorId => supabase.auth.mfa.unenroll({ factorId }),
  // Reports the highest assurance level satisfied ('aal1' = password only,
  // 'aal2' = password + a verified second factor) versus the level the
  // session is currently allowed to reach. Use this after sign-in to decide
  // whether an MFA challenge screen is required before granting access.
  mfaGetAuthenticatorAssuranceLevel: () => supabase.auth.mfa.getAuthenticatorAssuranceLevel()
};
