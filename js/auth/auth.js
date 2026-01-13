// auth.js
import { supabase } from '../config/supabase.js';

export async function checkUserSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
        window.location.href = 'index.html'; // ❌ solo en páginas protegidas, pero dejemos como antes
        return;
    }

    const user = session.user;

    // Actualizar DOM como antes
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) userDisplay.textContent = `Bienvenido, ${user.email}`;

    const userEmail = document.getElementById('userEmail');
    if (userEmail) userEmail.value = user.email;

    const userName = document.getElementById('userName');
    if (userName && user.user_metadata?.full_name) {
        userName.value = user.user_metadata.full_name;
    }

    return user;
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
        console.log('Logout iniciado');
        const { error } = await supabase.auth.signOut();
        if (error) {
            alert('Error cerrando sesión: ' + error.message);
            return;
        }
        window.location.href = 'index.html';
    } catch (err) {
        alert('Error inesperado: ' + err.message);
    }
}

