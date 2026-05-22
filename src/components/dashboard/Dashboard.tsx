import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ClipboardList, 
  Users, 
  TrendingUp, 
  AlertCircle,
  Clock,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { Repair, Sale, Customer } from '../../types';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="card flex flex-col justify-between"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="size-5 text-white" />
        </div>
        {trend && (
          <span className="text-[10px] font-bold text-brand-success bg-brand-success/10 px-2 py-1 rounded-md">
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-brand-text-dim text-[10px] font-bold uppercase tracking-widest mb-1">{title}</h3>
        <p className="text-3xl font-black text-brand-text tracking-tighter">{value}</p>
      </div>
    </motion.div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    pending: 0,
    inProcess: 0,
    ready: 0,
    monthlySales: 0,
    totalCustomers: 0,
    newCustomers: 0
  });
  const [recentRepairs, setRecentRepairs] = useState<Repair[]>([]);

  useEffect(() => {
    // Repairs counts
    const unsubRepairs = onSnapshot(collection(db, 'repairs'), (snapshot) => {
      const repairs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Repair));
      setStats(prev => ({
        ...prev,
        pending: repairs.filter(r => r.status === 'recibido').length,
        inProcess: repairs.filter(r => r.status === 'diagnostico' || r.status === 'esperando_piezas').length,
        ready: repairs.filter(r => r.status === 'reparado').length
      }));
    });

    // Recent repairs list
    const qRecent = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'), limit(5));
    const unsubRecent = onSnapshot(qRecent, (snapshot) => {
      setRecentRepairs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Repair)));
    });

    // Sales
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      const sales = snapshot.docs.map(d => d.data() as Sale);
      const total = sales.filter(s => s.status === 'vendido').reduce((acc, s) => acc + s.total, 0);
      setStats(prev => ({ ...prev, monthlySales: total }));
    });

    // Customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setStats(prev => ({ ...prev, totalCustomers: snapshot.size }));
    });

    return () => {
      unsubRepairs();
      unsubRecent();
      unsubSales();
      unsubCustomers();
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-brand-text tracking-tight">Panel de Control</h1>
          <p className="text-brand-text-dim text-sm font-medium">¡Hola {user?.name}! Estas son las métricas de hoy.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-brand-text">{new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>
            <p className="text-[10px] text-brand-text-dim uppercase font-bold tracking-widest">Estado del Sistema</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand-secondary/20 border border-brand-secondary/30 flex items-center justify-center">
            <CheckCircle2 className="size-5 text-brand-secondary" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Pendientes" 
          value={stats.pending} 
          icon={Clock} 
          color="bg-brand-primary" 
        />
        <StatCard 
          title="En Proceso" 
          value={stats.inProcess} 
          icon={AlertCircle} 
          color="bg-brand-secondary" 
        />
        <StatCard 
          title="Listos" 
          value={stats.ready} 
          icon={CheckCircle2} 
          color="bg-brand-success" 
        />
        <StatCard 
          title="Ventas (Acum)" 
          value={`$${stats.monthlySales > 1000 ? (stats.monthlySales/1000).toFixed(1) + 'k' : stats.monthlySales}`} 
          icon={TrendingUp} 
          color="bg-slate-700" 
          trend="+12%"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-brand-text flex items-center gap-2">
              <ClipboardList className="text-brand-primary size-5" />
              Servicios Recientes
            </h2>
            <button className="text-[10px] uppercase font-bold text-brand-primary hover:underline">Ver Todo</button>
          </div>
          <div className="space-y-3">
            {recentRepairs.map((repair) => (
              <div key={repair.id} className="flex items-center justify-between p-4 rounded-xl bg-brand-bg/50 border border-brand-border hover:border-brand-primary/30 transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="bg-brand-bg p-2 rounded-lg border border-brand-border group-hover:border-brand-secondary/50">
                    <PackageCheck className="text-brand-secondary size-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-brand-text text-sm">{repair.equipment.brand} {repair.equipment.model}</h4>
                    <p className="text-[10px] text-brand-text-dim uppercase font-bold tracking-tight">Ticket #{repair.id.substring(0,6).toUpperCase()} • {repair.customerName || 'Cliente No Identificado'}</p>
                  </div>
                </div>
                <div className="badge badge-blue">
                  {repair.status}
                </div>
              </div>
            ))}
            {recentRepairs.length === 0 && (
              <div className="text-center py-10 opacity-30 italic font-medium">No hay reparaciones registradas</div>
            )}
          </div>
        </div>

        <div className="card relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Users className="text-brand-secondary size-5" />
              Base de Datos
            </h2>
            <div className="bg-brand-bg/40 p-6 rounded-2xl border border-brand-border text-center">
              <p className="text-4xl font-black text-brand-secondary mb-1">{stats.totalCustomers}</p>
              <p className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">Clientes Totales</p>
            </div>
            
            <div className="mt-8 space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">Nuevos Clientes (Estimado)</span>
                <span className="text-sm font-bold text-brand-success">+2</span>
              </div>
              <div className="w-full bg-brand-bg h-1.5 rounded-full overflow-hidden">
                <div className="bg-brand-secondary h-full w-[15%]" />
              </div>
            </div>
          </div>
          
          <div className="mt-10 p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
            <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-1 italic">TIP DEL SISTEMA</p>
            <p className="text-[10px] text-brand-text-dim leading-relaxed">Recuerda actualizar el stock después de cada recepción de equipo.</p>
          </div>
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-secondary/5 rounded-full blur-3xl -mr-16 -mt-16" />
        </div>
      </div>
    </div>
  );
}
