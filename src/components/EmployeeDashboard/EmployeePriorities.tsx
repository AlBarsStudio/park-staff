import { Award, Zap, TrendingUp } from 'lucide-react';
import { Card } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Priority {
  priority_level: number;
  attraction_ids: number[] | number | string[] | string | null;
}

interface Attraction {
  id: number;
  name: string;
}

interface EmployeePrioritiesProps {
  priorities: Priority[];
  attractions: Attraction[];
}

const LEVEL_CONFIG = {
  1: {
    label: 'Высокий',
    mobileLabel: '🏆 Высокий',
    bg: 'var(--success-light)',
    text: 'var(--success)',
    icon: Zap,
  },
  2: {
    label: 'Средний',
    mobileLabel: '⚡ Средний',
    bg: 'var(--warning-light)',
    text: 'var(--warning)',
    icon: TrendingUp,
  },
  3: {
    label: 'Низкий',
    mobileLabel: '📊 Низкий',
    bg: 'var(--info-light)',
    text: 'var(--info)',
    icon: Award,
  },
} as const;

export function EmployeePriorities({
  priorities,
  attractions,
}: EmployeePrioritiesProps) {
  const isMobile = useIsMobile();

  const getAttractionNames = (priority: Priority | undefined): string => {
    if (!priority) return 'Не задан';

    const ids = Array.isArray(priority.attraction_ids)
      ? priority.attraction_ids
      : priority.attraction_ids
        ? [priority.attraction_ids]
        : [];

    if (ids.length === 0) return 'Не задан';

    return ids
      .map(id => {
        const numId = typeof id === 'string' ? parseInt(id, 10) : (id as number);
        return attractions.find(a => a.id === numId)?.name || 'Неизвестный';
      })
      .join(', ');
  };

  if (isMobile) {
    return (
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Award className="h-5 w-5" style={{ color: 'var(--warning)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Приоритеты
          </h3>
        </div>
        <div className="space-y-2">
          {([1, 2, 3] as const).map(level => {
            const priority = priorities.find(p => p.priority_level === level);
            const config = LEVEL_CONFIG[level];
            const names = getAttractionNames(priority);
            const truncated =
              names.length > 30 ? names.slice(0, 30) + '...' : names;

            return (
              <div
                key={level}
                className="p-2 rounded-lg"
                style={{ backgroundColor: config.bg }}
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: config.text }}
                >
                  {config.mobileLabel}
                </span>
                <p className="text-xs mt-1" style={{ color: 'var(--text)' }}>
                  {truncated}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-4">
        <Award className="h-5 w-5" style={{ color: 'var(--warning)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
          Приоритеты
        </h3>
      </div>
      <div className="space-y-3">
        {([1, 2, 3] as const).map(level => {
          const priority = priorities.find(p => p.priority_level === level);
          const config = LEVEL_CONFIG[level];
          const Icon = config.icon;
          const names = getAttractionNames(priority);

          return (
            <div
              key={level}
              className="p-3 rounded-lg"
              style={{ backgroundColor: config.bg }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4" style={{ color: config.text }} />
                <span
                  className="text-xs font-semibold"
                  style={{ color: config.text }}
                >
                  {config.label}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {names}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
