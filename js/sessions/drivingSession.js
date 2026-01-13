import { supabase } from '../config/supabase.js';

let sessionId = null;

export async function startDrivingSession() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('sesiones_conduccion')
        .insert([{ id_usuario: user.id }])
        .select()
        .single();

    if (error) {
        console.error(error);
        return null;
    }

    sessionId = data.id_sesion;
    return sessionId;
}

export async function endDrivingSession() {
    if (!sessionId) return;

    await supabase
        .from('sesiones_conduccion')
        .update({ fecha_fin: new Date().toISOString() })
        .eq('id_sesion', sessionId);

    sessionId = null;
}
