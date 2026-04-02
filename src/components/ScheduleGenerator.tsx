import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { UserProfile, Attraction, Employee, Shift } from '../types';
import {
  Loader2, Wand2, Save, GripVertical,
  Plus, X, CheckSquare, Square, Info, AlertCircle
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

// Структура для одной записи в сгенерированном графике
interface ScheduleEntry {
  employeeId: number;
  employeeName: string;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  isManuallyAdded?: boolean;
}

// Аттракцион с сотрудниками в графике
interface ScheduleAttractionRow {
  attractionId: number;
  attractionName: string;
  employees: ScheduleEntry[];
}

// День в графике
interface ScheduleDay {
  date: string; // YYYY-MM-DD
  rows: ScheduleAttractionRow[];
}

interface ScheduleGeneratorProps {
  profile: UserProfile;
  isSuperAdmin?: boolean;
}

// SQL для создания таблицы work_schedules (для справки в UI)
const SCHEDULE_TABLE_SQL = `
CREATE TABLE work_schedules (
  id            SERIAL PRIMARY KEY,
  schedule_date DATE NOT NULL,
  attraction_id INTEGER REFERENCES attractions(id),
  employee_id   INTEGER REFERENCES employees(id),
  work_start    TIME,
  work_end      TIME,
  is_full_day   BOOLEAN DEFAULT TRUE,
  created_by    INTEGER REFERENCES employees(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  notes         TEXT,
  UNIQUE(schedule_date, attraction_id, employee_id)
);`;

export function ScheduleGenerator({ profile, isSuperAdmin = false }: ScheduleGeneratorProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [_availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Параметры генерации
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [daysCount, setDaysCount] = useState<number>(1);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<Set<number>>(new Set());
  const [minStaffPerAttraction, setMinStaffPerAttraction] = useState<number>(1);

  // Результат
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [unassigned, setUnassigned] = useState<ScheduleEntry[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSqlInfo, setShowSqlInfo] = useState(false);

  // Drag & Drop состояние (зарезервировано для расширения)
  // const [dragging, setDragging] = useState<...>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);

    const { data: attrData } = await supabase
      .from('attractions')
      .select('id, name, min_staff, max_staff')
      .order('name');
    if (attrData) {
      setAttractions(attrData);
      setSelectedAttractionIds(new Set(attrData.map((a: Attraction) => a.id)));
    }

    const { data: empData } = await supabase
      .from('employees')
      .select('id, full_name, age')
      .order('full_name');
    if (empData) setEmployees(empData);

    setLoading(false);
  };

  // Подгрузить смены на выбранные даты
  const fetchShiftsForDates = async (dates: string[]): Promise<Shift[]> => {
    if (dates.length === 0) return [];
    const { data } = await supabase
      .from('employee_availability')
      .select('id, employee_id, work_date, is_full_day, start_time, end_time')
      .in('work_date', dates);
    return (data as Shift[]) || [];
  };

  const toggleAttraction = (id: number) => {
    setSelectedAttractionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateSchedule = async () => {
    if (selectedAttractionIds.size === 0) {
      alert('Выберите хотя бы один аттракцион');
      return;
    }
    setGenerating(true);
    setSaveSuccess(false);

    const dates: string[] = [];
    for (let i = 0; i < daysCount; i++) {
      dates.push(format(addDays(parseISO(startDate), i), 'yyyy-MM-dd'));
    }

    const shifts = await fetchShiftsForDates(dates);
    setAvailableShifts(shifts);

    const selectedAttractions = attractions.filter(a => selectedAttractionIds.has(a.id));

    const newSchedule: ScheduleDay[] = [];
    const allUnassigned: ScheduleEntry[] = [];

    for (const date of dates) {
      const dayShifts = shifts.filter(s => s.work_date === date);

      // Все сотрудники, доступные в этот день
      const availableEmployees: ScheduleEntry[] = dayShifts.map(s => {
        const emp = employees.find(e => e.id === s.employee_id);
        return {
          employeeId: s.employee_id,
          employeeName: emp?.full_name || `Сотрудник #${s.employee_id}`,
          isFullDay: s.is_full_day,
          startTime: s.start_time,
          endTime: s.end_time,
        };
      });

      // Распределяем сотрудников по аттракционам
      const rows: ScheduleAttractionRow[] = selectedAttractions.map(attr => ({
        attractionId: attr.id,
        attractionName: attr.name,
        employees: [],
      }));

      // Простой алгоритм: round-robin распределение
      const shuffled = [...availableEmployees].sort(() => Math.random() - 0.5);
      let attrIndex = 0;
      const usedEmployeeIds = new Set<number>();
      const dayUnassigned: ScheduleEntry[] = [];

      for (const entry of shuffled) {
        if (rows.length === 0) {
          dayUnassigned.push(entry);
          continue;
        }
        // Ищем аттракцион, которому нужен сотрудник
        let assigned = false;
        for (let attempt = 0; attempt < rows.length; attempt++) {
          const row = rows[(attrIndex + attempt) % rows.length];
          const maxStaff = attractions.find(a => a.id === row.attractionId)?.max_staff ?? 3;
          if (row.employees.length < maxStaff) {
            row.employees.push(entry);
            usedEmployeeIds.add(entry.employeeId);
            attrIndex = (attrIndex + 1) % rows.length;
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          dayUnassigned.push(entry);
        }
      }

      newSchedule.push({ date, rows });
      allUnassigned.push(...dayUnassigned.filter(e => !usedEmployeeIds.has(e.employeeId)));
    }

    setSchedule(newSchedule);
    // Дедупликация unassigned по employeeId
    const uniqueUnassigned = allUnassigned.filter(
      (e, i, arr) => arr.findIndex(x => x.employeeId === e.employeeId) === i
    );
    setUnassigned(uniqueUnassigned);
    setIsGenerated(true);
    setGenerating(false);

    await logActivity(
      isSuperAdmin ? 'superadmin' : 'admin',
      profile.id,
      'schedule_generate',
      `Сгенерирован график на ${daysCount} дн. начиная с ${startDate}, аттракционов: ${selectedAttractionIds.size}`
    );
  };

  // Перемещение: из ячейки в unassigned
  const moveToUnassigned = (dayDate: string, attractionId: number, employeeId: number) => {
    setSchedule(prev => prev.map(day => {
      if (day.date !== dayDate) return day;
      return {
        ...day,
        rows: day.rows.map(row => {
          if (row.attractionId !== attractionId) return row;
          const entry = row.employees.find(e => e.employeeId === employeeId);
          if (entry) {
            setUnassigned(u => {
              if (u.find(x => x.employeeId === employeeId)) return u;
              return [...u, entry];
            });
          }
          return { ...row, employees: row.employees.filter(e => e.employeeId !== employeeId) };
        }),
      };
    }));
  };

  // Перемещение: из unassigned в ячейку
  const moveFromUnassigned = (employeeId: number, dayDate: string, attractionId: number) => {
    const entry = unassigned.find(e => e.employeeId === employeeId);
    if (!entry) return;

    setSchedule(prev => prev.map(day => {
      if (day.date !== dayDate) return day;
      return {
        ...day,
        rows: day.rows.map(row => {
          if (row.attractionId !== attractionId) return row;
          if (row.employees.find(e => e.employeeId === employeeId)) return row;
          return { ...row, employees: [...row.employees, { ...entry, isManuallyAdded: true }] };
        }),
      };
    }));
    setUnassigned(prev => prev.filter(e => e.employeeId !== employeeId));
  };

  // Перемещение между ячейками
  const moveBetweenAttractions = (
    employeeId: number,
    fromDate: string, fromAttractionId: number,
    toDate: string, toAttractionId: number
  ) => {
    if (fromDate === toDate && fromAttractionId === toAttractionId) return;

    let entry: ScheduleEntry | undefined;
    const newSchedule = schedule.map(day => {
      if (day.date !== fromDate) return day;
      return {
        ...day,
        rows: day.rows.map(row => {
          if (row.attractionId !== fromAttractionId) return row;
          entry = row.employees.find(e => e.employeeId === employeeId);
          return { ...row, employees: row.employees.filter(e => e.employeeId !== employeeId) };
        }),
      };
    });

    if (!entry) return;
    const capturedEntry = entry;

    setSchedule(newSchedule.map(day => {
      if (day.date !== toDate) return day;
      return {
        ...day,
        rows: day.rows.map(row => {
          if (row.attractionId !== toAttractionId) return row;
          if (row.employees.find(e => e.employeeId === employeeId)) return row;
          return { ...row, employees: [...row.employees, { ...capturedEntry, isManuallyAdded: true }] };
        }),
      };
    }));
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      const entries: object[] = [];
      for (const day of schedule) {
        for (const row of day.rows) {
          for (const emp of row.employees) {
            entries.push({
              schedule_date: day.date,
              attraction_id: row.attractionId,
              employee_id: emp.employeeId,
              is_full_day: emp.isFullDay,
              work_start: emp.startTime,
              work_end: emp.endTime,
              created_by: profile.id,
            });
          }
        }
      }

      // Попытка вставки (таблица может ещё не существовать)
      const { error } = await supabase.from('work_schedules').insert(entries);
      if (error) {
        console.error(error);
        alert(`Ошибка сохранения: ${error.message}\n\nВозможно, таблица work_schedules ещё не создана.`);
      } else {
        await logActivity(
          isSuperAdmin ? 'superadmin' : 'admin',
          profile.id,
          'schedule_save',
          `График сохранён: ${schedule.length} дней, ${entries.length} записей`
        );
        setSaveSuccess(true);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center p-16">
      <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-purple-600" />
            Генератор графика работы
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Автоматическое составление расписания с возможностью ручного редактирования
          </p>
        </div>
        <button
          onClick={() => setShowSqlInfo(v => !v)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition"
        >
          <Info className="h-4 w-4" />
          SQL таблицы
        </button>
      </div>

      {/* SQL справка */}
      {showSqlInfo && (
        <div className="bg-gray-900 text-green-300 rounded-xl p-4 text-xs font-mono overflow-x-auto">
          <div className="text-gray-400 mb-2 font-sans text-sm">Предлагаемая структура таблицы <strong className="text-white">work_schedules</strong>:</div>
          <pre>{SCHEDULE_TABLE_SQL}</pre>
          <div className="mt-3 text-gray-400 font-sans text-xs">
            Колонки: <span className="text-yellow-300">id, schedule_date, attraction_id, employee_id, work_start, work_end, is_full_day, created_by, created_at, notes</span>
          </div>
        </div>
      )}

      {/* Параметры генерации */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-5">
        <h4 className="font-semibold text-gray-800">Параметры генерации</h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Количество дней</label>
            <select
              value={daysCount}
              onChange={e => setDaysCount(Number(e.target.value))}
              className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {[1, 2, 3, 4, 5, 6, 7].map(d => (
                <option key={d} value={d}>{d} {d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Мин. сотрудников / аттракцион</label>
            <input
              type="number"
              min={1}
              max={10}
              value={minStaffPerAttraction}
              onChange={e => setMinStaffPerAttraction(Number(e.target.value))}
              className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Выбор аттракционов */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Аттракционы</label>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setSelectedAttractionIds(new Set(attractions.map(a => a.id)))}
                className="text-blue-600 hover:underline"
              >
                Выбрать все
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setSelectedAttractionIds(new Set())}
                className="text-gray-500 hover:underline"
              >
                Снять все
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {attractions.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Аттракционы не найдены в базе данных</p>
            ) : (
              attractions.map(attr => (
                <button
                  key={attr.id}
                  onClick={() => toggleAttraction(attr.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    selectedAttractionIds.has(attr.id)
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {selectedAttractionIds.has(attr.id)
                    ? <CheckSquare className="h-3.5 w-3.5" />
                    : <Square className="h-3.5 w-3.5" />
                  }
                  {attr.name}
                </button>
              ))
            )}
          </div>
        </div>

        <button
          onClick={generateSchedule}
          disabled={generating || selectedAttractionIds.size === 0}
          className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {generating ? (
            <><Loader2 className="h-5 w-5 animate-spin" />Генерация...</>
          ) : (
            <><Wand2 className="h-5 w-5" />Сгенерировать график</>
          )}
        </button>
      </div>

      {/* Результат */}
      {isGenerated && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-gray-900">
              График работы
            </h4>
            <button
              onClick={handleSaveSchedule}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить график
            </button>
          </div>

          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-green-600" />
              График успешно сохранён в базе данных!
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Редактирование:</strong> Нажмите × рядом с сотрудником, чтобы переместить его в список незадействованных.
              Нажмите на имя в списке незадействованных, чтобы добавить его на аттракцион.
            </span>
          </div>

          {/* Таблица по дням */}
          {schedule.map(day => (
            <div key={day.date} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-800 text-white px-5 py-3 flex items-center gap-2">
                <CalendarDayIcon />
                <span className="font-semibold">
                  {format(parseISO(day.date), 'dd MMMM yyyy', { locale: ru })} — {format(parseISO(day.date), 'EEEE', { locale: ru })}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-1/3">Аттракцион</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Сотрудники</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {day.rows.map(row => (
                      <ScheduleRow
                        key={row.attractionId}
                        row={row}
                        day={day.date}
                        unassigned={unassigned}
                        onRemoveEmployee={(empId) => moveToUnassigned(day.date, row.attractionId, empId)}
                        onAddFromUnassigned={(empId) => moveFromUnassigned(empId, day.date, row.attractionId)}
                        schedule={schedule}
                        onMoveBetween={(empId, fromAttr, toDate, toAttr) =>
                          moveBetweenAttractions(empId, day.date, fromAttr, toDate, toAttr)
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Незадействованные сотрудники */}
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-5">
            <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400" />
              Незадействованные сотрудники ({unassigned.length})
            </h5>
            {unassigned.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Все доступные сотрудники распределены по аттракционам</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-3">
                  Сотрудники доступны для выхода на смену, но не включены в текущий график.
                  Для добавления нажмите <strong>+</strong> на нужном аттракционе.
                </p>
                <div className="flex flex-wrap gap-2">
                  {unassigned.map(emp => (
                    <div
                      key={emp.employeeId}
                      className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm font-medium text-orange-800">{emp.employeeName}</span>
                      <span className="text-xs text-orange-500">
                        {emp.isFullDay ? 'Полн.' : `${emp.startTime?.slice(0,5)}–${emp.endTime?.slice(0,5)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Иконка календарного дня
function CalendarDayIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2} />
      <path d="M16 2v4M8 2v4M3 10h18" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// Строка таблицы — аттракцион + сотрудники
interface ScheduleRowProps {
  row: ScheduleAttractionRow;
  day: string;
  unassigned: ScheduleEntry[];
  onRemoveEmployee: (empId: number) => void;
  onAddFromUnassigned: (empId: number) => void;
  schedule: ScheduleDay[];
  onMoveBetween: (empId: number, fromAttr: number, toDate: string, toAttr: number) => void;
}

function ScheduleRow({ row, unassigned, onRemoveEmployee, onAddFromUnassigned }: ScheduleRowProps) {
  const [showUnassignedPicker, setShowUnassignedPicker] = useState(false);

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-semibold text-gray-800 align-top">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-400 rounded-full flex-shrink-0"></span>
          {row.attractionName}
        </div>
        {row.employees.length === 0 && (
          <div className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Нет сотрудников
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-2">
          {row.employees.map(emp => (
            <div
              key={emp.employeeId}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                emp.isManuallyAdded
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-gray-100 border-gray-200 text-gray-800'
              }`}
            >
              <GripVertical className="h-3 w-3 text-gray-400" />
              <span>{emp.employeeName}</span>
              {!emp.isFullDay && (
                <span className="text-gray-400">
                  {emp.startTime?.slice(0, 5)}–{emp.endTime?.slice(0, 5)}
                </span>
              )}
              <button
                onClick={() => onRemoveEmployee(emp.employeeId)}
                className="ml-1 text-gray-400 hover:text-red-500 transition"
                title="Убрать из графика"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Кнопка добавить из незадействованных */}
          <div className="relative">
            <button
              onClick={() => setShowUnassignedPicker(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition"
              title="Добавить сотрудника из незадействованных"
            >
              <Plus className="h-3 w-3" />
              Добавить
            </button>

            {showUnassignedPicker && (
              <div className="absolute z-10 left-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-48">
                {unassigned.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2 py-1">Нет доступных сотрудников</p>
                ) : (
                  <ul className="space-y-1">
                    {unassigned.map(emp => (
                      <li key={emp.employeeId}>
                        <button
                          onClick={() => {
                            onAddFromUnassigned(emp.employeeId);
                            setShowUnassignedPicker(false);
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-blue-50 hover:text-blue-700 transition flex items-center gap-2"
                        >
                          <Plus className="h-3 w-3" />
                          {emp.employeeName}
                          {!emp.isFullDay && (
                            <span className="text-gray-400 text-xs">
                              {emp.startTime?.slice(0, 5)}–{emp.endTime?.slice(0, 5)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => setShowUnassignedPicker(false)}
                    className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}


