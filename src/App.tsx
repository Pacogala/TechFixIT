/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import EquipmentReception from './components/repairs/EquipmentReception';
import RepairList from './components/repairs/RepairList';
import CustomerList from './components/customers/CustomerList';
import InventoryList from './components/inventory/InventoryList';
import SalesPOS from './components/sales/SalesPOS';
import UserManagement from './components/admin/UserManagement';
import Settings from './components/admin/Settings';
import Sidebar from './components/layout/Sidebar';
import { motion, AnimatePresence } from 'motion/react';
import { Menu } from 'lucide-react';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-brand-bg">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"
      />
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-brand-bg relative overflow-hidden">
      {/* Theme Decorative Gradient */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-secondary/5 rounded-full blur-[100px] -mr-64 -mt-64 pointer-events-none" />
      
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-brand-card/90 backdrop-blur-md border-b border-brand-border flex items-center justify-between px-4 z-40">
        <h1 className="text-lg font-black tracking-tighter gradient-text">TECHCRM</h1>
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-brand-text-dim hover:text-white"
        >
          <Menu size={24} />
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 relative z-10 pt-20 md:pt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity:0, scale: 0.99 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/recepcion" element={<PrivateRoute><EquipmentReception /></PrivateRoute>} />
          <Route path="/reparaciones" element={<PrivateRoute><RepairList /></PrivateRoute>} />
          <Route path="/clientes" element={<PrivateRoute><CustomerList /></PrivateRoute>} />
          <Route path="/usuarios" element={<PrivateRoute><UserManagement /></PrivateRoute>} />
          <Route path="/inventario" element={<PrivateRoute><InventoryList /></PrivateRoute>} />
          <Route path="/ventas" element={<PrivateRoute><SalesPOS /></PrivateRoute>} />
          <Route path="/config" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
