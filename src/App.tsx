import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { session, profile, loading, signOut } = useAuth();

  // Показываем загрузку
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  // Если не авторизован - показываем форму входа
  if (!session || !profile) {
    return <Auth onLogin={() => window.location.reload()} />;
  }

  // Показываем Dashboard (он уже сам определяет админ/сотрудник)
  return <Dashboard profile={profile} onLogout={signOut} />;
}
