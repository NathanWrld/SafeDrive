import { startDrivingSession, endDrivingSession } from '../sessions/drivingSession.js';
import { createBlinkDetector } from './blinkLogic.js';

let camera = null;
let blinkDetector = null;

export async function startDetection(video, canvas, estado) {

    const canvasCtx = canvas.getContext('2d');

    // Inicializamos el detector de parpadeo
    blinkDetector = createBlinkDetector();

    // ================= FaceMesh =================
    const faceMesh = new FaceMesh({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
    });

    faceMesh.onResults((results) => {

        if (!results.image) return;

        canvas.width = results.image.width || canvas.width;
        canvas.height = results.image.height || canvas.height;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        if (
            results.multiFaceLandmarks &&
            results.multiFaceLandmarks.length > 0
        ) {
            const landmarks = results.multiFaceLandmarks[0];

            // Dibujos (exactamente como antes)
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
                color: '#00C853',
                lineWidth: 0.5
            });
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {
                color: '#FF5722',
                lineWidth: 1
            });
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {
                color: '#FF5722',
                lineWidth: 1
            });

            // ===== Procesar frame =====
            const result = blinkDetector.processFrame(landmarks, canvas);

            if (!result.calibrated) {
                estado.innerHTML = `
                    <p>✅ Rostro detectado — calibrando... (${result.remainingFrames} frames)</p>
                    <p>Parpadeos: 0</p>
                `;
            } else {
                estado.innerHTML = `
                    <p>✅ Rostro detectado</p>
                    <p>Parpadeos: ${result.blinkCount}</p>
                    <p>Parpadeos por minuto: ${result.bpm}</p>
                    <p>EAR(smooth): ${result.ear.toFixed(6)}</p>
                    <p>Baseline EMA: ${result.baseline.toFixed(6)}</p>
                    <p>Umbral: ${result.threshold.toFixed(6)}</p>
                    <p>Derivada: ${result.derivative.toFixed(6)}</p>
                `;
            }

        } else {
            estado.innerHTML = `<p>❌ No se detecta rostro</p>`;
        }

        canvasCtx.restore();
    });

    // ================= Cámara =================
    camera = new Camera(video, {
        onFrame: async () => {
            await faceMesh.send({ image: video });
        },
        width: 480,
        height: 360
    });

    camera.start();
}

export async function stopDetection(video, canvas) {

    if (camera) {
        camera.stop();
        camera = null;
    }

    if (blinkDetector) {
        blinkDetector.reset();
        blinkDetector = null;
    }

    video.style.display = 'none';
    canvas.style.display = 'none';
}

