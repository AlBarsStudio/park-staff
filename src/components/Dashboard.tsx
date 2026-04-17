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
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div 
                className="p-1.5 rounded-lg shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <span 
                className="text-base sm:text-xl font-bold"
                style={{ color: 'var(--text)' }}
              >
                ParkStaff
              </span>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-3">
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

              {/* User Info - Mobile */}
              <div className="md:hidden flex items-center gap-2">
                <div className="text-right">
                  <div 
                    className="text-xs font-semibold leading-tight"
                    style={{ color: 'var(--text)' }}
                  >
                    {profile.full_name}
                  </div>
                  <Badge 
                    variant={getRoleBadgeVariant(profile.access_level)}
                    dot
                  >
                    <RoleIcon className="h-2.5 w-2.5" />
                    <span className="text-[10px]">{getRoleName(profile.access_level)}</span>
                  </Badge>
                </div>
              </div>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="p-1.5 sm:p-2 rounded-lg transition-all hover:scale-105"
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
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ========================================
          MAIN CONTENT
          ======================================== */}
      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {/* Dashboard Content */}
          <div className="animate-slide-up">
            {profile.access_level === 1 && <SuperAdminDashboard profile={profile} />}
            {profile.access_level === 2 && <AdminDashboard profile={profile} />}
            {profile.access_level === 3 && <EmployeeDashboard profile={profile} />}
          </div>
        </div>
      </main>

      {/* ========================================
          FOOTER (Hidden on Mobile)
          ======================================== */}
      <footer 
        className="hidden sm:block border-t mt-auto"
        style={{ 
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            {/* Copyright */}
            <p 
              className="text-xs"
              style={{ color: 'var(--text-subtle)' }}
            >
              © 2026 ParkStaff. Все права защищены.
            </p>

            {/* Center - Developer Credit */}
            <p 
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Разработано командой <span style={{ color: 'var(--primary)' }}>AlBars</span>
            </p>

            {/* Right - Version & Support */}
            <div className="flex items-center gap-4 text-xs">
              <a 
                href="https://vk.com/albars_studio"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                Поддержка
              </a>
              <span style={{ color: 'var(--border)' }}>•</span>
              <span style={{ color: 'var(--text-subtle)' }}>
                v2.3.0
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
