import React, { useState, useEffect } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/use-toast';
import { Save } from 'lucide-react';

const MisDatos = () => {
    const { user } = useAuth();
    const { getMisDatos, updateMisDatos, getDiocesis, getParrocos } = useAppData();
    const { toast } = useToast();

    const [formData, setFormData] = useState({ nombre: '', codigo: '', diocesis: '', direccion: '', telefono: '', email: '', parroco: '', vicario: '' });
    const [diocesisList, setDiocesisList] = useState([]);
    const [parrocosList, setParrocosList] = useState([]);

    useEffect(() => {
        if (user?.parishId) {
            const currentData = getMisDatos(user.parishId);
            setFormData(prev => ({...prev, ...currentData}));
            setDiocesisList(getDiocesis(user.parishId));
            setParrocosList(getParrocos(user.parishId));
        }
    }, [user?.parishId]);

    const handleSave = () => {
        if (!formData.nombre) {
            toast({ title: 'Error', description: 'El nombre de la parroquia es requerido.', variant: 'destructive' });
            return;
        }

        const result = updateMisDatos(formData, user?.parishId);
        if (result.success) {
            toast({ title: 'Éxito', description: 'Datos guardados correctamente.', variant: 'success', className: "bg-green-50 border-green-200 text-green-900" });
        }
    };

    const diocesisOptions = diocesisList.map(d => ({ value: d.nombre, label: d.nombre }));
    const parrocosOptions = parrocosList.map(p => ({ value: `${p.nombre} ${p.apellido}`, label: `${p.nombre} ${p.apellido}` }));

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-w-4xl mx-auto">
            <h3 className="text-lg font-bold text-[#2C3E50] mb-6 border-b pb-2">Información de la Parroquia</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Parroquia *</label>
                    <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                    <Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diócesis</label>
                    <Select 
                        value={formData.diocesis} 
                        onChange={e => setFormData({...formData, diocesis: e.target.value})} 
                        options={diocesisOptions}
                        placeholder="Seleccione..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                    <Input value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Párroco Actual</label>
                    <Select 
                        value={formData.parroco} 
                        onChange={e => setFormData({...formData, parroco: e.target.value})} 
                        options={parrocosOptions}
                        placeholder="Seleccione..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vicario Parroquial</label>
                    <Select 
                        value={formData.vicario} 
                        onChange={e => setFormData({...formData, vicario: e.target.value})} 
                        options={parrocosOptions}
                        placeholder="Seleccione..."
                    />
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <Button onClick={handleSave} className="bg-[#4B7BA7] text-white gap-2 px-6">
                    <Save className="w-4 h-4" /> Guardar Cambios
                </Button>
            </div>
        </div>
    );
};

export default MisDatos;