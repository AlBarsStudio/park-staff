import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge, Button, Modal } from '../ui';
import type { EmployeeAvailability, EmployeeDataManager, ScheduleAssignment } from '../../lib/employeeDatabase';
import type { PendingChanges } from './index';

function formatDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

interface EmployeeDashboardModalsProps {
  // Add shift modal
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  modalDate: string;
  isFullDayModal: boolean;
  setIsFullDayModal: (val: boolean) => void;
  modalStartTime: string;
  setModalStartTime: (val: string) => void;
  modalEndTime: string;
  setModalEndTime: (val: string) => void;
  modalComment: string;
  setModalComment: (val: string) => void;
  modalError: string;
  handleAddShiftToPending: () => void;
  START_TIMES: string[];
  END_TIMES: string[];

  // View shift modal
  isViewModalOpen: boolean;
  setIsViewModalOpen: (open: boolean) => void;
  viewShift: EmployeeAvailability | null;
  handleDeleteShiftToPending: (shift: EmployeeAvailability) => void;
  pendingChanges: PendingChanges;
  dataManager: EmployeeDataManager | null;

  // Time log modal
  isTimeLogModalOpen: boolean;
  setIsTimeLogModalOpen: (open: boolean) => void;
  selectedSchedule: ScheduleAssignment | null;
  actualStart: string;
  setActualStart: (val: string) => void;
  actualEnd: string;
  setActualEnd: (val: string) => void;
  timeLogError: string;
  handleSaveTimeLog: () => void;
  savingTimeLog: boolean;
}

export function EmployeeDashboardModals({
  isAddModalOpen,
  setIsAddModalOpen,
  modalDate,
  isFullDayModal,
  setIsFullDayModal,
  modalStartTime,
  setModalStartTime,
  modalEndTime,
  setModalEndTime,
  modalComment,
  setModalComment,
  modalError,
  handleAddShiftToPending,
  START_TIMES,
  END_TIMES,
  isViewModalOpen,
  setIsViewModalOpen,
  viewShift,
  handleDeleteShiftToPending,
  pendingChanges,
  dataManager,
  isTimeLogModalOpen,
  setIsTimeLogModalOpen,
  selectedSchedule,
  actualStart,
  setActualStart,
  actualEnd,
  setActualEnd,
  timeLogError,
  handleSaveTimeLog,
  savingTimeLog,
}: EmployeeDashboardModalsProps) {
  return (
    <>
      {/* ADD SHIFT MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={`Смена на ${modalDate ? formatDateStr(modalDate) : ''}`}
        size="md"
        fullScreenOnMobile={false}
      >
        <div className="space-y-4 p-4">
          {modalError && (
            <div
              className="p-3 rounded-xl text-sm animate-shake"
              style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}
            >
              {modalError}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => setIsFullDayModal(true)}
              variant={isFullDayModal ? 'primary' : 'secondary'}
              className="flex-1"
            >
              Полная
            </Button>
            <Button
              onClick={() => setIsFullDayModal(false)}
              variant={!isFullDayModal ? 'primary' : 'secondary'}
              className="flex-1"
            >
              Неполная
            </Button>
          </div>

          {!isFullDayModal && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label-mobile">Начало</label>
                <select
                  value={modalStartTime}
                  onChange={e => setModalStartTime(e.target.value)}
                  className="input"
                >
                  {START_TIMES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label-mobile">Окончание</label>
                <select
                  value={modalEndTime}
                  onChange={e => setModalEndTime(e.target.value)}
                  className="input"
                >
                  {END_TIMES.filter(t => t > modalStartTime).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="input-label-mobile">Комментарий (необязательно)</label>
            <textarea
              value={modalComment}
              onChange={e => setModalComment(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Добавьте комментарий..."
              maxLength={4096}
            />
          </div>

          <Button
            onClick={handleAddShiftToPending}
            variant="primary"
            size="lg"
            className="w-full"
          >
            Добавить смену
          </Button>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            💡 Изменения вступят в силу после нажатия "Сохранить"
          </p>
        </div>
      </Modal>

      {/* VIEW SHIFT MODAL */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Детали смены"
        size="sm"
        fullScreenOnMobile={false}
      >
        {viewShift && (
          <div className="space-y-4 p-4">
            {viewShift.id < 0 && (
              <Badge variant="warning">Не сохранена в БД</Badge>
            )}
            {pendingChanges.deletions.some(d => d.id === viewShift.id) && (
              <Badge variant="danger">Помечена на удаление</Badge>
            )}

            <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Дата</span>
              <p className="font-semibold mt-1" style={{ color: 'var(--text)' }}>
                {format(parseISO(viewShift.work_date), 'dd MMMM yyyy', { locale: ru })}
              </p>
            </div>

            <div>
              <Badge variant={viewShift.is_full_day ? 'success' : 'warning'} size="lg">
                {viewShift.is_full_day ? '✓ Полная смена' : '⏰ Неполная смена'}
              </Badge>
            </div>

            {!viewShift.is_full_day && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Время работы</span>
                <p className="font-semibold mt-1 text-lg" style={{ color: 'var(--text)' }}>
                  {viewShift.start_time?.slice(0, 5)} – {viewShift.end_time?.slice(0, 5)}
                </p>
              </div>
            )}

            {viewShift.comment && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Комментарий</span>
                <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{viewShift.comment}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setIsViewModalOpen(false)}
                variant="secondary"
                className="flex-1"
              >
                Закрыть
              </Button>
              {(viewShift.id < 0 || dataManager?.canDeleteAvailability(viewShift).allowed) && (
                <Button
                  onClick={() => handleDeleteShiftToPending(viewShift)}
                  variant="danger"
                  className="flex-1"
                >
                  Удалить
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* TIME LOG MODAL */}
      <Modal
        isOpen={isTimeLogModalOpen}
        onClose={() => setIsTimeLogModalOpen(false)}
        title="Отметка времени"
        size="sm"
        fullScreenOnMobile={false}
      >
        {selectedSchedule && (
          <div className="space-y-4 p-4">
            {timeLogError && (
              <div
                className="p-3 rounded-xl text-sm animate-shake"
                style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}
              >
                {timeLogError}
              </div>
            )}

            <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <p className="text-sm mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                Укажите фактическое время работы:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label-mobile">Начало</label>
                  <input
                    type="time"
                    value={actualStart}
                    onChange={e => setActualStart(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label-mobile">Окончание</label>
                  <input
                    type="time"
                    value={actualEnd}
                    onChange={e => setActualEnd(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSaveTimeLog}
              disabled={savingTimeLog}
              variant="primary"
              size="lg"
              loading={savingTimeLog}
              className="w-full"
            >
              Сохранить время
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
