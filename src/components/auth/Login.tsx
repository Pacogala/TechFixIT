import React, { useState } from 'react';
import { auth, googleProvider } from '../../lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { motion } from 'motion/react';
import { ShieldCheck, Cpu, Mail, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      setError('Credenciales inválidas');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (err: any) {
      setError('Error al iniciar sesión con Google');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-brand-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-secondary/10 rounded-full blur-[120px] animate-pulse" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm glass-panel p-10 rounded-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <h1 className="text-2xl font-black tracking-tighter gradient-text uppercase">TechCRM Solutions</h1>
          <p className="text-brand-text-dim text-xs font-bold mt-2 uppercase tracking-widest">v2.4.0 High-Performance System</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-5">
          <div className="form-group">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">Email Corporativo</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim size-4" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-base pl-11"
                placeholder="usuario@techcrm.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="text-[10px] uppercase tracking-widest font-bold text-brand-text-dim mb-2 block">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim size-4" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base pl-11"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && <p className="text-brand-danger text-xs text-center font-bold">{error}</p>}

          <button 
            type="submit"
            className="w-full btn-primary mt-4"
          >
            Iniciar Sesión
          </button>
        </form>

        <div className="mt-10">
          <div className="relative flex items-center justify-center mb-6">
            <div className="flex-grow border-t border-brand-border"></div>
            <span className="flex-shrink mx-4 text-brand-text-dim/50 text-[10px] uppercase tracking-widest font-bold">Autenticación OAuth</span>
            <div className="flex-grow border-t border-brand-border"></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full btn-outline flex items-center justify-center gap-3 text-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="size-4" />
            Acceso con Cuenta Google
          </button>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-brand-text-dim/40 italic">
          <ShieldCheck className="size-3" />
          <span className="text-[9px] uppercase tracking-wider font-bold">Secure Gateway Active</span>
        </div>
      </motion.div>
    </div>
  );
}
