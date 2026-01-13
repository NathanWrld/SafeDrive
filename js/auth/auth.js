import { supabase } from '../config/supabase.js';

export async function checkUserSession(protectedPage = false) {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error al obtener sesión:', error);
        return;
    }

    if (!session?.user) {
        // Si es página protegida y no hay sesión → redirigir a login
        if (protectedPage) {
            window.location.href = 'index.html';
        }
        return null;
    }

    return session.user;
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
