import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { updateDoc, doc, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Repair, RepairStatus } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Wrench, 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Printer, 
  CreditCard,
  AlertCircle,
  Hash
} from 'lucide-react';
import { generateRepairReceipt, generateReceptionReceipt } from '../../lib/pdfService';
import { ActivityAction, logActivity } from '../../lib/activityLogger';

interface RepairProcessModalProps {
  repair: Repair;
  onClose: () => void;
}

export default function RepairProcessModal({ repair, onClose }: RepairProcessModalProps) {
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState(repair.diagnostic || '');
  const [actions, setActions] = useState<string[]>(repair.actionsPerformed || []);
  const [newAction, setNewAction] = useState('');
  const [parts, setParts] = useState(repair.parts || []);
  const [labor, setLabor] = useState(repair.quote?.labor || 0);
  const [status, setStatus] = useState<RepairStatus>(repair.status);
  const [authorized, setAuthorized] = useState(repair.quote?.authorized || false);
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'business')).then((snap) => {
      if (snap.exists()) {
        setBusiness(snap.data());
      }
    }).catch(err => console.error("Error loading business info in RepairProcessModal:", err));
  }, []);

  // Totals calculation
  const partsTotal = parts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  const finalTotal = partsTotal + Number(labor);

  const addAction = () => {
    if (newAction.trim()) {
      setActions([...actions, newAction.trim()]);
      setNewAction('');
    }
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const addPart = () => {
    setParts([...parts, { name: '', serial: '', price: 0, quantity: 1 }]);
  };

  const updatePart = (index: number, field: string, value: any) => {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], [field]: value };
    setParts(newParts);
  };

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handleSave = async (isFinalPayment = false) => {
    setLoading(true);
    try {
      const updateData: any = {
        diagnostic,
        actionsPerformed: actions,
        parts,
        quote: {
          total: finalTotal,
          labor: Number(labor),
          authorized,
          authorizedAt: authorized && !repair.quote?.authorized ? new Date().toISOString() : repair.quote?.authorizedAt || null,
        },
        status: isFinalPayment ? 'entregado' : status,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'repairs', repair.id), updateData);
      
      logActivity(ActivityAction.UPDATE, `Actualizada reparación #${repair.id.substring(0,8)}. Estado: ${updateData.status}`);

      if (isFinalPayment) {
        // Register as a Sale automatically
        await addDoc(collection(db, 'sales'), {
          customerId: repair.customerId,
          repairId: repair.id,
          items: [
            { name: `Servicio Técnico: ${repair.equipment.brand} ${repair.equipment.model}`, price: finalTotal, quantity: 1 }
          ],
          total: finalTotal,
          status: 'vendido',
          createdAt: serverTimestamp()
        });
        logActivity(ActivityAction.SALE, `Venta generada por liquidación de reparación #${repair.id.substring(0,8)}`);
        await generateRepairReceipt({ ...repair, ...updateData }, business);
        onClose();
      } else {
        alert('Cambios guardados correctamente');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'repairs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-brand-bg/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative z-10"
      >
        <header className="p-6 border-b border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter">GESTIÓN DE SERVICIO</h2>
              <p className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">
                #{repair.id.substring(0,8).toUpperCase()} • {repair.equipment.brand} {repair.equipment.model}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-brand-text-dim hover:text-white transition-colors">
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column: Diagnostics & Actions */}
            <div className="space-y-6">
              {/* Datos de Recepción */}
              <section className="p-4 bg-brand-bg/65 rounded-2xl border border-brand-border space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-brand-secondary flex items-center gap-2">
                  <ClipboardCheck size={14} /> Observaciones de Recepción
                </h3>
                <div className="space-y-3">
                  <p className="text-xs text-brand-text whitespace-pre-wrap leading-relaxed">
                    {repair.notes || 'Sin observaciones registradas durante la recepción.'}
                  </p>
                  
                  {repair.photos && repair.photos.length > 0 && (
                    <div className="pt-2 border-t border-brand-border/30">
                      <p className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest mb-2 font-mono">EVIDENCIA DE RECEPCIÓN</p>
                      <div className="flex flex-wrap gap-2">
                        {repair.photos.map((photoUrl, index) => (
                          <a 
                            key={index} 
                            href={photoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="relative block w-12 h-12 rounded-lg border border-brand-border overflow-hidden hover:scale-105 active:scale-95 transition-all"
                          >
                            <img 
                              src={photoUrl} 
                              alt={`Evidencia ${index + 1}`} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[8px] font-bold text-white uppercase font-mono">VER</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3 py-1">
                <label className="text-xs font-black text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                  <ClipboardCheck size={14} className="text-brand-primary" /> Diagnóstico Técnico
                </label>
                <textarea 
                  className="input-base min-h-[120px] resize-none"
                  placeholder="Describe la falla encontrada y el diagnóstico..."
                  value={diagnostic}
                  onChange={(e) => setDiagnostic(e.target.value)}
                />
              </section>

              <section className="space-y-3">
                <label className="text-xs font-black text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                  <Wrench size={14} className="text-brand-secondary" /> Acciones Realizadas:
                </label>
                <div className="flex gap-2">
                  <input 
                    className="input-base"
                    placeholder="Ej: Limpieza de ventiladores..."
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addAction()}
                  />
                  <button onClick={addAction} className="btn-primary px-3"><Plus size={20} /></button>
                </div>
                <div className="space-y-2">
                  {actions.map((action, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-brand-bg rounded-lg border border-brand-border group">
                      <span className="text-sm">{action}</span>
                      <button onClick={() => removeAction(i)} className="text-brand-text-dim hover:text-brand-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Column: Parts & Quote */}
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                    <Hash size={14} className="text-brand-success" /> Refacciones y Materiales
                  </label>
                  <button onClick={addPart} className="text-[10px] font-black text-brand-primary hover:underline uppercase tracking-widest">
                    + Añadir Refacción
                  </button>
                </div>
                
                <div className="space-y-2">
                  {parts.map((part, i) => (
                    <div key={i} className="p-3 bg-brand-bg rounded-xl border border-brand-border space-y-2 relative group">
                      <button 
                        onClick={() => removePart(i)}
                        className="absolute top-2 right-2 text-brand-text-dim hover:text-brand-danger opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                      <input 
                        className="input-base py-1.5 text-xs" 
                        placeholder="Nombre de la refacción"
                        value={part.name}
                        onChange={(e) => updatePart(i, 'name', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          className="input-base py-1.5 text-[10px]" 
                          placeholder="Num. Serie (opcional)"
                          value={part.serial}
                          onChange={(e) => updatePart(i, 'serial', e.target.value)}
                        />
                        <input 
                          type="number"
                          className="input-base py-1.5 text-xs" 
                          placeholder="Precio"
                          value={part.price}
                          onChange={(e) => updatePart(i, 'price', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  ))}
                  {parts.length === 0 && (
                    <div className="py-8 text-center border-2 border-dashed border-brand-border rounded-xl opacity-30 text-xs italic">
                      No se han registrado refacciones
                    </div>
                  )}
                </div>
              </section>

              <section className="card p-4 bg-brand-bg border-brand-primary/20 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-brand-primary">Presupuesto del Servicio</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-text-dim">Mano de Obra</span>
                    <input 
                      type="number"
                      className="w-24 text-right bg-transparent border-b border-brand-border outline-none focus:border-brand-primary font-bold"
                      value={labor}
                      onChange={(e) => setLabor(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-text-dim">Total Refacciones</span>
                    <span className="font-bold">${partsTotal.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-brand-border flex justify-between items-center">
                    <span className="font-black text-sm uppercase tracking-tighter">Liquidación Total</span>
                    <span className="text-2xl font-black text-brand-primary tracking-tighter">${finalTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div 
                  onClick={() => setAuthorized(!authorized)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${authorized ? 'bg-brand-success/10 border-brand-success text-brand-success' : 'bg-brand-bg border-brand-border text-brand-text-dim'}`}
                >
                  <CheckCircle2 size={18} />
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Autorización Cliente</p>
                    <p className="text-[9px] font-bold opacity-80">{authorized ? 'SERVICIO AUTORIZADO' : 'PENDIENTE DE AUTORIZACIÓN'}</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <footer className="p-6 border-t border-brand-border bg-brand-bg/50 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
             <select 
               className="btn-outline text-[10px] font-black tracking-widest py-2.5"
               value={status}
               onChange={(e) => setStatus(e.target.value as RepairStatus)}
             >
               <option value="recibido">RECIBIDO</option>
               <option value="diagnostico">DIAGNÓSTICO</option>
               <option value="esperando_piezas">ESPERANDO PIEZAS</option>
               <option value="reparado">REPARADO</option>
             </select>
             <button 
              onClick={() => handleSave(false)}
              disabled={loading}
              className="btn-outline py-2.5 text-[10px] font-black"
             >
               GUARDAR PROGRESO
             </button>
          </div>

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={async () => {
                await generateReceptionReceipt({
                  id: repair.id.substring(0, 8).toUpperCase(),
                  client: repair.client || { name: 'N/A', phone: '000' },
                  equipment: repair.equipment,
                  notes: repair.notes || '',
                  business: business || undefined
                });
              }}
              className="btn-outline py-2.5 text-[10px] font-black flex items-center gap-2 border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10"
            >
              <Printer size={14} /> RECIBO RECEPCIÓN
            </button>
            <button 
              onClick={async () => await generateRepairReceipt(repair, business)}
              className="btn-outline py-2.5 text-[10px] font-black flex items-center gap-2"
            >
              <Printer size={14} /> TICKET SERVICIO
            </button>
            <button 
              onClick={() => handleSave(true)}
              disabled={loading || !authorized}
              className="btn-primary py-2.5 px-6 bg-brand-success hover:bg-brand-success/90 text-[10px] font-black flex items-center gap-2 disabled:opacity-50"
            >
              <CreditCard size={14} /> LIQUIDAR Y CERRAR
            </button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
