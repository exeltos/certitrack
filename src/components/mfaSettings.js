// Two-factor authentication (TOTP) enrollment and management.
// Self-contained: injects its own markup into a mount point so pages only
// need one call (mountMfaSettings) instead of hand-wiring a form each time.
import { authService } from '../services/authService.js';

function render(container, { enrolled }) {
  container.innerHTML = enrolled
    ? `
      <p class="ct-settings-section__desc">Η ταυτοποίηση δύο παραγόντων είναι <strong>ενεργή</strong> σε αυτόν τον λογαριασμό.</p>
      <button class="ct-btn ct-btn-secondary ct-btn-sm" id="mfaDisableBtn" type="button">Απενεργοποίηση</button>
    `
    : `
      <p class="ct-settings-section__desc">Προσθέστε ένα δεύτερο επίπεδο ασφάλειας με μια εφαρμογή ταυτοποίησης (Google Authenticator, 1Password κ.λπ.).</p>
      <button class="ct-btn ct-btn-primary ct-btn-sm" id="mfaEnrollBtn" type="button">Ενεργοποίηση ταυτοποίησης δύο παραγόντων</button>
      <div id="mfaEnrollPanel" class="hidden" style="margin-top:12px;"></div>
    `;
}

async function currentTotpFactor() {
  const { data, error } = await authService.mfaListFactors();
  if (error) return null;
  return data?.totp?.find(f => f.status === 'verified') || null;
}

async function startEnrollment(container) {
  const panel = container.querySelector('#mfaEnrollPanel');
  panel.classList.remove('hidden');
  panel.innerHTML = '<p>Δημιουργία κωδικού QR...</p>';

  const { data, error } = await authService.mfaEnroll();
  if (error) {
    panel.innerHTML = `<p class="ct-inline-note ct-inline-note--error">${error.message}</p>`;
    return;
  }

  const { id: factorId, totp } = data;
  panel.innerHTML = `
    <p>Σαρώστε τον κωδικό QR με την εφαρμογή ταυτοποίησης, ή εισάγετε το κλειδί χειροκίνητα:</p>
    <img src="${totp.qr_code}" alt="QR code" style="width:180px;height:180px;margin:8px 0;" />
    <p><code>${totp.secret}</code></p>
    <input type="text" id="mfaVerifyCode" inputmode="numeric" maxlength="6" placeholder="6-ψήφιος κωδικός" class="ct-input" style="max-width:160px;" />
    <button class="ct-btn ct-btn-primary ct-btn-sm" id="mfaVerifyBtn" type="button">Επιβεβαίωση</button>
    <div id="mfaVerifyStatus" class="ct-inline-note"></div>
  `;

  panel.querySelector('#mfaVerifyBtn').addEventListener('click', async () => {
    const code = panel.querySelector('#mfaVerifyCode').value.trim();
    const status = panel.querySelector('#mfaVerifyStatus');
    if (!/^\d{6}$/.test(code)) {
      status.textContent = 'Εισάγετε έναν έγκυρο 6-ψήφιο κωδικό.';
      return;
    }
    const { data: challenge, error: challengeError } = await authService.mfaChallenge(factorId);
    if (challengeError) { status.textContent = challengeError.message; return; }

    const { error: verifyError } = await authService.mfaVerify(factorId, challenge.id, code);
    if (verifyError) { status.textContent = 'Λανθασμένος κωδικός, δοκιμάστε ξανά.'; return; }

    render(container, { enrolled: true });
    bind(container);
  });
}

async function disableMfa(container) {
  const factor = await currentTotpFactor();
  if (!factor) return;
  const confirmed = window.Swal
    ? (await Swal.fire({ title: 'Απενεργοποίηση 2FA;', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ναι', cancelButtonText: 'Άκυρο' })).isConfirmed
    : window.confirm('Απενεργοποίηση 2FA;');
  if (!confirmed) return;

  const { error } = await authService.mfaUnenroll(factor.id);
  if (error) {
    window.Swal ? Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message }) : alert(error.message);
    return;
  }
  render(container, { enrolled: false });
  bind(container);
}

function bind(container) {
  container.querySelector('#mfaEnrollBtn')?.addEventListener('click', () => startEnrollment(container));
  container.querySelector('#mfaDisableBtn')?.addEventListener('click', () => disableMfa(container));
}

export async function mountMfaSettings(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const factor = await currentTotpFactor();
  render(container, { enrolled: Boolean(factor) });
  bind(container);
}
