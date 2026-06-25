import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, setAuthToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RegisterPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await apiFetch<{ token: string }>('/api/auth/register', {
        method: 'POST', body: JSON.stringify({ email, password, name }),
      });
      setAuthToken(r.token);
      nav('/dashboard');
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="grid min-h-full md:grid-cols-2">
      <aside className="hero-mesh hidden flex-col justify-between p-10 md:flex">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 via-primary to-fuchsia-500 text-white text-xs shadow-sm">DP</span>
          Daily Planner
        </Link>
        <div>
          <Sparkles className="mb-3 size-6 text-primary" />
          <p className="text-2xl font-semibold leading-tight">
            Plan with clarity.<br />Deliver with confidence.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start solo or bring your team. Manager-ready from day one.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground">It takes 30 seconds.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password (min 8)</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} minLength={8} required
                  autoComplete="new-password" className="pr-10"
                  value={password} onChange={e => setPassword(e.target.value)} />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
