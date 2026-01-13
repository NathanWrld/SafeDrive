import { supabase } from '../config/supabase.js';

export async function checkUserSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) {
            window.location.href = 'index.html';
            return;
        }

        const user = session.user;

        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay) userDisplay.textContent = `Bienvenido, ${user.email}`;

        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.value = user.email;

        const userName = document.getElementById('userName');
        if (userName && user.user_metadata?.full_name) {
            userName.value = user.user_metadata.full_name;
        }
    } catch (err) {
        console.error('Error en checkUserSession:', err);
    }
}

export function listenAuthChanges() {
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'index.html';
        }
    });
}

export async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error cerrando sesión:', error.message);
        } else {
            window.location.href = 'index.html';
        }
    } catch (err) {
        console.error('Error inesperado en logout:', err);
    }
}
