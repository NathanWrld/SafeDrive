import { checkUserSession, listenAuthChanges } from './auth/auth.js';
import { initControls } from './ui/controls.js';
import { supabase } from './config/supabase.js';

const page = document.body.id;

document.addEventListener('DOMContentLoaded', async () => {
    if (page === 'home') {
        const user = await checkUserSession();
        if (!user) {
            // Redirige solo si no hay sesión en páginas protegidas
            window.location.href = 'index.html';
            return;
        }

        listenAuthChanges();
        initControls();

    } else if (page === 'login') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            // Redirige a home si ya hay sesión
            window.location.href = 'home.html';
        }
        // Si no hay sesión, se queda en login
    }
});

