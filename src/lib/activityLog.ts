import { supabase } from './supabase';

export type UserType = 'employee' | 'admin' | 'superadmin';
export type ActionType =
  | 'shift_add'
  | 'shift_delete'
  | 'shift_update'
  | 'schedule_generate'
  | 'schedule_save'
  | 'login'
  | 'logout';

export async function logActivity(
  userType: UserType,
  userId: number,
  actionType: ActionType,
  description: string
): Promise<void> {
  try {
    await supabase.from('activity_log').insert([
      {
        user_type: userType,
        user_id: userId,
        action_type: actionType,
        description,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}
