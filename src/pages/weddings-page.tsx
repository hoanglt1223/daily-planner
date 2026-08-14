import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, Calendar, Users, Settings, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type Wedding = {
  id: string;
  partnerName: string;
  weddingDate: string;
  venueName: string;
  status: string;
  stressLevel: number;
  daysUntilWedding: number;
  counts: {
    contacts: number;
    emergencyPlans: number;
    checklistTotal: number;
    checklistCompleted: number;
  };
};

export function WeddingsPage() {
  const navigate = useNavigate();
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWeddings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<Wedding[]>('/api/weddings?action=list');
      setWeddings(data);
    } catch (err) {
      setError('Failed to load weddings');
      console.error('Error loading weddings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeddings();
  }, [loadWeddings]);

  const handleDeleteWedding = async (id: string) => {
    if (!confirm('Are you sure you want to delete this wedding? This action cannot be undone.')) {
      return;
    }

    try {
      await apiFetch(`/api/weddings/${id}?action=delete`, {
        method: 'DELETE',
      });
      setWeddings(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Error deleting wedding:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-500';
      case 'finalizing': return 'bg-yellow-500';
      case 'day_of': return 'bg-purple-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStressColor = (level: number) => {
    switch (level) {
      case 1: return 'text-green-500';
      case 2: return 'text-yellow-500';
      case 3: return 'text-orange-500';
      case 4: return 'text-red-500';
      case 5: return 'text-red-700';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wedding Emergency Assistant</h1>
          <p className="text-muted-foreground">Manage your wedding planning with emergency contacts, contingency plans, and checklists.</p>
        </div>
        <AddWeddingDialog onWeddingAdded={loadWeddings} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-between py-4 px-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={loadWeddings}>Retry</Button>
          </CardContent>
        </Card>
      ) : weddings.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/25 bg-muted/20">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">No weddings yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Create your first wedding profile to start planning with emergency contacts and contingency plans.
              </p>
            </div>
            <AddWeddingDialog onWeddingAdded={loadWeddings} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {weddings.map(wedding => (
            <Card key={wedding.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{wedding.partnerName}</h3>
                    <p className="text-sm text-muted-foreground">{wedding.venueName}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {wedding.status.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(wedding.weddingDate), 'MMMM d, yyyy')}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className={cn('font-medium', getStressColor(wedding.stressLevel))}>
                      Stress level: {wedding.stressLevel}/5
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <div className={cn('h-2 rounded-full', getStatusColor(wedding.status))} style={{ width: '8px' }} />
                    <span className="text-muted-foreground">
                      {wedding.daysUntilWedding > 0
                        ? `${wedding.daysUntilWedding} days to go`
                        : wedding.daysUntilWedding === 0
                          ? 'Today!'
                          : 'Past date'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-semibold">{wedding.counts.contacts}</div>
                    <div className="text-xs text-muted-foreground">Contacts</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-semibold">{wedding.counts.emergencyPlans}</div>
                    <div className="text-xs text-muted-foreground">Emergency Plans</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-semibold">{wedding.counts.checklistCompleted}/{wedding.counts.checklistTotal}</div>
                    <div className="text-xs text-muted-foreground">Checklist</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-semibold">
                      {wedding.counts.checklistTotal > 0
                        ? Math.round((wedding.counts.checklistCompleted / wedding.counts.checklistTotal) * 100)
                        : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Progress</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link to={`/weddings/${wedding.id}`}>
                      <Settings className="h-4 w-4 mr-1" />
                      Manage
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleDeleteWedding(wedding.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Add Wedding Dialog Component
function AddWeddingDialog({ onWeddingAdded }: { onWeddingAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    partnerName: '',
    weddingDate: '',
    venueName: '',
    venueAddress: '',
    guestCount: '',
    budget: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        guestCount: formData.guestCount ? parseInt(formData.guestCount) : null,
        budget: formData.budget ? parseInt(formData.budget) : null,
      };

      await apiFetch('/api/weddings?action=create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setOpen(false);
      setFormData({
        partnerName: '',
        weddingDate: '',
        venueName: '',
        venueAddress: '',
        guestCount: '',
        budget: '',
        notes: '',
      });
      onWeddingAdded();
    } catch (err) {
      console.error('Error creating wedding:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Wedding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Wedding Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="partnerName">Partner Name</Label>
            <Input
              id="partnerName"
              value={formData.partnerName}
              onChange={(e) => setFormData(prev => ({ ...prev, partnerName: e.target.value }))}
              placeholder="Your partner's name"
              required
            />
          </div>

          <div>
            <Label htmlFor="weddingDate">Wedding Date</Label>
            <Input
              id="weddingDate"
              type="date"
              value={formData.weddingDate}
              onChange={(e) => setFormData(prev => ({ ...prev, weddingDate: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="venueName">Venue Name</Label>
            <Input
              id="venueName"
              value={formData.venueName}
              onChange={(e) => setFormData(prev => ({ ...prev, venueName: e.target.value }))}
              placeholder="Wedding venue"
              required
            />
          </div>

          <div>
            <Label htmlFor="venueAddress">Venue Address (optional)</Label>
            <Input
              id="venueAddress"
              value={formData.venueAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, venueAddress: e.target.value }))}
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="guestCount">Guest Count (optional)</Label>
              <Input
                id="guestCount"
                type="number"
                value={formData.guestCount}
                onChange={(e) => setFormData(prev => ({ ...prev, guestCount: e.target.value }))}
                placeholder="Number of guests"
              />
            </div>

            <div>
              <Label htmlFor="budget">Budget (optional)</Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="Total budget"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes or important details"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Wedding'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}