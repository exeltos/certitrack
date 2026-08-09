const META = {
  'company-dashboard': {
    eyebrow: 'CertiTrack / Εταιρεία',
    title: 'Επισκόπηση',
    description: 'Κατάσταση συμμόρφωσης, λήξεις και ενέργειες που χρειάζονται προσοχή.'
  },
  'company-suppliers': {
    eyebrow: 'CertiTrack / Εταιρεία',
    title: 'Προμηθευτές',
    description: 'Διαχείριση συνεργαζόμενων προμηθευτών και πρόσβαση στα πιστοποιητικά τους.'
  },
  'company-certificates': {
    eyebrow: 'CertiTrack / Εταιρεία',
    title: 'Πιστοποιητικά εταιρείας',
    description: 'Κεντρική διαχείριση των πιστοποιητικών της εταιρείας.'
  },
  'company-compliance': {
    eyebrow: 'CertiTrack / Εταιρεία',
    title: 'Συμμόρφωση',
    description: 'Απαιτήσεις ανά προμηθευτή, ελλείψεις και κατάσταση συμμόρφωσης.'
  },
  'company-profile': {
    eyebrow: 'CertiTrack / Εταιρεία',
    title: 'Ρυθμίσεις λογαριασμού',
    description: 'Στοιχεία εταιρείας και ασφάλεια λογαριασμού.'
  },
  'company-supplier': {
    eyebrow: 'CertiTrack / Προμηθευτής',
    title: 'Καρτέλα προμηθευτή',
    description: 'Στοιχεία συνεργάτη και διαθέσιμα πιστοποιητικά.'
  },
  'supplier-certificates': {
    eyebrow: 'CertiTrack / Προμηθευτής',
    title: 'Πιστοποιητικά',
    description: 'Διαχείριση, ισχύς και κοινοποίηση των πιστοποιητικών σας.'
  },
  'supplier-companies': {
    eyebrow: 'CertiTrack / Προμηθευτής',
    title: 'Οι εταιρείες μου',
    description: 'Εταιρείες που σας έχουν αποθηκευμένο και κατάσταση πρόσβασης.'
  },
  'supplier-profile': {
    eyebrow: 'CertiTrack / Προμηθευτής',
    title: 'Ρυθμίσεις λογαριασμού',
    description: 'Στοιχεία προμηθευτή και ασφάλεια λογαριασμού.'
  },
  'admin-dashboard': {
    eyebrow: 'CertiTrack / Platform Admin',
    title: 'Επισκόπηση πλατφόρμας',
    description: 'Συνολική εικόνα οργανισμών, συνεργασιών και δραστηριότητας.'
  },
  'admin-organizations': {
    eyebrow: 'CertiTrack / Platform Admin',
    title: 'Οργανισμοί',
    description: 'Εταιρείες και προμηθευτές που χρησιμοποιούν την πλατφόρμα.'
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
