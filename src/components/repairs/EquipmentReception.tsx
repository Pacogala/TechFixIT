import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Trash2, 
  Save, 
  UserPlus, 
  PcCase, 
  Smartphone, 
  Printer, 
  Monitor, 
  Hash,
  Info,
  Check,
  Search
} from 'lucide-react';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { EquipmentType, RepairStatus, BusinessSettings, Customer } from '../../types';
import { generateReceptionReceipt } from '../../lib/pdfService';
import { ActivityAction, logActivity } from '../../lib/activityLogger';
import { compressImage, fileToBase64 } from '../../lib/imageUtils';
import { getWhatsAppLink } from '../../lib/whatsappUtils';

export default function EquipmentReception() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savedRepair, setSavedRepair] = useState<any>(null);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);

  // Registered customer search structures
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTermCustomer, setSearchTermCustomer] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadBusiness = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'business'));
        if (snap.exists()) {
          setBusiness(snap.data() as BusinessSettings);
        }
      } catch (err) {
        console.error('Error loading business settings:', err);
      }
    };
    loadBusiness();

    // Subscribe to customers collection
    const q = query(collection(db, 'customers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (err) => {
      console.error("Error subscribing to customers inside EquipmentReception:", err);
    });

    return unsubscribe;
  }, [user]);
  
  // Client Data
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  
  // Equipment Data
  const [type, setType] = useState<EquipmentType>('PC');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  
  // Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setClientName('');
    setClientPhone('');
    setSearchTermCustomer('');
    setBrand('');
    setModel('');
    setSerial('');
    setNotes('');
    setPhotos([]);
    setPreviews([]);
    setSavedRepair(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setPhotos(prev => [...prev, ...newFiles]);
      
      const newPreviews = newFiles.map(file => URL.createObjectURL(file as Blob));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      console.log('Starting equipment reception save...', { clientName, brand, model });
      
      // 1. Save or Update Customer in customers collection
      let customerId = '';
      try {
        console.log('Searching for customer by phone:', clientPhone);
        const customerQuery = query(collection(db, 'customers'), where('phone', '==', clientPhone));
        const customerSnap = await getDocs(customerQuery);
        
        if (!customerSnap.empty) {
          customerId = customerSnap.docs[0].id;
          console.log('Existing customer found:', customerId);
        } else {
          console.log('Creating new customer...');
          const newCustomerRef = await addDoc(collection(db, 'customers'), {
            name: clientName,
            phone: clientPhone,
            createdAt: serverTimestamp()
          });
          customerId = newCustomerRef.id;
          console.log('New customer created:', customerId);
        }
      } catch (cusErr) {
        console.error('Non-blocking error handling customer registration:', cusErr);
      }

      // 2. Upload Photos
      const photoUrls = [];
      console.log('Photos to upload:', photos.length);
      
      const uploadPhoto = (photo: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          console.log('Uploading photo:', photo.name, 'Size:', photo.size);
          const storageRef = ref(storage, `repairs/${Date.now()}-${photo.name}`);
          const uploadTask = uploadBytesResumable(storageRef, photo);

          // Timeout safety
          const timeout = setTimeout(() => {
            console.warn('Upload timed out for:', photo.name);
            reject(new Error('Upload timeout after 45s'));
          }, 45000);

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log('Upload is ' + progress + '% done');
            }, 
            (error) => {
              clearTimeout(timeout);
              console.error('Upload failed for:', photo.name, error);
              reject(error);
            }, 
            async () => {
              clearTimeout(timeout);
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Upload complete for:', photo.name, 'URL:', downloadURL);
              resolve(downloadURL);
            }
          );
        });
      };

      for (const photo of photos) {
        try {
          console.log('Compressing original image of size:', photo.size);
          const compressed = await compressImage(photo);
          console.log('Compressed to size:', compressed.size);
          let url = '';
          try {
            url = await uploadPhoto(compressed);
          } catch (uploadError) {
            console.warn('Storage upload failed, falling back to compact base64...', uploadError);
            // Re-compress to a tiny size (360x360, 0.4 quality) to keep the base64 string extremely lightweight (~10KB)
            const superCompact = await compressImage(photo, 360, 360, 0.4);
            url = await fileToBase64(superCompact);
          }
          photoUrls.push(url);
        } catch (photoErr) {
          console.error('Non-blocking error uploading/processing photo, skipping...', photoErr);
        }
      }

      // 3. Create Repair Order
      const repairData = {
        customerId, // Link to customer collection
        client: { name: clientName, phone: clientPhone }, // Redundant but useful for search/display
        equipment: { type, brand, model, serial },
        status: 'recibido' as RepairStatus,
        notes,
        photos: photoUrls,
        technicianId: user?.uid || 'unknown',
        technicianName: user?.name || 'Técnico',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('Checking repairData keys:', Object.keys(repairData));
      console.log('Adding document to Firestore...');
      const docRef = await addDoc(collection(db, 'repairs'), repairData);
      console.log('Document added successfully:', docRef.id);
      
      const newRepair = {
        id: docRef.id.substring(0, 8).toUpperCase(),
        fullId: docRef.id,
        ...repairData,
        // Replace timestamps for local state usage
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Log Activity
      try {
        await logActivity(ActivityAction.CREATE, `Nueva recepción de equipo: ${brand} ${model} para ${clientName}`);
      } catch (logErr) {
        console.error('Error logging activity:', logErr);
      }

      setSavedRepair(newRepair);
    } catch (error) {
      console.error('CRITICAL ERROR in EquipmentReception handleSubmit:', error);
      handleFirestoreError(error, OperationType.CREATE, 'repairs');
    } finally {
      setLoading(false);
    }
  };

  const shareWhatsApp = () => {
    if (!savedRepair) return;
    const message = `*TechCRM - Ticket de Recepción*\n\nHola ${savedRepair.client.name}, hemos recibido tu equipo:\n\n*Equipo:* ${savedRepair.equipment.brand} ${savedRepair.equipment.model}\n*S/N:* ${savedRepair.equipment.serial}\n*Folio:* #${savedRepair.id}\n\nPodrás consultar el avance de tu reparación con tu folio. ¡Gracias por tu confianza!`;
    const url = getWhatsAppLink(savedRepair.client.phone, message, business?.whatsappDefaultPrefix || '52');
    window.open(url, '_blank');
  };

  const downloadPDF = async () => {
    if (!savedRepair) return;
    await generateReceptionReceipt({
      id: savedRepair.id,
      client: savedRepair.client,
      equipment: savedRepair.equipment,
      notes: savedRepair.notes,
      business: business || undefined
    });
  };

  if (savedRepair) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-12 space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-brand-success/10 rounded-full flex items-center justify-center text-brand-success">
              <Check className="size-10" />
            </div>
          </div>
          
          <div>
            <h2 className="text-3xl font-black text-brand-text tracking-tight mb-2">¡Recepción Exitosa!</h2>
            <p className="text-brand-text-dim text-sm font-medium">Ticket de reparación registrado correctamente.</p>
          </div>

          <div className="bg-brand-bg rounded-2xl p-6 border border-brand-border">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase text-brand-text-dim tracking-widest">Folio de Servicio</span>
              <span className="text-sm font-black text-brand-primary">#{savedRepair.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-brand-text-dim tracking-widest">Cliente</span>
              <span className="text-sm font-bold text-brand-text">{savedRepair.client.name}</span>
            </div>
          </div>

          <div className="grid gap-3">
            <button onClick={shareWhatsApp} className="btn-primary bg-brand-success flex items-center justify-center gap-3 py-4">
              <Smartphone className="size-5" /> Enviar por WhatsApp
            </button>
            <button onClick={downloadPDF} className="btn-outline flex items-center justify-center gap-3 py-4">
              <Printer className="size-5" /> Descargar PDF
            </button>
            <button onClick={resetForm} className="text-xs font-black uppercase tracking-widest text-brand-text-dim hover:text-white pt-4">
              Nueva Recepción
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="badge badge-blue">Servicio Técnico</span>
          <span className="text-[10px] text-brand-text-dim font-black uppercase tracking-widest">ID Ticket: #REC-AUTO</span>
        </div>
        <h1 className="text-3xl font-black text-brand-text tracking-tighter">Nueva Recepción</h1>
        <p className="text-brand-text-dim text-sm font-medium">Registro de evidencia y diagnóstico inicial.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Customer Information */}
        <section className="card overflow-visible">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-brand-primary/10 rounded-lg">
              <UserPlus className="text-brand-primary size-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-brand-text">Información del Cliente</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* Customer Search Autocomplete */}
            <div className="form-group md:col-span-2 relative">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">Buscar Cliente Registrado (Opcional)</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim size-4" />
                <input 
                  type="text"
                  className="input-base pl-12"
                  placeholder="Escribe el nombre o teléfono y selecciona..."
                  value={searchTermCustomer}
                  onChange={(e) => {
                    setSearchTermCustomer(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
              </div>
              
              {/* Autocomplete Suggestions */}
              {showSuggestions && searchTermCustomer && (
                <div className="absolute left-0 right-0 mt-2 bg-brand-card border border-brand-border rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50">
                  {customers
                    .filter(c => 
                      c.name.toLowerCase().includes(searchTermCustomer.toLowerCase()) || 
                      c.phone.includes(searchTermCustomer)
                    )
                    .map(c => (
                      <div 
                        key={c.id}
                        className="p-4 hover:bg-brand-primary/10 cursor-pointer flex justify-between items-center border-b border-brand-border/30 last:border-0 transition-colors"
                        onClick={() => {
                          setClientName(c.name);
                          setClientPhone(c.phone);
                          setSearchTermCustomer(c.name);
                          setShowSuggestions(false);
                        }}
                      >
                        <div>
                          <p className="text-sm font-bold text-brand-text">{c.name}</p>
                          <p className="text-[10px] text-brand-text-dim font-bold uppercase tracking-widest">Tel: {c.phone}</p>
                        </div>
                        <span className="text-[9px] font-black text-brand-primary uppercase tracking-widest bg-brand-primary/10 px-3 py-1.5 rounded-lg">Seleccionar</span>
                      </div>
                    ))}
                  {customers.filter(c => 
                    c.name.toLowerCase().includes(searchTermCustomer.toLowerCase()) || 
                    c.phone.includes(searchTermCustomer)
                  ).length === 0 && (
                    <div className="p-4 text-center text-xs text-brand-text-dim">
                      No se encontraron resultados. Ingresa los datos abajo para crearlo al guardar.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">Nombre del Cliente</label>
              <input 
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="input-base"
                placeholder="Ej. Carlos Mendoza"
              />
            </div>
            <div className="form-group">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">WhatsApp / Teléfono</label>
              <input 
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                required
                className="input-base"
                placeholder="+52 1 123 456 7890"
              />
            </div>
          </div>
        </section>

        {/* Equipment Information */}
        <section className="card">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-brand-secondary/10 rounded-lg">
              <PcCase className="text-brand-secondary size-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-brand-text">Ficha Técnica del Equipo</h2>
          </div>
          
          <div className="mb-10">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-4 block">Tipo de Dispositivo</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { id: 'PC', icon: PcCase, label: 'Desktop' },
                { id: 'Laptop', icon: Monitor, label: 'Laptop' },
                { id: 'Celular', icon: Smartphone, label: 'Móvil' },
                { id: 'Impresora', icon: Printer, label: 'Impresora' },
                { id: 'Otro', icon: Info, label: 'Otros' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id as EquipmentType)}
                  className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all gap-3 ${
                    type === item.id 
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' 
                    : 'border-brand-border bg-brand-bg/50 text-brand-text-dim hover:border-brand-text-dim/30'
                  }`}
                >
                  <item.icon className="size-5" />
                  <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="form-group">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">Marca</label>
              <input 
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required
                className="input-base"
                placeholder="Ej. Lenovo, Asus, Samsung"
              />
            </div>
            <div className="form-group">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">Modelo</label>
              <input 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
                className="input-base"
                placeholder="Ej. ThinkPad Carbon X1"
              />
            </div>
            <div className="form-group">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">Número de Serie</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim size-3" />
                <input 
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  className="input-base pl-10"
                  placeholder="S/N: 000-000-000"
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">Diagnóstico Inicial / Observaciones</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-base min-h-[140px] resize-none"
              placeholder="Describa a detalle la falla y el estado en que se recibe..."
            />
          </div>
        </section>

        {/* Photo Upload Section */}
        <section className="card">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-danger/10 rounded-lg">
                <Camera className="text-brand-danger size-5" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-brand-text">Evidencia Estética</h2>
            </div>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="btn-outline py-1.5 px-3 text-[10px] uppercase tracking-widest flex items-center gap-2 border-brand-primary text-brand-primary hover:bg-brand-primary/10"
              >
                <Camera className="size-3" /> Abrir Cámara
              </button>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-outline py-1.5 px-3 text-[10px] uppercase tracking-widest"
              >
                Cargar Archivos
              </button>
            </div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            multiple 
            accept="image/*"
            onChange={handlePhotoChange}
          />
          <input 
            type="file" 
            ref={cameraInputRef}
            className="hidden" 
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {previews.map((preview, index) => (
              <motion.div 
                layout
                key={preview}
                className="relative group aspect-video rounded-xl overflow-hidden border border-brand-border bg-brand-bg/50"
              >
                <img src={preview} alt="Evidencia" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <button 
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute inset-0 flex items-center justify-center bg-brand-danger/80 opacity-0 group-hover:opacity-100 transition-all text-white"
                >
                  <Trash2 className="size-6" />
                </button>
              </motion.div>
            ))}
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video rounded-xl border-2 border-dashed border-brand-border flex flex-col items-center justify-center gap-2 text-brand-text-dim hover:border-brand-primary hover:text-brand-primary transition-all bg-brand-bg/30 group"
            >
              <Upload className="size-6 group-hover:animate-bounce" />
              <span className="text-[9px] font-black uppercase tracking-widest">Añadir Foto</span>
            </button>
          </div>
        </section>

        {/* Submit Actions */}
        <div className="flex items-center gap-6 pt-4">
          <button 
            disabled={loading}
            type="submit"
            className="flex-1 btn-primary py-4 text-sm uppercase tracking-widest flex items-center justify-center gap-3 bg-brand-success hover:bg-brand-success/90"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-brand-text border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="size-5" />
                Guardar Recepción de Equipo
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
