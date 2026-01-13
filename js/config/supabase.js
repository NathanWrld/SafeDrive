import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://roogjmgxghbuiogpcswy.supabase.co';
const supabaseKey = 'sb_publishable_RTN2PXvdWOQFfUySAaTa_g_LLe-T_NU';

export const supabase = createClient(supabaseUrl, supabaseKey);