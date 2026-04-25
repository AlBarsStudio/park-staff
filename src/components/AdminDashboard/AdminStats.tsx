import { useMemo } from 'react';
import { Users, Gamepad2, Calendar, LayoutGrid } from 'lucide-react';
import { Employee, Attraction, EmployeeAvailability, ScheduleAssignment } from '../../lib/DatabaseService';
import { Card } from '../ui';

interface AdminStatsProps {
  employees: Employee[];
  attractions: Attraction[];
  shifts: EmployeeAvailability[];
  scheduleAssignments: ScheduleAssignment[];
}

export function AdminStats({
  employees,
  attractions,
  shifts,
  scheduleAssignments,
}: AdminStatsProps) {
  // ============================================================
  // Вычисление статистики
  // ============================================================
  const stats = useMemo(() => {
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    const monthShifts = shifts.filter((s) => {
      const date = new Date(s.work_date);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    });

    const monthSchedule = scheduleAssignments.filter((s) => {
      const date = new Date(s.work_date);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    });

    return {
      totalEmployees: employees.length,
      activeAttractions: attractions.length,
      shiftsThisMonth: monthShifts.length,
      scheduleThisMonth: monthSchedule.length,
    };
  }, [employees, attractions, shifts, scheduleAssignments]);

  // ============================================================
  // Конфигурация карточек
  // ============================================================
  const cards = [
    {
      icon: Users,
      label: 'Всего сотрудников',
      value: stats.totalEmployees,
      color: 'primary',
    },
    {
      icon: Gamepad2,
      label: 'Активных аттракционов',
      value: stats.activeAttractions,
      color: 'warning',
    },
    {
      icon: Calendar,
      label: 'Смен в этом месяце',
      value: stats.shiftsThisMonth,
      color: 'success',
    },
    {
      icon: LayoutGrid,
      label: 'Назначений в графике',
      value: stats.scheduleThisMonth,
      color: 'info',
    },
  ];

  // ============================================================
  // Рендер
  // ============================================================
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <Card key={index} padding="md" variant="hover">
            <div className="flex items-center gap-3">
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: `var(--${card.color}-light)` }}
              >
                <Icon className="h-6 w-6" style={{ color: `var(--${card.color})` }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {card.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                  {card.value}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
