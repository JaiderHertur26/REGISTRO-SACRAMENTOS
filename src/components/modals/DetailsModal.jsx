import React from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

const DetailsModal = ({ isOpen, onClose, data }) => {
  if (!data) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles de Diócesis/Arquidiócesis">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Nombre Oficial</label>
            <p className="text-gray-900 font-medium">{data.name}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Tipo</label>
            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${data.type === 'archdiocese' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
              {data.type === 'archdiocese' ? 'Arquidiócesis' : 'Diócesis'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Provincia Eclesiástica</label>
            <p className="text-gray-900">{data.ecclesiasticalProvince || 'No registrada'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Jurisdicción Eclesiástica</label>
            <p className="text-gray-900">{data.jurisdiction || 'No registrada'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Obispo/Arzobispo</label>
            <p className="text-gray-900">{data.bishop}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Obispo Auxiliar</label>
            <p className="text-gray-900">{data.auxiliaryBishop || 'N/A'}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Código de Diócesis</label>
              <p className="text-gray-900 font-mono font-bold bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block">
                {data.codigo || data.code || 'No asignado'}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Usuario Administrador</label>
              <p className="text-gray-900 font-medium">{data.username || 'No asignado'}</p>
            </div>
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

export default DetailsModal;