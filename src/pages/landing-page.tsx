import { Link } from 'react-router-dom';
import { CalendarRange, Clock, Share2, Users, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: CalendarRange, title: 'Time-blocked kanban', tone: 'from-violet-500/15 to-violet-500/0',
    body: 'Drag tasks onto a day or week grid. Click an empty slot — or drag across cells — to schedule in seconds.' },
  { icon: Clock, title: 'Capacity at a glance', tone: 'from-emerald-500/15 to-emerald-500/0',
    body: 'See booked vs. free hours instantly. Know whether the new urgent task actually fits — before saying yes.' },
  { icon: Share2, title: 'Share + book slots', tone: 'from-amber-500/15 to-amber-500/0',
    body: 'One link gives a read-only week view and a Calendly-style booking page. Three privacy modes per user.' },
  { icon: Users, title: 'Cross-team free/busy', tone: 'from-sky-500/15 to-sky-500/0',
    body: 'Managers see free/busy of mapped users. Owner picks: full details or busy-only — like Google Calendar.' },
];

export function LandingPage() {
  return (
    <div className="hero-mesh min-h-full">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 via-primary to-fuchsia-500 text-white text-xs shadow-sm">
              DP
            </span>
            Daily Planner
          </span>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/register">Get started <ArrowRight className="size-3.5" /></Link></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3" /> Kanban × Calendar × Timesheet
        </span>
        <h1 className="mt-6 bg-gradient-to-br from-foreground via-primary to-fuchsia-600 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent sm:text-7xl">
          Plan with clarity.<br />Deliver with confidence.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          A time-blocked planner that combines kanban, calendar, and timesheet — built so individuals and
          their managers can see workload, capacity, and trade-offs at a glance.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Button asChild size="lg" className="shadow-lg shadow-primary/30">
            <Link to="/register">Start free <ArrowRight className="size-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg"><Link to="/login">Sign in</Link></Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map(f => (
            <div key={f.title}
              className={`group relative overflow-hidden rounded-2xl bg-card p-6 transition-all shadow-soft hover:-translate-y-0.5 hover:shadow-soft-lg`}>
              <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${f.tone}`} />
              <f.icon className="size-7 text-primary" />
              <p className="mt-3 text-lg font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
