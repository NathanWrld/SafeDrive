import { checkUserSession, listenAuthChanges } from './auth/auth.js';
import { initControls } from './ui/controls.js';
import { supabase } from './config/supabase.js';

const page = document.body.id;

if (page === 'home') {
    // Página protegida → si no hay sesión, redirige al login
    checkUserSession(true).then((user) => {
        if (!user) return; // Redirigido al login

        listenAuthChanges();
        initControls();
    });
} else if (page === 'login') {
    // Página login → si ya hay sesión, ir a home
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            window.location.href = 'home.html';
        }
    });
}


