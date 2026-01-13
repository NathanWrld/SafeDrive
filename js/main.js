import { checkUserSession, listenAuthChanges } from './auth/auth.js';
import { initControls } from './ui/controls.js';

const page = document.body.id;

// Siempre ejecuta checkUserSession y escucha cambios
checkUserSession();
listenAuthChanges();

// Solo inicializa controles si estamos en home
if (page === 'home') {
    initControls();
}


