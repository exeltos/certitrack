let pdfJsPromise;

async function getPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs').then(pdfjsLib => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
}

function escapeAttr(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

export async function openPdfViewer(url, title = 'Προβολή πιστοποιητικού') {
  if (!url) throw new Error('Δεν βρέθηκε αρχείο για προβολή.');

  await Swal.fire({
    title: escapeAttr(title),
    html: `
      <div class="ct-pdf-viewer" data-pdf-url="${escapeAttr(url)}">
        <div class="ct-pdf-viewer__bar">
          <span class="ct-status ct-status--neutral"><i data-lucide="eye"></i> Μόνο προβολή</span>
          <div class="ct-pdf-viewer__controls">
            <button type="button" class="ct-row-action" id="ctPdfPrev" aria-label="Προηγούμενη σελίδα"><i data-lucide="chevron-left"></i></button>
            <span id="ctPdfPageInfo">Σελίδα 1 / 1</span>
            <button type="button" class="ct-row-action" id="ctPdfNext" aria-label="Επόμενη σελίδα"><i data-lucide="chevron-right"></i></button>
            <button type="button" class="ct-row-action" id="ctPdfZoomOut" aria-label="Σμίκρυνση"><i data-lucide="zoom-out"></i></button>
            <button type="button" class="ct-row-action" id="ctPdfZoomIn" aria-label="Μεγέθυνση"><i data-lucide="zoom-in"></i></button>
          </div>
        </div>
        <div class="ct-pdf-viewer__stage" id="ctPdfStage">
          <div class="ct-pdf-viewer__loading" id="ctPdfLoading"><i data-lucide="loader-circle"></i><span>Φόρτωση εγγράφου...</span></div>
          <canvas id="ctPdfCanvas" aria-label="${escapeAttr(title)}"></canvas>
        </div>
        <p class="ct-pdf-viewer__note">Το CertiTrack εμφανίζει το έγγραφο μέσα στην εφαρμογή χωρίς κουμπί λήψης.</p>
      </div>`,
    width: 'min(1120px,96vw)',
    showCloseButton: true,
    showConfirmButton: false,
    allowOutsideClick: true,
    customClass: { htmlContainer: 'ct-preview-modal' },
    didOpen: async () => {
      window.lucide?.createIcons();
      const popup = Swal.getPopup();
      const canvas = popup.querySelector('#ctPdfCanvas');
      const stage = popup.querySelector('#ctPdfStage');
      const loading = popup.querySelector('#ctPdfLoading');
      const pageInfo = popup.querySelector('#ctPdfPageInfo');
      const prev = popup.querySelector('#ctPdfPrev');
      const next = popup.querySelector('#ctPdfNext');
      const zoomIn = popup.querySelector('#ctPdfZoomIn');
      const zoomOut = popup.querySelector('#ctPdfZoomOut');
      const ctx = canvas.getContext('2d');
      let pdf;
      let pageNum = 1;
      let scale = 1.15;
      let rendering = false;

      const renderPage = async () => {
        if (!pdf || rendering) return;
        rendering = true;
        try {
          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const maxWidth = Math.max(320, stage.clientWidth - 32);
          const fitScale = Math.min(maxWidth / baseViewport.width, 1.55);
          const viewport = page.getViewport({ scale: fitScale * scale });
          const ratio = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * ratio);
          canvas.height = Math.floor(viewport.height * ratio);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          await page.render({ canvasContext: ctx, viewport }).promise;
          pageInfo.textContent = `Σελίδα ${pageNum} / ${pdf.numPages}`;
          prev.disabled = pageNum <= 1;
          next.disabled = pageNum >= pdf.numPages;
        } finally {
          rendering = false;
        }
      };

      try {
        const pdfjsLib = await getPdfJs();
        pdf = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
        loading.remove();
        await renderPage();
        prev.addEventListener('click', async () => { if (pageNum > 1) { pageNum -= 1; await renderPage(); } });
        next.addEventListener('click', async () => { if (pageNum < pdf.numPages) { pageNum += 1; await renderPage(); } });
        zoomIn.addEventListener('click', async () => { scale = Math.min(2.2, scale + .15); await renderPage(); });
        zoomOut.addEventListener('click', async () => { scale = Math.max(.65, scale - .15); await renderPage(); });
      } catch (error) {
        console.error(error);
        loading.innerHTML = '<span>Δεν ήταν δυνατή η ενσωματωμένη προβολή του PDF.</span>';
      }
    }
  });
}
