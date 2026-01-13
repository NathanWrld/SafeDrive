import { checkUserSession, listenAuthChanges } from './auth/auth.js';
import { initControls } from './ui/controls.js';
import { supabase } from './config/supabase.js';

const page = document.body.id;

if (page === 'home') {
    // Solo en páginas protegidas
    checkUserSession();      
    listenAuthChanges();
    initControls();
} else if (page === 'login') {
    // Solo en login
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            // Si ya está logueado, ir a home
            window.location.href = 'home.html';
        }
    });
}

