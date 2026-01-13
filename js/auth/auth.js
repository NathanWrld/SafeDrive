import { supabase } from '../config/supabase.js';

export async function checkUserSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error obteniendo sesión:', error);
        return null;
    }

    return session?.user || null; // Nunca redirige aquí
}

export function listenAuthChanges() {
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'index.html';
        }
    });
}

export async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}
