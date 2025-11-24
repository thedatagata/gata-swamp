import { PageProps, Handlers } from "$fresh/server.ts";
import { getSession } from "../../utils/models/session.ts";

interface AdminData {
  isAdmin: boolean;
  adminEmail?: string;
}

export const handler: Handlers<AdminData> = {
  async GET(req, ctx) {
    const sessionId = (ctx.state as any).sessionId as string | undefined;
    
    if (!sessionId) {
      return new Response("", {
        status: 303,
        headers: { Location: "/auth/signin" },
      });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return new Response("", {
        status: 303,
        headers: { Location: "/auth/signin" },
      });
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const isAdmin = session.username === adminEmail;

    if (!isAdmin) {
      return new Response("Forbidden", { status: 403 });
    }

    return ctx.render({ isAdmin: true, adminEmail: session.username });
  }
};

export default function AdminUsersPage({ data }: PageProps<AdminData>) {
  return (
    <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] p-8">
      <div class="max-w-4xl mx-auto">
        <div class="bg-[#172217] border border-[#90C137]/30 rounded-2xl p-8 shadow-2xl">
          <div class="flex items-center justify-between mb-8">
            <div>
              <h1 class="text-3xl font-bold text-[#F8F6F0]">Admin Panel</h1>
              <p class="text-[#F8F6F0]/60 mt-1">Logged in as: {data.adminEmail}</p>
            </div>
            <a 
              href="/app/dashboard"
              class="px-4 py-2 bg-[#90C137]/10 border border-[#90C137]/30 text-[#90C137] rounded-lg hover:bg-[#90C137]/20 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>

          <div class="bg-[#90C137]/5 border border-[#90C137]/20 rounded-lg p-6 mb-8">
            <h2 class="text-xl font-bold text-[#F8F6F0] mb-4">Create New User</h2>
            <form id="create-user-form" class="space-y-4">
              <div>
                <label class="block text-sm text-[#F8F6F0]/80 mb-1">Email</label>
                <input 
                  type="email" 
                  name="email"
                  required 
                  placeholder="user@example.com"
                  class="w-full p-3 bg-[#172217] border border-[#90C137]/30 rounded-lg text-[#F8F6F0] focus:border-[#90C137] outline-none"
                />
              </div>
              <div>
                <label class="block text-sm text-[#F8F6F0]/80 mb-1">Temporary Password</label>
                <input 
                  type="text" 
                  name="tempPassword"
                  required 
                  placeholder="Generate a secure password"
                  class="w-full p-3 bg-[#172217] border border-[#90C137]/30 rounded-lg text-[#F8F6F0] focus:border-[#90C137] outline-none"
                />
                <p class="text-xs text-[#F8F6F0]/50 mt-1">User will need to use this to log in</p>
              </div>
              <div>
                <label class="block text-sm text-[#F8F6F0]/80 mb-1">AI Model Tier</label>
                <select 
                  name="modelTier"
                  class="w-full p-3 bg-[#172217] border border-[#90C137]/30 rounded-lg text-[#F8F6F0] focus:border-[#90C137] outline-none"
                >
                  <option value="3b">3B Model (Default)</option>
                  <option value="7b">7B Model (More Powerful)</option>
                </select>
                <p class="text-xs text-[#F8F6F0]/50 mt-1">Assign users to different models for experimentation</p>
              </div>
              <button 
                type="submit"
                class="w-full py-3 bg-[#90C137] text-[#172217] rounded-lg font-bold hover:bg-[#a0d147] transition-colors"
              >
                Create User
              </button>
            </form>
            <div id="create-message" class="mt-4 hidden"></div>
          </div>

          <div class="bg-[#90C137]/5 border border-[#90C137]/20 rounded-lg p-6">
            <h2 class="text-xl font-bold text-[#F8F6F0] mb-4">📋 Instructions</h2>
            <ol class="space-y-2 text-[#F8F6F0]/80 text-sm">
              <li>1. Enter the user's email address</li>
              <li>2. Create a temporary password (send this to them securely)</li>
              <li>3. Add their email to the LaunchDarkly <strong>demo-access-allowlist</strong> flag</li>
              <li>4. Share the site URL and credentials with them</li>
            </ol>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{__html: `
        document.getElementById('create-user-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const form = e.target;
          const formData = new FormData(form);
          const email = formData.get('email');
          const tempPassword = formData.get('tempPassword');
          const modelTier = formData.get('modelTier');
          
          const messageDiv = document.getElementById('create-message');
          messageDiv.classList.remove('hidden');
          messageDiv.className = 'mt-4 p-3 rounded';
          messageDiv.textContent = 'Creating user...';
          messageDiv.classList.add('bg-blue-900/50', 'border', 'border-blue-500/50', 'text-blue-200');
          
          try {
            const res = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, tempPassword, modelTier })
            });
            
            const data = await res.json();
            
            if (res.ok) {
              messageDiv.className = 'mt-4 p-3 rounded bg-green-900/50 border border-green-500/50 text-green-200';
              messageDiv.textContent = '✅ ' + data.message + ' - Remember to add them to LaunchDarkly!';
              form.reset();
            } else {
              messageDiv.className = 'mt-4 p-3 rounded bg-red-900/50 border border-red-500/50 text-red-200';
              messageDiv.textContent = '❌ ' + data.error;
            }
          } catch (err) {
            messageDiv.className = 'mt-4 p-3 rounded bg-red-900/50 border border-red-500/50 text-red-200';
            messageDiv.textContent = '❌ Failed to create user';
          }
        });
      `}} />
    </div>
  );
}
