import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const legacyServiceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const namedSecretKeys=Deno.env.get('SUPABASE_SECRET_KEYS');
const SERVICE_ROLE=legacyServiceRole || (()=>{try{return JSON.parse(namedSecretKeys||'{}')?.default||'';}catch{return '';}})();
const CRON_SECRET=Deno.env.get('CRON_SECRET') || '';
const SMTP_HOST=Deno.env.get('SMTP_HOST') || '';
const SMTP_PORT=Number(Deno.env.get('SMTP_PORT') || '587');
const SMTP_SECURE=Deno.env.get('SMTP_SECURE') === 'true';
const SMTP_USER=Deno.env.get('SMTP_USER') || '';
const SMTP_PASSWORD=Deno.env.get('SMTP_PASSWORD') || '';
const EMAIL_FROM=Deno.env.get('EMAIL_FROM') || 'noreply@certitrack.gr';
const EMAIL_FROM_NAME=Deno.env.get('EMAIL_FROM_NAME') || 'CertiTrack';
const APP_URL=Deno.env.get('APP_URL') || 'https://www.certitrack.gr';

const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));


function emailShell({eyebrow,title,body,buttonLabel,buttonHref}:{
  eyebrow:string; title:string; body:string; buttonLabel:string; buttonHref:string;
}){
  return `<!doctype html>
<html lang="el">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#12213a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e4eaf3;border-radius:18px;overflow:hidden;">
        <tr><td style="padding:26px 32px 14px;">
          <div style="font-size:20px;font-weight:800;color:#17315f;">Certi<span style="color:#315efb;">Track</span></div>
        </td></tr>
        <tr><td style="padding:8px 32px 32px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#74829a;text-transform:uppercase;margin-bottom:12px;">${esc(eyebrow)}</div>
          <h1 style="font-size:25px;line-height:1.25;margin:0 0 16px;color:#0d1b31;">${esc(title)}</h1>
          <div style="font-size:16px;line-height:1.65;color:#4b5b73;">${body}</div>
          <div style="margin-top:28px;">
            <a href="${esc(buttonHref)}" style="display:inline-block;background:#315efb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:10px;">${esc(buttonLabel)}</a>
          </div>
        </td></tr>
        <tr><td style="border-top:1px solid #edf1f6;padding:18px 32px;font-size:12px;line-height:1.5;color:#8a96a8;">
          Αυτό είναι αυτοματοποιημένο μήνυμα του CertiTrack. Αν δεν αναγνωρίζετε την ενέργεια, μπορείτε να αγνοήσετε το μήνυμα.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function template(row:any){
  const p=row.payload||{};
  const title=String(p.certificate_title||'Πιστοποιητικό');
  const expiry=p.expiry_date?new Date(`${p.expiry_date}T00:00:00`).toLocaleDateString('el-GR'):'';

  if(row.template_key==='relationship_invite'){
    const requester=String(p.requester_name||'Ένας οργανισμός');
    const isRegistrationInvite=!p.relationship_id;
    const href=isRegistrationInvite
      ? `${APP_URL}/pages/auth/register.html?invite=${encodeURIComponent(String(p.invitation_id||''))}`
      : `${APP_URL}/pages/organization/partners.html`;

    return {
      subject:isRegistrationInvite
        ? 'CertiTrack — Πρόσκληση εγγραφής και συνεργασίας'
        : 'CertiTrack — Νέο αίτημα συνεργασίας',
      text:isRegistrationInvite
        ? `${requester} σας προσκαλεί να εγγραφείτε στο CertiTrack και να συνδεθείτε ως συνεργάτες.\n\nΕγγραφή: ${href}`
        : `${requester} σας προσκαλεί σε συνεργασία στο CertiTrack.\n\nΠροβολή αιτήματος: ${href}`,
      html:emailShell({
        eyebrow:isRegistrationInvite?'Πρόσκληση εγγραφής':'Νέο αίτημα συνεργασίας',
        title:isRegistrationInvite
          ? `${requester} σας προσκαλεί στο CertiTrack`
          : `${requester} σας προσκαλεί σε συνεργασία`,
        body:isRegistrationInvite
          ? `Ο οργανισμός <strong style="color:#12213a;">${esc(requester)}</strong> θέλει να συνεργαστεί μαζί σας μέσω του CertiTrack. Δημιουργήστε λογαριασμό οργανισμού για να συνεχίσετε.`
          : `Ο οργανισμός <strong style="color:#12213a;">${esc(requester)}</strong> θέλει να συνδεθεί μαζί σας στο CertiTrack. Ανοίξτε το αίτημα για να το αποδεχθείτε ή να το απορρίψετε.`,
        buttonLabel:isRegistrationInvite?'Εγγραφή στο CertiTrack':'Προβολή αιτήματος',
        buttonHref:href
      })
    };
  }

  if(row.template_key==='relationship_accepted'){
    const partner=String(p.partner_name||'Ο συνεργαζόμενος οργανισμός');
    const href=`${APP_URL}/pages/organization/partners.html`;
    return {
      subject:'CertiTrack — Η συνεργασία έγινε αποδεκτή',
      text:`${partner} αποδέχθηκε το αίτημα συνεργασίας σας.\n\nΠροβολή συνεργατών: ${href}`,
      html:emailShell({
        eyebrow:'Ενημέρωση συνεργασίας',
        title:'Η συνεργασία ενεργοποιήθηκε',
        body:`Ο οργανισμός <strong style="color:#12213a;">${esc(partner)}</strong> αποδέχθηκε το αίτημα συνεργασίας σας.`,
        buttonLabel:'Προβολή συνεργατών',
        buttonHref:href
      })
    };
  }

  if(row.template_key==='relationship_declined'){
    const partner=String(p.partner_name||'Ο οργανισμός');
    const href=`${APP_URL}/pages/organization/partners.html`;
    return {
      subject:'CertiTrack — Το αίτημα συνεργασίας απορρίφθηκε',
      text:`${partner} απέρριψε το αίτημα συνεργασίας σας.\n\nΠροβολή συνεργατών: ${href}`,
      html:emailShell({
        eyebrow:'Ενημέρωση συνεργασίας',
        title:'Το αίτημα συνεργασίας απορρίφθηκε',
        body:`Ο οργανισμός <strong style="color:#12213a;">${esc(partner)}</strong> απέρριψε το αίτημα συνεργασίας σας.`,
        buttonLabel:'Προβολή συνεργατών',
        buttonHref:href
      })
    };
  }

  if(row.template_key==='certificate_expired'){
    const href=`${APP_URL}/pages/organization/certificates.html`;
    return {
      subject:row.subject,
      text:`Το πιστοποιητικό ${title} έχει λήξει${expiry?` στις ${expiry}`:''}.\n\nΆνοιγμα CertiTrack: ${href}`,
      html:emailShell({
        eyebrow:'Ειδοποίηση πιστοποιητικού',
        title:'Ληγμένο πιστοποιητικό',
        body:`Το πιστοποιητικό <strong style="color:#12213a;">${esc(title)}</strong> έχει λήξει${expiry?` στις ${esc(expiry)}`:''}.`,
        buttonLabel:'Προβολή πιστοποιητικών',
        buttonHref:href
      })
    };
  }

  if(row.template_key==='certificate_expiry'){
    const days=Number(p.warning_days);
    const phrase=days===0?'λήγει σήμερα':`λήγει σε ${days} ημέρες`;
    const href=`${APP_URL}/pages/organization/certificates.html`;
    return {
      subject:row.subject,
      text:`Το πιστοποιητικό ${title} ${phrase}${expiry?` (${expiry})`:''}.\n\nΆνοιγμα CertiTrack: ${href}`,
      html:emailShell({
        eyebrow:'Ειδοποίηση πιστοποιητικού',
        title:'Πιστοποιητικό προς λήξη',
        body:`Το πιστοποιητικό <strong style="color:#12213a;">${esc(title)}</strong> ${esc(phrase)}${expiry?` (${esc(expiry)})`:''}.`,
        buttonLabel:'Προβολή πιστοποιητικών',
        buttonHref:href
      })
    };
  }

  const href=APP_URL;
  return {
    subject:row.subject,
    text:`${row.subject}\n\n${href}`,
    html:emailShell({
      eyebrow:'CertiTrack',
      title:String(row.subject||'Ενημέρωση'),
      body:'Υπάρχει νέα ενημέρωση στον λογαριασμό σας.',
      buttonLabel:'Άνοιγμα CertiTrack',
      buttonHref:href
    })
  };
}

let smtpClient: SMTPClient | null = null;
function getSmtpClient(): SMTPClient | null {
  if (smtpClient) return smtpClient;
  if (!SMTP_HOST) return null;
  smtpClient = new SMTPClient({
    debug: { encodeLB: true },
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_SECURE,
      auth: { username: SMTP_USER, password: SMTP_PASSWORD }
    }
  });
  return smtpClient;
}

async function sendViaSmtp(row:any){
  const client=getSmtpClient();
  if(!client) throw new Error('SMTP_HOST is not configured');
  const t=template(row);
  await client.send({
    from:`${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
    to:row.recipient_email,
    subject:t.subject,
    content:t.text,
    html:t.html,
    headers:{
      'MIME-Version':'1.0',
      'X-Mailer':'CertiTrack Notifications'
    }
  });
  return null; // denomailer doesn't return a provider message id
}

Deno.serve(async req=>{
  if(req.method!=='POST') return new Response('Method Not Allowed',{status:405});
  if(!CRON_SECRET || req.headers.get('x-cron-secret')!==CRON_SECRET) return new Response('Unauthorized',{status:401});

  if(!SUPABASE_URL || !SERVICE_ROLE) return Response.json({ok:false,error:'Supabase server credentials are unavailable'},{status:500});
  const sb=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
  // Expiry generation is optional in this worker. Collaboration email delivery must not
  // fail when the expiry-notification RPC is not installed yet.
  let generated:any=null;
  try{
    const result=await sb.rpc('ct_generate_expiry_notifications');
    if(!result.error) generated=result.data;
    else console.warn('Expiry notification generation skipped:',result.error.message);
  }catch(error){
    console.warn('Expiry notification generation skipped:',error);
  }

  const worker=crypto.randomUUID();
  const {data:batch,error:claimError}=await sb.rpc('ct_claim_email_batch',{p_worker:worker,p_limit:50});
  if(claimError) return Response.json({ok:false,stage:'claim',error:claimError.message},{status:500});

  let sent=0,failed=0;
  for(const row of batch||[]){
    try{
      const providerId=await sendViaSmtp(row);
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
  if(smtpClient){ try{ await smtpClient.close(); }catch{ /* best-effort */ } }
  return Response.json({ok:true,generated:generated?.[0]||generated||null,claimed:(batch||[]).length,sent,failed});
});
