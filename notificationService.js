import { supabase } from './supabaseClient.js';

export const notificationService = {
  async listCurrent(limit=50){
    const res=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(limit);
    if(res.error) throw res.error;
    return res.data||[];
  },
  async unreadCount(){
    const res=await supabase.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null);
    if(res.error) throw res.error;
    return res.count||0;
  },
  async markRead(id,read=true){
    const res=await supabase.rpc('ct_mark_notification_read',{p_notification:id,p_read:read});
    if(res.error) throw res.error;
  },
  async preferences(organizationId){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return null;
    const res=await supabase.from('notification_preferences').select('*')
      .eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle();
    if(res.error) throw res.error;
    return res.data;
  },
  async savePreferences(organizationId,prefs){
    const res=await supabase.rpc('ct_update_notification_preferences',{
      p_organization:organizationId,
      p_in_app:!!prefs.in_app_enabled,
      p_email:!!prefs.email_enabled,
      p_expiry_in_app:!!prefs.expiry_in_app_enabled,
      p_expiry_email:!!prefs.expiry_email_enabled,
      p_warning_days:prefs.expiry_warning_days,
      p_relationship:!!prefs.relationship_notifications,
      p_certificate_change:!!prefs.certificate_change_notifications
    });
    if(res.error) throw res.error;
    return res.data;
  }
};
