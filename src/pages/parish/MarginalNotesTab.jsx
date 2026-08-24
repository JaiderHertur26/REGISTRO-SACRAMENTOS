import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Save, Check, Loader2, BookOpen, Link, HeartCrack, Edit3, ShieldAlert, Droplet, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const MarginalNotesTab = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    // 🚀 ESTADO MAESTRO EXPANDIDO PARA TODOS LOS SACRAMENTOS
    const [templates, setTemplates] = useState({
        // DECRETOS GENERALES
        correccion_anulada: "PARTIDA ANULADA POR DECRETO NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO] DE LA [OFICINA_EXPIDE]. LA INFORMACIÓN CORREGIDA PASA AL L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].",
        correccion_nueva: "ESTA PARTIDA SE INSCRIBE POR DECRETO DE CORRECCIÓN NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO], Y ANULA LA PARTIDA ORIGINAL DEL L-[LIBRO_ANULADA] F-[FOLIO_ANULADA] N-[NUMERO_ANULADA]. DA FE: [MINISTRO].",
        reposicion_nueva: "ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO] DE LA [OFICINA_EXPIDE], DEBIDO A PÉRDIDA O DETERIORO DEL ORIGINAL. DA FE: [MINISTRO].",
        error_transcripcion: "SE CORRIGE ERROR DE TRANSCRIPCIÓN. DONDE DECÍA: [VALOR_INCORRECTO], DEBE LEERSE CORRECTAMENTE COMO: [VALOR_CORRECTO]. DA FE: [MINISTRO].",
        
        // BAUTISMOS (Efectos de Confirmación y Matrimonio en Bautismo)
        bautismo_confirmado: "EL [FECHA_CONFIRMACION] FUE CONFIRMADO(A) EN LA PARROQUIA [PARROQUIA_CONFIRMACION]. DIÓCESIS DE [DIOCESIS_CONFIRMACION]. L-[LIBRO_CONF], F-[FOLIO_CONF], N-[NUMERO_CONF].",
        bautismo_casado: "EL [FECHA_NOTIFICACION] SE NOTIFICA QUE CONTRAJO MATRIMONIO CON [NOMBRE_CONYUGE] EL [FECHA_MATRIMONIO] EN LA PARROQUIA [PARROQUIA_MATRIMONIO]. DIÓCESIS: [DIOCESIS_MATRIMONIO]. L-[LIBRO_MAT], F-[FOLIO_MAT], N-[NUMERO_MAT].",
        bautismo_nulidad_mat: "MATRIMONIO CON [NOMBRE_CONYUGE] DECLARADO NULO. SENTENCIA DEL TRIBUNAL ECLESIÁSTICO, DECRETO NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO].",
        bautismo_orden: "RECIBIÓ EL ORDEN SACERDOTAL / PROFESIÓN RELIGIOSA EL [FECHA_ORDEN] EN [LUGAR_ORDEN]. DIÓCESIS: [DIOCESIS_ORDEN].",
        vinculo_civil: "REGISTRO CIVIL: NUIP/NIP [NUIP]. EXPEDIDO EN [OFICINA_REGISTRO] EL DÍA [FECHA_EXPEDICION_RC].",
        
        // MATRIMONIOS
        matrimonio_nulidad: "ESTE MATRIMONIO FUE DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO].",
        
        // FIRMA / CERTIFICACIÓN
        certificacion_estandar: "LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA."
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        if (!user?.parishId) return;
        const storedData = localStorage.getItem(`marginalNotesTemplates_${user.parishId}`);
        if (storedData) {
            setTemplates(JSON.parse(storedData));
        }
    }, [user]);

    const handleChange = (key, value) => {
        setTemplates(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 800));
            localStorage.setItem(`marginalNotesTemplates_${user?.parishId}`, JSON.stringify(templates));
            
            setIsSuccess(true);
            toast({ title: "Plantillas Guardadas", description: "El motor inteligente ha sido actualizado.", className: "bg-green-50 text-green-900 border-green-200" });
            setTimeout(() => setIsSuccess(false), 3000);
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron guardar las plantillas.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const TemplateCard = ({ title, icon: Icon, stateKey, variables, placeholder, colorClass = "text-[#4B7BA7] bg-blue-50" }) => (
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                <div className={cn("p-2 rounded-xl", colorClass)}><Icon className="w-5 h-5" /></div>
                <h3 className="font-black text-gray-800 uppercase tracking-widest text-[11px]">{title}</h3>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 block mb-1">Variables Dinámicas Permitidas:</span>
                <span className="text-[10px] font-mono text-gray-500 font-bold leading-relaxed">{variables}</span>
            </div>
            <textarea
                value={templates[stateKey] || ''}
                onChange={(e) => handleChange(stateKey, e.target.value)}
                placeholder={placeholder}
                className="w-full min-h-[100px] p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4B7BA7]/20 outline-none resize-none text-xs font-bold text-gray-700 uppercase"
            />
        </div>
    );

    const SectionTitle = ({ title }) => (
        <div className="col-span-full border-b border-gray-200 pb-2 mt-8 mb-2">
            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">{title}</h2>
        </div>
    );

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500">
            <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-[2rem] flex items-start gap-4">
                <ShieldAlert className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                    <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-1">Motor Inteligente de Notas</h3>
                    <p className="text-xs text-blue-700 font-medium">Configure cómo el sistema redactará automáticamente las notas marginales cruzadas al registrar los diferentes sacramentos. Use las variables entre corchetes para inyección de datos.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 🚀 DECRETOS E INTERVENCIONES LEGALES */}
                <SectionTitle title="Decretos Generales y Correcciones" />
                
                <TemplateCard 
                    title="1. Decreto de Corrección (Partida Anulada)" 
                    icon={Edit3} stateKey="correccion_anulada" 
                    variables="[NUMERO_DECRETO], [FECHA_DECRETO], [OFICINA_EXPIDE], [LIBRO_NUEVA], [FOLIO_NUEVA], [NUMERO_NUEVA]"
                />
                <TemplateCard 
                    title="2. Decreto de Corrección (Asiento Nuevo)" 
                    icon={BookOpen} stateKey="correccion_nueva" 
                    variables="[NUMERO_DECRETO], [FECHA_DECRETO], [LIBRO_ANULADA], [FOLIO_ANULADA], [NUMERO_ANULADA], [MINISTRO]"
                />
                <TemplateCard 
                    title="3. Decreto de Reposición / Restauración" 
                    icon={BookOpen} stateKey="reposicion_nueva" 
                    variables="[NUMERO_DECRETO], [FECHA_DECRETO], [OFICINA_EXPIDE], [MINISTRO]"
                />
                <TemplateCard 
                    title="4. Error de Transcripción Simple" 
                    icon={Edit3} stateKey="error_transcripcion" 
                    variables="[VALOR_INCORRECTO], [VALOR_CORRECTO], [MINISTRO]"
                />

                {/* 🚀 AFECTACIONES AL MARGEN DEL BAUTISMO */}
                <SectionTitle title="Notas Cruzadas en Bautismos" />

                <TemplateCard 
                    title="1. Notificación de Confirmación" 
                    icon={UserCheck} stateKey="bautismo_confirmado" colorClass="text-red-600 bg-red-50"
                    variables="[FECHA_CONFIRMACION], [PARROQUIA_CONFIRMACION], [DIOCESIS_CONFIRMACION], [LIBRO_CONF], [FOLIO_CONF], [NUMERO_CONF]"
                />
                <TemplateCard 
                    title="2. Notificación de Matrimonio" 
                    icon={HeartCrack} stateKey="bautismo_casado" colorClass="text-amber-600 bg-amber-50"
                    variables="[NOMBRE_CONYUGE], [FECHA_MATRIMONIO], [PARROQUIA_MATRIMONIO], [DIOCESIS_MATRIMONIO], [LIBRO_MAT], [FOLIO_MAT], [NUMERO_MAT], [FECHA_NOTIFICACION]"
                />
                <TemplateCard 
                    title="3. Vínculo de Registro Civil (Adopción / Reconocimiento)" 
                    icon={Link} stateKey="vinculo_civil" colorClass="text-indigo-600 bg-indigo-50"
                    variables="[NUIP], [OFICINA_REGISTRO], [FECHA_EXPEDICION_RC]"
                />
                <TemplateCard 
                    title="4. Orden Sacerdotal / Prof. Religiosa" 
                    icon={ShieldAlert} stateKey="bautismo_orden" colorClass="text-purple-600 bg-purple-50"
                    variables="[FECHA_ORDEN], [LUGAR_ORDEN], [DIOCESIS_ORDEN]"
                />

                {/* 🚀 AFECTACIONES EN MATRIMONIO */}
                <SectionTitle title="Notas Jurídicas Matrimoniales" />

                <TemplateCard 
                    title="1. Nulidad Matrimonial" 
                    icon={ShieldAlert} stateKey="matrimonio_nulidad" colorClass="text-amber-600 bg-amber-50"
                    variables="[NUMERO_DECRETO], [FECHA_DECRETO]"
                />
                <TemplateCard 
                    title="2. Nulidad Matrimonial (Al margen del Bautismo)" 
                    icon={HeartCrack} stateKey="bautismo_nulidad_mat" colorClass="text-amber-600 bg-amber-50"
                    variables="[NOMBRE_CONYUGE], [NUMERO_DECRETO], [FECHA_DECRETO]"
                />

            </div>

            {/* BOTÓN FLOTANTE */}
            <div className="fixed bottom-8 right-8 z-50">
                <Button 
                    onClick={handleSaveAll} 
                    disabled={isSaving}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:shadow-2xl hover:shadow-emerald-500/40 text-white px-10 py-8 rounded-full font-black uppercase tracking-widest text-[10px] shadow-xl transition-all active:scale-95"
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : isSuccess ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    {isSuccess ? 'Motor Actualizado' : 'Guardar Plantillas'}
                </Button>
            </div>
        </div>
    );
};

export default MarginalNotesTab;