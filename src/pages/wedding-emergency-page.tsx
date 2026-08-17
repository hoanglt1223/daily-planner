import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Phone, Mail, Users, AlertTriangle, CheckCircle2, Plus, Trash2, Clock, Heart, Flame, Sparkles, X, DollarSign } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { WeddingBudgetTracker } from '@/components/wedding-budget-tracker';

type Wedding = {
  id: string;
  partnerName: string;
  weddingDate: string;
  venueName: string;
  venueAddress: string;
  guestCount: number;
  budget: number;
  status: string;
  stressLevel: number;
  notes: string;
  daysUntilWedding: number;
  contacts?: Contact[];
  emergencyPlans?: EmergencyPlan[];
  checklist?: ChecklistItem[];
};

type Contact = {
  id: string;
  role: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
  backupContact: string;
  hasBackup: boolean;
  confirmed: boolean;
};

type EmergencyPlan = {
  id: string;
  scenario: string;
  title: string;
  steps: Array<{ step: number; action: string; responsible: string; timeline: string }>;
  contacts: Array<{ name: string; role: string; phone: string }>;
  supplies: Array<{ item: string; quantity: string; location: string }>;
  priority: number;
};

type ChecklistItem = {
  id: string;
  category: string;
  task: string;
  completed: boolean;
  priority: number;
  assignee: string;
  notes: string;
};

export function WeddingEmergencyPage() {
  const { id } = useParams();
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [emergencyPlans, setEmergencyPlans] = useState<EmergencyPlan[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('contacts');

  const loadWeddingData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<Wedding>(`/api/weddings/${id}?action=get`);
      setWedding(data);
      setContacts(data.contacts || []);
      setEmergencyPlans(data.emergencyPlans || []);
      setChecklist(data.checklist || []);
    } catch (err) {
      setError('Failed to load wedding data');
      console.error('Error loading wedding:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadWeddingData();
  }, [loadWeddingData]);

  const handleChecklistToggle = async (item: ChecklistItem) => {
    try {
      const updated = await apiFetch<ChecklistItem>(`/api/weddings/${id}?action=checklist-update&checklistId=${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !item.completed }),
      });

      setChecklist(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (err) {
      console.error('Error updating checklist:', err);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Delete this contact?')) return;

    try {
      await apiFetch(`/api/weddings/${id}?action=contact-delete&contactId=${contactId}`, {
        method: 'DELETE',
      });
      setContacts(prev => prev.filter(c => c.id !== contactId));
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading wedding emergency data...</p>
        </div>
      </div>
    );
  }

  if (error || !wedding) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Wedding</h3>
            <p className="text-muted-foreground mb-4">{error || 'Wedding not found'}</p>
            <Button asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stressColors = {
    1: 'bg-green-500',
    2: 'bg-yellow-500',
    3: 'bg-orange-500',
    4: 'bg-red-500',
    5: 'bg-red-700',
  };

  const completedChecklist = checklist.filter(item => item.completed).length;
  const checklistProgress = checklist.length > 0 ? Math.round((completedChecklist / checklist.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Wedding Emergency Assistant</h1>
            <Badge variant="outline" className="text-sm">
              {wedding.daysUntilWedding > 0 ? `${wedding.daysUntilWedding} days to go` : 'Today!'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {wedding.partnerName} & {wedding.venueName} • {format(new Date(wedding.weddingDate), 'MMMM d, yyyy')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/weddings">Back to Weddings</Link>
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              Countdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wedding.daysUntilWedding}</div>
            <p className="text-xs text-muted-foreground">days until wedding</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Stress Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={cn('h-3 rounded-full transition-all', stressColors[wedding.stressLevel as keyof typeof stressColors])} style={{ width: '60px' }} />
              <span className="text-2xl font-bold">{wedding.stressLevel}/5</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">current stress level</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.length}</div>
            <p className="text-xs text-muted-foreground">vendor contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{checklistProgress}%</div>
            <p className="text-xs text-muted-foreground">{completedChecklist} of {checklist.length} completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'contacts' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('contacts')}
        >
          Contacts
        </Button>
        <Button
          variant={activeTab === 'emergency' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('emergency')}
        >
          Emergency Plans
        </Button>
        <Button
          variant={activeTab === 'checklist' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('checklist')}
        >
          Checklist
        </Button>
        <Button
          variant={activeTab === 'budget' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('budget')}
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Budget
        </Button>
        <Button
          variant={activeTab === 'timeline' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Emergency Contacts</h2>
            <AddContactDialog weddingId={id!} onContactAdded={loadWeddingData} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {contacts.map(contact => (
              <Card key={contact.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{contact.name}</h3>
                      <Badge variant="outline" className="text-xs capitalize">{contact.role}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`tel:${contact.phone}`}>
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`mailto:${contact.email}`}>
                          <Mail className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteContact(contact.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {contact.company && (
                    <p className="text-sm text-muted-foreground mb-2">{contact.company}</p>
                  )}

                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {contact.phone}
                    </p>
                    {contact.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {contact.email}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1">
                      {contact.confirmed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {contact.confirmed ? 'Confirmed' : 'Pending confirmation'}
                      </span>
                    </div>
                    {contact.hasBackup && (
                      <Badge variant="outline" className="text-xs">Has backup</Badge>
                    )}
                  </div>

                  {contact.backupContact && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <p className="font-medium">Backup contact:</p>
                      <p className="text-muted-foreground">{contact.backupContact}</p>
                    </div>
                  )}

                  {contact.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{contact.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {contacts.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No emergency contacts yet</p>
                <AddContactDialog weddingId={id!} onContactAdded={loadWeddingData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'emergency' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Emergency Plans</h2>
            <AddEmergencyPlanDialog weddingId={id!} onPlanAdded={loadWeddingData} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {emergencyPlans.map(plan => (
              <Card key={plan.id} className={plan.priority >= 4 ? 'border-red-500' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{plan.title}</CardTitle>
                    <Badge variant={plan.priority >= 4 ? 'destructive' : 'outline'}>
                      Priority {plan.priority}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="w-fit capitalize">{plan.scenario.replace(/_/g, ' ')}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Action Steps:</h4>
                      <ol className="space-y-2 text-sm">
                        {plan.steps.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="font-medium text-muted-foreground">{step.step}.</span>
                            <div className="flex-1">
                              <p>{step.action}</p>
                              <p className="text-xs text-muted-foreground">
                                Responsible: {step.responsible} • {step.timeline}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {plan.contacts && plan.contacts.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Key Contacts:</h4>
                        <div className="space-y-1 text-sm">
                          {plan.contacts.map((contact, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <p className="font-medium">{contact.name}</p>
                                <p className="text-xs text-muted-foreground">{contact.role}</p>
                              </div>
                              <a href={`tel:${contact.phone}`} className="text-xs text-primary">
                                {contact.phone}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {plan.supplies && plan.supplies.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Required Supplies:</h4>
                        <div className="space-y-1 text-sm">
                          {plan.supplies.map((supply, i) => (
                            <div key={i} className="flex justify-between p-2 bg-muted rounded">
                              <span>{supply.item}</span>
                              <span className="text-muted-foreground">
                                {supply.quantity} • {supply.location}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {emergencyPlans.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No emergency plans yet</p>
                <AddEmergencyPlanDialog weddingId={id!} onPlanAdded={loadWeddingData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Last-Minute Checklist</h2>
            <AddChecklistItemDialog weddingId={id!} onItemAdded={loadWeddingData} />
          </div>

          <div className="space-y-2">
            {['1_week', '1_day', 'morning_of', 'day_of', 'emergency'].map(category => {
              const categoryItems = checklist.filter(item => item.category === category);
              if (categoryItems.length === 0) return null;

              return (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="text-base capitalize">{category.replace(/_/g, ' ')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {categoryItems.map(item => (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <input
                            type="checkbox"
                            id={item.id}
                            checked={item.completed}
                            onChange={() => handleChecklistToggle(item)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={item.id}
                              className={cn(
                                "text-sm font-medium cursor-pointer",
                                item.completed && "line-through text-muted-foreground"
                              )}
                            >
                              {item.task}
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">Priority {item.priority}</Badge>
                              {item.assignee && (
                                <span className="text-xs text-muted-foreground">{item.assignee}</span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {checklist.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No checklist items yet</p>
                <AddChecklistItemDialog weddingId={id!} onItemAdded={loadWeddingData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="space-y-4">
          <WeddingBudgetTracker weddingId={id!} weddingBudget={wedding?.budget || null} />
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Wedding Day Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Timeline feature coming soon</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This will help you plan your wedding day with hour-by-hour breakdown
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Add Contact Dialog Component
function AddContactDialog({ weddingId, onContactAdded }: { weddingId: string; onContactAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: 'other',
    name: '',
    company: '',
    phone: '',
    email: '',
    notes: '',
    backupContact: '',
    hasBackup: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiFetch(`/api/weddings/${weddingId}?action=contact-create`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setOpen(false);
      setFormData({
        role: 'other',
        name: '',
        company: '',
        phone: '',
        email: '',
        notes: '',
        backupContact: '',
        hasBackup: false,
      });
      onContactAdded();
    } catch (err) {
      console.error('Error creating contact:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Emergency Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venue">Venue</SelectItem>
                <SelectItem value="caterer">Caterer</SelectItem>
                <SelectItem value="photographer">Photographer</SelectItem>
                <SelectItem value="florist">Florist</SelectItem>
                <SelectItem value="dj_band">DJ/Band</SelectItem>
                <SelectItem value="officiant">Officiant</SelectItem>
                <SelectItem value="coordinator">Coordinator</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="backupContact">Backup Contact</Label>
            <Input
              id="backupContact"
              value={formData.backupContact}
              onChange={(e) => setFormData(prev => ({ ...prev, backupContact: e.target.value }))}
              placeholder="Alternative contact info"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="hasBackup"
              checked={formData.hasBackup}
              onChange={(e) => setFormData(prev => ({ ...prev, hasBackup: e.target.checked }))}
              className="mt-1"
            />
            <Label htmlFor="hasBackup">Has backup contact</Label>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
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
              {loading ? 'Adding...' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Add Emergency Plan Dialog Component
function AddEmergencyPlanDialog({ weddingId, onPlanAdded }: { weddingId: string; onPlanAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    scenario: 'weather',
    title: '',
    steps: [{ step: 1, action: '', responsible: '', timeline: '' }],
    priority: 3,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiFetch(`/api/weddings/${weddingId}?action=emergency-create`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setOpen(false);
      onPlanAdded();
    } catch (err) {
      console.error('Error creating emergency plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { step: prev.steps.length + 1, action: '', responsible: '', timeline: '' }]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Emergency Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Emergency Plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Label htmlFor="scenario">Scenario</Label>
            <Select value={formData.scenario} onValueChange={(value) => setFormData(prev => ({ ...prev, scenario: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weather">Weather Issues</SelectItem>
                <SelectItem value="vendor_no_show">Vendor No-Show</SelectItem>
                <SelectItem value="delay">Delay/Time Issue</SelectItem>
                <SelectItem value="injury">Injury/Medical</SelectItem>
                <SelectItem value="tech_failure">Tech Failure</SelectItem>
                <SelectItem value="attire_issue">Attire Issue</SelectItem>
                <SelectItem value="guest_issue">Guest Issue</SelectItem>
                <SelectItem value="venue_problem">Venue Problem</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Rain plan for outdoor ceremony"
              required
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority Level (1-5)</Label>
            <Input
              id="priority"
              type="number"
              min="1"
              max="5"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Action Steps</Label>
              <Button type="button" size="sm" variant="outline" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>
            <div className="space-y-2">
              {formData.steps.map((step, index) => (
                <div key={index} className="grid gap-2 p-3 border rounded">
                  <span className="text-sm font-medium">Step {step.step}</span>
                  <Input
                    placeholder="Action to take"
                    value={step.action}
                    onChange={(e) => {
                      const newSteps = [...formData.steps];
                      newSteps[index].action = e.target.value;
                      setFormData(prev => ({ ...prev, steps: newSteps }));
                    }}
                    required
                  />
                  <Input
                    placeholder="Who is responsible"
                    value={step.responsible}
                    onChange={(e) => {
                      const newSteps = [...formData.steps];
                      newSteps[index].responsible = e.target.value;
                      setFormData(prev => ({ ...prev, steps: newSteps }));
                    }}
                  />
                  <Input
                    placeholder="Timeline (e.g., 'Immediately', 'Within 1 hour')"
                    value={step.timeline}
                    onChange={(e) => {
                      const newSteps = [...formData.steps];
                      newSteps[index].timeline = e.target.value;
                      setFormData(prev => ({ ...prev, steps: newSteps }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Plan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Add Checklist Item Dialog Component
function AddChecklistItemDialog({ weddingId, onItemAdded }: { weddingId: string; onItemAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: '1_day',
    task: '',
    priority: 3,
    assignee: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiFetch(`/api/weddings/${weddingId}?action=checklist-create`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setOpen(false);
      onItemAdded();
    } catch (err) {
      console.error('Error creating checklist item:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Checklist Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1_week">1 Week Before</SelectItem>
                <SelectItem value="1_day">1 Day Before</SelectItem>
                <SelectItem value="morning_of">Morning Of</SelectItem>
                <SelectItem value="day_of">Day Of</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="task">Task</Label>
            <Textarea
              id="task"
              value={formData.task}
              onChange={(e) => setFormData(prev => ({ ...prev, task: e.target.value }))}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority Level (1-5)</Label>
            <Input
              id="priority"
              type="number"
              min="1"
              max="5"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
            />
          </div>

          <div>
            <Label htmlFor="assignee">Assignee (optional)</Label>
            <Input
              id="assignee"
              value={formData.assignee}
              onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
              placeholder="Who is responsible?"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional details or context"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}