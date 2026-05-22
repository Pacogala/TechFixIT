import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Download, Upload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../lib/firebase';
import { collection, writeBatch, doc, getDocs, query, where } from 'firebase/firestore';
import { ActivityAction, logActivity } from '../../lib/activityLogger';

interface CSVUploaderProps {
  type: 'products' | 'customers';
  template: any[];
  onComplete?: () => void;
}

export default function CSVUploader({ type, template, onComplete }: CSVUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ processed: 0, created: 0, updated: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `plantilla_${type}.csv`;
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setData(results.data);
      }
    });
  };

  const processImport = async () => {
    setLoading(true);
    const batch = writeBatch(db);
    let created = 0;
    let updated = 0;

    try {
      const collRef = collection(db, type);
      
      for (const item of data) {
        // Logic for deduplication
        let existingId = null;
        if (type === 'products' && item.sku) {
          const q = query(collRef, where('sku', '==', item.sku));
          const snap = await getDocs(q);
          if (!snap.empty) existingId = snap.docs[0].id;
        } else if (type === 'customers' && item.phone) {
          const q = query(collRef, where('phone', '==', item.phone));
          const snap = await getDocs(q);
          if (!snap.empty) existingId = snap.docs[0].id;
        }

        const cleanItem = { ...item };
        if (type === 'products') {
          cleanItem.price = Number(cleanItem.price) || 0;
          cleanItem.stock = Number(cleanItem.stock) || 0;
          cleanItem.minStock = Number(cleanItem.minStock) || 2;
        }

        if (existingId) {
          batch.update(doc(db, type, existingId), cleanItem);
          updated++;
        } else {
          const newDocRef = doc(collRef);
          batch.set(newDocRef, cleanItem);
          created++;
        }
      }

      await batch.commit();
      setStats({ processed: data.length, created, updated });
      logActivity(ActivityAction.IMPORT, `Importación masiva de ${type}: ${data.length} registros`);
      if (onComplete) onComplete();
      
      setTimeout(() => {
        setIsOpen(false);
        setData([]);
        setStats({ processed: 0, created: 0, updated: 0 });
      }, 3000);
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn-outline flex items-center gap-2 py-2 px-4 text-xs font-bold"
      >
        <Upload className="size-4" /> Importar CSV
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !loading && setIsOpen(false)}
              className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-xl card p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-brand-text uppercase tracking-tight">Importación de {type === 'products' ? 'Inventario' : 'Clientes'}</h3>
                <button onClick={() => setIsOpen(false)} className="text-brand-text-dim hover:text-white"><X className="size-6" /></button>
              </div>

              <div className="space-y-6">
                <div className="bg-brand-bg/50 p-6 rounded-2xl border border-dashed border-brand-border text-center">
                  <p className="text-sm font-medium text-brand-text-dim mb-4">Descarga la plantilla oficial para asegurar el formato correcto.</p>
                  <button onClick={downloadTemplate} className="btn-outline inline-flex items-center gap-2 text-[10px] py-1.5 px-3">
                    <Download className="size-3" /> Descargar Plantilla .CSV
                  </button>
                </div>

                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Seleccionar Archivo</label>
                  <input 
                    type="file" 
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden" 
                    ref={fileInputRef}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-brand-card border border-brand-border p-8 rounded-2xl cursor-pointer hover:border-brand-primary transition-all text-center"
                  >
                    <FileText className="size-10 text-brand-primary mx-auto mb-3" />
                    <p className="font-bold text-sm">{data.length > 0 ? `${data.length} filas detectadas` : 'Click para subir archivo CSV'}</p>
                    <p className="text-[10px] text-brand-text-dim uppercase font-bold tracking-widest mt-1">Soporta duplicidad por SKU/Teléfono</p>
                  </div>
                </div>

                {stats.processed > 0 && (
                  <div className="bg-brand-success/10 border border-brand-success/30 p-4 rounded-xl flex items-center gap-4">
                    <CheckCircle2 className="text-brand-success size-8" />
                    <div>
                      <p className="text-xs font-black text-brand-success uppercase tracking-widest">¡Importación Exitosa!</p>
                      <p className="text-[10px] text-brand-text-dim uppercase font-bold">Procesados: {stats.processed} | Nuevos: {stats.created} | Actualizados: {stats.updated}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setIsOpen(false)} className="flex-1 btn-outline">Cerrar</button>
                  <button 
                    disabled={data.length === 0 || loading}
                    onClick={processImport}
                    className="flex-1 btn-primary bg-brand-success flex items-center justify-center gap-2"
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : 'Procesar e Importar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
