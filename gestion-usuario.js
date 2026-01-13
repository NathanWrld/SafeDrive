// gestion-usuarios.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://roogjmgxghbuiogpcswy.supabase.co'
const supabaseKey = 'sb_publishable_RTN2PXvdWOQFfUySAaTa_g_LLe-T_NU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Función para cargar datos del usuario logueado
async function loadUserProfile() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
            console.error("Error obteniendo usuario:", error.message)
            return
        }

        if (user) {
            document.getElementById('userName').value = user.user_metadata?.full_name || ''
            document.getElementById('userEmail').value = user.email || ''
        }
    } catch (err) {
        console.error("Error inesperado al cargar perfil:", err)
    }
}

// Ejecutar la carga de perfil solo **al abrir la sección de usuarios**
const usuariosBtn = document.querySelector('.menu-btn[data-target="usuarios"]')
if (usuariosBtn) {
    usuariosBtn.addEventListener('click', loadUserProfile)
}

// Manejar actualización del perfil
const editProfileForm = document.getElementById('editProfileForm')
if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const messageEl = document.getElementById('profileMessage')
        messageEl.textContent = ''
        messageEl.style.color = '#f87171' // rojo por defecto

        const name = document.getElementById('userName').value
        const email = document.getElementById('userEmail').value
        const newPassword = document.getElementById('newPassword').value
        const repeatPassword = document.getElementById('repeatPassword').value

        if (newPassword && newPassword !== repeatPassword) {
            messageEl.textContent = "Las contraseñas nuevas no coinciden."
            return
        }

        try {
            // Actualización de datos (nombre, email, contraseña opcional)
            const { error: updateError } = await supabase.auth.updateUser({
                email: email,
                password: newPassword || undefined,
                data: { full_name: name }
            })

            if (updateError) {
                messageEl.textContent = `Error al actualizar: ${updateError.message}`
                return
            }

            messageEl.style.color = "#10b981" // verde
            messageEl.textContent = "Perfil actualizado correctamente."

            // Limpiar campos de contraseña
            document.getElementById('newPassword').value = ''
            document.getElementById('repeatPassword').value = ''

        } catch (err) {
            console.error(err)
            messageEl.textContent = "Ocurrió un error inesperado."
        }
    })
}
