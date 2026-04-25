import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, BarChart3, DollarSign, Users } from 'lucide-react';
import { Card } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { Employee } from '../../lib/employeeDatabase';

interface EmployeeStatsProps {
  profile: Employee;
  greeting: string;
  shiftsCount: number;
  scheduleCount: number;
  now?: Date;
}

export function EmployeeStats({
  profile,
  greeting,
  shiftsCount,
  scheduleCount,
  now,
}: EmployeeStatsProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        <Card padding="md">
          <h2 
            className="font-bold mb-3" 
            style={{ 
              color: 'var(--text)',
              fontSize: 'clamp(1.125rem, 4vw, 1.25rem)',
            }}
          >
            {greeting || 'Здравствуйте!'}
          </h2>
          {now && (
            <div className="text-center mt-4">
              <div 
                className="font-bold" 
                style={{ 
                  color: 'var(--primary)',
                  fontSize: 'clamp(2rem, 10vw, 2.5rem)',
                }}
              >
                {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div 
                className="mt-1" 
                style={{ 
                  color: 'var(--text-muted)',
                  fontSize: 'clamp(0.75rem, 3vw, 0.875rem)',
                }}
              >
                {format(now, 'dd MMMM yyyy, EEEE', { locale: ru })}
              </div>
            </div>
          )}
        </Card>
        
        <Card padding="md">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Мои смены</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{shiftsCount}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--success-light)' }}>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: 'var(--success)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>По графику</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--success)' }}>{scheduleCount}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--info-light)' }}>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: 'var(--info)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Ставка</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--info)' }}>{profile.base_hourly_rate || 250}₽/ч</span>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card padding="lg" className="lg:col-span-2 card-hover">
        <div className="flex items-start justify-between">
          <div>
            <h2 
              className="font-bold mb-2" 
              style={{ 
                color: 'var(--text)',
                fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
              }}
            >
              {greeting || `Здравствуйте, ${profile.full_name?.split(' ')[0]}!`}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>Возраст: {profile.age ?? 'Не указан'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                <span>Ставка: {profile.base_hourly_rate || 250}₽/ч</span>
              </div>
            </div>
          </div>
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: 'white',
            }}
          >
            {profile.full_name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </Card>

      <Card padding="md" className="card-hover">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Мои смены</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{shiftsCount}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--success-light)' }}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" style={{ color: 'var(--success)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>По графику</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{scheduleCount}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
