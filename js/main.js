import { checkUserSession, listenAuthChanges } from './auth/auth.js';
import { initControls } from './ui/controls.js';

const page = document.body.id;

// Siempre
checkUserSession();
listenAuthChanges();

// Solo en home
if (page === 'home') {
    initControls();
}

