// Private certificate storage helpers.
// Supports both legacy public URLs and new object-path values in file_url.
import { supabase } from '../services/supabaseClient.js';
import { openPdfViewer } from './pdfViewer.js';

export function certificateObjectPath(fileRef, bucketName) {
  if (!fileRef) return '';
  const value = String(fileRef);

  // Current records store the object path directly.
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');

  try {
    const url = new URL(value);
    const publicMarker = `/storage/v1/object/public/${bucketName}/`;
    const signedMarker = `/storage/v1/object/sign/${bucketName}/`;
    let idx = url.pathname.indexOf(publicMarker);
    if (idx >= 0) return decodeURIComponent(url.pathname.slice(idx + publicMarker.length));
    idx = url.pathname.indexOf(signedMarker);
    if (idx >= 0) return decodeURIComponent(url.pathname.slice(idx + signedMarker.length));
  } catch {
    // Fall through for malformed legacy URLs.
  }

  // Legacy CertiTrack paths are <auth-user-id>/<uuid>.<ext>.
  const parts = value.split('/').filter(Boolean);
  return parts.slice(-2).join('/');
}

export async function createCertificateSignedUrl(bucketName, fileRef, expiresIn = 600) {
  const path = certificateObjectPath(fileRef, bucketName);
  if (!path) throw new Error('Δεν βρέθηκε το αρχείο του πιστοποιητικού.');

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Δεν ήταν δυνατή η ασφαλής πρόσβαση στο αρχείο.');
  return data.signedUrl;
}

export async function removeCertificateObject(bucketName, fileRef) {
  const path = certificateObjectPath(fileRef, bucketName);
  if (!path) return;
  const { error } = await supabase.storage.from(bucketName).remove([path]);
  if (error) throw error;
}

export async function openCertificatePreview(bucketName, fileRef, title = '') {
  if (!fileRef) throw new Error('Δεν βρέθηκε το αρχείο του πιστοποιητικού.');
  const value = String(fileRef);
  // Demo/local files, object URLs and legacy public URLs can be previewed directly.
  if (/^(https?:|blob:|data:)/i.test(value) || value.startsWith('/')) {
    return openPdfViewer(value, title || 'Προβολή πιστοποιητικού');
  }
  const signedUrl = await createCertificateSignedUrl(bucketName, value, 600);
  return openPdfViewer(signedUrl, title || 'Προβολή πιστοποιητικού');
}


export async function downloadCertificate(bucketName, fileRef, filename = 'certificate.pdf') {
  const signedUrl = await createCertificateSignedUrl(bucketName, fileRef, 600);
  const link = document.createElement('a');
  link.href = signedUrl;
  link.download = filename || 'certificate.pdf';
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
