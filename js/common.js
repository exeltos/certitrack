// js/common.js

import { supabase } from './supabaseClient.js';

/**
 * Φορτώνει ένα HTML component μέσα σε ένα container μέσω fetch.
 * @param {string} id - ID του στοιχείου-container.
 * @param {string} url - URL του partial HTML.
 */
export async function loadComponent(id, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Αποτυχία φόρτωσης component: ${url}`);
    const html = await res.text();
    const container = document.getElementById(id);
    if (container) container.innerHTML = html;
  } catch (err) {
    console.error(err);
    // Προβολή σφάλματος αν το SweetAlert2 είναι διαθέσιμο
    if (window.Swal) {
      Swal.fire({ icon: 'error', title: 'Φόρτωση Component', text: err.message });
    }
  }
}

/**
 * Εμφανίζει global loading overlay.
 */
export function showLoading() {
  let overlay = document.getElementById('global-loader');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'global-loader';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.innerHTML = `
      <svg class="animate-spin h-12 w-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

/**
 * Αποκρύπτει global loading overlay.
 */
export function hideLoading() {
  const overlay = document.getElementById('global-loader');
  if (overlay) overlay.style.display = 'none';
}

/**
 * Εμφανίζει σφάλμα χρησιμοποιώντας SweetAlert2 αν υπάρχει, αλλιώς console.
 * @param {Error|string} error - Το σφάλμα ή μήνυμα.
 * @param {string} title - Προαιρετικός τίτλος.
 */
export function handleError(error, title = 'Σφάλμα') {
  console.error(error);
  const message = error.message || error.toString() || 'Κάτι πήγε στραβά';
  if (window.Swal) {
    Swal.fire({ icon: 'error', title, text: message });
  }
}

/**
 * Φόρτωση προφίλ χρήστη από Supabase.
 * @param {string} userId
 * @returns {Promise<Object|undefined>}
 */
export async function loadUserProfile(userId) {
  try {
    showLoading();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    handleError(err, 'Φόρτωση Προφίλ');
  } finally {
    hideLoading();
  }
}

/**
 * Εναλλαγή dark/light mode με persist στο localStorage.
 */
export function toggleDarkMode() {
  const root = document.documentElement;
  const isDark = root.classList.toggle('dark');
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
}

// Εφαρμόζει αποθηκευμένο theme κατά το φόρτωμα
(function applyStoredTheme() {
  try {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch {}
})();
