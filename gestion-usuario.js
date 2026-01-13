// gestion-usuario.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://roogjmgxghbuiogpcswy.supabase.co'
const supabaseKey = 'sb_publishable_RTN2PXvdWOQFfUySAaTa_g_LLe-T_NU'
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Función pública para cargar el perfil del usuario
 * Solo se ejecuta al entrar al módulo "usuarios"
 */
export async function loadUserProfile() {
    try {
        const { data: user, error } = await supabase.auth.getUser()
        if (error) {
            console.error("Error obteniendo usuario:", error.message)
            return
        }

        if (user && user.user) {
            document.getElementById('userName').value = user.user.user_metadata?.full_name || ''
            document.getElementById('userEmail').value = user.user.email || ''
        }
    } catch (err) {
        console.error("Error inesperado al cargar perfil:", err)
    }
}

// Manejar la actualización del perfil
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('editProfileForm')
    if (!form) return

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const name = document.getElementById('userName').value
        const email = document.getElementById('userEmail').value
        const newPassword = document.getElementById('newPassword').value
        const repeatPassword = document.getElementById('repeatPassword').value
        const currentPassword = document.getElementById('currentPassword').value
        const messageEl = document.getElementById('profileMessage')
        messageEl.textContent = ''
        messageEl.style.color = '#ef4444' // rojo por defecto

        if (newPassword && newPassword !== repeatPassword) {
            messageEl.textContent = "Las contraseñas nuevas no coinciden."
            return
        }

        try {
            // Reautenticación con la contraseña actual
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: currentPassword
            })

            if (signInError) {
                messageEl.textContent = "Contraseña actual incorrecta."
                return
            }

            // Actualizar nombre y correo (y contraseña si se proporcionó)
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
            document.getElementById('currentPassword').value = ''

        } catch (err) {
            console.error("Error inesperado al actualizar perfil:", err)
            messageEl.textContent = "Ocurrió un error inesperado."
        }
    })
})
