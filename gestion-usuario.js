// gestion-usuarios.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://roogjmgxghbuiogpcswy.supabase.co'
const supabaseKey = 'sb_publishable_RTN2PXvdWOQFfUySAaTa_g_LLe-T_NU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Verificar sesión antes de hacer cualquier cosa
async function checkSessionAndLoadProfile() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
        console.error("Error obteniendo sesión:", error.message)
        return
    }

    if (!session) {
        // Redirigir a login o mostrar mensaje
        alert("No hay sesión activa. Por favor, ingresa primero.")
        window.location.href = "/login.html" // ajusta según tu login
        return
    }

    // Cargar perfil solo si hay sesión
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
        console.error("Error obteniendo usuario:", userError.message)
        return
    }

    if (user) {
        document.getElementById('userName').value = user.user_metadata?.full_name || ''
        document.getElementById('userEmail').value = user.email || ''
    }
}

// Ejecutar solo cuando el usuario haga click en "Gestión de Usuario"
const usuariosBtn = document.querySelector('.menu-btn[data-target="usuarios"]')
if (usuariosBtn) {
    usuariosBtn.addEventListener('click', checkSessionAndLoadProfile)
}

// Formulario de actualización
const editProfileForm = document.getElementById('editProfileForm')
if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const messageEl = document.getElementById('profileMessage')
        messageEl.textContent = ''
        messageEl.style.color = '#f87171'

        const name = document.getElementById('userName').value
        const email = document.getElementById('userEmail').value
        const newPassword = document.getElementById('newPassword').value
        const repeatPassword = document.getElementById('repeatPassword').value

        if (newPassword && newPassword !== repeatPassword) {
            messageEl.textContent = "Las contraseñas nuevas no coinciden."
            return
        }

        try {
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

        } catch (err) {
            console.error(err)
            messageEl.textContent = "Ocurrió un error inesperado."
        }
    })
}
