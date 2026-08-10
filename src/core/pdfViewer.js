function escapeAttr(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

export async function openPdfViewer(url, title = 'Προβολή πιστοποιητικού') {
  if (!url) throw new Error('Δεν βρέθηκε αρχείο για προβολή.');
  const viewerUrl = `${url}${url.includes('#') ? '&' : '#'}toolbar=0&navpanes=0&statusbar=0&messages=0`;
  await Swal.fire({
    title: escapeAttr(title),
    html: `
      <div class="ct-pdf-viewer">
        <div class="ct-pdf-viewer__bar">
          <span class="ct-status ct-status--neutral"><i data-lucide="eye"></i> Μόνο προβολή</span>
          <span class="ct-pdf-viewer__security">Δεν παρέχεται ενέργεια λήψης από το CertiTrack.</span>
        </div>
        <div class="ct-pdf-viewer__stage ct-pdf-viewer__stage--native">
          <div class="ct-pdf-viewer__loading" id="ctPdfLoading"><i data-lucide="loader-circle"></i><span>Φόρτωση εγγράφου...</span></div>
          <iframe id="ctPdfFrame" class="ct-pdf-native-frame" src="${escapeAttr(viewerUrl)}" title="${escapeAttr(title)}"></iframe>
        </div>
      </div>`,
    width: 'min(1180px,97vw)',
    showCloseButton: true,
    showConfirmButton: false,
    allowOutsideClick: true,
    customClass: { htmlContainer: 'ct-preview-modal' },
    didOpen: () => {
      window.lucide?.createIcons();
      const popup = Swal.getPopup();
      const frame = popup?.querySelector('#ctPdfFrame');
      const loading = popup?.querySelector('#ctPdfLoading');
      let finished = false;
      const complete = () => { if (finished) return; finished = true; loading?.remove(); };
      frame?.addEventListener('load', complete, { once:true });
      setTimeout(() => {
        if (!finished && loading) loading.innerHTML = '<span>Το έγγραφο αργεί να φορτώσει. Ελέγξτε ότι το PDF υπάρχει στο storage και ότι η σχέση πρόσβασης είναι ενεργή.</span>';
      }, 8000);
    }
  });
}
