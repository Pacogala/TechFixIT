import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import { Customer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { cleanWhatsAppNumber } from '../../lib/whatsappUtils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  ExternalLink,
  User
} from 'lucide-react';
import CSVUploader from '../admin/CSVUploader';

export default function CustomerList() {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [business, setBusiness] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));

    getDoc(doc(db, 'settings', 'business')).then((snap) => {
      if (snap.exists()) setBusiness(snap.data());
    }).catch(err => console.error("Error loading business settings in CustomerList:", err));

    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const customerData = { name, phone, email, address };
    
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), customerData);
      } else {
        await addDoc(collection(db, 'customers'), { ...customerData, createdAt: new Date().toISOString() });
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    }
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setPhone(customer.phone);
      setEmail(customer.email || '');
      setAddress(customer.address || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const customerTemplate = [
    { name: 'Juan Pérez', phone: '5211234567890', email: 'juan@ejemplo.com', address: 'Calle 123, Ciudad' }
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-brand-text tracking-tighter">Directorio de Clientes</h1>
          <p className="text-brand-text-dim text-sm font-medium">Búsqueda y gestión de contactos TechCRM.</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <>
              <CSVUploader type="customers" template={customerTemplate} />
              <button 
                onClick={() => openModal()}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="size-4" />
                Registrar Cliente
              </button>
            </>
          )}
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim size-4" />
        <input 
          type="text" 
          placeholder="Buscar por nombre o teléfono..."
          className="input-base pl-12 h-14 text-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => (
          <motion.div 
            layout
            key={customer.id}
            className="card group hover:border-brand-primary/50 transition-all"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-bg rounded-xl border border-brand-border flex items-center justify-center text-brand-primary font-black group-hover:bg-brand-primary group-hover:text-white transition-all">
                  {customer.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-brand-text">{customer.name}</h3>
                  <p className="text-[10px] text-brand-text-dim uppercase font-bold tracking-widest">ID: {customer.id.substring(0,8).toUpperCase()}</p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => openModal(customer)} className="p-2 text-brand-text-dim hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"><Edit3 className="size-4" /></button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-brand-text-dim">
                <div className="w-8 h-8 rounded-lg bg-brand-bg flex items-center justify-center"><Phone className="size-3" /></div>
                <span className="font-bold">{customer.phone}</span>
                <a href={`https://wa.me/${cleanWhatsAppNumber(customer.phone, business?.whatsappDefaultPrefix || '52')}`} target="_blank" rel="noreferrer" className="ml-auto text-brand-success hover:underline font-black text-[10px] uppercase">WhatsApp</a>
              </div>
              {customer.email && (
                <div className="flex items-center gap-3 text-xs text-brand-text-dim">
                  <div className="w-8 h-8 rounded-lg bg-brand-bg flex items-center justify-center"><Mail className="size-3" /></div>
                  <span className="font-bold truncate">{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-3 text-xs text-brand-text-dim">
                  <div className="w-8 h-8 rounded-lg bg-brand-bg flex items-center justify-center"><MapPin className="size-3" /></div>
                  <span className="font-bold truncate">{customer.address}</span>
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-6 border-t border-brand-border flex justify-between">
              <button className="text-[10px] font-black uppercase text-brand-primary bg-brand-primary/5 px-4 py-2 rounded-lg hover:bg-brand-primary/10 transition-colors flex items-center gap-2">
                <ExternalLink className="size-3" /> Ver Expediente
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Customer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg card p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-brand-text tracking-tight">
                  {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                </h2>
                <button onClick={closeModal} className="text-brand-text-dim hover:text-white">&times;</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="form-group text-left">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Nombre Completo</label>
                  <input 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-base"
                    placeholder="Ej. Roberto Sánchez"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group text-left">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Teléfono / WhatsApp</label>
                    <input 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-base"
                      placeholder="+52 1 234 567 8900"
                    />
                  </div>
                  <div className="form-group text-left">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Correo Electrónico</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-base"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </div>

                <div className="form-group text-left">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Dirección</label>
                  <textarea 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-base min-h-[100px] resize-none"
                    placeholder="Calle, Número, Colonia..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={closeModal} className="flex-1 btn-outline">Cancelar</button>
                  <button type="submit" className="flex-1 btn-primary bg-brand-secondary">
                    {editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
