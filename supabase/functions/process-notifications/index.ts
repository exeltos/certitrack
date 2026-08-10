import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const legacyServiceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const namedSecretKeys=Deno.env.get('SUPABASE_SECRET_KEYS');
const SERVICE_ROLE=legacyServiceRole || (()=>{try{return JSON.parse(namedSecretKeys||'{}')?.default||'';}catch{return '';}})();
const CRON_SECRET=Deno.env.get('CRON_SECRET') || '';
const MAILERSEND_TOKEN=Deno.env.get('MAILERSEND_TOKEN') || '';
const EMAIL_FROM=Deno.env.get('EMAIL_FROM') || 'noreply@certitrack.gr';
const APP_URL=Deno.env.get('APP_URL') || 'https://www.certitrack.gr';

const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));

function template(row:any){
  const p=row.payload||{};
  const title=esc(p.certificate_title||'Πιστοποιητικό');
  const expiry=p.expiry_date?new Date(`${p.expiry_date}T00:00:00`).toLocaleDateString('el-GR'):'';
  if(row.template_key==='certificate_expired'){
    return {
      subject:row.subject,
      html:`<h2>Ληγμένο πιστοποιητικό</h2><p>Το πιστοποιητικό <strong>${title}</strong> έχει λήξει${expiry?` στις ${esc(expiry)}`:''}.</p><p><a href="${esc(APP_URL)}/pages/organization/certificates.html">Άνοιγμα CertiTrack</a></p>`
    };
  }
  if(row.template_key==='certificate_expiry'){
    const days=Number(p.warning_days);
    const phrase=days===0?'λήγει σήμερα':`λήγει σε ${days} ημέρες`;
    return {
      subject:row.subject,
      html:`<h2>Πιστοποιητικό προς λήξη</h2><p>Το πιστοποιητικό <strong>${title}</strong> ${phrase}${expiry?` (${esc(expiry)})`:''}.</p><p><a href="${esc(APP_URL)}/pages/organization/certificates.html">Άνοιγμα CertiTrack</a></p>`
    };
  }
  if(row.template_key==='relationship_invite'){
    return {
      subject:row.subject,
      html:`<h2>Πρόσκληση συνεργασίας</h2><p>Ο οργανισμός <strong>${esc(p.requester_name||'')}</strong> σας προσκαλεί να συνδεθείτε στο CertiTrack.</p><p><a href="${esc(APP_URL)}/pages/organization/partners.html">Άνοιγμα CertiTrack</a></p>`
    };
  }
  if(row.template_key==='relationship_accepted'){
    return {
      subject:row.subject,
      html:`<h2>Η συνεργασία ενεργοποιήθηκε</h2><p>Ο οργανισμός <strong>${esc(p.partner_name||'')}</strong> αποδέχθηκε το αίτημα συνεργασίας.</p><p><a href="${esc(APP_URL)}/pages/organization/partners.html">Προβολή συνεργατών</a></p>`
    };
  }
  if(row.template_key==='relationship_declined'){
    return {
      subject:row.subject,
      html:`<h2>Το αίτημα συνεργασίας απορρίφθηκε</h2><p>Ο οργανισμός <strong>${esc(p.partner_name||'')}</strong> απέρριψε το αίτημα συνεργασίας.</p><p><a href="${esc(APP_URL)}/pages/organization/partners.html">Προβολή συνεργατών</a></p>`
    };
  }
  return {subject:row.subject,html:`<p>${esc(row.subject)}</p><p><a href="${esc(APP_URL)}">Άνοιγμα CertiTrack</a></p>`};
}

async function sendMailerSend(row:any){
  if(!MAILERSEND_TOKEN) throw new Error('MAILERSEND_TOKEN is not configured');
  const t=template(row);
  const response=await fetch('https://api.mailersend.com/v1/email',{
    method:'POST',
    headers:{Authorization:`Bearer ${MAILERSEND_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:{email:EMAIL_FROM,name:'CertiTrack'},
      to:[{email:row.recipient_email}],
      subject:t.subject,
      html:t.html
    })
  });
  if(!response.ok) throw new Error(`MailerSend ${response.status}: ${await response.text()}`);
  return response.headers.get('x-message-id')||response.headers.get('X-Message-Id')||null;
}

Deno.serve(async req=>{
  if(req.method!=='POST') return new Response('Method Not Allowed',{status:405});
  if(!CRON_SECRET || req.headers.get('x-cron-secret')!==CRON_SECRET) return new Response('Unauthorized',{status:401});

  if(!SUPABASE_URL || !SERVICE_ROLE) return Response.json({ok:false,error:'Supabase server credentials are unavailable'},{status:500});
  const sb=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:generated,error:genError}=await sb.rpc('ct_generate_expiry_notifications');
  if(genError) return Response.json({ok:false,stage:'generate',error:genError.message},{status:500});

  const worker=crypto.randomUUID();
  const {data:batch,error:claimError}=await sb.rpc('ct_claim_email_batch',{p_worker:worker,p_limit:50});
  if(claimError) return Response.json({ok:false,stage:'claim',error:claimError.message},{status:500});

  let sent=0,failed=0;
  for(const row of batch||[]){
    try{
      const providerId=await sendMailerSend(row);
      const {error}=await sb.rpc('ct_complete_email',{p_id:row.id,p_success:true,p_provider_message_id:providerId,p_error:null});
      if(error) throw error;
      sent++;
    }catch(error){
      failed++;
      await sb.rpc('ct_complete_email',{
        p_id:row.id,p_success:false,p_provider_message_id:null,
        p_error:error instanceof Error?error.message:String(error)
      });
    }
  }
  return Response.json({ok:true,generated:generated?.[0]||generated||null,claimed:(batch||[]).length,sent,failed});
});
