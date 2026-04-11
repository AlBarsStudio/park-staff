import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, subMonths, addMonths, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Save, Loader2, Calendar } from 'lucide-react';
import { ScheduleAssignment, Attraction, Employee } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { cn } from '../utils/cn';

interface ScheduleViewBlockProps {
  scheduleAssignments: ScheduleAssignment[];
  attractions: Attraction[];
  employees: Employee[];
  scheduleViewMonth: Date;
  setScheduleViewMonth: (date: Date) => void;
}

export function ScheduleViewBlock({
  scheduleAssignments,
  attractions,
  employees,
  scheduleViewMonth,
  setScheduleViewMonth
}: ScheduleViewBlockProps) {
  // Режимы отображения: 'day', 'days', 'week'
  const [viewMode, setViewMode] = useState<'day' | 'days' | 'week'>('day');
  // Для режима 'days' – начальная дата и количество дней (1-7)
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [daysCount, setDaysCount] = useState<number>(1);
  // Для режима 'week' – выбранная неделя (начало недели – понедельник)
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Состояние для хранения отфильтрованных назначений
  const [filteredAssignments, setFilteredAssignments] = useState<ScheduleAssignment[]>([]);
  // Индикатор загрузки
  const [loading, setLoading] = useState(false);
  
  // Ссылка на контейнер для экспорта
  const containerRef = useRef<HTMLDivElement>(null);

  // Эффект: при изменении параметров фильтрации пересчитываем отображаемые назначения
  useEffect(() => {
    let start: Date, end: Date;
    
    if (viewMode === 'day') {
      start = startDate;
      end = startDate;
    } else if (viewMode === 'days') {
      start = startDate;
      end = addDays(startDate, daysCount - 1);
    } else { // week
      start = selectedWeekStart;
      end = addDays(selectedWeekStart, 6);
    }
    
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    
    const filtered = scheduleAssignments.filter(sa => {
      const date = sa.work_date;
      return date >= startStr && date <= endStr;
    });
    
    setFilteredAssignments(filtered);
  }, [viewMode, startDate, daysCount, selectedWeekStart, scheduleAssignments]);

  // Вспомогательные функции для навигации по неделям
  const weeksInSelectedMonth = useMemo(() => {
    const start = startOfMonth(scheduleViewMonth);
    const end = endOfMonth(scheduleViewMonth);
    const weeks: Date[][] = [];
    let current = startOfWeek(start, { weekStartsOn: 1 });
    while (current <= end) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(addDays(current, i));
      }
      weeks.push(week);
      current = addDays(current, 7);
    }
    return weeks;
  }, [scheduleViewMonth]);

  const currentWeekIndex = useMemo(() => {
    return weeksInSelectedMonth.findIndex(week => 
      week.some(day => isSameDay(day, selectedWeekStart))
    );
  }, [weeksInSelectedMonth, selectedWeekStart]);

  const handlePrevWeek = () => {
    if (currentWeekIndex > 0) {
      setSelectedWeekStart(weeksInSelectedMonth[currentWeekIndex - 1][0]);
    } else {
      const prevMonth = subMonths(scheduleViewMonth, 1);
      setScheduleViewMonth(prevMonth);
      const weeksPrev = getWeeksInMonth(prevMonth);
      if (weeksPrev.length > 0) {
        setSelectedWeekStart(weeksPrev[weeksPrev.length - 1][0]);
      }
    }
  };

  const handleNextWeek = () => {
    if (currentWeekIndex < weeksInSelectedMonth.length - 1) {
      setSelectedWeekStart(weeksInSelectedMonth[currentWeekIndex + 1][0]);
    } else {
      const nextMonth = addMonths(scheduleViewMonth, 1);
      setScheduleViewMonth(nextMonth);
      const weeksNext = getWeeksInMonth(nextMonth);
      if (weeksNext.length > 0) {
        setSelectedWeekStart(weeksNext[0][0]);
      }
    }
  };

  function getWeeksInMonth(monthDate: Date): Date[][] {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const weeks: Date[][] = [];
    let current = startOfWeek(start, { weekStartsOn: 1 });
    while (current <= end) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(addDays(current, i));
      }
      weeks.push(week);
      current = addDays(current, 7);
    }
    return weeks;
  }

  // Функция экспорта в PNG
  const exportToPNG = useCallback(() => {
    if (!containerRef.current) return;
    
    const dates = getDateRange();
    const attrIds = [...new Set(filteredAssignments.map(a => a.attraction_id))];
    const attrMap = new Map(attractions.map(a => [a.id, a]));
    const empMap = new Map(employees.map(e => [e.id, e]));
    
    const cellWidth = 120;
    const cellHeight = 40;
    const headerHeight = 50;
    const leftColWidth = 150;
    const rowHeight = 60;
    
    const cols = dates.length;
    const rows = attrIds.length;
    const svgWidth = leftColWidth + cols * cellWidth;
    const svgHeight = headerHeight + rows * rowHeight;
    
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" font-family="Arial, sans-serif">`;
    svgContent += `<rect width="100%" height="100%" fill="white"/>`;
    
    // Заголовки дат
    dates.forEach((date, idx) => {
      const x = leftColWidth + idx * cellWidth;
      const y = 0;
      svgContent += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${headerHeight}" fill="#f3f4f6" stroke="#d1d5db"/>`;
      svgContent += `<text x="${x + cellWidth/2}" y="${y + 20}" text-anchor="middle" font-size="14" font-weight="bold" fill="#374151">${format(date, 'dd.MM.yyyy')}</text>`;
      svgContent += `<text x="${x + cellWidth/2}" y="${y + 38}" text-anchor="middle" font-size="12" fill="#6b7280">${format(date, 'EEEE', { locale: ru })}</text>`;
    });
    
    // Левая колонка с аттракционами
    attrIds.forEach((attrId, rowIdx) => {
      const attr = attrMap.get(attrId);
      const y = headerHeight + rowIdx * rowHeight;
      svgContent += `<rect x="0" y="${y}" width="${leftColWidth}" height="${rowHeight}" fill="#f9fafb" stroke="#d1d5db"/>`;
      svgContent += `<text x="${10}" y="${y + 25}" font-size="14" font-weight="bold" fill="#111827">${attr?.name || '—'}</text>`;
      svgContent += `<text x="${10}" y="${y + 45}" font-size="12" fill="#6b7280">Коэф: ${attr?.coefficient || 1.0}</text>`;
    });
    
    // Ячейки с сотрудниками
    dates.forEach((date, colIdx) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      attrIds.forEach((attrId, rowIdx) => {
        const assignments = filteredAssignments.filter(a => a.work_date === dateStr && a.attraction_id === attrId);
        const x = leftColWidth + colIdx * cellWidth;
        const y = headerHeight + rowIdx * rowHeight;
        
        svgContent += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${rowHeight}" fill="white" stroke="#d1d5db"/>`;
        
        if (assignments.length === 0) {
          svgContent += `<text x="${x + cellWidth/2}" y="${y + rowHeight/2 + 5}" text-anchor="middle" font-size="12" fill="#9ca3af">—</text>`;
        } else {
          let yOffset = y + 18;
          assignments.slice(0, 3).forEach((ass) => {
            const emp = empMap.get(ass.employee_id);
            const timeStr = `${ass.start_time?.substring(0,5)}-${ass.end_time?.substring(0,5)}`;
            svgContent += `<text x="${x + 5}" y="${yOffset}" font-size="11" fill="#1f2937">${emp?.full_name || '?'}</text>`;
            svgContent += `<text x="${x + 5}" y="${yOffset + 14}" font-size="10" fill="#6b7280">${timeStr}</text>`;
            yOffset += 28;
          });
          if (assignments.length > 3) {
            svgContent += `<text x="${x + 5}" y="${yOffset}" font-size="10" fill="#6b7280">+ ещё ${assignments.length - 3}</text>`;
          }
        }
      });
    });
    
    svgContent += `</svg>`;
    
    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgWidth;
      canvas.height = svgHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const startStr = format(getDateRange()[0], 'yyyy-MM-dd');
        const endStr = format(getDateRange()[getDateRange().length - 1], 'yyyy-MM-dd');
        const fileName = `schedule_${startStr}_${endStr}.png`;
        
        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  }, [filteredAssignments, attractions, employees, viewMode, startDate, daysCount, selectedWeekStart]);

  const getDateRange = (): Date[] => {
    if (viewMode === 'day') return [startDate];
    if (viewMode === 'days') {
      return Array.from({ length: daysCount }, (_, i) => addDays(startDate, i));
    }
    return Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
          График смен
        </h3>
        <Button
          variant="success"
          onClick={exportToPNG}
          icon={<Save className="h-4 w-4" />}
        >
          Сохранить как PNG
        </Button>
      </div>

      {/* Панель управления */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Переключатель режимов */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Режим:
            </span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {[
                { mode: 'day' as const, label: '1 день' },
                { mode: 'days' as const, label: 'Несколько дней' },
                { mode: 'week' as const, label: 'Неделя' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'px-3 py-1.5 text-sm transition',
                    viewMode === mode
                      ? 'text-white'
                      : 'hover:bg-tertiary'
                  )}
                  style={{
                    backgroundColor: viewMode === mode ? 'var(--primary)' : 'var(--surface)',
                    color: viewMode === mode ? 'white' : 'var(--text)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Выбор даты для режимов day/days */}
          {(viewMode === 'day' || viewMode === 'days') && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Дата:
                </span>
                <input
                  type="date"
                  value={format(startDate, 'yyyy-MM-dd')}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  className="input"
                />
              </div>
              {viewMode === 'days' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Дней:
                  </span>
                  <select
                    value={daysCount}
                    onChange={(e) => setDaysCount(Number(e.target.value))}
                    className="input"
                  >
                    {[1,2,3,4,5,6,7].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Выбор недели */}
          {viewMode === 'week' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Месяц:
                </span>
                <input
                  type="month"
                  value={format(scheduleViewMonth, 'yyyy-MM')}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-').map(Number);
                    setScheduleViewMonth(new Date(year, month - 1, 1));
                    const newMonth = new Date(year, month - 1, 1);
                    const weeks = getWeeksInMonth(newMonth);
                    if (weeks.length > 0) {
                      setSelectedWeekStart(weeks[0][0]);
                    }
                  }}
                  className="input"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevWeek}
                  icon={<ChevronLeft className="h-4 w-4" />}
                />
                <span className="text-sm font-medium min-w-[180px] text-center" style={{ color: 'var(--text)' }}>
                  {format(selectedWeekStart, 'd MMM', { locale: ru })} – {format(addDays(selectedWeekStart, 6), 'd MMM yyyy', { locale: ru })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextWeek}
                  icon={<ChevronRight className="h-4 w-4" />}
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Таблица графика */}
      <Card padding="none" ref={containerRef}>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin h-8 w-8" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <ScheduleTable
            assignments={filteredAssignments}
            attractions={attractions}
            employees={employees}
            dateRange={getDateRange()}
          />
        )}
      </Card>
    </div>
  );
}

// Вспомогательный компонент таблицы
function ScheduleTable({
  assignments,
  attractions,
  employees,
  dateRange
}: {
  assignments: ScheduleAssignment[];
  attractions: Attraction[];
  employees: Employee[];
  dateRange: Date[];
}) {
  const attrMap = new Map(attractions.map(a => [a.id, a]));
  const empMap = new Map(employees.map(e => [e.id, e]));
  
  const relevantAttrIds = useMemo(() => {
    const ids = new Set(assignments.map(a => a.attraction_id));
    if (ids.size === 0) {
      return attractions.map(a => a.id);
    }
    return Array.from(ids);
  }, [assignments, attractions]);

  const sortedAttrIds = relevantAttrIds.sort((a, b) => {
    const nameA = attrMap.get(a)?.name || '';
    const nameB = attrMap.get(b)?.name || '';
    return nameA.localeCompare(nameB);
  });

  if (dateRange.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <th 
              className="sticky left-0 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider border-r"
              style={{ 
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text)',
                borderColor: 'var(--border)'
              }}
            >
              Аттракцион
            </th>
            {dateRange.map(date => (
              <th 
                key={date.toISOString()} 
                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider border-r last:border-r-0"
                style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
              >
                <div>{format(date, 'dd.MM')}</div>
                <div className="font-normal" style={{ color: 'var(--text-muted)' }}>
                  {format(date, 'EEEEEE', { locale: ru })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {sortedAttrIds.map(attrId => {
            const attr = attrMap.get(attrId);
            return (
              <tr key={attrId}>
                <td 
                  className="sticky left-0 px-3 py-2 font-medium border-r"
                  style={{ 
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                    borderColor: 'var(--border)'
                  }}
                >
                  <div>{attr?.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    коэф. {attr?.coefficient || 1.0}
                  </div>
                </td>
                {dateRange.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayAssignments = assignments.filter(a => a.work_date === dateStr && a.attraction_id === attrId);
                  return (
                    <td 
                      key={dateStr} 
                      className="px-2 py-2 align-top border-r last:border-r-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {dayAssignments.length === 0 ? (
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>—</span>
                      ) : (
                        <div className="space-y-1">
                          {dayAssignments.map((ass, idx) => {
                            const emp = empMap.get(ass.employee_id);
                            const timeStr = `${ass.start_time?.substring(0,5)}-${ass.end_time?.substring(0,5)}`;
                            return (
                              <div key={idx} className="text-xs">
                                <div 
                                  className="font-medium truncate max-w-[120px]" 
                                  title={emp?.full_name}
                                  style={{ color: 'var(--text)' }}
                                >
                                  {emp?.full_name || '?'}
                                </div>
                                <div style={{ color: 'var(--text-muted)' }}>
                                  {timeStr}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {assignments.length === 0 && (
        <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
          <Calendar className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-subtle)' }} />
          <p>Нет данных за выбранный период</p>
        </div>
      )}
    </div>
  );
}
