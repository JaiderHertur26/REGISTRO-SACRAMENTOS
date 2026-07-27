import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff, Building2, MapPin, Phone, Mail, User, KeyRound, Loader2 } from 'lucide-react';

const CreateChancellorModal = ({ isOpen, onClose }) => {
  const { createChancellor, getChancellorByDiocese } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({ name: '', phone: '', contactEmail: '', address: '', username: '', password: '', confirmPassword: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
        toast({ title: 'Error', description: 'Las contraseñas no coinciden.', variant: 'destructive' });
        return;
    }
    
    const existing = getChancellorByDiocese(user.dioceseId);
    if (existing) {
        toast({ title: 'Atención', description: 'Ya existe una Cancillería para esta diócesis.', variant: 'destructive' });
        return;
    }

    setLoading(true);
    try {
      const chancellorData = { name: formData.name, phone: formData.phone, email: formData.contactEmail, address: formData.address, dioceseId: user.dioceseId };
      const userData = { username: formData.username, password: formData.password, email: `${formData.username.toLowerCase()}@eclesia.org` };

      await createChancellor(chancellorData, userData);
      toast({ title: 'Éxito', description: 'Cancillería creada correctamente.', className: "bg-green-50 border-green-200 text-green-700" });
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo crear la cancillería.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alta Manual de Cancillería">
      <form onSubmit={handleSubmit} className="space-y-4 p-2 pt-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre del Canciller / Sede</label>
          <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]" />
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Pbro. Juan Pérez" className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 uppercase transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
            <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Número" className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 uppercase transition-all" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email de Contacto</label>
            <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input required type="email" value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} placeholder="correo@ejemplo.com" className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 transition-all" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dirección Física</label>
          <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input required type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Sede diocesana" className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 uppercase transition-all" />
          </div>
        </div>

        {/* Credentials */}
        <div className="border-t border-slate-200 pt-6 mt-6 bg-slate-50 -mx-6 px-6 pb-4">
            <h4 className="text-[10px] font-black text-[#D4AF37] mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Credenciales de Acceso Local
            </h4>
            
            <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuario</label>
                  <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 transition-all" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                        <div className="relative">
                            <input required type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full pl-5 pr-11 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 transition-all" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar</label>
                        <div className="relative">
                            <input required type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full pl-5 pr-11 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm font-bold text-slate-800 transition-all" />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="w-1/3 rounded-xl border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50">Cancelar</Button>
          <Button type="submit" disabled={loading} className="w-2/3 rounded-xl bg-[#D4AF37] hover:bg-[#C4A027] text-gray-900 font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crear Cancillería'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateChancellorModal;