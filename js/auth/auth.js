import { supabase } from '../config/supabase.js';

export async function checkUserSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
        window.location.href = 'index.html';
        return;
    }

    const user = session.user;

    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) userDisplay.textContent = `Bienvenido, ${user.email}`;

    const userEmail = document.getElementById('userEmail');
    if (userEmail) userEmail.value = user.email;

    const userName = document.getElementById('userName');
    if (userName && user.user_metadata?.full_name) {
        userName.value = user.user_metadata.full_name;
    }
}

export function listenAuthChanges() {
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'index.html';
        }
    });
}

export async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}
