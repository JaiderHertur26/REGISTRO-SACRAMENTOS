import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Save, Check, Loader2, BookOpen, Link, HeartCrack, Edit3, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const DEFAULT_TEMPLATES = {
    correccion_anulada: "PARTIDA ANULADA POR DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO]. LA INFORMACIÓN CORREGIDA PASA AL LIBRO SUPLETORIO: L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].",
    correccion_nueva: "ESTA PARTIDA SE INSCRIBE POR DECRETO DE CORRECCIÓN NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], Y ANULA LA PARTIDA ORIGINAL DEL L-[LIBRO_ANULADA] F-[FOLIO_ANULADA] N-[NUMERO_ANULADA]. DA FE: [MINISTRO].",
    reposicion_nueva: "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO], DEBIDO A PÉRDIDA O DETERIORO DEL ORIGINAL. DA FE: [MINISTRO].",
    matrimonio_casado: "EL DÍA [FECHA_NOTIFICACION] SE RECIBIÓ AVISO DE LA PARROQUIA [PARROQUIA_MATRIMONIO] DE LA DIÓCESIS DE [DIOCESIS_MATRIMONIO], NOTIFICANDO QUE CONTRAJO MATRIMONIO CON [NOMBRE_CONYUGE] EL [FECHA_MATRIMONIO]. INSCRITO EN EL L-[LIBRO_MAT], F-[FOLIO_MAT], N-[NUMERO_MAT].",
    matrimonio_nulidad: "MATRIMONIO DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO].",
    vinculo_civil: "REGISTRO CIVIL: NUIP/NIP [NUIP]. EXPEDIDO EN LA OFICINA [OFICINA_REGISTRO] EL DÍA [FECHA_EXPEDICION_RC]."
};

const MarginalNotesTab = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const chanceryId = user?.chanceryId || user?.chancery_id || user?.dioceseId;

    useEffect(() => {
        const fetchTemplates = async () => {
            if (!chanceryId) return;
            try {
                // Usamos parish_parameters como almacén de configuración genérico (usando chanceryId como llave primaria)
                const { data, error } = await supabase
                    .from('parish_parameters')
                    .select('bautizos_params')
                    .eq('parish_id', chanceryId)
                    .maybeSingle();
                
                if (data && data.bautizos_params?.plantillas_notas) {
                    setTemplates({ ...DEFAULT_TEMPLATES, ...data.bautizos_params.plantillas_notas });
                }
            } catch (e) {
                console.error("Error obteniendo plantillas:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTemplates();
    }, [chanceryId]);

    const handleChange = (key, value) => {
        setTemplates(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            // 1. Obtener la configuración actual para no borrar otros datos
            const { data: currentData } = await supabase.from('parish_parameters').select('bautizos_params').eq('parish_id', chanceryId).maybeSingle();
            
            const currentParams = currentData?.bautizos_params || {};
            const newParams = { ...currentParams, plantillas_notas: templates };

            // 2. Guardar en Supabase
            const { error } = await supabase
                .from('parish_parameters')
                .upsert({ parish_id: chanceryId, bautizos_params: newParams }, { onConflict: 'parish_id' });

            if (error) throw error;
            
            setIsSuccess(true);
            toast({ title: "Plantillas Guardadas", description: "El motor de redacción está sincronizado en la Nube.", className: "bg-green-50 text-green-900 border-green-200" });
            setTimeout(() => setIsSuccess(false), 3000);
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron sincronizar las plantillas.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const TemplateCard = ({ title, icon: Icon, stateKey, variables, placeholder }) => (
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                <div className="bg-blue-50 p-2 rounded-xl text-[#4B7BA7]"><Icon className="w-5 h-5" /></div>
                <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">{title}</h3>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 block mb-1">Variables Dinámicas Permitidas:</span>
                <span className="text-[10px] font-mono text-gray-500 font-bold">{variables}</span>
            </div>
            <textarea
                value={templates[stateKey]}
                onChange={(e) => handleChange(stateKey, e.target.value)}
                placeholder={placeholder}
                className="w-full min-h-[100px] p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/20 outline-none resize-none text-xs font-bold text-gray-700 uppercase"
            />
        </div>
    );

    if (isLoading) return <div className="py-24 text-center text-gray-400 font-black uppercase text-xs animate-pulse">Sincronizando Motor con Supabase...</div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-[2rem] flex items-start gap-4">
                <ShieldAlert className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                    <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-1">Motor de Notas de Cancillería (Nube)</h3>
                    <p className="text-xs text-blue-700 font-medium">Configure cómo el sistema redactará automáticamente las notas. Estas plantillas aplican para toda la jurisdicción.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TemplateCard title="1. Decreto de Corrección (Anulada)" icon={Edit3} stateKey="correccion_anulada" variables="[NUMERO_DECRETO], [FECHA_DECRETO], [LIBRO_NUEVA], [FOLIO_NUEVA], [NUMERO_NUEVA]" />
                <TemplateCard title="2. Decreto de Corrección (Nueva)" icon={BookOpen} stateKey="correccion_nueva" variables="[NUMERO_DECRETO], [FECHA_DECRETO], [LIBRO_ANULADA], [FOLIO_ANULADA], [NUMERO_ANULADA], [MINISTRO]" />
                <TemplateCard title="3. Decreto de Reposición" icon={BookOpen} stateKey="reposicion_nueva" variables="[NUMERO_DECRETO], [FECHA_DECRETO], [MINISTRO]" />
                <TemplateCard title="4. Vínculo Civil (Opcional)" icon={Link} stateKey="vinculo_civil" variables="[NUIP], [OFICINA_REGISTRO], [FECHA_EXPEDICION_RC]" />
                <TemplateCard title="5. Notificación de Matrimonio" icon={HeartCrack} stateKey="matrimonio_casado" variables="[NOMBRE_CONYUGE], [FECHA_MATRIMONIO], [PARROQUIA_MATRIMONIO], [DIOCESIS_MATRIMONIO], [FECHA_NOTIFICACION]" />
                <TemplateCard title="6. Nulidad Matrimonial" icon={ShieldAlert} stateKey="matrimonio_nulidad" variables="[NUMERO_DECRETO], [FECHA_DECRETO]" />
            </div>

            <div className="fixed bottom-8 right-8 z-50">
                <Button 
                    onClick={handleSaveAll} disabled={isSaving}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:shadow-2xl text-white px-10 py-8 rounded-full font-black uppercase tracking-widest text-[10px] shadow-xl transition-all active:scale-95"
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : isSuccess ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    {isSuccess ? 'Motor Sincronizado' : 'Guardar en la Nube'}
                </Button>
            </div>
        </div>
    );
};

export default MarginalNotesTab;