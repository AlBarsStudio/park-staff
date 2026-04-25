/**
 * AdminManualComposer — обёртка над ManualScheduleComposer для AdminDashboard.
 */

import { Employee, Attraction, ScheduleAssignment } from '../../lib/DatabaseService';
import { ManualScheduleComposer } from '../ManualScheduleComposer';

interface AdminManualComposerProps {
  employees: Employee[];
  attractions: Attraction[];
  scheduleAssignments: ScheduleAssignment[];
  onRefreshData: () => Promise<void>;
}

export function AdminManualComposer({
  employees,
  attractions,
  scheduleAssignments,
  onRefreshData,
}: AdminManualComposerProps) {
  return (
    <ManualScheduleComposer
      employees={employees}
      attractions={attractions}
      scheduleAssignments={scheduleAssignments}
      onRefreshData={onRefreshData}
    />
  );
}
