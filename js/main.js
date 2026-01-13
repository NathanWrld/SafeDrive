import { checkUserSession, listenAuthChanges } from './auth/auth.js';
import { initControls } from './ui/controls.js';

document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.id;

    if (page === 'home') {
        await checkUserSession(); // ❌ sigue actualizando el DOM aquí como antes
        listenAuthChanges();
        initControls();
    }

    // en login no hacemos nada, porque el comportamiento de redirección ya estaba funcionando antes
});


