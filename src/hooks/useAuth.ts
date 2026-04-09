import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: number;
  full_name: string;
  auth_uid: string;
  access_level: number;
  age?: number | null;
  phone_number?: string | null;
  telegram?: string | null;
  vk?: string | null;
  max?: string | null;
  base_hourly_rate?: number | null;
  last_login?: string | null;
  created_at: string;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Получаем текущую сессию
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Подписываемся на изменения авторизации
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (authUid: string) => {
    try {
      console.log('[useAuth] Загрузка профиля для auth_uid:', authUid);

      // 1. Проверяем таблицу admins
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('id, full_name, auth_uid, access_level, created_at')
        .eq('auth_uid', authUid)
        .maybeSingle();

      if (adminError && adminError.code !== 'PGRST116') {
        console.error('[useAuth] Ошибка при проверке admins:', adminError);
      }

      if (adminData) {
        console.log('[useAuth] Найден администратор:', adminData.full_name);
        setProfile({
          ...adminData,
          age: null,
          phone_number: null,
          telegram: null,
          vk: null,
          max: null,
          base_hourly_rate: null,
          last_login: null,
        });
        setLoading(false);
        return;
      }

      // 2. Проверяем таблицу employees
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id, full_name, auth_uid, access_level, age, phone_number, telegram, vk, max, base_hourly_rate, last_login, created_at')
        .eq('auth_uid', authUid)
        .maybeSingle();

      if (employeeError && employeeError.code !== 'PGRST116') {
        console.error('[useAuth] Ошибка при проверке employees:', employeeError);
      }

      if (employeeData) {
        console.log('[useAuth] Найден сотрудник:', employeeData.full_name);
        setProfile(employeeData);
        setLoading(false);
        return;
      }

      // 3. Профиль не найден
      console.error('[useAuth] Профиль не найден ни в admins, ни в employees');
      setProfile(null);
      setLoading(false);
    } catch (error) {
      console.error('[useAuth] Критическая ошибка загрузки профиля:', error);
      setProfile(null);
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return {
    session,
    profile,
    loading,
    signOut,
    isAdmin: profile?.access_level ? profile.access_level <= 2 : false,
    isSuperAdmin: profile?.access_level === 1,
  };
}
