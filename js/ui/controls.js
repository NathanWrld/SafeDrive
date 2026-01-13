import { startDetection, stopDetection } from '../detection/faceDetection.js';
import { startDrivingSession, endDrivingSession } from '../sessions/drivingSession.js';
import { logout } from '../auth/auth.js';
import { initBurgerMenu } from './burger-btn.js';

export function initControls() {
    const video = document.querySelector('.input_video');
    const canvas = document.querySelector('.output_canvas');
    const estado = document.getElementById('estado');

    document.getElementById('startDetection').addEventListener('click', async () => {
        video.style.display = 'block';
        canvas.style.display = 'block';

        await startDrivingSession();
        startDetection(video, canvas, estado);
    });

    document.getElementById('stopDetection').addEventListener('click', async () => {
        stopDetection(video, canvas);
        await endDrivingSession();
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);

    initBurgerMenu();
}

