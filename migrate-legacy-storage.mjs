import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

function objectPath(ref,bucket){
  if(!ref)return'';
  const value=String(ref);
  if(!/^https?:\/\//i.test(value))return value.replace(/^\/+/,'');
  try{
    const u=new URL(value);
    for(const marker of [`/storage/v1/object/public/${bucket}/`,`/storage/v1/object/sign/${bucket}/`,`/storage/v1/object/${bucket}/`]){
      const i=u.pathname.indexOf(marker);
      if(i>=0)return decodeURIComponent(u.pathname.slice(i+marker.length));
    }
  }catch{}
  return value.split('/').filter(Boolean).slice(-2).join('/');
}
function fileName(path){return path.split('/').pop()||'certificate.pdf';}

const {data:rows,error}=await sb.from('certificates')
  .select('id,organization_id,current_file_id,legacy_storage_bucket,legacy_storage_ref')
  .is('current_file_id',null).not('legacy_storage_ref','is',null);
if(error)throw error;

let copied=0,skipped=0,failed=0;
for(const c of rows||[]){
  const bucket=c.legacy_storage_bucket;
  const oldPath=objectPath(c.legacy_storage_ref,bucket);
  if(!bucket||!oldPath){skipped++;continue;}
  try{
    const {data:blob,error:downloadError}=await sb.storage.from(bucket).download(oldPath);
    if(downloadError)throw downloadError;
    const bytes=new Uint8Array(await blob.arrayBuffer());
    const newPath=`${c.organization_id}/${c.id}/${crypto.randomUUID()}.pdf`;
    const {error:uploadError}=await sb.storage.from('organizationcertificates')
      .upload(newPath,bytes,{contentType:'application/pdf',upsert:false});
    if(uploadError)throw uploadError;

    const {error:registerError}=await sb.rpc('ct_migrate_legacy_certificate_file',{
      p_certificate:c.id,p_storage_path:newPath,p_original_file_name:fileName(oldPath),p_file_size_bytes:bytes.byteLength
    });
    if(registerError)throw registerError;
    copied++;
    console.log(`COPIED ${c.id} -> ${newPath}`);
  }catch(err){
    failed++;
    console.error(`FAILED ${c.id}:`,err.message||err);
  }
}
console.log(JSON.stringify({total:(rows||[]).length,copied,skipped,failed},null,2));
if(failed)process.exitCode=2;
