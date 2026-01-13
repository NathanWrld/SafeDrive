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

document.addEventListener('DOMContentLoaded', async () => {
    if (page === 'home') {
        const user = await checkUserSession();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Actualiza UI con el usuario logueado
        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay) {
            userDisplay.textContent = `Bienvenido, ${user.email}`;
        }

        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.value = user.email;

        const userName = document.getElementById('userName');
        if (userName && user.user_metadata?.full_name) {
            userName.value = user.user_metadata.full_name;
        }

        listenAuthChanges();
        initControls();
    } else if (page === 'login') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            window.location.href = 'home.html';
        }
    }
});


