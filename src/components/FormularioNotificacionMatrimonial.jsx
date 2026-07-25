import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAppData } from '@/context/AppDataContext';
import { validateMarriageFields, validarPersonaNoTieneConyuge } from '@/utils/matrimonialNotificationValidation';
import BusquedaPartidaBautismo from '@/components/BusquedaPartidaBautismo';

const FormularioNotificacionMatrimonial = ({ selectedPartida, allDocuments = [], onSave, onCancel }) => {
    const { data } = useAppData();
    
    const allDioceses = [...(data.dioceses || [])].sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
    });
    
    const getInitialFormState = () => ({
        spouseName: '',
        marriageDate: '',
        marriageBook: '',
        marriageFolio: '',
        marriageNumber: '',
        marriageDiocese: '',
        marriageParish: '',
        conyuge: {
            id: '',
            nombres: '',
            apellidos: '',
            fechaBautismo: '',
            partidaBautismoId: '',
            parishId: ''
        }
    });

    const [formData, setFormData] = useState(getInitialFormState());
    const [errors, setErrors] = useState({});
    const [validationError, setValidationError] = useState(null);
    const [parishOptions, setParishOptions] = useState([]);

    useEffect(() => {
        if (selectedPartida && selectedPartida.id) {
            const firstName = selectedPartida?.nombres || selectedPartida?.firstName || '';
            const lastName = selectedPartida?.apellidos || selectedPartida?.lastName || '';
            const personName = `${firstName} ${lastName}`.trim();
            
            const validation = validarPersonaNoTieneConyuge(personName, allDocuments);
            if (!validation.valido) {
                setValidationError(validation.mensaje);
            } else {
                setValidationError(null);
            }
        }
    }, [selectedPartida, allDocuments]);

    useEffect(() => {
        if (formData.marriageDiocese) {
            const matches = (data.parishes || []).filter(p => 
                p.diocese_id === formData.marriageDiocese || 
                p.dioceseId === formData.marriageDiocese
            );
            
            setParishOptions(matches.map(p => ({ value: p.id, label: p.name })));
        } else {
            setParishOptions([]);
        }
    }, [formData.marriageDiocese, data.parishes]);

    const handleChange = (field, value) => {
        const newData = { ...formData, [field]: value };
        setFormData(newData);
        
        const val = validateMarriageFields(newData);
        setErrors(val.fieldErrors || {});
    };

    const handlePartidaConyugeSelected = (partida) => {
        if (!partida) {
            setFormData(prev => ({ 
                ...prev, 
                spouseName: '', 
                conyuge: getInitialFormState().conyuge 
            }));
            return;
        }

        if (!partida.id || (!partida.nombres && !partida.firstName)) {
            alert("Error: La partida seleccionada no contiene los datos requeridos (ID, nombres).");
            return;
        }

        const nombres = partida.nombres || partida.firstName || '';
        const apellidos = partida.apellidos || partida.lastName || '';
        const fullName = `${nombres} ${apellidos}`.trim();
        
        setFormData(prev => ({
            ...prev,
            spouseName: fullName,
            conyuge: {
                id: partida.id,
                nombres: nombres,
                apellidos: apellidos,
                fechaBautismo: partida.sacramentDate || partida.fecbau || '',
                partidaBautismoId: partida.id,
                parishId: partida.parishId || partida._parishId
            }
        }));
    };

    const handleSubmit = async () => {
        if (validationError) return;

        if (!formData.conyuge || !formData.conyuge.partidaBautismoId) {
            alert("Error: Debe seleccionar la partida de bautismo del cónyuge.");
            return;
        }

        if (!formData.conyuge.nombres) {
            alert("Error: La partida de bautismo del cónyuge no tiene nombres válidos.");
            return;
        }

        const val = validateMarriageFields(formData);
        if (!val.valid) {
            setErrors(val.fieldErrors || {});
            return;
        }
        
        // Enrich data with actual names instead of just IDs for the note generation
        const selectedDiocese = allDioceses.find(d => d.id === formData.marriageDiocese);
        const dioceseName = selectedDiocese ? selectedDiocese.name : formData.marriageDiocese;
        
        let parishName = formData.marriageParish;
        if (parishOptions.length > 0) {
            const selectedParish = data.parishes.find(p => p.id === formData.marriageParish);
            if (selectedParish) parishName = selectedParish.name;
        }

        const payload = { 
            ...formData, 
            spousePartida: formData.conyuge,
            marriageDioceseName: dioceseName,
            marriageParishName: parishName
        };
        
        await onSave(payload);
        
        setFormData(getInitialFormState());
    };

    const isFormValid = validateMarriageFields(formData).valid && !validationError;

    if (!selectedPartida || !selectedPartida.id) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
                Información de partida inválida o incompleta. Por favor, seleccione otra partida.
            </div>
        );
    }

    const firstName = selectedPartida?.nombres || selectedPartida?.firstName || '';
    const lastName = selectedPartida?.apellidos || selectedPartida?.lastName || '';
    const personName = `${firstName} ${lastName}`.trim() || 'Persona Desconocida';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-200 pb-3">Datos del Matrimonio Celebrado</h2>
            
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Persona (Contraente)</label>
                <Input 
                    value={personName} 
                    disabled 
                    className="bg-gray-50 font-medium"
                />
                {validationError && (
                    <p className="text-red-500 text-sm mt-1 font-medium">{validationError}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cónyuge <span className="text-red-500">*</span></label>
                    <Input 
                        value={formData.spouseName} 
                        onChange={(e) => handleChange('spouseName', e.target.value)} 
                        placeholder="Ej: María Pérez (Auto-completado al buscar partida)"
                        error={errors.spouseName}
                        disabled={!!validationError || !!formData.conyuge?.partidaBautismoId}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del Matrimonio <span className="text-red-500">*</span></label>
                    <Input 
                        type="date"
                        value={formData.marriageDate} 
                        onChange={(e) => handleChange('marriageDate', e.target.value)} 
                        error={errors.marriageDate}
                        disabled={!!validationError}
                    />
                </div>
            </div>

            <div className="mb-8 border-t border-gray-200 pt-6">
                <label className="block text-sm font-bold text-gray-800 mb-4">Partida de Bautismo del Cónyuge <span className="text-red-500">*</span></label>
                {!formData.conyuge?.partidaBautismoId ? (
                    <BusquedaPartidaBautismo onPartidaSelected={handlePartidaConyugeSelected} />
                ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 relative">
                        <h4 className="text-blue-800 font-bold mb-3">Detalles del Cónyuge Seleccionado</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-sm text-gray-800">
                            <p><span className="font-semibold text-blue-700">Nombres:</span> {formData.conyuge.nombres}</p>
                            <p><span className="font-semibold text-blue-700">Apellidos:</span> {formData.conyuge.apellidos}</p>
                            <p><span className="font-semibold text-blue-700">Fecha Bautismo:</span> {formData.conyuge.fechaBautismo || 'No registrada'}</p>
                            <p><span className="font-semibold text-blue-700">ID Partida:</span> <span className="font-mono">{formData.conyuge.partidaBautismoId}</span></p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handlePartidaConyugeSelected(null)}
                        >
                            Cambiar Partida
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Libro <span className="text-red-500">*</span></label>
                    <Input 
                        type="number"
                        value={formData.marriageBook} 
                        onChange={(e) => handleChange('marriageBook', e.target.value)} 
                        error={errors.marriageBook}
                        disabled={!!validationError}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Folio <span className="text-red-500">*</span></label>
                    <Input 
                        type="number"
                        value={formData.marriageFolio} 
                        onChange={(e) => handleChange('marriageFolio', e.target.value)} 
                        error={errors.marriageFolio}
                        disabled={!!validationError}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número <span className="text-red-500">*</span></label>
                    <Input 
                        type="number"
                        value={formData.marriageNumber} 
                        onChange={(e) => handleChange('marriageNumber', e.target.value)} 
                        error={errors.marriageNumber}
                        disabled={!!validationError}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diócesis de Celebración <span className="text-red-500">*</span></label>
                    <Select 
                        value={formData.marriageDiocese} 
                        onChange={(e) => handleChange('marriageDiocese', e.target.value)}
                        options={allDioceses.map(d => ({ value: d.id, label: d.name }))}
                        placeholder="Seleccione la diócesis"
                        error={errors.marriageDiocese}
                        disabled={!!validationError}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parroquia de Celebración <span className="text-red-500">*</span></label>
                    {parishOptions.length > 0 ? (
                        <Select 
                            value={formData.marriageParish} 
                            onChange={(e) => handleChange('marriageParish', e.target.value)}
                            options={parishOptions}
                            placeholder="Seleccione la parroquia"
                            error={errors.marriageParish}
                            disabled={!!validationError}
                        />
                    ) : (
                        <Input 
                            value={formData.marriageParish} 
                            onChange={(e) => handleChange('marriageParish', e.target.value)} 
                            placeholder="Nombre de la parroquia"
                            error={errors.marriageParish}
                            disabled={!!validationError}
                        />
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-4 border-t border-gray-200 pt-6">
                <Button variant="outline" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    disabled={!isFormValid || !formData.conyuge?.partidaBautismoId}
                    className="bg-[#4B7BA7] hover:bg-[#3b6082] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    title={validationError ? "No se puede guardar porque la persona ya tiene cónyuge" : "Guardar notificación"}
                >
                    Guardar Notificación
                </Button>
            </div>
        </div>
    );
};

export default FormularioNotificacionMatrimonial;