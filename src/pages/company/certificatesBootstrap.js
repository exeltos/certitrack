import { initCompanyCertificatesPage } from './certificates.js';

  document.addEventListener('DOMContentLoaded', () => {
    initCompanyCertificatesPage().then(() => {
      const notifyCountEl = document.getElementById('notifyCount');
      const bellBtn = document.getElementById('notifyBtn');
      const allSoon = document.querySelectorAll('.cert-card.border-warning');
      const blocked = document.querySelectorAll('.cert-card.border-error');

      if (allSoon.length > 0) {
        notifyCountEl.textContent = allSoon.length;
        notifyCountEl.classList.remove('hidden');
        bellBtn?.addEventListener('click', () => {
          Swal.fire({
            title: 'Πιστοποιητικά που λήγουν σύντομα',
            html: '<ul style="text-align:left">' +
              Array.from(allSoon).map(card => `<li>• ${card.querySelector('h3')?.textContent}</li>`).join('') +
              '</ul>',
            icon: 'info',
            confirmButtonText: 'ΟΚ'
          });
        });
      } else if (blocked.length > 0) {
        bellBtn?.addEventListener('click', () => {
          Swal.fire({
            icon: 'warning',
            title: 'Αποκλεισμένη Πρόσβαση',
            text: 'Ο προμηθευτής δεν επιτρέπει την πρόσβασή σας στα αρχεία του.'
          });
        });
      }
    });
  });
