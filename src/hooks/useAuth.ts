// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { dbService, Employee } from '../lib/DatabaseService';

export function useAuth() {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('park_staff_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      // Если пользователь есть, инициализируем базу его данными
      // dbService.initFromUser(parsedUser); 
    }
    setLoading(false);
  }, []);

  const login = async (loginStr: string, pass: string) => {
    const loggedUser = await dbService.login(loginStr, pass);
    if (loggedUser) {
      localStorage.setItem('park_staff_user', JSON.stringify(loggedUser));
      setUser(loggedUser);
      return true;
    }
    return false;
  };

  const signOut = () => {
    localStorage.removeItem('park_staff_user');
    setUser(null);
    window.location.reload();
  };

  return {
    user,
    profile: user,
    loading,
    login,
    signOut,
    isAdmin: user ? user.access_level <= 2 : false,
    isSuperAdmin: user ? user.access_level === 1 : false,
  };
}
