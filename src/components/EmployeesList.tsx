import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../types';
import { Plus, Trash2, Loader2, X, AlertCircle, UserPlus, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Card, Button, Modal, Badge } from './ui';

interface EmployeesListProps {
  employees: Employee[];
  isSuperAdmin?: boolean;
  currentUserId?: number;
  onEmployeeUpdate?: () => void;
}

export function EmployeesList({ employees: propEmployees, isSuperAdmin = false, currentUserId, onEmployeeUpdate }: EmployeesListProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    phone_number: '',
    telegram: '',
    vk: '',
    email: '',
    password: '',
    access_level: '3',
  });

  useEffect(() => {
    if (propEmployees && propEmployees.length > 0) {
      setEmployees(propEmployees);
      setLoading(false);
    } else {
      fetchEmployees();
    }
  }, [propEmployees]);

  const fetchEmployees = async () => {
    setLoading(true);
    
    let query = supabase
      .from('employees')
      .select('id, full_name, age, phone_number, telegram, vk, access_level, auth_uid, last_login')
      .order('full_name', { ascending: true });

    if (!isSuperAdmin && currentUserId) {
      query = query.eq('id', currentUserId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Ошибка загрузки:', error);
      setEmployees([]);
    } else {
      setEmployees(data || []);
    }
    
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!isSuperAdmin) {
      alert('Недостаточно прав');
      return;
    }
    
    if (!confirm('Удалить сотрудника?')) return;

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    
    if (error) {
      alert('Ошибка: ' + error.message);
    } else {
      fetchEmployees();
      onEmployeeUpdate?.();
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSuperAdmin) {
      setFormError('Недостаточно прав');
      return;
    }
    
    setFormError('');
    setIsSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });
      
      if (authError) {
        setFormError(authError.message);
        setIsSubmitting(false);
        return;
      }
      
      const user = authData.user;
      if (!user) {
        setFormError('Не удалось создать пользователя');
        setIsSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase.from('employees').insert({
        full_name: formData.full_name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        phone_number: formData.phone_number.trim() || null,
        telegram: formData.telegram.trim() || null,
        vk: formData.vk.trim() || null,
        auth_uid: user.id,
        access_level: parseInt(formData.access_level),
      });
      
      if (insertError) {
        setFormError(insertError.message);
        setIsSubmitting(false);
        return;
      }

      setShowAddForm(false);
      setFormData({
        full_name: '',
        age: '',
        phone_number: '',
        telegram: '',
        vk: '',
        email: '',
        password: '',
        access_level: '3',
      });
      fetchEmployees();
      onEmployeeUpdate?.();
      
    } catch (err) {
      console.error('Ошибка:', err);
      setFormError('Произошла ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccessLevelBadge = (level: number) => {
    switch (level) {
      case 1:
        return { text: 'Супер-админ', variant: 'error' as const };
      case 2:
        return { text: 'Администратор', variant: 'warning' as const };
      case 3:
        return { text: 'Сотрудник', variant: 'info' as const };
      default:
        return { text: 'Не определен', variant: 'neutral' as const };
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 mx-auto mb-3" style={{ color: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Загрузка сотрудников...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin && employees.length === 0) {
    return (
      <Card padding="lg" className="text-center">
        <div className="p-3 rounded-lg inline-flex mx-auto mb-4" style={{ backgroundColor: 'var(--warning-light)' }}>
          <AlertCircle className="h-12 w-12" style={{ color: 'var(--warning)' }} />
        </div>
        <h3 className="font-semibold mb-1" style={{ color: 'var(--text)' }}>
          Нет данных о профиле
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Обратитесь к администратору
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Сотрудники
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            
