import sqlite3
import os
import json
import sys

def switch_account(target_email):
    auth_dir = os.path.expanduser(r'~/.ccs/cliproxy/auth')
    auth_file = None
    for f in os.listdir(auth_dir):
        if target_email.lower() in f.lower() and f.endswith('.json'):
            auth_file = os.path.join(auth_dir, f)
            break
            
    if not auth_file or not os.path.exists(auth_file):
        return False, f"Auth file for {target_email} not found in {auth_dir}"
        
    with open(auth_file, 'r', encoding='utf-8') as fl:
        auth_data = json.load(fl)
        
    access_token = auth_data.get('access_token')
    if not access_token:
        return False, "Access token missing in auth file"
        
    db_path = os.path.expandvars(r'%APPDATA%\Antigravity IDE\User\globalStorage\state.vscdb')
    if not os.path.exists(db_path):
        return False, f"state.vscdb not found at {db_path}"
        
    try:
        conn = sqlite3.connect(db_path, timeout=5.0)
        c = conn.cursor()
        c.execute('SELECT value FROM ItemTable WHERE key = ?', ('antigravityAuthStatus',))
        row = c.fetchone()
        
        status_data = {}
        if row and row[0]:
            try:
                status_data = json.loads(row[0])
            except Exception:
                pass
                
        status_data['email'] = target_email
        status_data['apiKey'] = access_token
        status_data['name'] = target_email.split('@')[0]
        
        c.execute(
            'INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)',
            ('antigravityAuthStatus', json.dumps(status_data))
        )
        conn.commit()
        conn.close()
        return True, f"Successfully switched Antigravity IDE configuration to {target_email}"
    except Exception as e:
        return False, f"Database error: {str(e)}"

if __name__ == '__main__':
    if len(sys.argv) > 1:
        ok, msg = switch_account(sys.argv[1])
        print(msg)
        sys.exit(0 if ok else 1)

