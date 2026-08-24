const META = {
  'organization-dashboard': { eyebrow:'CertiTrack / Οργανισμός', title:'Επισκόπηση', description:'Πιστοποιητικά, συνεργάτες και εκκρεμότητες σε μία ενιαία εικόνα.' },
  'organization-certificates': { eyebrow:'CertiTrack / Οργανισμός', title:'Πιστοποιητικά', description:'Διαχείριση των πιστοποιητικών που ανήκουν στον οργανισμό σας.' },
  'organization-partners': { eyebrow:'CertiTrack / Οργανισμός', title:'Συνεργάτες', description:'Συνδέστε άλλους οργανισμούς και διαχειριστείτε τις μεταξύ σας σχέσεις.' },
  'organization-compliance': { eyebrow:'CertiTrack / Οργανισμός', title:'Συμμόρφωση', description:'Απαιτήσεις και κατάσταση συμμόρφωσης ανά σχέση συνεργασίας.' },
  'organization-profile': { eyebrow:'CertiTrack / Οργανισμός', title:'Ρυθμίσεις', description:'Στοιχεία οργανισμού και ασφάλεια λογαριασμού.' },
  'organization-partner': { eyebrow:'CertiTrack / Οργανισμός', title:'Καρτέλα συνεργάτη', description:'Στοιχεία συνεργάτη και κοινόχρηστα πιστοποιητικά.' },
  'admin-dashboard': {
    eyebrow: 'CertiTrack / Platform Admin',
    title: 'Επισκόπηση πλατφόρμας',
    description: 'Συνολική εικόνα οργανισμών, συνεργασιών και δραστηριότητας.'
  },
  'admin-organizations': {
    eyebrow: 'CertiTrack / Platform Admin',
    title: 'Οργανισμοί',
    description: 'Οργανισμοί που χρησιμοποιούν την πλατφόρμα.'
  },
  'admin-audit': {
    eyebrow: 'CertiTrack / Platform Admin',
    title: 'Audit log',
    description: 'Ιστορικό ενεργειών και βασικών μεταβολών της πλατφόρμας.'
  }
};

export function renderPageHeader(page) {
  const meta=META[page];
  if (!meta) return '';
  return `<section class="ct-page-header">
    <div>
      <div class="ct-page-header__eyebrow">${meta.eyebrow}</div>
      <h1 class="ct-page-header__title">${meta.title}</h1>
      <p class="ct-page-header__description">${meta.description}</p>
    </div>
    <div id="page-header-actions" class="ct-page-header__actions"></div>
  </section>`;
}
