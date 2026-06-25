import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ForgotPasswordPage() {
  return (
    <div className="grid min-h-svh md:grid-cols-2">
      {/* Left marketing panel */}
      <aside className="hero-mesh relative hidden flex-col justify-between p-10 md:flex">
        <div className="absolute inset-0 bg-slate-900/55 rounded-[inherit]" aria-hidden="true" />
        <Link to="/" className="relative z-10 flex items-center gap-2 text-sm font-semibold text-white">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-400 via-violet-500 to-fuchsia-500 text-white text-xs shadow-sm">
            DP
          </span>
          Daily Planner
        </Link>
        <div className="relative z-10">
          <Sparkles className="mb-3 size-6 text-violet-300" />
          <p className="text-2xl font-semibold leading-tight text-white">
            Plan with clarity.<br />Deliver with confidence.
          </p>
          <p className="mt-2 text-sm text-slate-200">
            See workload and capacity instantly — for you and your team.
          </p>
        </div>
      </aside>

      {/* Right content column */}
      <main className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Reset password</CardTitle>
              <CardDescription>Password recovery options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Automated password reset by email is not available yet.
              </p>
              <p>To regain access, you have two options:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  If you are still signed in on another device, go to{' '}
                  <span className="font-medium text-foreground">Settings → Change password</span>{' '}
                  to set a new one.
                </li>
                <li>
                  Contact your workspace admin to reset your account password directly.
                </li>
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <Link to="/login">
                  <ArrowLeft className="size-4" />
                  Back to sign in
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
