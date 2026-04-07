// Dashboard.tsx
import { LogOut, Calendar } from 'lucide-react';
import { UserProfile } from '../types';
import { EmployeeDashboard } from './EmployeeDashboard';
import { AdminDashboard } from './AdminDashboard';
import { SuperAdminDashboard } from './SuperAdminDashboard';

interface DashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export function Dashboard({ profile, onLogout }: DashboardProps) {
  const getRoleName = (level: number) => {
    switch (level) {
      case 1:
        return 'Супер Администратор';
      case 2:
        return 'Администратор';
      case 3:
        return 'Сотрудник';
      default:
        return 'Неизвестно';
    }
  };

  const getRoleBadgeColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-red-100 text-red-700';
      case 2:
        return 'bg-purple-100 text-purple-700';
      case 3:
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Calendar className="h-7 w-7 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">ParkStaff</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-gray-900">{profile.full_name}</div>
                <div
                  className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block ${getRoleBadgeColor(
                    profile.access_level
                  )}`}
                >
                  {getRoleName(profile.access_level)}
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Выйти"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {profile.access_level === 1 && <SuperAdminDashboard profile={profile} />}
        {profile.access_level === 2 && <AdminDashboard profile={profile} />}
        {profile.access_level === 3 && <EmployeeDashboard profile={profile} />}
      </main>
    </div>
  );
}
