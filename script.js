/* script.js - Versión balanceada para detectar parpadeos rápidos y lentos
   - EAR en píxeles normalizado por ancho de cara (independiente de distancia).
   - Suavizado moderado + detector de derivada para parpadeos rápidos.
   - Cuenta en transición closed -> open; respeta mínimo entre blinks.
   - Muestra valores útiles para depuración.
*/
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://roogjmgxghbuiogpcswy.supabase.co'
const supabaseKey = 'sb_publishable_RTN2PXvdWOQFfUySAaTa_g_LLe-T_NU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Verifica si hay usuario logeado
async function checkUserSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error obteniendo la sesión:', error.message);
        return;
    }

    // ❌ No hay usuario → login
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // ✅ Hay usuario
    const user = session.user;

    // Header o saludo
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.textContent = `Bienvenido, ${user.email}`;
    }

    // Perfil
    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
        userEmail.value = user.email;
    }

    const userName = document.getElementById('userName');
    if (userName && user.user_metadata?.full_name) {
        userName.value = user.user_metadata.full_name;
    }
}

checkUserSession();

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        window.location.href = 'index.html';
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error cerrando sesión:', error.message);
    } else {
        window.location.href = 'index.html';
    }
});

/* Registro de Sesiones en la base de datos */
let sessionId = null; // Guardará el id_sesion actual
let camera = null;

const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const estado = document.getElementById('estado');

// Inicia sesión de conducción
async function startUserSession() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error('No se pudo obtener usuario:', userError);
            alert('No se pudo obtener el usuario. Inicia sesión de nuevo.');
            return;
        }

        // Insertar nuevo registro en la tabla sesiones_conduccion
        const { data, error } = await supabase
            .from('sesiones_conduccion')
            .insert([{ id_usuario: user.id, fecha_inicio: new Date().toISOString() }])
            .select() // devuelve el registro insertado
            .single();

        if (error) {
            console.error('Error insertando sesión:', error);
            return;
        }

        sessionId = data.id_sesion; // Guardamos el id_sesion
        console.log('Sesión iniciada:', sessionId);

    } catch (error) {
        console.error('Error en startUserSession:', error);
    }
}

// Finaliza sesión de conducción
async function endUserSession() {
    if (!sessionId) return;

    try {
        const { error } = await supabase
            .from('sesiones_conduccion')
            .update({ fecha_fin: new Date().toISOString() })
            .eq('id_sesion', sessionId); // Usamos id_sesion, no id

        if (error) console.error('Error al finalizar sesión:', error);
        else console.log('Sesión finalizada:', sessionId);

        sessionId = null;

    } catch (error) {
        console.error('Error en endUserSession:', error);
    }
}

// ----------------- Botones -----------------
document.getElementById('startDetection').addEventListener('click', async () => {
    videoElement.style.display = 'block';
    canvasElement.style.display = 'block';

    await startUserSession();
    startDetection(); // tu función de FaceMesh / parpadeos

    estado.innerHTML = "<p>Analizando rostro...</p>";
    document.getElementById('startDetection').style.display = 'none';
    document.getElementById('stopDetection').style.display = 'inline-block';
});

document.getElementById('stopDetection').addEventListener('click', async () => {
    if (camera) {
        camera.stop();
        camera = null;
    }

    videoElement.style.display = 'none';
    canvasElement.style.display = 'none';

    await endUserSession();

    estado.innerHTML = "<p>Detección detenida.</p>";
    document.getElementById('startDetection').style.display = 'inline-block';
    document.getElementById('stopDetection').style.display = 'none';
});

// ---------------- Lógica de detección ----------------
function startDetection() {
    const canvasCtx = canvasElement.getContext('2d');

    // ---------------- Parámetros ----------------
    const SMOOTHING_WINDOW = 5;
    const BASELINE_FRAMES_INIT = 60;
    const EMA_ALPHA = 0.03;
    const BASELINE_MULTIPLIER = 0.62;
    const CLOSED_FRAMES_THRESHOLD = 1;
    const MIN_TIME_BETWEEN_BLINKS = 150;
    const DERIVATIVE_THRESHOLD = -0.0025;

    let blinkCount = 0;
    let blinkStartTime = Date.now();
    let lastBlinkTime = 0;

    let earHistory = [];
    let baselineSamples = [];
    let baselineEMA = null;
    let initialCalibrationDone = false;

    let state = 'open';
    let closedFrameCounter = 0;
    let prevSmoothedEAR = 0;

    function toPixel(l) { return { x: l.x * canvasElement.width, y: l.y * canvasElement.height }; }
    function dist(a,b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function movingAverage(arr) { return arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0; }
    function median(arr) { if (!arr.length) return 0; const a = [...arr].sort((x,y)=>x-y); const m=Math.floor(a.length/2); return arr.length%2===0 ? (a[m-1]+a[m])/2 : a[m]; }
    function calculateEAR_px(landmarks, indices) {
        const [p0,p1,p2,p3,p4,p5] = indices.map(i => toPixel(landmarks[i]));
        const vertical1 = dist(p1,p5), vertical2 = dist(p2,p4), horizontal = dist(p0,p3);
        if (horizontal===0) return 0;
        return (vertical1 + vertical2) / (2.0 * horizontal);
    }

    const RIGHT_EYE_IDX = [33,160,158,133,153,144];
    const LEFT_EYE_IDX  = [362,385,387,263,373,380];

    const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence:0.55, minTrackingConfidence:0.55 });

    faceMesh.onResults((results) => {
        if (results.image) {
            canvasElement.width = results.image.width || canvasElement.width;
            canvasElement.height = results.image.height || canvasElement.height;
        }

        canvasCtx.save();
        canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
        canvasCtx.drawImage(results.image,0,0,canvasElement.width,canvasElement.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const lm = results.multiFaceLandmarks[0];
            drawConnectors(canvasCtx, lm, FACEMESH_TESSELATION, { color: '#00C853', lineWidth: 0.5 });
            drawConnectors(canvasCtx, lm, FACEMESH_RIGHT_EYE, { color:'#FF5722', lineWidth:1 });
            drawConnectors(canvasCtx, lm, FACEMESH_LEFT_EYE, { color:'#FF5722', lineWidth:1 });

            const rightEAR_px = calculateEAR_px(lm, RIGHT_EYE_IDX);
            const leftEAR_px  = calculateEAR_px(lm, LEFT_EYE_IDX);
            const ear_px = (rightEAR_px + leftEAR_px)/2;

            const xs = lm.map(p => p.x * canvasElement.width);
            const faceWidthPx = Math.max(...xs) - Math.min(...xs);
            const ear_rel = faceWidthPx>0 ? ear_px/faceWidthPx : ear_px;

            if (!initialCalibrationDone) {
                if (ear_rel>0) baselineSamples.push(ear_rel);
                const remaining = Math.max(0, BASELINE_FRAMES_INIT - baselineSamples.length);
                estado.innerHTML = `<p>✅ Rostro detectado — calibrando... (${remaining} frames)</p>
                                    <p>Parpadeos: ${blinkCount}</p>`;
                canvasCtx.restore();
                if (baselineSamples.length >= BASELINE_FRAMES_INIT) {
                    baselineEMA = median(baselineSamples);
                    if (baselineEMA<=0) baselineEMA=0.01;
                    initialCalibrationDone = true;
                    console.log('Baseline inicial:', baselineEMA);
                }
                return;
            }

            earHistory.push(ear_rel);
            if (earHistory.length>SMOOTHING_WINDOW) earHistory.shift();
            const smoothedEAR = movingAverage(earHistory);
            const derivative = smoothedEAR - prevSmoothedEAR;
            prevSmoothedEAR = smoothedEAR;

            baselineEMA = baselineEMA===null ? smoothedEAR : (EMA_ALPHA*smoothedEAR + (1-EMA_ALPHA)*baselineEMA);
            if (!baselineEMA || baselineEMA<=0) baselineEMA = 0.01;

            const EAR_THRESHOLD = baselineEMA * BASELINE_MULTIPLIER;
            const rapidDrop = derivative < DERIVATIVE_THRESHOLD;
            const consideredClosed = (smoothedEAR < EAR_THRESHOLD) || rapidDrop;

            const now = Date.now();

            if (consideredClosed) {
                closedFrameCounter++;
                if (state==='open' && closedFrameCounter>=CLOSED_FRAMES_THRESHOLD) state='closed';
            } else {
                if (state==='closed') {
                    if (now - lastBlinkTime > MIN_TIME_BETWEEN_BLINKS) {
                        blinkCount++;
                        lastBlinkTime = now;
                    }
                    state='open';
                }
                closedFrameCounter=0;
            }

            const elapsedMinutes = (now-blinkStartTime)/60000;
            if (elapsedMinutes>=1) {
                blinkCount=0;
                blinkStartTime=now;
            }
            const bpm = (blinkCount/(elapsedMinutes||1)).toFixed(1);

            estado.innerHTML = `
                <p>✅ Rostro detectado</p>
                <p>Parpadeos: ${blinkCount}</p>
                <p>Parpadeos por minuto: ${bpm}</p>
                <p>EAR(smooth): ${smoothedEAR.toFixed(6)}</p>
                <p>Baseline EMA: ${baselineEMA.toFixed(6)}</p>
                <p>Umbral: ${EAR_THRESHOLD.toFixed(6)}</p>
                <p>Derivada: ${derivative.toFixed(6)}</p>
            `;
        } else {
            estado.innerHTML = `<p>❌ No se detecta rostro</p>`;
        }

        canvasCtx.restore();
    });

    // Inicializar cámara
    camera = new Camera(videoElement, {
        onFrame: async () => { await faceMesh.send({image: videoElement}); },
        width: 480,
        height: 360
    });
    camera.start();
}

// ---------------- Gestión de usuarios ----------------
const profileForm = document.getElementById('editProfileForm');
const profileMessage = document.getElementById('profileMessage');

if(profileForm){
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        profileMessage.textContent = '';
        profileMessage.classList.remove('success','error');

        const userName = document.getElementById('userName').value.trim();
        const userEmail = document.getElementById('userEmail').value.trim();
        const newPassword = document.getElementById('newPassword').value;
        const repeatPassword = document.getElementById('repeatPassword').value;
        const currentPassword = document.getElementById('currentPassword').value;

        if(!currentPassword){
            profileMessage.textContent = 'Debes ingresar tu contraseña actual.';
            profileMessage.classList.add('error');
            return;
        }

        if(newPassword && newPassword !== repeatPassword){
            profileMessage.textContent = 'La nueva contraseña y la repetición no coinciden.';
            profileMessage.classList.add('error');
            return;
        }

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if(userError || !user){
                profileMessage.textContent = 'No se pudo obtener el usuario.';
                profileMessage.classList.add('error');
                return;
            }

            // Actualizar metadata (nombre)
            const updates = { full_name: userName };

            const { error: updateMetaError } = await supabase.auth.updateUser({
                data: updates
            });

            if(updateMetaError){
                profileMessage.textContent = 'Error al actualizar nombre.';
                profileMessage.classList.add('error');
                return;
            }

            // Actualizar email si cambió
            if(userEmail !== user.email){
                const { error: emailError } = await supabase.auth.updateUser({
                    email: userEmail
                });
                if(emailError){
                    profileMessage.textContent = 'Error al actualizar correo.';
                    profileMessage.classList.add('error');
                    return;
                }
            }

            // Actualizar contraseña si se ingresó nueva
            if(newPassword){
                const { error: passError } = await supabase.auth.updateUser({
                    password: newPassword
                });
                if(passError){
                    profileMessage.textContent = 'Error al actualizar contraseña.';
                    profileMessage.classList.add('error');
                    return;
                }
            }

            profileMessage.textContent = 'Perfil actualizado correctamente.';
            profileMessage.classList.add('success');

            // Limpiar campos de contraseña
            document.getElementById('newPassword').value = '';
            document.getElementById('repeatPassword').value = '';
            document.getElementById('currentPassword').value = '';

        } catch(err){
            console.error(err);
            profileMessage.textContent = 'Ocurrió un error al actualizar perfil.';
            profileMessage.classList.add('error');
        }
    });
}
