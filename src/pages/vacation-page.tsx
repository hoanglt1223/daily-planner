import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, Trash2, Edit2, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

type VacationStatus = {
  vacationDaysAvailable: number;
  vacationDaysUsed: number;
  vacationDaysAccrualRate: number;
  vacationAccrualLastReset: string | null;
  vacationBlocks: Array<{
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    note: string | null;
  }>;
};

export function VacationPage() {
  const [data, setData] = useState<VacationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    startAt: '',
    endAt: '',
    note: '',
  });
  const [balanceData, setBalanceData] = useState({
    vacationDaysAvailable: 0,
    vacationDaysUsed: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<VacationStatus>('/api/vacation?action=status');
      setData(response);
      setBalanceData({
        vacationDaysAvailable: response.vacationDaysAvailable,
        vacationDaysUsed: response.vacationDaysUsed,
      });
    } catch (e) {
      console.error('Failed to load vacation data:', e);
      toast.error('Failed to load vacation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const startDate = new Date(formData.startAt);
      const endDate = new Date(formData.endAt);
      const totalHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      const vacationDays = Math.round(totalHours / 8 * 10) / 10;

      if (vacationDays <= 0) {
        toast.error('End date must be after start date');
        setSubmitting(false);
        return;
      }

      if (vacationDays > data!.vacationDaysAvailable) {
        toast.error(`Insufficient balance. You have ${data!.vacationDaysAvailable} days available, but this request is for ${vacationDays} days.`);
        setSubmitting(false);
        return;
      }

      await apiFetch('/api/vacation?action=request', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          startAt: formData.startAt,
          endAt: formData.endAt,
          note: formData.note || null,
        }),
      });

      toast.success('Vacation request created successfully');
      setDialogOpen(false);
      setFormData({ title: '', startAt: '', endAt: '', note: '' });
      loadData();
    } catch (e) {
      console.error('Failed to create vacation request:', e);
      toast.error('Failed to create vacation request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this vacation? Your balance will be refunded.')) {
      return;
    }

    try {
      await apiFetch(`/api/vacation?action=delete&id=${id}`, {
        method: 'DELETE',
      });
      toast.success('Vacation cancelled successfully');
      loadData();
    } catch (e) {
      console.error('Failed to cancel vacation:', e);
      toast.error('Failed to cancel vacation');
    }
  };

  const handleUpdateBalance = async () => {
    setSubmitting(true);
    try {
      await apiFetch('/api/vacation?action=balance', {
        method: 'PATCH',
        body: JSON.stringify(balanceData),
      });
      toast.success('Vacation balance updated successfully');
      setEditBalanceOpen(false);
      loadData();
    } catch (e) {
      console.error('Failed to update balance:', e);
      toast.error('Failed to update balance');
    } finally {
      setSubmitting(false);
    }
  };

  const upcomingVacations = data?.vacationBlocks
    .filter(b => new Date(b.startAt) > new Date() && b.status === 'planned')
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()) || [];

  const pastVacations = data?.vacationBlocks
    .filter(b => new Date(b.startAt) <= new Date() || b.status !== 'planned')
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()) || [];

  const calculateDays = (start: string, end: string) => {
    const totalHours = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
    return Math.round(totalHours / 8 * 10) / 10;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vacation Management</h1>
            <p className="text-muted-foreground">Plan and track your time off</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-10">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vacation Management</h1>
          <p className="text-muted-foreground">Plan and track your time off</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard">
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Balance overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data!.vacationDaysAvailable}</div>
            <p className="text-xs text-muted-foreground mt-1">Balance remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Used This Year</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data!.vacationDaysUsed}</div>
            <p className="text-xs text-muted-foreground mt-1">Days taken</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Accrual Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data!.vacationDaysAccrualRate}</div>
            <p className="text-xs text-muted-foreground mt-1">Days per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Request Vacation
        </Button>
        <Button variant="outline" onClick={() => setEditBalanceOpen(true)} className="gap-2">
          <Edit2 className="size-4" />
          Update Balance
        </Button>
      </div>

      {/* Upcoming vacations */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Time Off</CardTitle>
          <CardDescription>Your scheduled vacation days</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingVacations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="size-8 mx-auto mb-2 opacity-50" />
              <p>No upcoming vacation scheduled</p>
              <Button
                variant="link"
                onClick={() => setDialogOpen(true)}
                className="mt-2"
              >
                Plan your first vacation
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingVacations.map((vacation) => (
                <div
                  key={vacation.id}
                  className="flex items-start justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{vacation.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(vacation.startAt), 'MMM d, yyyy')} - {format(new Date(vacation.endAt), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {calculateDays(vacation.startAt, vacation.endAt)} days
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(vacation.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past vacations */}
      {pastVacations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Time Off</CardTitle>
            <CardDescription>Your vacation history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pastVacations.map((vacation) => (
                <div
                  key={vacation.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{vacation.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(vacation.startAt), 'MMM d, yyyy')} - {format(new Date(vacation.endAt), 'MMM d, yyyy')}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={vacation.status === 'completed' ? 'default' : 'secondary'}>
                        {vacation.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {calculateDays(vacation.startAt, vacation.endAt)} days
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New vacation request dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Vacation</DialogTitle>
            <DialogDescription>
              Plan your time off. Your balance will be deducted automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Summer Vacation, Family Time"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startAt">Start Date</Label>
                  <Input
                    id="startAt"
                    type="date"
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endAt">End Date</Label>
                  <Input
                    id="endAt"
                    type="date"
                    value={formData.endAt}
                    onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                    required
                  />
                </div>
              </div>
              {formData.startAt && formData.endAt && (
                <p className="text-sm text-muted-foreground">
                  Duration: {calculateDays(formData.startAt, formData.endAt)} days
                </p>
              )}
              <div>
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Request Vacation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update balance dialog */}
      <Dialog open={editBalanceOpen} onOpenChange={setEditBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Vacation Balance</DialogTitle>
            <DialogDescription>
              Manually adjust your vacation days balance. Use this for corrections or when starting to track vacation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="available">Available Days</Label>
              <Input
                id="available"
                type="number"
                step="0.5"
                value={balanceData.vacationDaysAvailable}
                onChange={(e) => setBalanceData({ ...balanceData, vacationDaysAvailable: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="used">Used This Year</Label>
              <Input
                id="used"
                type="number"
                step="0.5"
                value={balanceData.vacationDaysUsed}
                onChange={(e) => setBalanceData({ ...balanceData, vacationDaysUsed: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBalanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateBalance} disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Balance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
