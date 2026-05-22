import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { Product, SaleStatus } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Check,
  X,
  Package,
  User,
  Ticket
} from 'lucide-react';
import { ActivityAction, logActivity } from '../../lib/activityLogger';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CartItem extends Product {
  quantity: number;
}

export default function SalesPOS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCartOnMobile, setShowCartOnMobile] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
    });
    return unsubscribe;
  }, []);

  const addToCart = (product: Product) => {
    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      if (existing) {
        return current.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    // On mobile, maybe don't auto-switch, but let's show a brief feedback if needed
  };

  const removeFromCart = (productId: string) => {
    setCart(current => current.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(current => current.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const tax = subtotal * 0; // Assuming 0 for now or add if needed
  const total = subtotal + tax;

  const handleCheckout = async (status: SaleStatus) => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      const saleData = {
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        total,
        status,
        clientName, // Optional
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'sales'), saleData);
      
      // Log Activity
      logActivity(ActivityAction.SALE, `Venta procesada por $${total.toLocaleString()}${clientName ? ' al cliente ' + clientName : ''}`);

      // Decrement Inventory if it's a final sale
      if (status === 'vendido') {
        for (const item of cart) {
          const productRef = doc(db, 'products', item.id);
          await updateDoc(productRef, {
            stock: increment(-item.quantity)
          });
        }
      }

      setSuccess(true);
      setCart([]);
      setClientName('');
      setShowCartOnMobile(false);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:h-[calc(100vh-160px)]">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col min-h-0 order-2 lg:order-1">
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-brand-text tracking-tighter">Terminal POS</h1>
            <p className="text-brand-text-dim text-sm font-medium hidden md:block">Buscador rápido de refacciones y servicios.</p>
          </div>
          <button 
            onClick={() => setShowCartOnMobile(true)}
            className="lg:hidden relative btn-primary p-3 rounded-full"
          >
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-danger text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black">
                {cart.length}
              </span>
            )}
          </button>
        </header>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim size-4" />
          <input 
            type="text" 
            placeholder="Buscar producto o SKU..."
            className="input-base pl-12 h-12 md:h-14 text-sm md:text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
            {filteredProducts.map((product) => (
              <motion.button
                layout
                key={product.id}
                onClick={() => addToCart(product)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="card p-4 text-left group hover:border-brand-primary/50 transition-all flex flex-col justify-between h-40 md:h-44"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="badge badge-blue">{product.category}</span>
                    <span className={`text-[10px] font-bold ${product.stock > 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
                      {product.stock} disp.
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-brand-text line-clamp-2">{product.name}</h4>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-lg font-black text-brand-primary">${product.price.toLocaleString()}</span>
                  <div className="p-2 bg-brand-primary/10 rounded-lg group-hover:bg-brand-primary group-hover:text-white transition-colors">
                    <Plus className="size-4" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart side */}
      <div className={cn(
        "lg:w-[400px] flex flex-col min-h-0 order-1 lg:order-2 fixed lg:relative inset-0 lg:inset-auto z-50 lg:z-0 bg-brand-bg lg:bg-transparent transition-transform duration-300 lg:translate-x-0",
        showCartOnMobile ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
        <div className="card h-full lg:h-auto lg:flex-1 flex flex-col p-0 border-0 lg:border relative rounded-none lg:rounded-2xl">
          <div className="p-6 border-b border-brand-border flex items-center justify-between">
            <h3 className="font-black text-lg flex items-center gap-2">
              <ShoppingCart className="text-brand-secondary size-5" />
              Carrito
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-1 bg-brand-bg rounded-md text-brand-text-dim">
                {cart.length} items
              </span>
              <button 
                onClick={() => setShowCartOnMobile(false)}
                className="lg:hidden p-2 text-brand-text-dim hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {cart.map((item) => (
              <div key={item.id} className="bg-brand-bg/50 p-4 rounded-xl border border-brand-border flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 overflow-hidden">
                    <h5 className="font-bold text-sm truncate">{item.name}</h5>
                    <p className="text-[10px] text-brand-text-dim uppercase font-bold">$ {item.price.toLocaleString()} c/u</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-brand-danger hover:bg-brand-danger/10 p-1.5 rounded-lg transition-colors">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 bg-brand-bg rounded-lg border border-brand-border p-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white/5 rounded-md text-brand-text-dim"><Minus className="size-3" /></button>
                    <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white/5 rounded-md text-brand-text-dim"><Plus className="size-3" /></button>
                  </div>
                  <span className="font-black text-brand-text">${(item.price * item.quantity).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-20">
                <div className="p-6 bg-brand-bg rounded-full mb-4">
                  <Package className="size-12" />
                </div>
                <p className="font-black uppercase tracking-widest text-xs">El carrito está vacío</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-brand-bg/50 border-t border-brand-border space-y-4 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] mb-safe">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-dim size-3" />
                  <input 
                    type="text" 
                    placeholder="Nombre del Cliente"
                    className="input-base pl-9 py-2 text-xs"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2 border-t border-brand-border/50">
                <div className="flex justify-between text-brand-text-dim text-xs font-bold uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-1 md:pt-2">
                  <span className="font-black text-sm uppercase tracking-tighter">Total</span>
                  <span className="text-2xl md:text-3xl font-black text-brand-primary tracking-tighter">${total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                disabled={loading || cart.length === 0}
                onClick={() => handleCheckout('cotizacion')}
                className="btn-outline py-3 text-[10px] uppercase tracking-widest"
              >
                Cotización
              </button>
              <button 
                disabled={loading || cart.length === 0}
                onClick={() => handleCheckout('vendido')}
                className="btn-primary py-3 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-brand-success p-0"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <><CreditCard className="size-4 shrink-0" /> Cobrar</>}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute inset-0 bg-brand-bg flex items-center justify-center p-8 z-20"
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-brand-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="size-10 text-brand-success" />
                  </div>
                  <h4 className="text-2xl font-black mb-2 uppercase tracking-tight">Venta Exitosa</h4>
                  <p className="text-brand-text-dim text-sm mb-8">Comprobante guardado correctamente.</p>
                  <button onClick={() => setSuccess(false)} className="btn-primary w-full">Cerrar</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

