import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { 
    Save, ArrowLeft, Loader2, Printer 
} from 'lucide-react';
import BaptismTicket from '@/components/BaptismTicket';

const BaptismNewPage = () => {
    const { user } = useAuth();
    const { saveBaptismToSource, getMisDatosList } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const parishId = user?.parish_id || user?.parishId || 'ae48c502-6603-4887-ba38-6886e628430e';
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO';

    const [isSaving, setIsSaving] = useState(false);
    const [savedDataForTicket, setSavedDataForTicket] = useState(null);
    const [parishInfo, setParishInfo] = useState(null);

    const [formData, setFormData] = useState({
        numeroRegistro: '---',
        lugarBautismo: nombreParroquia,
        fechaSacramento: '',
        horaSacramento: '10:00',
        nombres: '',
        apellidos: '',
        sexo: 'MASCULINO',
        fechaNacimiento: '',
        lugarNacimiento: '',
        nuip: '',
        serialRegistro: '',
        oficinaRegistro: '',
        fechaExpedicionRegistro: '',
        nombrePadre: '',
        cedulaPadre: '',
        nombreMadre: '',
        cedulaMadre: '',
        tipoUnionPadres: 'MATRIMONIO CATÓLICO',
        abuelosPaternos: '',
        abuelosMaternos: '',
        direccion: '',
        padrinos: '',
        ministro: '',
        daFe: ''
    });

    useEffect(() => {
        if (parishId) {
            const misDatos = getMisDatosList(parishId);
            if (misDatos?.length > 0) {
                setParishInfo(misDatos[0]);
            }
        }
    }, [parishId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nombres || !formData.apellidos) {
            toast({ title: "Campos Requeridos", description: "Ingrese nombres y apellidos.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const nextReg = String(Date.now()).slice(-6);
            const dataToSave = {
                ...formData,
                numeroRegistro: nextReg,
                status: 'pending'
            };

            const res = await saveBaptismToSource(dataToSave, parishId, 'pending');

            if (res.success) {
                setSavedDataForTicket(dataToSave);
                toast({ title: "Inscripción Guardada", description: "Borrador temporal guardado en la nube con éxito.", className: "bg-green-50 text-green-900 border-green-200" });
                setTimeout(() => {
                    navigate('/parroquia/bautismo/sentar-registros');
                }, 1500);
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="hidden print:block">
                {savedDataForTicket && <BaptismTicket baptismData={savedDataForTicket} parishInfo={parishInfo} />}
            </div>

            <div className="print:hidden max-w-5xl mx-auto space-y-8 pb-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-2xl bg-white border h-12 w-12"><ArrowLeft /></Button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Inscribir Nuevo Bautizo</h1>
                            <p className="text-[#4B7BA7] text-[10px] font-black uppercase tracking-[0.3em] mt-1">Generación de Boleta y Registro Temporal</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[2.5rem] border shadow-xl space-y-8">
                    
                    {/* SECCIÓN 1: SACRAMENTO */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input label="Lugar del Sacramento" name="lugarBautismo" value={formData.lugarBautismo} onChange={handleChange} required />
                        <Input label="Fecha Programada" type="date" name="fechaSacramento" value={formData.fechaSacramento} onChange={handleChange} required />
                        <Input label="Hora" type="time" name="horaSacramento" value={formData.horaSacramento} onChange={handleChange} />
                    </div>

                    {/* SECCIÓN 2: BAUTIZANDO */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input label="Nombres" name="nombres" value={formData.nombres} onChange={handleChange} required />
                        <Input label="Apellidos" name="apellidos" value={formData.apellidos} onChange={handleChange} required />
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Sexo</label>
                            <select name="sexo" value={formData.sexo} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl p-3.5 text-xs font-black uppercase">
                                <option value="MASCULINO">MASCULINO</option>
                                <option value="FEMENINO">FEMENINO</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Fecha de Nacimiento" type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} />
                        <Input label="Lugar de Nacimiento" name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleChange} />
                    </div>

                    {/* SECCIÓN 3: REGISTRO CIVIL */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
                        <Input label="NUIP" name="nuip" value={formData.nuip} onChange={handleChange} />
                        <Input label="Serial Registro" name="serialRegistro" value={formData.serialRegistro} onChange={handleChange} />
                        <Input label="Oficina Registro" name="oficinaRegistro" value={formData.oficinaRegistro} onChange={handleChange} />
                        <Input label="Fecha Expedición" type="date" name="fechaExpedicionRegistro" value={formData.fechaExpedicionRegistro} onChange={handleChange} />
                    </div>

                    {/* SECCIÓN 4: FILIACIÓN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Input label="Nombre del Padre" name="nombrePadre" value={formData.nombrePadre} onChange={handleChange} />
                            <Input label="Cédula del Padre" name="cedulaPadre" value={formData.cedulaPadre} onChange={handleChange} />
                            <Input label="Abuelos Paternos" name="abuelosPaternos" value={formData.abuelosPaternos} onChange={handleChange} />
                        </div>
                        <div className="space-y-4">
                            <Input label="Nombre de la Madre" name="nombreMadre" value={formData.nombreMadre} onChange={handleChange} />
                            <Input label="Cédula de la Madre" name="cedulaMadre" value={formData.cedulaMadre} onChange={handleChange} />
                            <Input label="Abuelos Maternos" name="abuelosMaternos" value={formData.abuelosMaternos} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Unión de los Padres</label>
                            <select name="tipoUnionPadres" value={formData.tipoUnionPadres} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl p-3.5 text-xs font-black uppercase">
                                <option value="MATRIMONIO CATÓLICO">MATRIMONIO CATÓLICO</option>
                                <option value="MATRIMONIO CIVIL">MATRIMONIO CIVIL</option>
                                <option value="UNIÓN LIBRE">UNIÓN LIBRE</option>
                                <option value="MADRE SOLTERA">MADRE SOLTERA</option>
                            </select>
                        </div>
                        <Input label="Dirección" name="direccion" value={formData.direccion} onChange={handleChange} />
                    </div>

                    {/* SECCIÓN 5: TESTIGOS Y MINISTRO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Padrinos" name="padrinos" value={formData.padrinos} onChange={handleChange} />
                        <Input label="Ministro" name="ministro" value={formData.ministro} onChange={handleChange} />
                    </div>

                    <div className="pt-6 border-t flex justify-end">
                        <Button type="submit" disabled={isSaving} className="px-12 py-8 bg-[#D4AF37] text-slate-950 hover:bg-[#B4932A] rounded-2xl font-black uppercase text-[11px] shadow-xl">
                            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} Inscribir y Guardar Borrador
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default BaptismNewPage;