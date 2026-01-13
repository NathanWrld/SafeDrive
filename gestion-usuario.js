// gestion-usuarios.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://roogjmgxghbuiogpcswy.supabase.co'
const supabaseKey = 'sb_publishable_RTN2PXvdWOQFfUySAaTa_g_LLe-T_NU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Función para cargar los datos del usuario actual
async function loadUserProfile() {
    const { data: userData, error } = await supabase.auth.getUser()
    if (error) {
        console.error("Error obteniendo usuario:", error.message)
        return
    }

    if (userData && userData.user) {
        document.getElementById('userName').value = userData.user.user_metadata?.full_name || ''
        document.getElementById('userEmail').value = userData.user.email || ''
    }
}

// Ejecutar cuando se entra al módulo "usuarios"
const usuariosBtn = document.querySelector('.menu-btn[data-target="usuarios"]')
if (usuariosBtn) {
    usuariosBtn.addEventListener('click', loadUserProfile)
}

// Manejar la actualización del perfil
const editProfileForm = document.getElementById('editProfileForm')
if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault()

        const name = document.getElementById('userName').value
        const email = document.getElementById('userEmail').value
        const newPassword = document.getElementById('newPassword').value
        const repeatPassword = document.getElementById('repeatPassword').value
        const currentPassword = document.getElementById('currentPassword').value
        const messageEl = document.getElementById('profileMessage')
        messageEl.textContent = ''
        messageEl.style.color = '#f87171' // rojo por defecto

        // Validar contraseñas nuevas
        if (newPassword && newPassword !== repeatPassword) {
            messageEl.textContent = "Las contraseñas nuevas no coinciden."
            return
        }

        try {
            // 1️⃣ Reautenticar con la contraseña actual
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: currentPassword
            })

            if (signInError) {
                messageEl.textContent = "Contraseña actual incorrecta."
                return
            }

            // 2️⃣ Actualizar nombre, correo y contraseña (si hay)
            const { error: updateError } = await supabase.auth.updateUser({
                email: email,
                password: newPassword || undefined,
                data: { full_name: name }
            })

            if (updateError) {
                messageEl.textContent = `Error al actualizar: ${updateError.message}`
                return
            }

            // Éxito
            messageEl.style.color = "#10b981" // verde
            messageEl.textContent = "Perfil actualizado correctamente."

            // Limpiar campos de contraseña
            document.getElementById('newPassword').value = ''
            document.getElementById('repeatPassword').value = ''
            document.getElementById('currentPassword').value = ''

        } catch (err) {
            console.error(err)
            messageEl.textContent = "Ocurrió un error inesperado."
        }
    })
}
