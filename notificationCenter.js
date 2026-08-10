import { notificationService } from '../services/notificationService.js';
import { escapeHtml } from './uiPrimitives.js';
import { locale } from '../shared/i18n.js';

function kindIcon(type){
  if(type==='certificate_expired')return 'circle-alert';
  if(type==='certificate_expiry')return 'clock-3';
  if(type==='relationship_invite')return 'user-plus';
  if(type==='relationship_accepted')return 'handshake';
  if(type==='relationship_declined')return 'user-x';
  return 'bell';
}
function fmtDate(value){
  try{return new Date(value).toLocaleString(locale(),{dateStyle:'short',timeStyle:'short'});}catch{return '';}
}
function notificationHref(n){
  if(n.entity_type==='certificate') return '/pages/organization/certificates.html';
  if(n.entity_type==='organization_relationship' && n.entity_id) return `/pages/organization/partner.html?relation=${encodeURIComponent(n.entity_id)}`;
  if(String(n.type||'').startsWith('relationship_')) return '/pages/organization/partners.html';
  return '';
}
function markup(rows){
  if(!rows.length)return `<div class="ct-notification-empty"><i data-lucide="bell-off"></i><strong>Δεν υπάρχουν ειδοποιήσεις</strong><span>Οι νέες ενημερώσεις θα εμφανίζονται εδώ.</span></div>`;
  return `<div class="ct-notification-center-list">${rows.map(n=>`
    <button class="ct-notification-item${n.read_at?'':' is-unread'}" type="button" data-notification-id="${escapeHtml(n.id)}" data-href="${escapeHtml(notificationHref(n))}">
      <span class="ct-notification-item__icon ct-notification-item__icon--${escapeHtml(n.severity||'info')}"><i data-lucide="${kindIcon(n.type)}"></i></span>
      <span class="ct-notification-item__content"><strong>${escapeHtml(n.title||'Ειδοποίηση')}</strong><span>${escapeHtml(n.body||'')}</span><small>${escapeHtml(fmtDate(n.created_at))}</small></span>
    </button>`).join('')}</div>`;
}
async function refreshCount(){
  const badge=document.getElementById('notifyCount');if(!badge)return;
  try{
    const count=await notificationService.unreadCount();
    badge.textContent=count>99?'99+':String(count);
    badge.classList.toggle('hidden',count===0);
  }catch{badge.classList.add('hidden');}
}
export async function openNotificationCenter(){
  const rows=await notificationService.listCurrent(50);
  await Swal.fire({
    title:'Ειδοποιήσεις',
    html:markup(rows),
    width:'min(620px,96vw)',
    showConfirmButton:false,
    showCloseButton:true,
    customClass:{htmlContainer:'ct-notification-center-modal'},
    didOpen:()=>{
      window.lucide?.createIcons();
      Swal.getPopup()?.querySelectorAll('[data-notification-id]').forEach(el=>el.addEventListener('click',async()=>{
        const id=el.dataset.notificationId;
        await notificationService.markRead(id,true).catch(()=>{});
        el.classList.remove('is-unread');
        await refreshCount();
        if(el.dataset.href){Swal.close();location.href=el.dataset.href;}
      }));
    }
  });
}
export function initNotificationCenter(){
  const btn=document.getElementById('notifyBtn');if(!btn)return;
  btn.addEventListener('click',()=>openNotificationCenter().catch(err=>Swal.fire('Σφάλμα',err.message||'Δεν ήταν δυνατή η φόρτωση ειδοποιήσεων.','error')));
  refreshCount();
  window.addEventListener('focus',refreshCount);
}
