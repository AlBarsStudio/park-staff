/**
 * AdminEmployeesList — обёртка над EmployeesList для AdminDashboard.
 * Адаптирует пропсы из AdminDashboard к интерфейсу EmployeesList.
 */

import { Employee } from '../../lib/DatabaseService';
import { EmployeesList } from '../EmployeesList';

interface AdminEmployeesListProps {
  employees: Employee[];
  isSuperAdmin: boolean;
  onRefreshData: () => Promise<void>;
}

export function AdminEmployeesList({
  isSuperAdmin,
  onRefreshData,
}: AdminEmployeesListProps) {
  return (
    <EmployeesList
      isSuperAdmin={isSuperAdmin}
      onEmployeeUpdate={onRefreshData}
    />
  );
}
