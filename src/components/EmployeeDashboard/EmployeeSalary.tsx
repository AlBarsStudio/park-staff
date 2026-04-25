import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DollarSign, Loader2 } from 'lucide-react';
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
  salaryPeriod: 'first' | 'second';
  setSalaryPeriod: (period: 'first' | 'second') => void;
  salaryData: SalaryData | null;
  loadingSalary: boolean;
}

export function EmployeeSalary({
  salaryPeriod,
  setSalaryPeriod,
  salaryData,
  loadingSalary,
}: EmployeeSalaryProps) {
  const isMobile = useIsMobile();

  return (
    <Card padding={isMobile ? 'sm' : 'md'} className="w-full">
      {isMobile ? (
        <h3 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text)' }}>
          Зарплата
        </h3>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5" style={{ color: 'var(--success)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
            Зарплата
          </h3>
        </div>
      )}

      <div className="space-y-4">
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

        {/* Loading */}
        {loadingSalary && (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-8 w-8 animate-spin"
              style={{ color: 'var(--primary)' }}
            />
          </div>
        )}

        {/* Data */}
        {!loadingSalary && salaryData && (
          <>
            {salaryData.days.length === 0 ? (
              <div
                className="text-center py-12"
                style={{ color: 'var(--text-muted)' }}
              >
                Нет данных
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
                          <span>{a.name}</span>
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

                {/* Total */}
                <Card
                  padding="md"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--success-light), var(--success))',
                    border: 'none',
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className="font-bold text-lg"
                      style={{ color: 'white' }}
                    >
                      Всего:
                    </span>
                    <span
                      className="font-bold text-3xl"
                      style={{ color: 'white' }}
                    >
                      {Math.round(salaryData.total)} ₽
                    </span>
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
