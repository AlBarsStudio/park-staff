import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Lock, Calendar, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { Button, Card, Input, ThemeToggle } from './ui';
import { useIsMobile } from '../hooks/useMediaQuery';

interface AuthProps {
  onLogin: () => void;
}

// Обновления первой стадии тестирования
const UPDATES = [
  'Исправление ошибок',
  'Доработка системы ведения учета и составления графика смен',
  'Разработка и тестирование алгоритмов генерации смен',
  'Разработка бота для беседы ВКонтакте и его взаимодействия с базой данных',
  'Оптимизация количества запросов к базе данных'
];

export function Auth({ onLogin }: AuthProps) {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Неверный email или пароль');
      setLoading(false);
    } else {
      onLogin();
    }
  };

  return (
    <div 
      className={`min-h-screen flex items-center justify-center ${isMobile ? 'py-6 px-4' : 'py-12 px-4 sm:px-6 lg:px-8'} relative overflow-hidden`}
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Декоративные элементы фона */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className={`absolute ${isMobile ? '-top-20 -right-20 w-40 h-40' : '-top-40 -right-40 w-80 h-80'} rounded-full opacity-10 blur-3xl`}
          style={{ backgroundColor: 'var(--primary)' }}
        />
        <div 
          className={`absolute ${isMobile ? '-bottom-20 -left-20 w-40 h-40' : '-bottom-40 -left-40 w-80 h-80'} rounded-full opacity-10 blur-3xl`}
          style={{ backgroundColor: 'var(--primary)' }}
        />
      </div>

      {/* Theme Toggle - Fixed Position */}
      <div className={`fixed ${isMobile ? 'top-4 right-4' : 'top-6 right-6'} z-50 animate-slide-down`}>
        <div 
          className="p-2 rounded-xl shadow-lg backdrop-blur-sm transition-all active:scale-95"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
        <div className={`text-center ${isMobile ? 'mb-6' : 'mb-8'} animate-slide-down`}>
          <div className="flex justify-center mb-6">
            <div 
              className={`${isMobile ? 'p-3' : 'p-4'} rounded-2xl shadow-xl transition-all active:scale-95 duration-300`}
              style={{ 
                backgroundColor: 'var(--primary)',
                boxShadow: '0 20px 40px -12px var(--primary-shadow)'
              }}
            >
              <Calendar className={`${isMobile ? 'h-12 w-12' : 'h-16 w-16'} text-white`} />
            </div>
          </div>
          
          <h1 
            className={`${isMobile ? 'text-4xl' : 'text-5xl'} font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r`}
            style={{ 
              backgroundImage: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            ParkStaff
          </h1>
          <p 
            className={`${isMobile ? 'text-base' : 'text-lg'} font-medium`}
            style={{ color: 'var(--text-muted)' }}
          >
            Система управления персоналом
          </p>
        </div>

        {/* Login Card */}
        <Card 
          padding={isMobile ? 'md' : 'lg'} 
          className="animate-slide-up mb-6" 
          style={{ animationDelay: '100ms' }}
        >
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email */}
            <div>
              <label 
                className="input-label-mobile"
                style={{ color: 'var(--text)' }}
              >
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  autoComplete="email"
                  className="input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label 
                className="input-label-mobile"
                style={{ color: 'var(--text)' }}
              >
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all active:scale-95"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div 
                className={`rounded-xl ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} text-sm border-2 animate-shake flex items-center gap-2`}
                style={{ 
                  backgroundColor: 'var(--error-light)', 
                  borderColor: 'var(--error)',
                  color: 'var(--error)'
                }}
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size={isMobile ? 'md' : 'lg'}
              loading={loading}
              className="w-full btn-mobile-full text-base font-semibold"
            >
              Войти в систему
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p 
              className="text-sm"
              style={{ color: 'var(--text-subtle)' }}
            >
              Возникли проблемы со входом?{' '}
              <a 
                href="https://vk.com/albars_studio"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline active:no-underline transition-all"
                style={{ color: 'var(--primary)' }}
              >
                Обратитесь к администратору
              </a>
            </p>
          </div>
        </Card>

        {/* What's New Section */}
        <div className={`space-y-4 animate-slide-up ${isMobile ? 'mb-4' : ''}`} style={{ animationDelay: '200ms' }}>
          {/* Warning Card */}
          <Card 
            padding={isMobile ? 'sm' : 'md'}
            className="border-2 transform transition-all duration-300 active:scale-98"
            style={{ 
              borderColor: 'var(--warning)',
              backgroundColor: 'var(--warning-light)'
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle 
                className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} flex-shrink-0 mt-0.5`}
                style={{ color: 'var(--warning)' }}
              />
              <div>
                <h3 
                  className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold mb-1`}
                  style={{ color: 'var(--warning)' }}
                >
                  Приложение в разработке
                </h3>
                <p 
                  className={`${isMobile ? 'text-[11px]' : 'text-xs'} leading-relaxed`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  Некоторые функции могут быть временно недоступны
                </p>
              </div>
            </div>
          </Card>

          {/* Updates Card */}
          <Card 
            padding={isMobile ? 'sm' : 'md'} 
            className="transform transition-all duration-300 active:scale-98"
          >
            <div className="mb-4">
              <h3 
                className={`${isMobile ? 'text-base' : 'text-lg'} font-bold mb-1`}
                style={{ color: 'var(--text)' }}
              >
                Что нового?
              </h3>
              <p 
                className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}
                style={{ color: 'var(--primary)' }}
              >
                1 стадия тестирования
              </p>
              <p 
                className={`${isMobile ? 'text-[11px]' : 'text-xs'}`}
                style={{ color: 'var(--text-muted)' }}
              >
                13.04 — 30.04
              </p>
            </div>

            <div className="space-y-2">
              {UPDATES.map((update, index) => (
                <div 
                  key={index}
                  className={`flex items-start gap-3 ${isMobile ? 'p-1.5' : 'p-2'} rounded-lg transition-all duration-200`}
                  style={{ 
                    animationDelay: `${300 + index * 50}ms`,
                  }}
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                  <p 
                    className={`${isMobile ? 'text-xs' : 'text-sm'} leading-relaxed`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {update}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center animate-slide-up" style={{ animationDelay: '400ms' }}>
          <div 
            className={`inline-flex items-center gap-2 ${isMobile ? 'px-4 py-2' : 'px-5 py-3'} rounded-xl shadow-lg transition-all active:scale-95`}
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p 
              className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}
              style={{ color: 'var(--text-muted)' }}
            >
              Разработано командой{' '}
              <a 
                href="https://vk.com/albars_studio"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline active:no-underline transition-all"
                style={{ color: 'var(--primary)' }}
              >
                AlBars Studio
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
