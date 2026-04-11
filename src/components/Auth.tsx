import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Lock, Mail, Calendar, Sparkles, CheckCircle2, 
  Code, Layers, Palette, Smartphone, Bell, TrendingUp
} from 'lucide-react';
import { Button, Card, Input, ThemeToggle } from './ui';
import { useTheme } from '../hooks/useTheme';

interface AuthProps {
  onLogin: () => void;
}

// Новости и обновления системы
const UPDATES = [
  {
    id: 1,
    title: 'Новый современный дизайн',
    description: 'Полностью обновленный интерфейс с оранжевым акцентом и поддержкой темной темы',
    icon: Palette,
    date: '2024',
    status: 'completed' as const,
  },
  {
    id: 2,
    title: 'Улучшенная мобильная версия',
    description: 'Оптимизация для смартфонов с удобной навигацией и адаптивным дизайном',
    icon: Smartphone,
    date: '2024',
    status: 'completed' as const,
  },
  {
    id: 3,
    title: 'Система управления темами',
    description: 'Выбор между светлой, темной и автоматической темой',
    icon: Layers,
    date: '2024',
    status: 'completed' as const,
  },
  {
    id: 4,
    title: 'Уведомления в реальном времени',
    description: 'Мгновенные push-уведомления о важных событиях и изменениях в графике',
    icon: Bell,
    date: 'В разработке',
    status: 'in-progress' as const,
  },
  {
    id: 5,
    title: 'Расширенная аналитика',
    description: 'Детальная статистика работы, производительности и KPI сотрудников',
    icon: TrendingUp,
    date: 'Планируется',
    status: 'planned' as const,
  },
];

export function Auth({ onLogin }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* ========================================
          LEFT SIDE - Login Form
          ======================================== */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
        {/* Theme Toggle - Top Right */}
        <div className="absolute top-4 right-4 lg:top-8 lg:right-8">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md mx-auto">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div 
                className="p-4 rounded-2xl shadow-lg transition-all hover:scale-105 hover:rotate-3"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Calendar className="h-12 w-12 text-white" />
              </div>
            </div>
            
            <h1 
              className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r"
              style={{ 
                backgroundImage: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              ParkStaff
            </h1>
            <p 
              className="text-base"
              style={{ color: 'var(--text-muted)' }}
            >
              Система управления персоналом
            </p>
          </div>

          {/* Login Card */}
          <Card padding="lg" className="animate-slide-up">
            <form className="space-y-6" onSubmit={handleLogin}>
              {/* Email */}
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text)' }}
                >
                  Email
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  icon={<Mail className="h-5 w-5" style={{ color: 'var(--text-subtle)' }} />}
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text)' }}
                >
                  Пароль
                </label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  icon={<Lock className="h-5 w-5" style={{ color: 'var(--text-subtle)' }} />}
                  autoComplete="current-password"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div 
                  className="rounded-lg px-4 py-3 text-sm border animate-slide-down"
                  style={{ 
                    backgroundColor: 'var(--error-light)', 
                    borderColor: 'var(--error)',
                    color: 'var(--error)'
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full"
              >
                Войти в систему
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center space-y-2">
              <p 
                className="text-xs"
                style={{ color: 'var(--text-subtle)' }}
              >
                Возникли проблемы со входом?{' '}
                <a 
                  href="https://vk.com/albars_studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:no-underline transition-colors"
                  style={{ color: 'var(--primary)' }}
                >
                  Обратитесь к администратору
                </a>
              </p>
            </div>
          </Card>

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Все системы работают
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          RIGHT SIDE - Updates & News
          ======================================== */}
      <div 
        className="flex-1 lg:flex lg:items-center lg:justify-center p-4 sm:p-6 lg:p-8"
        style={{ 
          backgroundColor: 'var(--bg-secondary)'
        }}
      >
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'var(--primary-light)' }}
              >
                <Sparkles 
                  className="h-6 w-6"
                  style={{ color: 'var(--primary)' }}
                />
              </div>
              <h2 
                className="text-2xl font-bold"
                style={{ color: 'var(--text)' }}
              >
                Что нового?
              </h2>
            </div>
            <p 
              className="text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              Последние обновления и улучшения системы
            </p>
          </div>

          {/* Updates List */}
          <div className="space-y-3">
            {UPDATES.map((update, index) => {
              const Icon = update.icon;
              
              return (
                <Card
                  key={update.id}
                  variant="hover"
                  padding="md"
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {update.status === 'completed' && (
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: 'var(--success-light)' }}
                        >
                          <Icon 
                            className="h-5 w-5"
                            style={{ color: 'var(--success)' }}
                          />
                        </div>
                      )}
                      {update.status === 'in-progress' && (
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: 'var(--warning-light)' }}
                        >
                          <Icon 
                            className="h-5 w-5"
                            style={{ color: 'var(--warning)' }}
                          />
                        </div>
                      )}
                      {update.status === 'planned' && (
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: 'var(--info-light)' }}
                        >
                          <Icon 
                            className="h-5 w-5"
                            style={{ color: 'var(--info)' }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 
                          className="text-sm font-semibold"
                          style={{ color: 'var(--text)' }}
                        >
                          {update.title}
                        </h3>
                        {update.status === 'completed' && (
                          <CheckCircle2 
                            className="h-4 w-4 flex-shrink-0 mt-0.5"
                            style={{ color: 'var(--success)' }}
                          />
                        )}
                      </div>
                      
                      <p 
                        className="text-xs mb-2 leading-relaxed"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {update.description}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-xs font-medium"
                          style={{ color: 'var(--text-subtle)' }}
                        >
                          {update.date}
                        </span>
                        
                        {update.status === 'completed' && (
                          <span className="badge-success text-xs">
                            Готово
                          </span>
                        )}
                        {update.status === 'in-progress' && (
                          <span className="badge-warning text-xs">
                            В работе
                          </span>
                        )}
                        {update.status === 'planned' && (
                          <span className="badge-info text-xs">
                            Планируется
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center">
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <Code className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <p 
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                Разработано{' '}
                <a 
                  href="https://vk.com/albars_studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:no-underline transition-colors"
                  style={{ color: 'var(--primary)' }}
                >
                  AlBars Studio
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
