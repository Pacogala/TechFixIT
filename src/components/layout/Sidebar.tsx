import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  Users, 
  Settings, 
  LogOut,
  TrendingUp,
  PackageSearch,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../lib/firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Panel Principal', icon: LayoutDashboard, path: '/' },
    { name: 'Nueva Recepción', icon: PlusCircle, path: '/recepcion' },
    { name: 'Reparaciones', icon: ClipboardList, path: '/reparaciones' },
    { name: 'Clientes', icon: Users, path: '/clientes' },
    { name: 'Ventas', icon: TrendingUp, path: '/ventas' },
    { name: 'Inventario', icon: PackageSearch, path: '/inventario' },
  ];

  if (isAdmin) {
    navItems.push({ name: 'Usuarios', icon: Users, path: '/usuarios' });
    navItems.push({ name: 'Configuración', icon: Settings, path: '/config' });
  }

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <aside className={cn(
        "w-64 bg-brand-bg/95 border-r border-brand-border fixed inset-y-0 left-0 z-50 transition-transform duration-300 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 md:p-8 flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tighter gradient-text">TECHCRM</h2>
          <button 
            onClick={onClose}
            className="md:hidden p-2 text-brand-text-dim hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onClose()}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all group text-sm font-medium",
                isActive 
                  ? "bg-brand-primary/10 text-brand-primary" 
                  : "text-brand-text-dim hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="size-4.5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-brand-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-brand-secondary flex items-center justify-center text-white font-bold text-xs shrink-0">
              {user?.name?.[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-brand-text text-xs font-bold truncate">{user?.name}</p>
              <p className="text-brand-text-dim text-[10px] uppercase font-bold tracking-tighter">
                {user?.role === 'admin' ? 'Administrador' : 'Técnico'}
              </p>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-brand-text-dim hover:text-brand-danger hover:bg-brand-danger/10 transition-all font-medium text-xs"
          >
            <LogOut className="size-4" />
            Cerrar Sesión
          </button>

          <div className="mt-6 text-[10px] text-brand-text-dim/50 font-bold uppercase tracking-widest text-center">
            v2.4.0 High-Performance
          </div>
        </div>
      </aside>
    </>
  );
}

