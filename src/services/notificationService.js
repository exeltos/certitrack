import { supabase } from './supabaseClient.js';

export const notificationService = {
  async listCurrent(limit=50){
    const res=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(limit);
    if(res.error) throw res.error; return res.data||[];
  },
  async listUnread(limit=50){
    const res=await supabase.from('notifications')
      .select('*')
      .is('read_at',null)
      .order('created_at',{ascending:false})
      .limit(limit);
    if(res.error) throw res.error; return res.data||[];
  },
  async unreadCount(){
    const res=await supabase.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null);
    if(res.error) throw res.error; return res.count||0;
  },
  async markRead(id,read=true){
    const res=await supabase.rpc('ct_set_notification_read',{p_notification:id,p_read:!!read});
    if(res.error) throw res.error; return res.data;
  },
  async markManyRead(ids=[]){
    const clean=[...new Set((ids||[]).filter(Boolean))];
    if(!clean.length)return;
    const res=await supabase.rpc('ct_mark_notifications_read',{p_notifications:clean});
    if(res.error) throw res.error; return res.data;
  },
  async preferences(organizationId){
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return null;
    const res=await supabase.from('notification_preferences').select('*').eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle();
    if(res.error) throw res.error; return res.data;
  },
  async savePreferences(organizationId,prefs){
    const {data:{user}}=await supabase.auth.getUser(); if(!user)throw new Error('Δεν υπάρχει ενεργός χρήστης.');
    // Was sending "expiry_notifications" (no such column) and "warning_days"
    // (real column: expiry_warning_days) -- every save failed. Fixed 2026-08-24.
    const payload={
      in_app_enabled:!!prefs.in_app_enabled,
      email_enabled:!!prefs.email_enabled,
      relationship_notifications:!!prefs.relationship_notifications,
      certificate_change_notifications:!!prefs.certificate_change_notifications,
      expiry_warning_days:prefs.expiry_warning_days
    };
    const res=await supabase.from('notification_preferences').update(payload).eq('organization_id',organizationId).eq('user_id',user.id).select('*').single();
    if(res.error) throw res.error; return res.data;
  }
};
