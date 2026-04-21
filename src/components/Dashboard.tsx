import { useState } from 'react';
import { LogOut, Calendar, User, Shield, Crown } from 'lucide-react';
import { UserProfile } from '../types';
import { EmployeeDashboard } from './EmployeeDashboard';
import { AdminDashboard } from './AdminDashboard';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { Badge, ThemeToggle } from './ui';
import { useIsMobile, useIsTablet } from '../hooks/useMediaQuery';
import MobileSidebar from './MobileSidebar';
import MobileHeader from './MobileHeader';

interface DashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export function Dashboard({ profile, onLogout }: DashboardProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* ========================================
          MOBILE HEADER
          ======================================== */}
      {isMobile ? (
        <MobileHeader
          title="ParkStaff"
          onMenuClick={() => setIsSidebarOpen(true)}
          showMenu={true}
          showThemeToggle={true}
        />
      ) : (
        /* ========================================
            DESKTOP NAVIGATION BAR
            ======================================== */
        <nav
          className="sticky top-0 z-50 border-b backdrop-blur-md"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--surface) 95%, transparent)',
            borderColor: 'var(--border)',
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
                <div className={`${isTablet ? 'flex' : 'hidden md:flex'} items-center gap-3`}>
                  <div className="text-right">
                    <div
                      className="text-sm font-semibold leading-tight"
                      style={{ color: 'var(--text)' }}
                    >
                      {profile.full_name}
                    </div>
                    <Badge variant={getRoleBadgeVariant(profile.access_level)} dot>
                      <RoleIcon className="h-3 w-3" />
                      <span className="text-xs">{getRoleName(profile.access_level)}</span>
                    </Badge>
                  </div>
                </div>

                <ThemeToggle />

                <button
                  onClick={onLogout}
                  className="p-1.5 sm:p-2 rounded-lg transition-all active:scale-95"
                  style={{ color: 'var(--text-muted)', backgroundColor: 'transparent' }}
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
      )}

      {/* ========================================
          MOBILE SIDEBAR
          ======================================== */}
      {isMobile && (
        <MobileSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          title="Меню"
        >
          <div className="p-4 space-y-4">

            {/* User Profile Card */}
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <RoleIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold text-sm truncate"
                    style={{ color: 'var(--text)' }}
                  >
                    {profile.full_name}
                  </p>
                  <Badge
                    variant={getRoleBadgeVariant(profile.access_level)}
                    className="mt-1"
                  >
                    {getRoleName(profile.access_level)}
                  </Badge>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  onLogout();
                }}
                className="w-full btn btn-danger btn-sm mt-2"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </div>

            <div className="divider-mobile" />

            {/* Info */}
            <div className="space-y-2">
              <p
                className="text-xs font-semibold uppercase tracking-wider px-2"
                style={{ color: 'var(--text-subtle)' }}
              >
                Информация
              </p>
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Версия: <span className="font-semibold">v2.3.0</span>
                </p>
                <a
                  href="https://vk.com/albars_studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs mt-1 inline-block"
                  style={{ color: 'var(--primary)' }}
                >
                  Поддержка →
                </a>
              </div>
            </div>

          </div>
        </MobileSidebar>
      )}

      {/* ========================================
          MAIN CONTENT
          ======================================== */}
      <main className="flex-1 w-full">
        <div
          className={`max-w-7xl mx-auto ${
            isMobile
              ? 'px-4 py-4'
              : 'px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'
          }`}
        >
          <div className={isMobile ? 'animate-fade-in' : 'animate-slide-up'}>
            {profile.access_level === 1 && <SuperAdminDashboard profile={profile} />}
            {profile.access_level === 2 && <AdminDashboard profile={profile} />}
            {profile.access_level === 3 && <EmployeeDashboard profile={profile} />}
          </div>
        </div>
      </main>

      {/* ========================================
          DESKTOP FOOTER
          ======================================== */}
      {!isMobile && (
        <footer
          className="border-t mt-auto"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                © 2026 ParkStaff. Все права защищены.
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Разработано командой{' '}
                <span style={{ color: 'var(--primary)' }}>AlBars</span>
              </p>
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
                <span style={{ color: 'var(--text-subtle)' }}>v2.3.0</span>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
