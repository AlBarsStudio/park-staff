// EmployeeSalary.tsx - ИСПРАВЛЕННАЯ ВЕРСИЯ

import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DollarSign, Loader2, Edit2, Check, X } from 'lucide-react';
import { useState } from 'react';
import { Card, Button } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface SalaryAttraction {
  name: string;
  hours: number;
  rate: number;
  coefficient: number;
  earn: number;
}

interface SalaryDay {
  date: string;
  attractions: SalaryAttraction[];
  total: number;
}

interface SalaryData {
  days: SalaryDay[];
  total: number;
}

interface EmployeeSalaryProps {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  salaryPeriod: 'first' | 'second';
  setSalaryPeriod: (period: 'first' | 'second') => void;
  salaryData: SalaryData | null;
  loadingSalary: boolean;
  scheduleWithLogs?: Array<{
    schedule: any;
    log: any | null;
  }>;
  onUpdateActualTime?: (logId: number, actualStart: string, actualEnd: string) => Promise<void>;
  onAddActualTime?: (scheduleId: number, actualStart: string, actualEnd: string) => Promise<void>;
}

export function EmployeeSalary({
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  salaryPeriod,
  setSalaryPeriod,
  salaryData,
  loadingSalary,
  scheduleWithLogs = [], // Значение по умолчанию
  onUpdateActualTime,
  onAddActualTime,
}: EmployeeSalaryProps) {
  const isMobile = useIsMobile();
  
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [updating, setUpdating] = useState(false);

  // Генерация списка годов (текущий +/- 2 года)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Названия месяцев
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const handleEditStart = (log: any) => {
    setEditingLogId(log.id);
    setEditStart(log.actual_start);
    setEditEnd(log.actual_end);
  };

  const handleEditCancel = () => {
    setEditingLogId(null);
    setEditStart('');
    setEditEnd('');
  };

  const handleEditSave = async (logId: number) => {
    if (!editStart || !editEnd || !onUpdateActualTime) return;
    
    setUpdating(true);
    try {
      await onUpdateActualTime(logId, editStart, editEnd);
      setEditingLogId(null);
      setEditStart('');
      setEditEnd('');
    } catch (error) {
      console.error('Ошибка обновления времени:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card padding={isMobile ? 'sm' : 'md'} className="w-full">
      {isMobile ? (
        <h3 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text)' }}>
          Зарплата
        </h3>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5" style={{ color: 'var(--warning)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
            Зарплата
          </h3>
        </div>
      )}

      <div className="space-y-4">
        {/* Selectors: Year, Month, Period */}
        <div className="grid grid-cols-2 gap-2">
          {/* Year selector */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Год
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Month selector */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Месяц
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              {months.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          <Button
            onClick={() => setSalaryPeriod('first')}
            variant={salaryPeriod === 'first' ? 'primary' : 'secondary'}
            size="sm"
            className={isMobile ? 'flex-1' : ''}
          >
            7–21
          </Button>
          <Button
            onClick={() => setSalaryPeriod('second')}
            variant={salaryPeriod === 'second' ? 'primary' : 'secondary'}
            size="sm"
            className={isMobile ? 'flex-1' : ''}
          >
            22–6
          </Button>
        </div>

        {/* Work logs list with edit functionality */}
        {scheduleWithLogs && scheduleWithLogs.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Отработанное время
            </h4>
            {scheduleWithLogs.map(({ schedule, log }) => (
              <Card
                key={schedule.id}
                padding="sm"
                style={{
                  backgroundColor: log
                    ? 'rgba(var(--success-rgb, 16, 185, 129), 0.05)'
                    : 'rgba(var(--warning-rgb, 245, 158, 11), 0.05)',
                  border: `1px solid ${log ? 'var(--success)' : 'var(--warning)'}`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {format(parseISO(schedule.work_date), 'dd.MM.yyyy (EEEE)', { locale: ru })}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {schedule.attraction?.name || 'Аттракцион'}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      По расписанию: {schedule.start_time} - {schedule.end_time}
                    </div>
                    
                    {log && editingLogId !== log.id && (
                      <div className="text-xs mt-1 font-medium" style={{ color: 'var(--success)' }}>
                        Фактически: {log.actual_start} - {log.actual_end}
                      </div>
                    )}

                    {log && editingLogId === log.id && (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={editStart}
                            onChange={(e) => setEditStart(e.target.value)}
                            className="flex-1 px-2 py-1 rounded border text-xs"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--border)',
                              color: 'var(--text)',
                            }}
                          />
                          <input
                            type="time"
                            value={editEnd}
                            onChange={(e) => setEditEnd(e.target.value)}
                            className="flex-1 px-2 py-1 rounded border text-xs"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--border)',
                              color: 'var(--text)',
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEditSave(log.id)}
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            disabled={updating}
                          >
                            {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button
                            onClick={handleEditCancel}
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            disabled={updating}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {!log && (
                      <div className="text-xs mt-1" style={{ color: 'var(--warning)' }}>
                        Не отмечено
                      </div>
                    )}
                  </div>

                  {log && editingLogId !== log.id && onUpdateActualTime && (
                    <button
                      onClick={() => handleEditStart(log)}
                      className="p-1 rounded hover:bg-black/5"
                      style={{ color: 'var(--primary)' }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Loading */}
        {loadingSalary && (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-8 w-8 animate-spin"
              style={{ color: 'var(--primary)' }}
            />
          </div>
        )}

        {/* Salary data */}
        {!loadingSalary && salaryData && (
          <>
            {salaryData.days.length === 0 ? (
              <div
                className="text-center py-12"
                style={{ color: 'var(--text-muted)' }}
              >
                Нет данных для расчета
              </div>
            ) : (
              <div className="space-y-2">
                {salaryData.days.map((day, index) => (
                  <Card
                    key={day.date}
                    padding="sm"
                    style={{
                      backgroundColor:
                        index % 2 === 0
                          ? 'rgba(var(--success-rgb, 16, 185, 129), 0.05)'
                          : 'rgba(var(--success-rgb, 16, 185, 129), 0.02)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="font-semibold mb-2 text-sm"
                      style={{ color: 'var(--text)' }}
                    >
                      {format(parseISO(day.date), 'dd.MM.yyyy (EEEE)', { locale: ru })}
                    </div>
                    <div
                      className="space-y-1 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {day.attractions.map((a, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>
                            {a.name} ({a.hours.toFixed(2)}ч × {a.rate}₽ × {a.coefficient})
                          </span>
                          <span className="font-medium">{Math.round(a.earn)}₽</span>
                        </div>
                      ))}
                    </div>
                    <div
                      className="mt-2 pt-2 border-t flex justify-between font-bold text-sm"
                      style={{
                        borderColor: 'var(--border)',
                        color: 'var(--primary)',
                      }}
                    >
                      <span>Итого:</span>
                      <span>{Math.round(day.total)} ₽</span>
                    </div>
                  </Card>
                ))}

                {/* Total with warning border */}
                <Card
                  padding="md"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '2px solid var(--warning)',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className="font-bold text-lg"
                      style={{ color: 'var(--text)' }}
                    >
                      Предварительная сумма:
                    </span>
                    <span
                      className="font-bold text-3xl"
                      style={{ color: 'var(--warning)' }}
                    >
                      {Math.round(salaryData.total)} ₽
                    </span>
                  </div>
                  <div
                    className="text-xs text-center mt-2 p-2 rounded"
                    style={{
                      backgroundColor: 'rgba(var(--warning-rgb, 245, 158, 11), 0.1)',
                      color: 'var(--warning)',
                    }}
                  >
                    ⚠️ Данные являются примерными. Точный расчет производит бухгалтерия.
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
