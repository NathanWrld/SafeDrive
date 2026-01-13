// controls.js
import { startDetection, stopDetection } from '../detection/faceDetection.js';
import { startDrivingSession, endDrivingSession } from '../sessions/drivingSession.js';
import { initBurgerMenu } from './burger-btn.js';

export function initControls() {
    initBurgerMenu();

    const video = document.querySelector('.input_video');
    const canvas = document.querySelector('.output_canvas');
    const estado = document.getElementById('estado');
    const startBtn = document.getElementById('startDetection');
    const stopBtn = document.getElementById('stopDetection');

    if (!video || !canvas || !estado || !startBtn || !stopBtn) return;

    startBtn.addEventListener('click', async () => {
        video.style.display = 'block';
        canvas.style.display = 'block';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        estado.innerHTML = '<p>Inicializando detección...</p>';

        await startDrivingSession();
        startDetection(video, canvas, estado);
    });

    stopBtn.addEventListener('click', async () => {
        stopDetection(video, canvas);
        stopBtn.style.display = 'none';
        startBtn.style.display = 'inline-block';
        estado.innerHTML = '<p>Detección detenida.</p>';

        await endDrivingSession();
    });
}
