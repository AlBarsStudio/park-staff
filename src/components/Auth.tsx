import { useState } from 'react';
import { 
  Lock, Calendar, Eye, EyeOff, AlertCircle, User
} from 'lucide-react';
import { Button, Card, Input, ThemeToggle } from './ui';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../hooks/useAuth';

interface AuthProps {
  onLogin: () => void;
}

const UPDATES = [
  'Переход на новую базу данных Yandex YDB',
  'Упрощенная система авторизации по логину',
  'Оптимизация производительности запросов',
  'Исправление ошибок в генераторе графиков',
  'Подготовка к интеграции с ВК-ботом'
];

export function Auth({ onLogin }: AuthProps) {
  const isMobile = useIsMobile();
  const { login: authLogin } = useAuth(); // Берем функцию входа из нашего нового хука
  
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Вызываем нашу новую функцию логина
      const success = await authLogin(loginField, password);

      if (success) {
        onLogin();
      } else {
        setError('Неверный логин или пароль');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
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

      {/* Theme Toggle */}
      <div className={`fixed ${isMobile ? 'top-4 right-4' : 'top-6 right-6'} z-50`}>
        <div className="p-2 rounded-xl shadow-lg backdrop-blur-sm transition-all active:scale-95" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <ThemeToggle />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className={`text-center ${isMobile ? 'mb-6' : 'mb-8'} animate-slide-down`}>
          <div className="flex justify-center mb-6">
            <div 
              className={`${isMobile ? 'p-3' : 'p-4'} rounded-2xl shadow-xl transition-all active:scale-95`}
              style={{ 
                backgroundColor: 'var(--primary)',
                boxShadow: '0 20px 40px -12px var(--primary-shadow)'
              }}
            >
              <Calendar className={`${isMobile ? 'h-12 w-12' : 'h-16 w-16'} text-white`} />
            </div>
          </div>
          
          <h1 className={`${isMobile ? 'text-4xl' : 'text-5xl'} font-bold mb-3 text-gradient`}>
            ParkStaff
          </h1>
          <p className={`${isMobile ? 'text-base' : 'text-lg'} font-medium`} style={{ color: 'var(--text-muted)' }}>
            Система управления персоналом
          </p>
        </div>

        <Card padding={isMobile ? 'md' : 'lg'} className="animate-slide-up mb-6">
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Login */}
            <div>
              <label className="input-label-mobile" style={{ color: 'var(--text)' }}>Логин</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  value={loginField}
                  onChange={(e) => setLoginField(e.target.value)}
                  placeholder="Ваш логин"
                  className="input pl-10" // Добавил отступ под иконку
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="input-label-mobile" style={{ color: 'var(--text)' }}>Пароль</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm border-2 animate-shake flex items-center gap-2"
                style={{ backgroundColor: 'var(--error-light)', borderColor: 'var(--error)', color: 'var(--error)' }}>
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" size={isMobile ? 'md' : 'lg'} loading={loading} className="w-full font-semibold">
              Войти в систему
            </Button>
          </form>
        </Card>

        {/* Информационный блок */}
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <Card padding="md">
            <h3 className="text-lg font-bold mb-3">Что нового?</h3>
            <div className="space-y-2">
              {UPDATES.map((update, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-muted">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <p>{update}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
