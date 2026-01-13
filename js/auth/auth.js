// auth.js
import { supabase } from '../config/supabase.js';

export async function initAuth() {
    // Espera a que el DOM esté cargado
    document.addEventListener('DOMContentLoaded', async () => {

        // Obtener sesión
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Error obteniendo sesión:', error.message);
            return;
        }

        if (!session?.user) {
            window.location.href = 'index.html';
            return;
        }

        // Mostrar usuario
        const user = session.user;
        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay) userDisplay.textContent = `Bienvenido, ${user.email}`;

        // Botón logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const { error } = await supabase.auth.signOut();
                if (!error) window.location.href = 'index.html';
                else alert('Error cerrando sesión: ' + error.message);
            });
        }

        // Escuchar cambios de sesión
        supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                window.location.href = 'index.html';
            }
        });

    });
}
