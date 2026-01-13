import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://roogjmgxghbuiogpcswy.supabase.co'
const supabaseKey = 'sb_publishable_RTN2PXvdWOQFfUySAaTa_g_LLe-T_NU'
const supabase = createClient(supabaseUrl, supabaseKey)

async function loadUserProfile() {
    const { data: user, error } = await supabase.auth.getUser()
    if (error) {
        console.error("Error obteniendo usuario:", error.message)
        return
    }

    if (user && user.user) {
        document.getElementById('userName').value = user.user.user_metadata?.full_name || ''
        document.getElementById('userEmail').value = user.user.email || ''
    }
}

// Ejecutar cuando se entra al módulo "usuarios"
document.querySelector('.menu-btn[data-target="usuarios"]').addEventListener('click', loadUserProfile)

// Manejar la actualización del perfil
document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = document.getElementById('userName').value
    const email = document.getElementById('userEmail').value
    const newPassword = document.getElementById('newPassword').value
    const repeatPassword = document.getElementById('repeatPassword').value
    const currentPassword = document.getElementById('currentPassword').value
    const messageEl = document.getElementById('profileMessage')
    messageEl.textContent = ''

    if (newPassword && newPassword !== repeatPassword) {
        messageEl.textContent = "Las contraseñas nuevas no coinciden."
        return
    }

    // 1. Reautenticar con la contraseña actual
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword
    })

    if (signInError) {
        messageEl.textContent = "Contraseña actual incorrecta."
        return
    }

    // 2. Actualizar nombre y correo
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
    // Limpiar campos de contraseña
    document.getElementById('newPassword').value = ''
    document.getElementById('repeatPassword').value = ''
    document.getElementById('currentPassword').value = ''
})
