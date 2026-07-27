import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff, Church, MapPin, User, Network, LayoutGrid, Calendar, Hash, Phone, Mail, Loader2, KeyRound } from 'lucide-react';

const CreateParishModal = ({ isOpen, onClose }) => {
  const { createParish, getVicariesByDiocese, data, getUserByUsername } = useAppData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '', vicaryId: '', decanateId: '', parroco: '', startDate: '', nit: '', address: '', phone: '', email: '', username: '', password: '', confirmPassword: ''
  });

  const vicaries = getVicariesByDiocese(user?.dioceseId || '');
  const availableDeaneries = formData.vicaryId ? data.deaneries.filter(d => d.vicaryId === formData.vicaryId) : [];

  const handleVicaryChange = (e) => {
    setFormData(prev => ({ ...prev, vicaryId: e.target.value, decanateId: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
        toast({ title: 'Error', description: 'Las contraseñas no coinciden.', variant: 'destructive' });
        return;
    }

    setLoading(true);
    try {
      const parishData = {
        name: formData.name, vicaryId: formData.vicaryId, decanateId: formData.decanateId || null,
        dioceseId: user.dioceseId, parroco: formData.parroco, startDate: formData.startDate,
        nit: formData.nit, address: formData.address, phone: formData.phone, email: formData.email, city: user.city || 'Desconocida'
      };

      const userData = { username: formData.username, password: formData.password, email: formData.email, dioceseId: user.dioceseId };

      await createParish(parishData, userData);
      toast({ title: 'Éxito', description: 'Parroquia y usuario creados correctamente.', className: "bg-green-50 border-green-200 text-green-700" });
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo crear la parroquia.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alta Manual de Parroquia">
      <form onSubmit={handleSubmit} className="space-y-4 p-2 pt-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
        
        {/* Name */}
        <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de la Parroquia</label>
            <div className="relative">
                <Church className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    required type="text" placeholder="Ej. Parroquia San José" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 uppercase transition-all"
                />
            </div>
        </div>

        {/* Hierarchy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vicaría</label>
                <div className="relative">
                    <Network className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B7BA7]" />
                    <select required value={formData.vicaryId} onChange={handleVicaryChange} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 uppercase transition-all appearance-none">
                        <option value="" disabled>Seleccionar Vicaría</option>
                        {vicaries.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Decanato (Opcional)</label>
                <div className="relative">
                    <LayoutGrid className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B7BA7]" />
                    <select disabled={!formData.vicaryId} value={formData.decanateId} onChange={e => setFormData({...formData, decanateId: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 uppercase transition-all appearance-none disabled:opacity-50">
                        <option value="">Sin Decanato</option>
                        {availableDeaneries.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {/* Priest */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Párroco Actual</label>
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="text" value={formData.parroco} onChange={e => setFormData({...formData, parroco: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 uppercase transition-all" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha Inicio Párroco</label>
                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 uppercase transition-all" />
                </div>
            </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">NIT</label>
                <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="text" value={formData.nit} onChange={e => setFormData({...formData, nit: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 uppercase transition-all" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dirección</label>
                <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 uppercase transition-all" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
                <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 uppercase transition-all" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 transition-all" />
                </div>
            </div>
        </div>

        {/* Credentials */}
        <div className="border-t border-slate-200 pt-6 mt-6 bg-slate-50 -mx-6 px-6 pb-4">
            <h4 className="text-[10px] font-black text-[#4B7BA7] mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Credenciales de Acceso Local
            </h4>
            
            <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuario</label>
                  <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 transition-all" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                        <div className="relative">
                            <input required type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full pl-5 pr-11 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 transition-all" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar</label>
                        <div className="relative">
                            <input required type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full pl-5 pr-11 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-sm font-bold text-slate-800 transition-all" />
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
          <Button type="submit" disabled={loading} className="w-2/3 rounded-xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crear Parroquia'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateParishModal;