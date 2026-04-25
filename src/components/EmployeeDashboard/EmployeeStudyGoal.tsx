import { Target } from 'lucide-react';
import { Card, Button } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Attraction {
  id: number;
  name: string;
}

interface StudyGoal {
  attraction_id: number;
  attraction?: {
    name: string;
  } | null;
}

interface EmployeeStudyGoalProps {
  studyGoal: StudyGoal | null;
  availableAttractions: Attraction[];
  selectedAttractionId: number | null;
  setSelectedAttractionId: (id: number | null) => void;
  handleSetStudyGoal: () => void;
  savingGoal: boolean;
  goalError: string;
}

export function EmployeeStudyGoal({
  studyGoal,
  availableAttractions,
  selectedAttractionId,
  setSelectedAttractionId,
  handleSetStudyGoal,
  savingGoal,
  goalError,
}: EmployeeStudyGoalProps) {
  const isMobile = useIsMobile();

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-5 w-5" style={{ color: 'var(--primary)' }} />
        <h3
          className={`font-semibold ${isMobile ? 'text-sm' : ''}`}
          style={{ color: 'var(--text)' }}
        >
          Цель изучения
        </h3>
      </div>

      {goalError && (
        <div
          className="mb-3 p-3 rounded-lg text-sm animate-shake"
          style={{
            backgroundColor: 'var(--error-light)',
            color: 'var(--error)',
            ...(isMobile && { padding: '0.5rem', fontSize: '0.75rem' }),
          }}
        >
          {goalError}
        </div>
      )}

      <select
        value={selectedAttractionId || ''}
        onChange={e =>
          setSelectedAttractionId(e.target.value ? Number(e.target.value) : null)
        }
        className="input mb-3"
        style={{
          borderRadius: '12px',
          ...(!isMobile && { padding: '0.75rem 1rem' }),
        }}
      >
        <option value="">-- Выберите аттракцион --</option>
        {availableAttractions.map(a => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <Button
        onClick={handleSetStudyGoal}
        disabled={savingGoal || !selectedAttractionId}
        variant="primary"
        size="sm"
        loading={savingGoal}
        className="w-full"
      >
        {isMobile ? 'Сохранить' : 'Сохранить цель'}
      </Button>

      {studyGoal && studyGoal.attraction && (
        <div
          className="mt-3 p-2 rounded-lg"
          style={{ backgroundColor: 'var(--primary-light)' }}
        >
          <p
            className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}
            style={{ color: 'var(--primary)' }}
          >
            <strong>Текущая:</strong> {studyGoal.attraction.name}
          </p>
        </div>
      )}
    </Card>
  );
}
