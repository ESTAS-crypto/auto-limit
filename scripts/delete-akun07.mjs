import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getServerSupabase } from '../src/lib/supabase.ts';

const sb = getServerSupabase();
if (sb) {
  const { error } = await sb.from('accounts').delete().eq('email', 'akun-07@gmail.com');
  console.log('Delete result error:', error);
}
console.log('akun-07 deleted successfully');
process.exit(0);
