import { Users, Gamepad2, Calendar, LayoutGrid } from 'lucide-react';
import { Card } from '../ui';

interface AdminStatsProps {
  stats: {
    totalEmployees: number;
    activeAttractions: number;
    shiftsThisMonth: number;
    scheduleThisMonth: number;
  };
}

export function AdminStats({ stats }: AdminStatsProps) {
  const items = [
    {
      icon: Users,
      label: 'Всего сотрудников',
      value: stats.totalEmployees,
      bgColor: 'var(--primary-light)',
      iconColor: 'var(--primary)',
    },
    {
      icon: Gamepad2,
      label: 'Активных аттракционов',
      value: stats.activeAttractions,
      bgColor: 'var(--warning-light)',
      iconColor: 'var(--warning)',
    },
    {
      icon: Calendar,
      label: 'Смен в этом месяце',
      value: stats.shiftsThisMonth,
      bgColor: 'var(--success-light)',
      iconColor: 'var(--success)',
    },
    {
      icon: LayoutGrid,
      label: 'Назначений в графике',
      value: stats.scheduleThisMonth,
      bgColor: 'var(--info-light)',
      iconColor: 'var(--info)',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(({ icon: Icon, label, value, bgColor, iconColor }) => (
        <Card key={label} padding="md" variant="hover">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: bgColor }}>
              <Icon className="h-6 w-6" style={{ color: iconColor }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {label}
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {value}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
