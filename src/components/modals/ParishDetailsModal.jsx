import React from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useAppData } from '@/context/AppDataContext';

const ParishDetailsModal = ({ isOpen, onClose, parish }) => {
  const { data } = useAppData();

  if (!parish) return null;

  // Resolve related data names
  const vicary = (data.vicariates || []).find(v => v.id === parish.vicaryId);
  const decanate = (data.deaneries || []).find(d => d.id === parish.decanateId);
  const user = (data.users || []).find(u => u.id === parish.userId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles de la Parroquia">
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Nombre de la Parroquia</label>
            <p className="text-gray-900 font-medium text-lg">{parish.name}</p>
          </div>
        </div>

        {/* Ecclesiastical Context */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
           <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Vicaría</label>
            <p className="text-gray-900">{vicary?.name || 'No asignada'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Decanato</label>
            <p className="text-gray-900">{decanate?.name || 'No asignado'}</p>
          </div>
        </div>

        {/* Priest Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Párroco Actual</label>
            <p className="text-gray-900 font-medium">{parish.parroco}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Fecha de Inicio</label>
            <p className="text-gray-900">{parish.startDate || 'No registrada'}</p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">NIT</label>
            <p className="text-gray-900">{parish.nit || 'No registrado'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Teléfono</label>
            <p className="text-gray-900">{parish.phone || 'No registrado'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
           <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Dirección</label>
            <p className="text-gray-900">{parish.address || 'No registrada'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
            <p className="text-gray-900">{parish.email || 'No registrado'}</p>
          </div>
        </div>

        {/* User Info */}
        <div className="border-t border-gray-100 pt-4">
           <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Usuario de Sistema</label>
            <p className="text-gray-900 font-medium font-mono bg-gray-100 inline-block px-2 py-1 rounded">
                {user?.username || 'Sin usuario asignado'}
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ParishDetailsModal;