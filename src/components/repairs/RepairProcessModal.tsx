import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { updateDoc, doc, collection, addDoc, serverTimestamp, getDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Repair, RepairStatus, Product } from '../../types';
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
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  
  // Inventory integration states
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [registeringPartIndex, setRegisteringPartIndex] = useState<number | null>(null);
  const [regCategory, setRegCategory] = useState('Hardware');
  const [regSku, setRegSku] = useState('');
  const [regStock, setRegStock] = useState(5);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'business')).then((snap) => {
      if (snap.exists()) {
        setBusiness(snap.data());
      }
    }).catch(err => console.error("Error loading business info in RepairProcessModal:", err));

    // Subscribe to products in inventory
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDbProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => {
      console.error("Error subscribing to products inside RepairProcessModal:", err);
    });

    return unsubscribe;
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

  const updatePart = (index: number, fieldOrFields: string | Record<string, any>, value?: any) => {
    setParts(prev => {
      const newParts = [...prev];
      if (typeof fieldOrFields === 'string') {
        newParts[index] = { ...newParts[index], [fieldOrFields]: value };
      } else {
        newParts[index] = { ...newParts[index], ...fieldOrFields };
      }
      return newParts;
    });
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
                      <div className="flex flex-wrap gap-2.5">
                        {repair.photos.map((photoUrl, index) => (
                          <div 
                            key={index} 
                            onClick={() => setLightboxPhoto(photoUrl)}
                            className="relative block w-14 h-14 rounded-xl border border-brand-border/60 overflow-hidden hover:scale-105 active:scale-95 transition-all cursor-pointer bg-brand-bg shadow-sm group/photo"
                          >
                            <img 
                              src={photoUrl} 
                              alt={`Evidencia ${index + 1}`} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[9px] font-black text-white uppercase tracking-wider font-mono">VER</span>
                            </div>
                          </div>
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
                    <div key={i} className="p-3 bg-brand-bg rounded-xl border border-brand-border space-y-2 relative group overflow-visible">
                      <button 
                        onClick={() => removePart(i)}
                        className="absolute top-2 right-2 text-brand-text-dim hover:text-brand-danger opacity-0 group-hover:opacity-100 transition-all z-10"
                      >
                        <Trash2 size={12} />
                      </button>
                      
                      {/* Name input with Autocomplete */}
                      <div className="relative">
                        <input 
                          className="input-base py-1.5 text-xs pr-8" 
                          placeholder="Nombre de la refacción"
                          value={part.name}
                          onChange={(e) => {
                            updatePart(i, 'name', e.target.value);
                            setActiveDropdownIndex(i);
                          }}
                          onFocus={() => setActiveDropdownIndex(i)}
                          onBlur={() => {
                            // Delay to allow clicking on dropdown items
                            setTimeout(() => setActiveDropdownIndex(null), 250);
                          }}
                        />
                        
                        {activeDropdownIndex === i && part.name.trim() && (
                          <div className="absolute left-0 right-0 mt-1 bg-brand-card border border-brand-border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50">
                            {dbProducts
                              .filter(p => p.name.toLowerCase().includes(part.name.toLowerCase()))
                              .map(p => (
                                <div 
                                  key={p.id}
                                  className="p-3 hover:bg-brand-primary/15 cursor-pointer flex justify-between items-center text-xs border-b border-brand-border/30 last:border-0 transition-colors"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    updatePart(i, { name: p.name, price: p.price });
                                    setActiveDropdownIndex(null);
                                  }}
                                >
                                  <div>
                                    <p className="font-bold text-brand-text">{p.name}</p>
                                    <p className="text-[10px] text-brand-text-dim font-bold uppercase tracking-wide">
                                      Stock: {p.stock} • SKU: {p.sku || 'N/A'}
                                    </p>
                                  </div>
                                  <span className="font-black text-xs text-brand-primary font-mono">${p.price.toLocaleString()}</span>
                                </div>
                              ))}
                            {dbProducts.filter(p => p.name.toLowerCase().includes(part.name.toLowerCase())).length === 0 && (
                              <div className="p-3 text-center text-[10px] text-brand-text-dim italic font-medium">
                                No se encontraron coincidencias exactas.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

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
                          value={part.price || ''}
                          onChange={(e) => updatePart(i, 'price', Number(e.target.value))}
                        />
                      </div>

                      {/* Stock Inventory Matches indicator & actions */}
                      {part.name.trim() && (
                        (() => {
                          const exactMatch = dbProducts.find(p => p.name.toLowerCase() === part.name.trim().toLowerCase());
                          if (exactMatch) {
                            return (
                              <div className="mt-1 pt-1.5 border-t border-brand-border/30 flex items-center justify-between">
                                <span className="text-[9px] font-black text-brand-success uppercase tracking-wider flex items-center gap-1 font-mono">
                                  ✓ En Inventario
                                </span>
                                <span className="text-[9px] font-bold text-brand-text-dim uppercase font-mono bg-brand-bg px-2 py-0.5 rounded border border-brand-border/40">
                                  Stock: {exactMatch.stock} u.
                                </span>
                              </div>
                            );
                          } else {
                            return (
                              <div className="mt-1 pt-1.5 border-t border-brand-border/30 flex items-center justify-between">
                                <span className="text-[9px] font-bold text-brand-text-dim flex items-center gap-1 font-mono uppercase">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-danger animate-pulse"></span> No registrado
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRegisteringPartIndex(i);
                                    setRegCategory('Hardware');
                                    setRegSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
                                    setRegStock(5);
                                  }}
                                  className="text-[9px] font-black text-brand-primary hover:underline hover:text-brand-primary/80 uppercase tracking-wide flex items-center gap-1 bg-brand-primary/5 px-2.5 py-1.5 rounded-xl border border-brand-primary/20 transition-all active:scale-95"
                                >
                                  + Guardar en Inventario
                                </button>
                              </div>
                            );
                          }
                        })()
                      )}

                      {/* Inline Product Creator Form */}
                      {registeringPartIndex === i && (
                        <div className="mt-2 p-3 bg-brand-card rounded-xl border border-brand-primary/40 space-y-3 animate-fade-in text-left">
                          <div className="flex justify-between items-center pb-1 border-b border-brand-border/50">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Registrar en Inventario</h4>
                            <button 
                              type="button" 
                              onClick={() => setRegisteringPartIndex(null)}
                              className="text-sm text-brand-text-dim hover:text-white font-bold px-1"
                            >
                              &times;
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-left">
                            <div className="form-group flex flex-col">
                              <label className="text-[8px] uppercase font-bold text-brand-text-dim mb-1">Categoría</label>
                              <select 
                                value={regCategory}
                                onChange={(e) => setRegCategory(e.target.value)}
                                className="input-base py-1 px-2 text-[10px] bg-brand-bg border-brand-border h-7"
                              >
                                <option>Hardware</option>
                                <option>Accesorios</option>
                                <option>Pantallas</option>
                                <option>Baterías</option>
                                <option>Servicios</option>
                              </select>
                            </div>
                            <div className="form-group flex flex-col">
                              <label className="text-[8px] uppercase font-bold text-brand-text-dim mb-1">SKU / Código</label>
                              <input 
                                value={regSku}
                                onChange={(e) => setRegSku(e.target.value)}
                                className="input-base py-1 px-2 text-[10px] h-7"
                                placeholder="SKU-XXXX"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-left">
                            <div className="form-group flex flex-col">
                              <label className="text-[8px] uppercase font-bold text-brand-text-dim mb-1">Stock Inicial</label>
                              <input 
                                type="number"
                                value={regStock}
                                onChange={(e) => setRegStock(Number(e.target.value))}
                                className="input-base py-1 px-2 text-[10px] h-7"
                              />
                            </div>
                            <div className="form-group flex flex-col">
                              <label className="text-[8px] uppercase font-bold text-brand-text-dim mb-1">Precio</label>
                              <input 
                                type="number"
                                disabled
                                value={part.price || 0}
                                className="input-base py-1 px-2 text-[10px] opacity-60 cursor-not-allowed h-7"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button 
                              type="button"
                              onClick={() => setRegisteringPartIndex(null)}
                              className="btn-outline flex-1 py-1 text-[9px] uppercase tracking-wider h-7"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="button"
                              onClick={async () => {
                                try {
                                  if (!part.name.trim()) return;
                                  await addDoc(collection(db, 'products'), {
                                    name: part.name.trim(),
                                    category: regCategory,
                                    sku: regSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                                    price: Number(part.price || 0),
                                    stock: Number(regStock),
                                    minStock: 2,
                                  });
                                  
                                  // Log activity
                                  logActivity(ActivityAction.CREATE, `Registrado nuevo producto desde presupuesto: ${part.name.trim()}`);
                                  setRegisteringPartIndex(null);
                                  alert('¡Producto agregado al inventario con éxito!');
                                } catch (err) {
                                  console.error("Error creating product from quote:", err);
                                  alert('Error al registrar producto');
                                }
                              }}
                              className="btn-primary flex-1 py-1 text-[9px] uppercase tracking-wider bg-brand-primary hover:bg-brand-primary/95 text-white font-black h-7"
                            >
                              Registrar
                            </button>
                          </div>
                        </div>
                      )}
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

        <footer className="p-6 border-t border-brand-border bg-brand-bg/50 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
             <select 
               className="btn-outline text-[10px] font-black tracking-widest py-2.5 flex-1 sm:flex-none animate-fade-in"
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
              className="btn-outline py-2.5 text-[10px] font-black flex-1 sm:flex-none"
             >
               GUARDAR PROGRESO
             </button>
          </div>

          <div className="flex flex-wrap gap-2.5 justify-stretch lg:justify-end">
            <button 
              type="button"
              onClick={async () => {
                await generateReceptionReceipt({
                  id: repair.id.substring(0, 8).toUpperCase(),
                  client: repair.client || { name: 'N/A', phone: '000' },
                  equipment: repair.equipment,
                  notes: repair.notes || '',
                  business: business || undefined,
                  photos: repair.photos || []
                });
              }}
              className="btn-outline py-2.5 text-[10px] font-black flex items-center justify-center gap-2 border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10 flex-1 sm:flex-none whitespace-nowrap"
            >
              <Printer size={14} /> RECIBO RECEPCIÓN
            </button>
            <button 
              onClick={async () => await generateRepairReceipt(repair, business)}
              className="btn-outline py-2.5 text-[10px] font-black flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap"
            >
              <Printer size={14} /> TICKET SERVICIO
            </button>
            <button 
              onClick={() => handleSave(true)}
              disabled={loading || !authorized}
              className="btn-primary py-2.5 px-6 bg-brand-success hover:bg-brand-success/90 text-[10px] font-black flex items-center justify-center gap-2 disabled:opacity-50 flex-1 sm:flex-none whitespace-nowrap"
            >
              <CreditCard size={14} /> LIQUIDAR Y CERRAR
            </button>
          </div>
        </footer>
      </motion.div>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxPhoto(null)}
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-brand-border/40 bg-zinc-950 flex flex-col items-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={lightboxPhoto} 
                alt="Detalle de Evidencia" 
                className="max-w-full max-h-[75vh] object-contain rounded-t-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="w-full p-4 flex justify-between items-center bg-brand-card border-t border-brand-border/40">
                <span className="text-xs font-bold text-brand-text-dim">Evidencia fotográfica registrada</span>
                <button 
                  onClick={() => setLightboxPhoto(null)} 
                  className="btn-primary py-1.5 px-4 bg-brand-danger hover:bg-brand-danger/90 text-[10px] font-black"
                >
                  CERRAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
