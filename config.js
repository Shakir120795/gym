/* Cloud database settings. Supabase project "gym" (online-only database).
   The anon key is public by design: it ships inside this file to every
   visitor. Row Level Security makes sure only signed-in users can read
   or write. NEVER put the service_role (secret) key here. */
window.GYM_CLOUD = {
  url: 'https://usalkhzjtnkvqdusrauf.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzYWxraHpqdG5rdnFkdXNyYXVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNDQ4MTksImV4cCI6MjEwNzkyMDgxOX0.7lAulFbHX-fC54TcEu-lKsRiv7X4MwG8t-2Pj6u6wPY',
  /* Super admin (shakir) ka WhatsApp number — demo lock screen par
     "activate karo" button ke liye. 10 digit number dalo; khali rakha
     to button nahi dikhega. */
  support: '8077372462'
};
