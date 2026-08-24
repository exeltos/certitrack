// Shared certificate helpers used by supplier/company certificate screens.
const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(dateValue, now = new Date()) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  return Math.ceil((target - now) / DAY_MS);
}

export function certificateStatus(dateValue, now = new Date(), soonDays = 30) {
  const days = daysUntil(dateValue, now);
  if (days < 0) return 'expired';
  if (days <= soonDays) return 'soon';
  return 'active';
}

export function certificateStats(certificates = [], now = new Date(), soonDays = 30) {
  return certificates.reduce((stats, certificate) => {
    const status = certificateStatus(certificate?.date, now, soonDays);
    stats.total += 1;
    stats[status] += 1;
    return stats;
  }, { total: 0, active: 0, soon: 0, expired: 0 });
}

export function filterCertificatesByStatus(certificates = [], status = 'all', now = new Date(), soonDays = 30) {
  if (status === 'all') return certificates;
  return certificates.filter(certificate => certificateStatus(certificate?.date, now, soonDays) === status);
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function storageObjectPath(fileUrl, bucketName) {
  if (!fileUrl) return '';
  try {
    const url = new URL(fileUrl);
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const index = url.pathname.indexOf(marker);
    if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    // Fall back to the legacy two-segment path used by the existing project.
  }
  return fileUrl.split('/').slice(-2).join('/');
}

export function hasRequiredAfm(profile) {
  return Boolean(profile?.afm && String(profile.afm).trim());
}
