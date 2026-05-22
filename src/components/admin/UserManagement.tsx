import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { User, Activity } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { 
  Users, 
  Shield, 
  Trash2, 
  History, 
  UserPlus, 
  Mail,
  ShieldCheck,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { ActivityAction, logActivity } from '../../lib/activityLogger';

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
    });

    const qActivities = query(collection(db, 'activities'), orderBy('timestamp', 'desc'));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Activity)).slice(0, 20));
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubActivities();
    };
  }, []);

  const toggleRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'technician' : 'admin';
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
      logActivity(ActivityAction.UPDATE, `Rol de ${user.name} cambiado a ${newRole}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const removeUser = async (user: User) => {
    if (confirm(`¿Eliminar acceso a ${user.name}?`)) {
      try {
        await deleteDoc(doc(db, 'users', user.uid));
        logActivity(ActivityAction.DELETE, `Acceso de ${user.name} eliminado`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'users');
      }
    }
  };

  if (!isAdmin) return <div className="p-20 text-center text-brand-text-dim">Acceso Restringido</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black text-brand-text tracking-tighter">Gestión de Usuarios</h1>
        <p className="text-brand-text-dim text-sm font-medium">Control de acceso y roles del sistema.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-brand-text flex items-center gap-2">
            <Users className="size-4 text-brand-primary" /> Usuarios del Sistema
          </h2>
          <div className="grid gap-4">
            {users.map((u) => (
              <div key={u.uid} className="card p-6 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${u.role === 'admin' ? 'bg-brand-secondary/10 text-brand-secondary' : 'bg-brand-primary/10 text-brand-primary'}`}>
                    {u.role === 'admin' ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-brand-text">{u.name}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-brand-text-dim font-bold uppercase tracking-widest">
                      <Mail className="size-3" /> {u.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex bg-brand-bg p-1 rounded-xl border border-brand-border h-fit">
                    <button 
                      onClick={() => u.role !== 'technician' && toggleRole(u)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                        u.role === 'technician' 
                        ? 'bg-brand-primary text-white shadow-lg' 
                        : 'text-brand-text-dim hover:text-white'
                      }`}
                    >
                      TÉCNICO
                    </button>
                    <button 
                      onClick={() => u.role !== 'admin' && toggleRole(u)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                        u.role === 'admin' 
                        ? 'bg-brand-secondary text-white shadow-lg' 
                        : 'text-brand-text-dim hover:text-white'
                      }`}
                    >
                      ADMIN
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => removeUser(u)}
                    className="p-2.5 text-brand-text-dim hover:text-brand-danger transition-colors bg-brand-bg rounded-xl border border-brand-border hover:border-brand-danger/30"
                    title="Eliminar Acceso"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-brand-text flex items-center gap-2">
            <History className="size-4 text-brand-secondary" /> Actividad Reciente
          </h2>
          <div className="card space-y-4 bg-brand-bg shadow-inner border-none h-[600px] overflow-y-auto pr-2 scrollbar-hide">
            {activities.map((activity) => (
              <div key={activity.id} className="p-4 rounded-xl bg-brand-card border border-brand-border/50 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                    activity.action === 'DELETE' ? 'bg-brand-danger/20 text-brand-danger' : 
                    activity.action === 'CREATE' ? 'bg-brand-success/20 text-brand-success' : 'bg-brand-secondary/20 text-brand-secondary'
                  }`}>
                    {activity.action}
                  </span>
                  <span className="text-[10px] font-bold text-brand-text-dim uppercase flex items-center gap-1">
                    <Clock className="size-3" /> {activity.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs font-bold text-brand-text">{activity.userName}</p>
                <p className="text-[10px] text-brand-text-dim leading-relaxed">{activity.details}</p>
              </div>
            ))}
            {activities.length === 0 && !loading && (
              <div className="text-center py-10 opacity-30 italic text-xs">Sin registros de actividad</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
