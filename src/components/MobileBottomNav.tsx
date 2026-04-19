import React from 'react';
import { 
  Home, 
  Users, 
  Calendar, 
  Settings,
  BarChart3 
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface MobileBottomNavProps {
  activeTab: string;
  items?: NavItem[];
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ 
  activeTab,
  items 
}) => {
  // Default navigation items
  const defaultItems: NavItem[] = [
    {
      id: 'home',
      label: 'Главная',
      icon: <Home className="w-6 h-6" />,
      onClick: () => console.log('Home clicked')
    },
    {
      id: 'schedule',
      label: 'Расписание',
      icon: <Calendar className="w-6 h-6" />,
      onClick: () => console.log('Schedule clicked')
    },
    {
      id: 'employees',
      label: 'Сотрудники',
      icon: <Users className="w-6 h-6" />,
      onClick: () => console.log('Employees clicked')
    },
    {
      id: 'stats',
      label: 'Статистика',
      icon: <BarChart3 className="w-6 h-6" />,
      onClick: () => console.log('Stats clicked')
    },
  ];

  const navItems = items || defaultItems;

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className={`mobile-bottom-nav-item ${
            activeTab === item.id ? 'active' : ''
          }`}
          aria-label={item.label}
          aria-current={activeTab === item.id ? 'page' : undefined}
        >
          <div className="transition-transform duration-200 active:scale-90">
            {item.icon}
          </div>
          <span className="text-xs mt-1 font-medium">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
};

export default MobileBottomNav;
