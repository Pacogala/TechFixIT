import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { Repair, RepairStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Smartphone, 
  Printer, 
  Trash2, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  Package,
  Filter,
  Calendar,
  User,
  History,
  Activity
} from 'lucide-react';
import { generateReceptionReceipt } from '../../lib/pdfService';
import { ActivityAction, logActivity } from '../../lib/activityLogger';
import RepairProcessModal from './RepairProcessModal';
import { getWhatsAppLink } from '../../lib/whatsappUtils';

const STATUS_CONFIG: Record<RepairStatus, { label: string; color: string; icon: any }> = {
  recibido: { label: 'RECIBIDO', color: 'bg-brand-primary/20 text-brand-primary border-brand-primary/30', icon: Clock },
  diagnostico: { label: 'DIAGNÓSTICO', color: 'bg-brand-secondary/20 text-brand-secondary border-brand-secondary/30', icon: Search },
  esperando_piezas: { label: 'ESPERANDO PIEZAS', color: 'bg-brand-warning/20 text-brand-warning border-brand-warning/30', icon: Package },
  reparado: { label: 'REPARADO', color: 'bg-brand-success/20 text-brand-success border-brand-success/30', icon: Wrench },
  entregado: { label: 'ENTREGADO', color: 'bg-brand-text-dim/20 text-brand-text-dim border-brand-border', icon: CheckCircle2 },
};

export default function RepairList() {
  const { isAdmin } = useAuth();
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<RepairStatus | 'all'>('all');
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'repairs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRepairs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Repair)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'repairs'));

    getDoc(doc(db, 'settings', 'business')).then((snap) => {
      if (snap.exists()) {
        setBusiness(snap.data());
      }
    }).catch(err => console.error("Error fetching business info in RepairList:", err));

    return unsubscribe;
  }, []);

  const updateStatus = async (repairId: string, newStatus: RepairStatus) => {
    try {
      await updateDoc(doc(db, 'repairs', repairId), { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      logActivity(ActivityAction.UPDATE, `Estado de reparación #${repairId.substring(0,8)} cambiado a ${newStatus}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'repairs');
    }
  };

  const deleteRepair = async (id: string) => {
    if (confirm('¿Eliminar registro de reparación permanentemente?')) {
      try {
        await deleteDoc(doc(db, 'repairs', id));
        logActivity(ActivityAction.DELETE, `Reparación #${id.substring(0,8)} eliminada`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'repairs');
      }
    }
  };

  const shareWhatsApp = (repair: any) => {
    const statusLabel = STATUS_CONFIG[repair.status as RepairStatus].label;
    const message = `*TechCRM - Actualización de Servicio*\n\nHola ${repair.client?.name || 'cliente'}, te informamos el estado de tu equipo:\n\n*Equipo:* ${repair.equipment.brand} ${repair.equipment.model}\n*Folio:* #${repair.id.substring(0,8).toUpperCase()}\n*Estado Actual:* ${statusLabel}\n\nGracias por tu confianza.`;
    const url = getWhatsAppLink(repair.client?.phone || '', message, business?.whatsappDefaultPrefix || '52');
    window.open(url, '_blank');
  };

  const downloadPDF = async (repair: any) => {
    await generateReceptionReceipt({
      id: repair.id.substring(0, 8).toUpperCase(),
      client: repair.client || { name: 'N/A', phone: '000' },
      equipment: repair.equipment,
      notes: repair.notes || '',
      business: business || undefined
    });
  };

  const filteredRepairs = repairs.filter(r => {
    const matchesSearch = 
      r.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.equipment?.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-brand-text tracking-tighter">Panel de Reparaciones</h1>
          <p className="text-brand-text-dim text-sm font-medium">Seguimiento de órdenes de servicio activo.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline flex items-center gap-2 text-[10px] py-1.5 px-3">
            <History className="size-3" /> Ver Historial
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim size-4" />
          <input 
            type="text" 
            placeholder="Buscar por cliente, modelo o folio..."
            className="input-base pl-12 h-12 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 bg-brand-card p-1 rounded-xl border border-brand-border overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest whitespace-nowrap transition-all ${filterStatus === 'all' ? 'bg-brand-primary text-white' : 'text-brand-text-dim hover:text-white'}`}
          >
            TODAS
          </button>
          {(Object.keys(STATUS_CONFIG) as RepairStatus[]).map((status) => (
            <button 
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest whitespace-nowrap transition-all ${filterStatus === status ? 'bg-brand-primary text-white' : 'text-brand-text-dim hover:text-white'}`}
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {filteredRepairs.map((repair) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={repair.id}
              className="card p-0 overflow-hidden group hover:border-brand-primary/30 transition-all border-brand-border/50 cursor-pointer"
              onClick={() => setSelectedRepair(repair)}
            >
              <div className="flex flex-col md:flex-row">
                {/* Status Column */}
                <div className={`md:w-2 flex transition-all ${STATUS_CONFIG[repair.status as RepairStatus]?.color.split(' ')[2] || 'bg-brand-border'}`} />
                
                <div className="flex-1 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-brand-bg rounded-2xl flex items-center justify-center border border-brand-border text-brand-primary">
                      {STATUS_CONFIG[repair.status as RepairStatus] ? (
                        <div className={STATUS_CONFIG[repair.status as RepairStatus].color.split(' ')[1]}>
                          {(() => {
                            const Icon = STATUS_CONFIG[repair.status as RepairStatus].icon;
                            return <Icon className="size-6" />;
                          })()}
                        </div>
                      ) : <Clock className="size-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded">#{repair.id.substring(0,8).toUpperCase()}</span>
                        <h3 className="font-bold text-brand-text">{repair.equipment.brand} {repair.equipment.model}</h3>
                        {repair.quote?.authorized && (
                          <span className="text-[8px] font-black text-brand-success flex items-center gap-1 uppercase tracking-tighter">
                            <CheckCircle2 size={10} /> Autorizado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-brand-text-dim font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1"><User className="size-3" /> {repair.client?.name || 'S/N'}</span>
                        <span className="flex items-center gap-1 text-brand-secondary"><Activity className="size-3" /> {STATUS_CONFIG[repair.status as RepairStatus]?.label}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 w-full md:w-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex-1 md:flex-none">
                      <select 
                        value={repair.status}
                        onChange={(e) => updateStatus(repair.id, e.target.value as RepairStatus)}
                        className={`text-[10px] font-black tracking-widest uppercase py-2 px-4 rounded-xl border appearance-none cursor-pointer transition-all ${STATUS_CONFIG[repair.status as RepairStatus].color}`}
                      >
                        {(Object.keys(STATUS_CONFIG) as RepairStatus[]).map(s => (
                          <option key={s} value={s} className="bg-brand-card text-brand-text">{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => shareWhatsApp(repair)}
                        className="p-2.5 text-brand-text-dim hover:text-brand-success bg-brand-bg rounded-xl border border-brand-border hover:border-brand-success/30 transition-all outline-none"
                        title="Notificar WhatsApp"
                      >
                        <Smartphone className="size-4" />
                      </button>
                      <button 
                        onClick={() => downloadPDF(repair)}
                        className="p-2.5 text-brand-text-dim hover:text-brand-primary bg-brand-bg rounded-xl border border-brand-border hover:border-brand-primary/30 transition-all outline-none"
                        title="Imprimir Ticket"
                      >
                        <Printer className="size-4" />
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => deleteRepair(repair.id)}
                          className="p-2.5 text-brand-text-dim hover:text-brand-danger bg-brand-bg rounded-xl border border-brand-border hover:border-brand-danger/30 transition-all outline-none"
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredRepairs.length === 0 && !loading && (
          <div className="text-center py-20 bg-brand-card rounded-3xl border-2 border-dashed border-brand-border">
            <Filter className="size-12 text-brand-text-dim mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-black text-brand-text">No se encontraron reparaciones</h3>
            <p className="text-brand-text-dim text-xs">Intenta cambiar los filtros o el término de búsqueda.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRepair && (
          <RepairProcessModal 
            repair={selectedRepair} 
            onClose={() => setSelectedRepair(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
