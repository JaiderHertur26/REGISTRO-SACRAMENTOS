import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const BaptismEditPage = () => {
    const [searchParams] = useSearchParams();
    const partidaId = searchParams.get('id');
    
    const { user } = useAuth();
    const { saveBaptismToSource, purificarRegistroBautismo } = useAppData();
    const { toast } = useToast();
    const navigate = useNavigate();

    const parishId = user?.parish_id || user?.parishId || 'ae48c502-6603-4887-ba38-6886e628430e';
    const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA PADRE MISERICORDIOSO';

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState(null);

    useEffect(() => {
        const loadPartida = async () => {
            if (!partidaId) {
                navigate('/parroquia/bautismo/partidas');
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('baptisms')
                    .select('*')
                    .eq('id', partidaId)
                    .single();

                if (error || !data) throw new Error("Partida no encontrada");

                const raw = typeof data.raw_data === 'string' ? JSON.parse(data.raw_data) : (data.raw_data || {});
                const purificado = purificarRegistroBautismo({
                    ...raw,
                    id: data.id,
                    status: data.status,
                    marginNote: data.margin_note || raw.notaMarginal,
                    Libro: data.book_number || raw.Libro,
                    folio: data.page_number || raw.folio,
                    numero: data.entry_number || raw.numero
                });

                setFormData(purificado);
            } catch (e) {
                toast({ title: "Error", description: "No se pudo cargar el registro.", variant: "destructive" });
                navigate('/parroquia/bautismo/partidas');
            } finally {
                setIsLoading(false);
            }
        };

        loadPartida();
    }, [partidaId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const res = await saveBaptismToSource(formData, parishId, formData.status || 'seated');
            if (res.success) {
                toast({ title: "Actualizado", description: "Partida actualizada en la nube.", className: "bg-green-50 text-green-900 border-green-200" });
                navigate('/parroquia/bautismo/partidas');
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !formData) {
        return (
            <DashboardLayout entityName={nombreParroquia}>
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4B7BA7] w-8 h-8" /></div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout entityName={nombreParroquia}>
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-2xl bg-white border h-12 w-12"><ArrowLeft /></Button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Modificar Partida de Bautismo</h1>
                            <p className="text-[#4B7BA7] text-[10px] font-black uppercase tracking-[0.3em] mt-1">L:{formData.Libro} F:{formData.folio} N:{formData.numero}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[2.5rem] border shadow-xl space-y-8">
                    
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input label="Libro" name="Libro" value={formData.Libro} onChange={handleChange} required />
                        <Input label="Folio" name="folio" value={formData.folio} onChange={handleChange} required />
                        <Input label="Acta Nº" name="numero" value={formData.numero} onChange={handleChange} required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input label="Lugar de Celebración" name="lugarBautismo" value={formData.lugarBautismo} onChange={handleChange} required />
                        <Input label="Fecha del Bautismo" type="date" name="fechaSacramento" value={formData.fechaSacramento} onChange={handleChange} required />
                        <Input label="Hora" type="time" name="horaSacramento" value={formData.horaSacramento} onChange={handleChange} />
                    </div>

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

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
                        <Input label="NUIP" name="nuip" value={formData.nuip} onChange={handleChange} />
                        <Input label="Serial Registro" name="serialRegistro" value={formData.serialRegistro} onChange={handleChange} />
                        <Input label="Oficina Registro" name="oficinaRegistro" value={formData.oficinaRegistro} onChange={handleChange} />
                        <Input label="Fecha Expedición" type="date" name="fechaExpedicionRegistro" value={formData.fechaExpedicionRegistro} onChange={handleChange} />
                    </div>

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
                        <Input label="Dirección de Residencia" name="direccion" value={formData.direccion} onChange={handleChange} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Padrinos" name="padrinos" value={formData.padrinos} onChange={handleChange} />
                        <Input label="Ministro" name="ministro" value={formData.ministro} onChange={handleChange} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400">Nota Marginal</label>
                        <textarea 
                            name="notaMarginal" 
                            value={formData.notaMarginal} 
                            onChange={handleChange} 
                            rows={3}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xs font-mono font-bold uppercase leading-relaxed" 
                        />
                    </div>

                    <div className="pt-6 border-t flex justify-end">
                        <Button type="submit" disabled={isSaving} className="px-12 py-8 bg-[#4B7BA7] text-white rounded-2xl font-black uppercase text-[11px] shadow-xl">
                            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} Guardar Cambios
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default BaptismEditPage;