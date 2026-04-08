import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, subMonths, addMonths, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import { ScheduleAssignment, Attraction, Employee } from '../types';

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
  // Индикатор загрузки (можно добавить, если понадобится отдельная загрузка)
  const [loading, setLoading] = useState(false);
  
  // Ссылка на контейнер для экспорта (используется для скриншота через canvas + SVG)
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
      const date = sa.work_date; // строка 'yyyy-MM-dd'
      return date >= startStr && date <= endStr;
    });
    
    setFilteredAssignments(filtered);
  }, [viewMode, startDate, daysCount, selectedWeekStart, scheduleAssignments]);

  // Вспомогательные функции для навигации по неделям в пределах выбранного месяца
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
      // Переход на предыдущий месяц
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
      // Переход на следующий месяц
      const nextMonth = addMonths(scheduleViewMonth, 1);
      setScheduleViewMonth(nextMonth);
      const weeksNext = getWeeksInMonth(nextMonth);
      if (weeksNext.length > 0) {
        setSelectedWeekStart(weeksNext[0][0]);
      }
    }
  };

  // Вспомогательная функция получения недель месяца (используется выше)
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

  // Функция экспорта в PNG (через SVG и canvas)
  const exportToPNG = useCallback(() => {
    if (!containerRef.current) return;
    
    // Получаем данные для отрисовки
    const dates = getDateRange();
    const attrIds = [...new Set(filteredAssignments.map(a => a.attraction_id))];
    const attrMap = new Map(attractions.map(a => [a.id, a]));
    const empMap = new Map(employees.map(e => [e.id, e]));
    
    // Строим SVG вручную
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
    
    // Левая колонка с названиями аттракционов
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
          assignments.slice(0, 3).forEach((ass, i) => {
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
    
    // Создаём изображение из SVG
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
        
        // Генерируем имя файла
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

  // Вспомогательная функция получения массива дат для текущего режима
  const getDateRange = (): Date[] => {
    if (viewMode === 'day') return [startDate];
    if (viewMode === 'days') {
      return Array.from({ length: daysCount }, (_, i) => addDays(startDate, i));
    }
    // week
    return Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i));
  };

  // Рендер основного содержимого вкладки
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">График смен</h3>
        <button
          onClick={exportToPNG}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-700"
        >
          <Save className="h-4 w-4" />
          Сохранить как PNG
        </button>
      </div>

      {/* Панель управления периодом */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Режим:</span>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              1 день
            </button>
            <button
              onClick={() => setViewMode('days')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'days' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Несколько дней
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              Неделя
            </button>
          </div>
        </div>

        {/* Выбор начальной даты и кол-ва дней (для режимов day/days) */}
        {(viewMode === 'day' || viewMode === 'days') && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Дата:</span>
              <input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            {viewMode === 'days' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Дней:</span>
                <select
                  value={daysCount}
                  onChange={(e) => setDaysCount(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  {[1,2,3,4,5,6,7].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* Выбор недели (режим week) */}
        {viewMode === 'week' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Месяц:</span>
              <input
                type="month"
                value={format(scheduleViewMonth, 'yyyy-MM')}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-').map(Number);
                  setScheduleViewMonth(new Date(year, month - 1, 1));
                  // При смене месяца автоматически выбираем первую неделю
                  const newMonth = new Date(year, month - 1, 1);
                  const weeks = getWeeksInMonth(newMonth);
                  if (weeks.length > 0) {
                    setSelectedWeekStart(weeks[0][0]);
                  }
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrevWeek} className="p-1 hover:bg-gray-200 rounded">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium min-w-[180px] text-center">
                {format(selectedWeekStart, 'd MMM')} – {format(addDays(selectedWeekStart, 6), 'd MMM yyyy')}
              </span>
              <button onClick={handleNextWeek} className="p-1 hover:bg-gray-200 rounded">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Отображение графика */}
      <div ref={containerRef} className="border rounded-xl overflow-hidden shadow-sm bg-white">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
          </div>
        ) : (
          <ScheduleTable
            assignments={filteredAssignments}
            attractions={attractions}
            employees={employees}
            dateRange={getDateRange()}
          />
        )}
      </div>
    </div>
  );
}

// Вспомогательный компонент для отрисовки таблицы (компактный)
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
  // Группируем назначения по дате и аттракциону
  const attrMap = new Map(attractions.map(a => [a.id, a]));
  const empMap = new Map(employees.map(e => [e.id, e]));
  
  // Определяем аттракционы, которые есть в назначениях за период (или все)
  const relevantAttrIds = useMemo(() => {
    const ids = new Set(assignments.map(a => a.attraction_id));
    // Если назначений нет, показываем все аттракционы, чтобы таблица не была пустой
    if (ids.size === 0) {
      return attractions.map(a => a.id);
    }
    return Array.from(ids);
  }, [assignments, attractions]);

  // Сортируем аттракционы по имени
  const sortedAttrIds = relevantAttrIds.sort((a, b) => {
    const nameA = attrMap.get(a)?.name || '';
    const nameB = attrMap.get(b)?.name || '';
    return nameA.localeCompare(nameB);
  });

  if (dateRange.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200">
              Аттракцион
            </th>
            {dateRange.map(date => (
              <th key={date.toISOString()} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
                <div>{format(date, 'dd.MM')}</div>
                <div className="font-normal text-gray-500">{format(date, 'EEEEEE', { locale: ru })}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedAttrIds.map(attrId => {
            const attr = attrMap.get(attrId);
            return (
              <tr key={attrId}>
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-900 border-r border-gray-200">
                  <div>{attr?.name}</div>
                  <div className="text-xs text-gray-500">коэф. {attr?.coefficient || 1.0}</div>
                </td>
                {dateRange.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayAssignments = assignments.filter(a => a.work_date === dateStr && a.attraction_id === attrId);
                  return (
                    <td key={dateStr} className="px-2 py-2 align-top border-r border-gray-100 last:border-r-0">
                      {dayAssignments.length === 0 ? (
                        <span className="text-gray-300 text-xs">—</span>
                      ) : (
                        <div className="space-y-1">
                          {dayAssignments.map((ass, idx) => {
                            const emp = empMap.get(ass.employee_id);
                            const timeStr = `${ass.start_time?.substring(0,5)}-${ass.end_time?.substring(0,5)}`;
                            return (
                              <div key={idx} className="text-xs">
                                <div className="font-medium truncate max-w-[120px]" title={emp?.full_name}>
                                  {emp?.full_name || '?'}
                                </div>
                                <div className="text-gray-500">{timeStr}</div>
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
        <div className="p-6 text-center text-gray-500">Нет данных за выбранный период</div>
      )}
    </div>
  );
}
