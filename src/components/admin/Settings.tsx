import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Bell, 
  Moon, 
  Globe, 
  Database, 
  User, 
  Lock, 
  Eye, 
  EyeOff,
  CloudUpload,
  RefreshCw,
  HardDrive,
  Mail,
  Palette,
  FileText,
  Phone,
  MapPin,
  MessageSquare,
  Building2,
  Check,
  Camera,
  Upload,
  Trash2,
  Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { BusinessSettings } from '../../types';

type TabType = 'General' | 'Seguridad' | 'Notificaciones' | 'Apariencia' | 'Idioma' | 'Base de Datos';

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('General');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Business Settings State
  const [business, setBusiness] = useState<BusinessSettings>({
    name: 'TechCRM Solutions',
    rfc: '',
    address: '',
    phone: '',
    customMessage: '¡Gracias por su confianza!'
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'business'), (snap) => {
      if (snap.exists()) {
        setBusiness(snap.data() as BusinessSettings);
      }
    });
    return unsub;
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      console.log('Uploading business logo...', file.name, 'Size:', file.size);
      const storageRef = ref(storage, `settings/logo-${Date.now()}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      const url = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Logo upload timeout')), 30000);
        
        uploadTask.on('state_changed', 
          null,
          (err) => {
            clearTimeout(timeout);
            reject(err);
          },
          async () => {
            clearTimeout(timeout);
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });
      
      console.log('Logo uploaded successfully:', url);
      setBusiness({ ...business, logo: url });
      
      // Autosave logo change
      console.log('Autosaving business settings with new logo...');
      await setDoc(doc(db, 'settings', 'business'), { ...business, logo: url });
      console.log('Business settings saved successfully.');
    } catch (err) {
      console.error('Error handling logo upload:', err);
      handleFirestoreError(err, OperationType.WRITE, 'settings/logo');
    } finally {
      setLoading(false);
    }
  };

  const saveBusinessSettings = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'business'), business);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/business');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'General' as TabType, label: 'General', icon: SettingsIcon },
    { id: 'Seguridad' as TabType, label: 'Seguridad', icon: Shield },
    { id: 'Notificaciones' as TabType, label: 'Notificaciones', icon: Bell },
    { id: 'Apariencia' as TabType, label: 'Apariencia', icon: Moon },
    { id: 'Idioma' as TabType, label: 'Idioma', icon: Globe },
    { id: 'Base de Datos' as TabType, label: 'Base de Datos', icon: Database },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'General':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-8 flex items-center gap-2">
                <Building2 className="size-4 text-brand-primary" /> Parámetros del Negocio
              </h3>
              
              <div className="flex flex-col md:flex-row gap-10 items-start mb-10">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim block">Logo de la Empresa</label>
                  <div className="relative group">
                    <div className="w-40 h-40 bg-brand-bg rounded-3xl border-2 border-dashed border-brand-border flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-brand-primary">
                      {business.logo ? (
                        <img src={business.logo} alt="Logo" className="w-full h-full object-contain p-4" />
                      ) : (
                        <div className="text-center p-4">
                          <Camera className="size-8 text-brand-text-dim mx-auto mb-2" />
                          <span className="text-[10px] font-bold text-brand-text-dim uppercase">Subir Logo</span>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => logoInputRef.current?.click()}
                      className="absolute -right-2 -bottom-2 p-3 bg-brand-primary text-white rounded-2xl shadow-xl hover:scale-110 transition-transform"
                    >
                      <Upload className="size-4" />
                    </button>
                    <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  <div className="form-group">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Nombre Comercial</label>
                    <input 
                      value={business.name}
                      onChange={e => setBusiness({...business, name: e.target.value})}
                      className="input-base" 
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">RFC / Tax ID</label>
                    <input 
                      value={business.rfc}
                      onChange={e => setBusiness({...business, rfc: e.target.value})}
                      className="input-base" 
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Teléfono</label>
                    <input 
                      value={business.phone}
                      onChange={e => setBusiness({...business, phone: e.target.value})}
                      className="input-base" 
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Dirección</label>
                    <input 
                      value={business.address}
                      onChange={e => setBusiness({...business, address: e.target.value})}
                      className="input-base" 
                    />
                  </div>
                </div>
              </div>

              <div className="form-group mb-8">
                <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Mensaje Personalizado en Tickets</label>
                <textarea 
                  value={business.customMessage}
                  onChange={e => setBusiness({...business, customMessage: e.target.value})}
                  className="input-base min-h-[100px] resize-none"
                  placeholder="Ej. Gracias por su confianza. Los equipos no reclamados después de 30 días se consideran abandonados."
                />
              </div>

              <div className="flex justify-end pt-6 border-t border-brand-border">
                <button 
                  disabled={loading}
                  onClick={saveBusinessSettings}
                  className={`btn-primary flex items-center gap-2 px-10 h-12 shadow-lg transition-all ${saved ? 'bg-brand-success shadow-brand-success/20' : 'shadow-brand-primary/20'}`}
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                    saved ? <><Check className="size-5" /> Parámetros Guardados</> : <><Save className="size-5" /> Guardar Cambios</>
                  )}
                </button>
              </div>
            </section>

            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <User className="size-4 text-brand-secondary" /> Perfil del Usuario
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Nombre</label>
                  <input readOnly value={user?.name || ''} className="input-base opacity-70" />
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Email</label>
                  <input readOnly value={user?.email || ''} className="input-base opacity-70" />
                </div>
              </div>
            </section>
          </motion.div>
        );

      case 'Seguridad':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <Lock className="size-4 text-brand-danger" /> Seguridad de Cuenta
              </h3>
              <div className="space-y-6">
                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Cambiar Contraseña</label>
                  <button className="btn-outline w-full justify-start text-xs">Actualizar credenciales de acceso</button>
                </div>
                <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-xl">
                  <p className="text-xs font-bold text-brand-danger mb-1">Verificación en dos pasos (2FA)</p>
                  <p className="text-[10px] text-brand-text-dim mb-3">Protege tu cuenta con una capa extra de seguridad.</p>
                  <button className="btn-primary bg-brand-danger py-1.5 px-4 text-[10px]">Activar 2FA</button>
                </div>
              </div>
            </section>

            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <Shield className="size-4 text-brand-success" /> Permisos de API
              </h3>
              <div className="form-group relative">
                <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Clave de Acceso al Sistema</label>
                <div className="relative">
                  <input 
                    type={showApiKey ? 'text' : 'password'} 
                    readOnly 
                    value="sk_techcrm_live_9823kjsd8923ksdh" 
                    className="input-base pr-12 font-mono text-sm"
                  />
                  <button 
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-brand-text-dim hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </section>
          </motion.div>
        );

      case 'Notificaciones':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <Bell className="size-4 text-brand-primary" /> Centro de Alertas
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Recepción de equipo', desc: 'Notificar cuando se registra un nuevo dispositivo' },
                  { label: 'Reparación completada', desc: 'Avisar al cliente y técnico al finalizar' },
                  { label: 'Stock bajo', desc: 'Alertar cuando un producto llega al stock mínimo' },
                  { label: 'Reporte diario', desc: 'Recibir resumen de ventas y reparaciones al correo' }
                ].map((notif, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-brand-bg rounded-xl border border-brand-border">
                    <div>
                      <p className="text-xs font-bold text-brand-text">{notif.label}</p>
                      <p className="text-[10px] text-brand-text-dim">{notif.desc}</p>
                    </div>
                    <button className="w-10 h-5 bg-brand-primary/20 rounded-full relative">
                      <div className="absolute left-1 top-0.5 w-4 h-4 bg-brand-primary rounded-full" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <Mail className="size-4 text-brand-secondary" /> Email Marketing
              </h3>
              <div className="flex gap-4">
                <button className="flex-1 btn-outline text-xs">Configurar SMTP</button>
                <button className="flex-1 btn-outline text-xs">Plantillas de Correo</button>
              </div>
            </section>
          </motion.div>
        );

      case 'Apariencia':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <Palette className="size-4 text-brand-primary" /> Tema del Sistema
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {['Oscuro', 'Claro', 'Sistema'].map((theme) => (
                  <button 
                    key={theme}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      theme === 'Oscuro' 
                      ? 'border-brand-primary bg-brand-bg shadow-lg shadow-brand-primary/10' 
                      : 'border-brand-border bg-brand-card grayscale opacity-50'
                    }`}
                  >
                    <div className={`w-full aspect-video rounded-lg mb-3 ${theme === 'Oscuro' ? 'bg-black' : 'bg-white'}`} />
                    <p className="text-[10px] font-black uppercase">{theme}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <Moon className="size-4 text-brand-secondary" /> Contraste y Accesibilidad
              </h3>
              <div className="space-y-6">
                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-4 block">Tamaño de Fuente (UI)</label>
                  <input type="range" className="w-full accent-brand-primary" min="12" max="18" defaultValue="14" />
                  <div className="flex justify-between mt-2 text-[8px] font-black text-brand-text-dim uppercase">
                    <span>Pequeño</span>
                    <span>Mediano</span>
                    <span>Grande</span>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        );

      case 'Idioma':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <Globe className="size-4 text-brand-primary" /> Configuración Regional
              </h3>
              <div className="space-y-6">
                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Idioma Principal</label>
                  <div className="grid gap-3">
                    {[
                      { id: 'es', label: 'Español (México)', active: true },
                      { id: 'en', label: 'English (United States)', active: false },
                      { id: 'pt', label: 'Português (Brasil)', active: false },
                    ].map((lang) => (
                      <button 
                        key={lang.id}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          lang.active ? 'bg-brand-primary text-white border-brand-primary shadow-lg' : 'bg-brand-bg text-brand-text-dim border-brand-border hover:border-white'
                        }`}
                      >
                        <span className="text-sm font-bold">{lang.label}</span>
                        {lang.active && <div className="w-2 h-2 bg-white rounded-full ring-4 ring-white/20" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Zona Horaria</label>
                  <select className="input-base">
                    <option>(GMT-06:00) Ciudad de México</option>
                    <option>(GMT-05:00) New York</option>
                  </select>
                </div>
              </div>
            </section>
          </motion.div>
        );

      case 'Base de Datos':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <Database className="size-4 text-brand-primary" /> Estado de la Base de Datos
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-brand-bg rounded-2xl border border-brand-border">
                  <p className="text-[10px] font-black uppercase text-brand-text-dim mb-1">Registros Totales</p>
                  <h4 className="text-2xl font-black text-brand-text">1,204</h4>
                </div>
                <div className="p-6 bg-brand-bg rounded-2xl border border-brand-border">
                  <p className="text-[10px] font-black uppercase text-brand-text-dim mb-1">Último Respaldo</p>
                  <h4 className="text-2xl font-black text-brand-text">Hoy, 10:45 AM</h4>
                </div>
              </div>
            </section>

            <section className="card">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text mb-6 flex items-center gap-2">
                <CloudUpload className="size-4 text-brand-secondary" /> Respaldos y Sincronización
              </h3>
              <div className="space-y-4">
                <button className="w-full btn-primary flex items-center justify-center gap-2">
                  <CloudUpload className="size-4" /> Crear Respaldo en la Nube
                </button>
                <div className="grid grid-cols-2 gap-4">
                  <button className="btn-outline flex items-center justify-center gap-2 py-3">
                    <HardDrive className="size-4" /> Exportar JSON
                  </button>
                  <button className="btn-outline flex items-center justify-center gap-2 py-3">
                    <RefreshCw className="size-4" /> Limpiar Caché
                  </button>
                </div>
              </div>
            </section>
          </motion.div>
        );
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header>
        <h1 className="text-3xl font-black text-brand-text tracking-tighter">Configuración del Sistema</h1>
        <p className="text-brand-text-dim text-sm font-medium">Personalización y ajustes avanzados de TechCRM.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeTab === tab.id 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                  : 'text-brand-text-dim hover:bg-brand-bg hover:text-white'
                }`}
              >
                <tab.icon className={`size-4 ${activeTab === tab.id ? 'text-white' : 'text-brand-text-dim/50'}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="md:col-span-2">
          {renderContent()}
          
          {activeTab !== 'General' && (
            <div className="mt-8 flex justify-end">
              <button onClick={() => setSaved(true)} className="btn-primary px-8">Guardar Cambios</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

