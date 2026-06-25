import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, setAuthToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function RegisterPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  function validateEmail(value: string) {
    if (value && !isValidEmail(value)) {
      setEmailError('Enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  }

  function validatePassword(value: string) {
    if (value && value.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return false;
    }
    setPasswordError('');
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const emailOk = validateEmail(email);
    const passwordOk = validatePassword(password);
    if (!emailOk || !passwordOk) return;

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

      {/* Stable centered column: min-h-full keeps height, flex+items-center never shifts */}
      <main className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="space-y-6">
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
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailError) validateEmail(e.target.value); }}
                  onBlur={e => validateEmail(e.target.value)}
                  aria-describedby={emailError ? 'email-error' : undefined}
                />
                {/* Reserve height so layout never shifts when error appears */}
                <p id="email-error" className="min-h-[1rem] text-xs text-destructive" role="alert" aria-live="polite">
                  {emailError}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password (min 8)</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (passwordError) validatePassword(e.target.value); }}
                    onBlur={e => validatePassword(e.target.value)}
                    aria-describedby={passwordError ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p id="password-error" className="min-h-[1rem] text-xs text-destructive" role="alert" aria-live="polite">
                  {passwordError}
                </p>
              </div>
              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating…' : 'Create account'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">No credit card required.</p>
              </div>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              Have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
