import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Lock, Calendar, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { Button, Card, Input, ThemeToggle } from './ui';

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
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Декоративные элементы фона */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: 'var(--primary)' }}
        />
        <div 
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: 'var(--primary)' }}
        />
      </div>

      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-6 right-6 z-50 animate-slide-down">
        <div 
          className="p-2 rounded-xl shadow-lg backdrop-blur-sm transition-all hover:scale-105"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8 animate-slide-down">
          <div className="flex justify-center mb-6">
            <div 
              className="p-4 rounded-2xl shadow-xl transition-all hover:scale-110 hover:rotate-6 duration-300"
              style={{ 
                backgroundColor: 'var(--primary)',
                boxShadow: '0 20px 40px -12px var(--primary-shadow)'
              }}
            >
              <Calendar className="h-16 w-16 text-white" />
            </div>
          </div>
          
          <h1 
            className="text-5xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r"
            style={{ 
              backgroundImage: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            ParkStaff
          </h1>
          <p 
            className="text-lg font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Система управления персоналом
          </p>
        </div>

        {/* Login Card */}
        <Card padding="lg" className="animate-slide-up mb-8" style={{ animationDelay: '100ms' }}>
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email */}
            <div>
              <label 
                className="block text-sm font-semibold mb-2"
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
                  className="w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 text-base"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label 
                className="block text-sm font-semibold mb-2"
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
                  className="w-full px-4 py-3 pr-12 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 text-base"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all hover:scale-110 active:scale-95"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
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
                className="rounded-xl px-4 py-3 text-sm border-2 animate-shake flex items-center gap-2"
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
              size="lg"
              loading={loading}
              className="w-full text-base font-semibold"
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
                className="font-semibold underline hover:no-underline transition-all"
                style={{ color: 'var(--primary)' }}
              >
                Обратитесь к администратору
              </a>
            </p>
          </div>
        </Card>

        {/* What's New Section */}
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
          {/* Warning Card */}
          <Card 
            padding="md" 
            className="border-2 transform transition-all duration-300 hover:scale-102"
            style={{ 
              borderColor: 'var(--warning)',
              backgroundColor: 'var(--warning-light)'
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle 
                className="h-6 w-6 flex-shrink-0 mt-0.5" 
                style={{ color: 'var(--warning)' }}
              />
              <div>
                <h3 
                  className="text-sm font-bold mb-1"
                  style={{ color: 'var(--warning)' }}
                >
                  Приложение в разработке
                </h3>
                <p 
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Некоторые функции могут быть временно недоступны
                </p>
              </div>
            </div>
          </Card>

          {/* Updates Card */}
          <Card padding="md" className="transform transition-all duration-300 hover:scale-102">
            <div className="mb-4">
              <h3 
                className="text-lg font-bold mb-1"
                style={{ color: 'var(--text)' }}
              >
                Что нового?
              </h3>
              <p 
                className="text-sm font-semibold"
                style={{ color: 'var(--primary)' }}
              >
                1 стадия тестирования
              </p>
              <p 
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                13.04 — 30.04
              </p>
            </div>

            <div className="space-y-2">
              {UPDATES.map((update, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-2 rounded-lg transition-all duration-200 hover:translate-x-1"
                  style={{ 
                    animationDelay: `${300 + index * 50}ms`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                  <p 
                    className="text-sm leading-relaxed"
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
        <div className="mt-8 text-center animate-slide-up" style={{ animationDelay: '400ms' }}>
          <div 
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg transition-all hover:scale-105"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p 
              className="text-sm font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Разработано командой{' '}
              <a 
                href="https://vk.com/albars_studio"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:no-underline transition-all"
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
