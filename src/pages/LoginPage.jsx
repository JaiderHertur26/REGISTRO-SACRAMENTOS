import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Church, Lock, User } from 'lucide-react';
import { logAuthEvent } from '@/utils/authLogger';
import { ROLE_TYPES } from '@/config/supabaseConfig';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = login(username, password);
    
    if (result.success) {
      // Log successful navigation trigger as a confirmation
      logAuthEvent(result.user, 'LOGIN_SUCCESS');

      toast({
        title: "Bienvenido",
        description: "Inicio de sesión exitoso.",
        variant: "success"
      });
      navigate(result.redirectPath);
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Login | Eclesia Digital</title>
        <meta name="description" content="Acceso al sistema de gestión" />
      </Helmet>
      
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-[#D4AF37] rounded-xl flex items-center justify-center mb-4 shadow-lg transform rotate-3">
                <Church className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#111111]">Eclesia Digital</h1>
              <p className="text-gray-500 text-sm mt-1">Gestión Eclesiástica Integral</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#111111]">Usuario</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all text-[#111111] font-medium placeholder:text-gray-400"
                    placeholder="Ingrese su usuario"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#111111]">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all text-[#111111] font-medium placeholder:text-gray-400"
                    placeholder="Ingrese su contraseña"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] font-bold py-3 text-sm shadow-md hover:shadow-lg transition-all"
              >
                {loading ? 'Validando credenciales...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100">
               <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Credenciales Demo:</p>
                  <div className="space-y-1 text-xs text-gray-700 font-mono">
                    <p>Admin: <span className="text-[#111111] font-bold">Hertur26</span> / <span className="text-[#111111] font-bold">1052042443-Ht</span></p>
                  </div>
               </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;