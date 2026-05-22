import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import CSVUploader from '../admin/CSVUploader';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  AlertTriangle,
  Tag,
  DollarSign,
  Box
} from 'lucide-react';

export default function InventoryList() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(2);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));
    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const productData = { name, category, sku, price: Number(price), stock: Number(stock), minStock: Number(minStock) };
    
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), productData);
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  };

  const deleteProduct = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setCategory(product.category);
      setSku(product.sku || '');
      setPrice(product.price);
      setStock(product.stock);
      setMinStock(product.minStock || 2);
    } else {
      setEditingProduct(null);
      setName('');
      setCategory('Hardware');
      setSku('');
      setPrice(0);
      setStock(0);
      setMinStock(2);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const productTemplate = [
    { name: 'Nombre Ejemplo', category: 'Hardware', sku: 'SKU-001', price: 1500, stock: 10, minStock: 2 }
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-brand-text tracking-tighter">Inventario</h1>
          <p className="text-brand-text-dim text-sm font-medium">Control de stock de refacciones y accesorios.</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <>
              <CSVUploader type="products" template={productTemplate} />
              <button 
                onClick={() => openModal()}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="size-4" />
                Añadir Producto
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim size-4" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o SKU..."
            className="input-base pl-12 h-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select className="input-base w-48 h-12 bg-brand-card">
          <option>Todas las Categorías</option>
          <option>Hardware</option>
          <option>Accesorios</option>
          <option>Smartphones</option>
          <option>Services</option>
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-brand-bg/50 border-b border-brand-border">
            <tr>
              <th className="px-6 py-4 text-[10px] uppercase font-bold text-brand-text-dim tracking-widest">Producto</th>
              <th className="px-6 py-4 text-[10px] uppercase font-bold text-brand-text-dim tracking-widest">Categoría</th>
              <th className="px-6 py-4 text-[10px] uppercase font-bold text-brand-text-dim tracking-widest text-center">Stock</th>
              <th className="px-6 py-4 text-[10px] uppercase font-bold text-brand-text-dim tracking-widest text-right">Precio</th>
              <th className="px-6 py-4 text-[10px] uppercase font-bold text-brand-text-dim tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-brand-bg p-2 rounded-lg border border-brand-border">
                      <Box className="size-4 text-brand-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-brand-text text-sm">{product.name}</p>
                      <p className="text-[10px] text-brand-text-dim font-medium uppercase tracking-tighter">SKU: {product.sku || 'N/A'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="badge badge-blue">{product.category}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className={`text-sm font-black ${product.stock <= (product.minStock || 2) ? 'text-brand-danger' : 'text-brand-text'}`}>
                      {product.stock}
                    </span>
                    {product.stock <= (product.minStock || 2) && (
                      <span className="flex items-center gap-1 text-[8px] font-bold text-brand-danger uppercase tracking-widest mt-1">
                        <AlertTriangle className="size-2" /> Stock Bajo
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-black text-brand-text text-sm">
                  ${product.price.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => openModal(product)}
                          className="p-2 text-brand-text-dim hover:text-brand-primary transition-colors hover:bg-brand-primary/10 rounded-lg"
                        >
                          <Edit3 className="size-4" />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 text-brand-text-dim hover:text-brand-danger transition-colors hover:bg-brand-danger/10 rounded-lg"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length === 0 && !loading && (
          <div className="p-20 text-center text-brand-text-dim/50 font-bold uppercase tracking-widest italic border-t border-brand-border">
            No se encontraron productos
          </div>
        )}
      </div>

      {/* Product Modal */}
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
              className="relative w-full max-w-lg card p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-brand-text tracking-tight">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <button onClick={closeModal} className="text-brand-text-dim hover:text-white">&times;</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="form-group text-left">
                  <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Nombre del Producto</label>
                  <input 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-base"
                    placeholder="Ej. Disco Duro SSD 480GB"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group text-left">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Categoría</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input-base"
                    >
                      <option>Hardware</option>
                      <option>Accesorios</option>
                      <option>Pantallas</option>
                      <option>Baterías</option>
                      <option>Servicios</option>
                    </select>
                  </div>
                  <div className="form-group text-left">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">SKU / Código</label>
                    <input 
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="input-base"
                      placeholder="SKU-XXXX"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="form-group text-left flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Precio ($)</label>
                    <input 
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="input-base"
                    />
                  </div>
                  <div className="form-group text-left flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Stock</label>
                    <input 
                      type="number"
                      required
                      value={stock}
                      onChange={(e) => setStock(Number(e.target.value))}
                      className="input-base"
                    />
                  </div>
                  <div className="form-group text-left flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-brand-text-dim mb-2 block">Mín. Stock</label>
                    <input 
                      type="number"
                      value={minStock}
                      onChange={(e) => setMinStock(Number(e.target.value))}
                      className="input-base"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={closeModal} className="flex-1 btn-outline">Cancelar</button>
                  <button type="submit" className="flex-1 btn-primary">
                    {editingProduct ? 'Guardar Cambios' : 'Añadir al Inventario'}
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
