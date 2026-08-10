import { getOrganizationContext, bindOrganizationLogout } from './guard.js';
import { organizationService } from '../../services/organizationService.js';
import { daysUntil } from '../../core/certificateCore.js';
import { emptyState, escapeHtml, statusBadge } from '../../components/uiPrimitives.js';
import { locale } from '../../shared/i18n.js';

const $ = id => document.getElementById(id);
const safe = escapeHtml;

async function init(){
  const ctx = await getOrganizationContext(); if(!ctx) return;
  bindOrganizationLogout();
  const { organization, user } = ctx;
  $('orgName').textContent = organization.display_name || organization.legal_name || organization.name || 'Οργανισμός';
  const [certs, partners] = await Promise.all([
    organizationService.listOwnCertificates(organization, user.id),
    organizationService.listPartners(organization)
  ]);
  let active=0, soon=0, expired=0;
  certs.forEach(c=>{ const d=daysUntil(c.date); if(d<0) expired++; else if(d<=30) soon++; else active++; });
  $('kpiCertificates').textContent=certs.length; $('kpiPartners').textContent=partners.length; $('kpiSoon').textContent=soon; $('kpiExpired').textContent=expired;
  const score = certs.length ? Math.round((active/certs.length)*100) : 100;
  $('healthScore').textContent=score; $('healthLabel').textContent = score>=85?'Πολύ καλή εικόνα':score>=65?'Χρειάζεται παρακολούθηση':'Χρειάζεται ενέργεια';
  const attention = certs.filter(c=>daysUntil(c.date)<=30).sort((a,b)=>new Date(a.date)-new Date(b.date));
  $('attentionList').innerHTML = attention.length ? attention.slice(0,6).map(c=>`<a class="ct-attention-row" href="./certificates.html" title="Προβολή"><div class="ct-attention-row__main"><strong>${safe(c.title||'Πιστοποιητικό')}</strong><span>${safe(c.type||'')} · λήξη ${new Date(c.date).toLocaleDateString(locale())}</span></div><div class="ct-attention-row__status">${daysUntil(c.date)<0?statusBadge('danger','Ληγμένο'):statusBadge('warning','Προς λήξη')}<i data-lucide="chevron-right"></i></div></a>`).join('') : emptyState({icon:'circle-check-big',title:'Δεν υπάρχουν άμεσες εκκρεμότητες',text:'Τα δικά σας πιστοποιητικά δεν έχουν λήξει και δεν λήγουν εντός 30 ημερών.'});
  $('partnerList').innerHTML = partners.length ? partners.slice(0,10).map(r=>`<a class="ct-attention-row" href="${r.status==='active'?`./partner.html?relation=${encodeURIComponent(r.id)}`:'./partners.html'}"><div class="ct-attention-row__main"><strong>${safe(r.partner?.name||'Συνεργάτης')}</strong><span>ΑΦΜ ${safe(r.partner?.afm||'—')}</span></div><div class="ct-attention-row__status">${statusBadge(r.status==='blocked'?'danger':'success',r.status==='blocked'?'Αποκλεισμένη':'Ενεργή')}<i data-lucide="chevron-right"></i></div></a>`).join('') : emptyState({icon:'users',title:'Δεν υπάρχουν συνεργάτες',text:'Προσθέστε τον πρώτο συνεργάτη σας για να μοιράζεστε πιστοποιητικά.'});
  window.lucide?.createIcons();
}
init().catch(err=>{console.error(err); Swal.fire('Σφάλμα',err.message||'Αποτυχία φόρτωσης','error');});
