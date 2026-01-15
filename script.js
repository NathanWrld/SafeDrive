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

    // Perfil
    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
        userEmail.value = user.email;
    }

}

checkUserSession();

// Obtiene el rol del usuario logeado
async function getUserRole() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return 'User';

    const { data, error } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (error || !data || !data.rol) return 'User';

    // Normalizar: quitar espacios y convertir a mayúsculas la primera letra
    const rol = String(data.rol).trim();
    if (rol === 'Dev') return 'Dev';
    return 'User';
}



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
    const rol = await getUserRole();
    console.log('Rol detectado:', rol); // Para depuración

    if (rol === 'Dev') {
        videoElement.style.display = 'block';
        canvasElement.style.display = 'block';
    } else {
        videoElement.style.display = 'block';
        canvasElement.style.display = 'none';
    }

    await startUserSession();
    startDetection(rol);

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
function startDetection(rol) {
    const canvasCtx = canvasElement.getContext('2d');
    const isDev = rol === 'Dev'; // Solo Dev verá las líneas en el rostro

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
        if (!results.image) return;

        if (isDev) {
            canvasElement.width = results.image.width || canvasElement.width;
            canvasElement.height = results.image.height || canvasElement.height;

            canvasCtx.save();
            canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
            // Dibujar video y conectores solo para Dev
            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        }

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const lm = results.multiFaceLandmarks[0];

            if (isDev) {
                drawConnectors(canvasCtx, lm, FACEMESH_TESSELATION, { color: '#00C853', lineWidth: 0.5 });
                drawConnectors(canvasCtx, lm, FACEMESH_RIGHT_EYE, { color:'#FF5722', lineWidth:1 });
                drawConnectors(canvasCtx, lm, FACEMESH_LEFT_EYE, { color:'#FF5722', lineWidth:1 });
            }

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
                if (baselineSamples.length >= BASELINE_FRAMES_INIT) {
                    baselineEMA = median(baselineSamples);
                    if (baselineEMA<=0) baselineEMA=0.01;
                    initialCalibrationDone = true;
                }
                if (isDev) canvasCtx.restore();
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

        if (isDev) canvasCtx.restore();
    });

    camera = new Camera(videoElement, {
        onFrame: async () => { await faceMesh.send({image: videoElement}); },
        width: 480,
        height: 360
    });
    camera.start();
}



// ---------------- Edición de Perfil ----------------
async function loadUserProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return;

    const userId = authData.user.id;

    const { data: userProfile, error } = await supabase
        .from('Usuarios')
        .select('nombre')
        .eq('id_usuario', userId)
        .single();

    if (error) {
        console.error("Error cargando perfil:", error);
        return;
    }

    document.getElementById('userName').value = userProfile.nombre;
    document.getElementById('userEmail').value = authData.user.email;
}

// Ejecutar cuando se abre el módulo "usuarios"
document
    .querySelector('.menu-btn[data-target="usuarios"]')
    .addEventListener('click', loadUserProfile);

// Guardar cambios del perfil
document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const messageEl = document.getElementById('profileMessage');
    messageEl.textContent = '';
    messageEl.style.color = '#f87171';

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newName = document.getElementById('userName').value.trim();
    const newEmail = document.getElementById('userEmail').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const repeatPassword = document.getElementById('repeatPassword').value;
    const currentPassword = document.getElementById('currentPassword').value;

    try {
        // 🔐 Verificar contraseña actual
        if (!currentPassword) {
            throw new Error('Debes ingresar tu contraseña actual');
        }

        const { error: authError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword
        });

        if (authError) {
            throw new Error('La contraseña actual es incorrecta');
        }

        // 1️⃣ Verificar si existe en Usuarios
        const { data: existingUser, error: fetchError } = await supabase
            .from('Usuarios')
            .select('id_usuario')
            .eq('id_usuario', user.id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }

        // 2️⃣ Insert o Update nombre
        if (!existingUser) {
            const { error } = await supabase
                .from('Usuarios')
                .insert([{ id_usuario: user.id, nombre: newName }]);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('Usuarios')
                .update({ nombre: newName })
                .eq('id_usuario', user.id);
            if (error) throw error;
        }

        // 3️⃣ Actualizar email
        if (newEmail && newEmail !== user.email) {
            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) throw error;
        }

        // 4️⃣ Actualizar contraseña
        if (newPassword || repeatPassword) {
            if (newPassword.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres');
            }
            if (newPassword !== repeatPassword) {
                throw new Error('Las contraseñas no coinciden');
            }

            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });
            if (error) throw error;
        }

        messageEl.style.color = '#10b981';
        messageEl.textContent = 'Perfil actualizado correctamente';

        document.getElementById('newPassword').value = '';
        document.getElementById('repeatPassword').value = '';
        document.getElementById('currentPassword').value = '';

    } catch (err) {
        console.error(err);
        messageEl.textContent = err.message || 'Error al actualizar perfil';
    }
});


