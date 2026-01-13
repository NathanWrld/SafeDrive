// gestion-usuario.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://roogjmgxghbuiogpcswy.supabase.co'
const supabaseKey = 'sb_publishable_RTN2PXvdWOQFfUySAaTa_g_LLe-T_NU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Función para cargar el perfil SOLO cuando se abre el módulo "usuarios"
async function loadUserProfile() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
        console.error("Error obteniendo usuario:", error.message)
        return
    }

    if (!user) {
        console.warn("No hay usuario logueado para cargar el perfil")
        return
    }

    const nameInput = document.getElementById('userName')
    const emailInput = document.getElementById('userEmail')
    if (nameInput) nameInput.value = user.user_metadata?.full_name || ''
    if (emailInput) emailInput.value = user.email || ''
}

// Ejecutar cuando se entra al módulo "usuarios"
const usuariosBtn = document.querySelector('.menu-btn[data-target="usuarios"]')
if (usuariosBtn) {
    usuariosBtn.addEventListener('click', loadUserProfile)
}

// Manejar la actualización del perfil
const profileForm = document.getElementById('editProfileForm')
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const name = document.getElementById('userName').value
        const email = document.getElementById('userEmail').value
        const newPassword = document.getElementById('newPassword').value
        const repeatPassword = document.getElementById('repeatPassword').value
        const currentPassword = document.getElementById('currentPassword').value
        const messageEl = document.getElementById('profileMessage')
        messageEl.textContent = ''
        messageEl.style.color = '#ef4444'

        if (newPassword && newPassword !== repeatPassword) {
            messageEl.textContent = "Las contraseñas nuevas no coinciden."
            return
        }

        // Reautenticación con contraseña actual
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: currentPassword
        })

        if (signInError) {
            messageEl.textContent = "Contraseña actual incorrecta."
            return
        }

        // Actualizar nombre, correo y contraseña (si aplica)
        const { error: updateError } = await supabase.auth.updateUser({
            email: email,
            password: newPassword || undefined,
            data: { full_name: name }
        })

        if (updateError) {
            messageEl.textContent = `Error al actualizar: ${updateError.message}`
            return
        }

        messageEl.style.color = "#10b981"
        messageEl.textContent = "Perfil actualizado correctamente."
        document.getElementById('newPassword').value = ''
        document.getElementById('repeatPassword').value = ''
        document.getElementById('currentPassword').value = ''
    })
}
