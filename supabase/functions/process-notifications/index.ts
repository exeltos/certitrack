import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

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

// Where each email's button leads, and its small heading. Title and body come
// from the database (ct_notify_org stores them in the payload), so emails and
// in-app notifications always say the same thing.
const ROUTES:Record<string,{path:string;eyebrow:string;button:string}>={
  connection_request:{path:'/pages/organization/partners.html',eyebrow:'Συνδέσεις',button:'Προβολή αιτήματος'},
  connection_accepted:{path:'/pages/organization/partners.html',eyebrow:'Συνδέσεις',button:'Προβολή συνδέσεων'},
  document_request:{path:'/pages/organization/requests.html?tab=incoming',eyebrow:'Αίτημα εγγράφου',button:'Απάντηση στο αίτημα'},
  document_request_fulfilled:{path:'/pages/organization/requests.html?tab=outgoing',eyebrow:'Αίτημα εγγράφου',button:'Προβολή'},
  partner_certificate_expiring:{path:'/pages/organization/requests.html?tab=outgoing',eyebrow:'Έγγραφα συνεργατών',button:'Προβολή'},
  partner_certificate_expired:{path:'/pages/organization/requests.html?tab=outgoing',eyebrow:'Έγγραφα συνεργατών',button:'Προβολή'},
  partner_certificate_renewed:{path:'/pages/organization/requests.html?tab=outgoing',eyebrow:'Έγγραφα συνεργατών',button:'Προβολή'},
  certificate_expiry:{path:'/pages/organization/certificates.html',eyebrow:'Τα πιστοποιητικά σας',button:'Προβολή πιστοποιητικών'},
  certificate_expired:{path:'/pages/organization/certificates.html',eyebrow:'Τα πιστοποιητικά σας',button:'Προβολή πιστοποιητικών'}
};

function template(row:any){
  const p=row.payload||{};

  // Invitation to an organization that is not registered yet.
  if(row.template_key==='connection_invitation'){
    const inviter=String(p.partner_name||'Ένας οργανισμός');
    const href=`${APP_URL}/pages/auth/register.html`;
    return {
      subject:row.subject,
      text:`${inviter} σας προσκαλεί να συνδεθείτε στο CertiTrack για να ανταλλάσσετε πιστοποιητικά.\n\nΕγγραφή: ${href}\n\nΚάντε εγγραφή με αυτό το email και θα δείτε αμέσως το αίτημα σύνδεσης.`,
      html:emailShell({
        eyebrow:'Πρόσκληση',
        title:`${inviter} σας προσκαλεί στο CertiTrack`,
        body:`Ο οργανισμός <strong style="color:#12213a;">${esc(inviter)}</strong> θέλει να συνδεθεί μαζί σας για να ανταλλάσσετε πιστοποιητικά. Ο καθένας βλέπει μόνο ό,τι επιλέγει να δείξει ο άλλος.<br><br>Κάντε εγγραφή με <strong>αυτό το email</strong> και θα δείτε αμέσως το αίτημα.`,
        buttonLabel:'Εγγραφή στο CertiTrack',
        buttonHref:href
      })
    };
  }

  // "Request a presentation" from the home page, sent to the platform owner.
  // Replying to the email answers the person who asked (see replyTo below).
  if(row.template_key==='presentation_request'){
    const line=(label:string,value:unknown)=>value?`<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 0;color:#12213a;">${esc(String(value)).replace(/\n/g,'<br>')}</td></tr>`:'';
    const href=`${APP_URL}/pages/admin/presentations.html`;
    const fields:[string,unknown][]=[['Όνομα',p.name],['Εταιρεία',p.company],['Email',p.email],['Τηλέφωνο',p.phone],['Μήνυμα',p.message]];
    return {
      subject:row.subject,
      replyTo:typeof p.email==='string'?p.email:undefined,
      text:`Νέο αίτημα παρουσίασης από την αρχική σελίδα.\n\n${fields.filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nΑπαντήστε σε αυτό το email για να γράψετε απευθείας στον ενδιαφερόμενο.\n\nΌλα τα αιτήματα: ${href}`,
      html:emailShell({
        eyebrow:'Αίτημα παρουσίασης',
        title:`${String(p.company||'Νέο αίτημα')} ζητά παρουσίαση`,
        body:`<table role="presentation" style="border-collapse:collapse;font-size:14px;">${fields.map(([k,v])=>line(k,v)).join('')}</table><br>Απαντήστε σε αυτό το email για να γράψετε απευθείας στον ενδιαφερόμενο.`,
        buttonLabel:'Όλα τα αιτήματα',
        buttonHref:href
      })
    };
  }

  const route=ROUTES[row.template_key]||{path:'/pages/organization/dashboard.html',eyebrow:'CertiTrack',button:'Άνοιγμα CertiTrack'};
  const href=`${APP_URL}${route.path}`;
  const title=String(p.title||row.subject||'Ενημέρωση');
  const body=String(p.body||'Υπάρχει νέα ενημέρωση στον λογαριασμό σας.');
  return {
    subject:row.subject,
    text:`${title}\n\n${body}\n\n${href}`,
    html:emailShell({eyebrow:route.eyebrow,title,body:esc(body),buttonLabel:route.button,buttonHref:href})
  };
}

let transporter:any=null;

function getTransporter(){
  if(transporter)return transporter;
  if(!SMTP_HOST)throw new Error('SMTP_HOST is not configured');

  transporter=nodemailer.createTransport({
    host:SMTP_HOST,
    port:SMTP_PORT,
    secure:SMTP_SECURE,
    requireTLS:!SMTP_SECURE,
    auth:{
      user:SMTP_USER,
      pass:SMTP_PASSWORD
    }
  });
  return transporter;
}

async function sendViaSmtp(row:any){
  const mailer=getTransporter();
  const t=template(row);

  const info=await mailer.sendMail({
    from:{
      name:EMAIL_FROM_NAME,
      address:EMAIL_FROM
    },
    to:row.recipient_email,
    ...('replyTo' in t && t.replyTo ? {replyTo:t.replyTo} : {}),
    subject:t.subject,
    text:t.text,
    html:t.html
  });

  return info?.messageId||null;
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
  return Response.json({ok:true,generated:generated?.[0]||generated||null,claimed:(batch||[]).length,sent,failed});
});
