// main.js
import { initAuth } from './auth/auth.js';
import { initControls } from './ui/controls.js';

document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.id;

    if (page === 'home') {
        // Inicializa Supabase y escucha cambios
        initAuth(); 

        // Inicializa UI y detección
        initControls();
    } else if (page === 'login') {
        // Si ya está logueado, ir a home
        import('./config/supabase.js').then(({ supabase }) => {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) {
                    window.location.href = 'home.html';
                }
            });
        });
    }
});

