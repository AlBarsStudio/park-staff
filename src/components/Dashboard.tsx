import { LogOut, Calendar, User, Shield, Crown } from 'lucide-react';
import { UserProfile } from '../types';
import { EmployeeDashboard } from './EmployeeDashboard';
import { AdminDashboard } from './AdminDashboard';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { Badge, ThemeToggle } from './ui';

interface DashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export function Dashboard({ profile, onLogout }: DashboardProps) {
  const getRoleName = (level: number) => {
    switch (level) {
      case 1: return 'Супер Администратор';
      case 2: return 'Администратор';
      case 3: return 'Сотрудник';
      default: return 'Неизвестно';
    }
  };

  const getRoleBadgeVariant = (level: number): 'error' | 'warning' | 'info' | 'neutral' => {
    switch (level) {
      case 1: return 'error';    // Красный для супер-админа
      case 2: return 'warning';  // Оранжевый для админа
      case 3: return 'info';     // Синий для сотрудника
      default: return 'neutral';
    }
  };

  const getRoleIcon = (level: number) => {
    switch (level) {
      case 1: return Crown;
      case 2: return Shield;
      case 3: return User;
      default: return User;
    }
  };

  const RoleIcon = getRoleIcon(profile.access_level);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* ========================================
          NAVIGATION BAR
          ======================================== */}
      <nav 
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ 
          backgroundColor: 'color-mix(in srgb, var(--surface) 95%, transparent)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div 
                className="p-1.5 rounded-lg shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <span 
                className="text-xl font-bold hidden sm:inline"
                style={{ color: 'var(--text)' }}
              >
                ParkStaff
              </span>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme Toggle */}
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              {/* User Info - Desktop */}
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <div 
                    className="text-sm font-semibold leading-tight"
                    style={{ color: 'var(--text)' }}
                  >
                    {profile.full_name}
                  </div>
                  <Badge 
                    variant={getRoleBadgeVariant(profile.access_level)}
                    dot
                  >
                    <RoleIcon className="h-3 w-3" />
                    <span className="text-xs">{getRoleName(profile.access_level)}</span>
                  </Badge>
                </div>
              </div>

              {/* User Avatar - Mobile */}
              <div className="md:hidden">
                <div 
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                  style={{ backgroundColor: 'var(--primary)' }}
                  title={profile.full_name}
                >
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="p-2 rounded-lg transition-all hover:scale-105"
                style={{ 
                  color: 'var(--text-muted)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--error-light)';
                  e.currentTarget.style.color = 'var(--error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                title="Выйти"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Mobile User Info */}
          <div className="md:hidden pb-3 pt-1 flex items-center justify-between">
            <div>
              <div 
                className="text-sm font-semibold"
                style={{ color: 'var(--text)' }}
              >
                {profile.full_name}
              </div>
              <Badge 
                variant={getRoleBadgeVariant(profile.access_level)}
                dot
              >
                <RoleIcon className="h-3 w-3" />
                <span className="text-xs">{getRoleName(profile.access_level)}</span>
              </Badge>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* ========================================
          MAIN CONTENT
          ======================================== */}
      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Welcome Message */}
          <div className="mb-6 animate-slide-up">
            <h1 
              className="text-2xl sm:text-3xl font-bold mb-1"
              style={{ color: 'var(--text)' }}
            >
              Добро пожаловать, {profile.full_name.split(' ')[0]}! 👋
            </h1>
            <p 
              className="text-sm sm:text-base"
              style={{ color: 'var(--text-muted)' }}
            >
              {profile.access_level === 1 && 'Панель супер-администратора'}
              {profile.access_level === 2 && 'Панель администратора'}
              {profile.access_level === 3 && 'Личный кабинет сотрудника'}
            </p>
          </div>

          {/* Dashboard Content */}
          <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            {profile.access_level === 1 && <SuperAdminDashboard profile={profile} />}
            {profile.access_level === 2 && <AdminDashboard profile={profile} />}
            {profile.access_level === 3 && <EmployeeDashboard profile={profile} />}
          </div>
        </div>
      </main>

      {/* ========================================
          FOOTER
          ======================================== */}
      <footer 
        className="border-t mt-auto"
        style={{ 
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p 
              className="text-xs"
              style={{ color: 'var(--text-subtle)' }}
            >
              © 2024 ParkStaff. Все права защищены.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <a 
                href="https://vk.com/albars_studio"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Поддержка
              </a>
              <span style={{ color: 'var(--border)' }}>•</span>
              <span style={{ color: 'var(--text-subtle)' }}>
                v2.0.0
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
