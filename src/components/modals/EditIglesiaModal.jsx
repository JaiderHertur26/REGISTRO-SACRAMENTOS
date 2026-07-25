import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

const EditIglesiaModal = ({ isOpen, onClose, onUpdate, item }) => {
    const [formData, setFormData] = useState({
        codigo: '', 
        nombre: '', 
        nronit: '', 
        direccion: '', 
        ciudad: '', 
        telefono: '', 
        nrofax: '', 
        email: '', 
        parroco: '', 
        diocesis: ''
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (item) {
            setFormData({
                codigo: item.codigo || '', 
                nombre: item.nombre || '', 
                nronit: item.nronit || item.nit || '', 
                direccion: item.direccion || '', 
                ciudad: item.ciudad || '', 
                telefono: item.telefono || '', 
                nrofax: item.nrofax || item.fax || '', 
                email: item.email || '', 
                parroco: item.parroco || '', 
                diocesis: item.diocesis || ''
            });
        }
    }, [item]);

    const validateForm = () => {
        const newErrors = {};
        if (!formData.codigo.trim()) newErrors.codigo = true;
        if (!formData.nombre.trim()) newErrors.nombre = true;
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validateForm() && item) {
            onUpdate(item.id, formData);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Iglesia">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Código *</label>
                        <Input 
                            value={formData.codigo} 
                            onChange={e => setFormData({...formData, codigo: e.target.value})} 
                            className={cn(errors.codigo && "border-red-500 focus-visible:ring-red-500")}
                        />
                        {errors.codigo && <span className="text-xs text-red-500">Requerido</span>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Nombre *</label>
                        <Input 
                            value={formData.nombre} 
                            onChange={e => setFormData({...formData, nombre: e.target.value})} 
                            className={cn(errors.nombre && "border-red-500 focus-visible:ring-red-500")} 
                        />
                        {errors.nombre && <span className="text-xs text-red-500">Requerido</span>}
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">NIT</label>
                        <Input value={formData.nronit} onChange={e => setFormData({...formData, nronit: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Diócesis</label>
                        <Input value={formData.diocesis} onChange={e => setFormData({...formData, diocesis: e.target.value})} />
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Dirección</label>
                    <Input value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Ciudad</label>
                        <Input value={formData.ciudad} onChange={e => setFormData({...formData, ciudad: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Párroco</label>
                        <Input value={formData.parroco} onChange={e => setFormData({...formData, parroco: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Teléfono</label>
                        <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Fax</label>
                        <Input value={formData.nrofax} onChange={e => setFormData({...formData, nrofax: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Email</label>
                        <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} className="bg-[#4B7BA7] text-white hover:bg-[#3A6286]">
                        Actualizar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default EditIglesiaModal;