// main.js
import { initAuth } from './auth/auth.js';
import { initControls } from './ui/controls.js';

const page = document.body.id;

if (page === 'home') {
    initAuth();      // Inicializa sesión y logout
    initControls();  // Inicializa UI y detección
}
