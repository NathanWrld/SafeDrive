// auth.js
import { supabase } from '../config/supabase.js';

export function initAuth() {
    // Verificar sesión al cargar home
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) {
            window.location.href = 'index.html';
            return;
        }

        const user = session.user;
        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay) userDisplay.textContent = `Bienvenido, ${user.email}`;
    });

    // Escuchar cambios de sesión
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'index.html';
        }
    });

    // Botón logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (!error) window.location.href = 'index.html';
            else alert('Error cerrando sesión: ' + error.message);
        });
    }
}
