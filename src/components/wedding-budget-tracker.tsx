import { useCallback, useEffect, useState } from 'react';
import { DollarSign, Plus, Trash2, Edit, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';

type WeddingExpense = {
  id: string;
  weddingId: string;
  category: string;
  amount: number;
  description: string;
  vendor: string | null;
  date: string;
  isPaid: boolean;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type BudgetSummary = {
  budget: number;
  totalSpent: number;
  totalPaid: number;
  remaining: number;
  categoryBreakdown: Record<string, number>;
  expenseCount: number;
  paidCount: number;
};

interface WeddingBudgetTrackerProps {
  weddingId: string;
  weddingBudget: number | null;
}

const EXPENSE_CATEGORIES = [
  { value: 'venue', label: 'Venue' },
  { value: 'catering', label: 'Catering' },
  { value: 'attire', label: 'Attire' },
  { value: 'photography', label: 'Photography' },
  { value: 'videography', label: 'Videography' },
  { value: 'decor', label: 'Decorations' },
  { value: 'music', label: 'Music & DJ' },
  { value: 'flowers', label: 'Flowers' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'invitations', label: 'Invitations' },
  { value: 'rings', label: 'Rings & Jewelry' },
  { value: 'gifts', label: 'Gifts & Favors' },
  { value: 'other', label: 'Other' },
];

export function WeddingBudgetTracker({ weddingId, weddingBudget }: WeddingBudgetTrackerProps) {
  const [expenses, setExpenses] = useState<WeddingExpense[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<WeddingExpense | null>(null);

  const [formData, setFormData] = useState({
    category: 'other',
    amount: '',
    description: '',
    vendor: '',
    date: new Date().toISOString().split('T')[0],
    isPaid: false,
    paymentMethod: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [expensesData, summaryData] = await Promise.all([
        apiFetch<WeddingExpense[]>(`/api/weddings/${weddingId}?action=expense-list`),
        apiFetch<BudgetSummary>(`/api/weddings/${weddingId}?action=expense-summary`),
      ]);
      setExpenses(expensesData);
      setSummary(summaryData);
    } catch (err) {
      setError('Failed to load budget data');
      console.error('Error loading budget data:', err);
    } finally {
      setLoading(false);
    }
  }, [weddingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddExpense = async () => {
    if (!formData.category || !formData.amount || !formData.description || !formData.date) {
      return;
    }

    try {
      await apiFetch(`/api/weddings/${weddingId}?action=expense-create`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setIsAddDialogOpen(false);
      setFormData({
        category: 'other',
        amount: '',
        description: '',
        vendor: '',
        date: new Date().toISOString().split('T')[0],
        isPaid: false,
        paymentMethod: '',
        notes: '',
      });
      loadData();
    } catch (err) {
      console.error('Error adding expense:', err);
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;

    try {
      await apiFetch(`/api/weddings/${weddingId}?action=expense-update&expenseId=${editingExpense.id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });

      setIsEditDialogOpen(false);
      setEditingExpense(null);
      loadData();
    } catch (err) {
      console.error('Error updating expense:', err);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      await apiFetch(`/api/weddings/${weddingId}?action=expense-delete&expenseId=${expenseId}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  const openEditDialog = (expense: WeddingExpense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      vendor: expense.vendor || '',
      date: expense.date.split('T')[0],
      isPaid: expense.isPaid,
      paymentMethod: expense.paymentMethod || '',
      notes: expense.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      venue: 'bg-blue-500',
      catering: 'bg-orange-500',
      attire: 'bg-purple-500',
      photography: 'bg-pink-500',
      videography: 'bg-red-500',
      decor: 'bg-yellow-500',
      music: 'bg-indigo-500',
      flowers: 'bg-green-500',
      transportation: 'bg-teal-500',
      invitations: 'bg-cyan-500',
      rings: 'bg-amber-500',
      gifts: 'bg-rose-500',
      other: 'bg-gray-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading budget data...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }

  const budget = weddingBudget || summary?.budget || 0;
  const totalSpent = summary?.totalSpent || 0;
  const remaining = budget - totalSpent;
  const budgetPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const isOverBudget = remaining < 0;

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${budget.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">${totalSpent.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isOverBudget ? 'text-red-500' : 'text-green-500'}`}>
              ${remaining.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Budget Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`text-2xl font-bold ${isOverBudget ? 'text-red-500' : 'text-blue-500'}`}>
                {budgetPercent.toFixed(1)}%
              </div>
              {isOverBudget && <AlertCircle className="h-5 w-5 text-red-500" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={budgetPercent} className="h-3" />
          <div className="mt-2 text-sm text-muted-foreground">
            {isOverBudget ? (
              <span className="text-red-500 font-medium">Over budget by ${Math.abs(remaining).toLocaleString()}</span>
            ) : (
              <span>${remaining.toLocaleString()} remaining (${budgetPercent.toFixed(1)}% used)</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {summary && Object.keys(summary.categoryBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(summary.categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => {
                  const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
                  const percentOfTotal = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;

                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{categoryLabel}</span>
                          <span className="text-sm text-muted-foreground">${amount.toLocaleString()}</span>
                        </div>
                        <Progress value={percentOfTotal} className="h-2" />
                      </div>
                      <div className="text-xs text-muted-foreground w-16 text-right">
                        {percentOfTotal.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Expenses ({summary?.expenseCount || 0})
            </CardTitle>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Wedding Expense</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="What was this expense for?"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vendor">Vendor (optional)</Label>
                    <Input
                      id="vendor"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      placeholder="Company or person name"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPaid"
                      checked={formData.isPaid}
                      onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isPaid">Paid</Label>
                  </div>

                  {formData.isPaid && (
                    <div>
                      <Label htmlFor="paymentMethod">Payment Method</Label>
                      <Input
                        id="paymentMethod"
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        placeholder="e.g., Credit Card, Cash, Transfer"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional details..."
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleAddExpense} className="w-full">
                    Add Expense
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No expenses tracked yet. Start by adding your first expense!</p>
              </div>
            ) : (
              expenses.map((expense) => {
                const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category;

                return (
                  <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <Badge className={`${getCategoryColor(expense.category)} text-white`}>
                        {categoryLabel}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-medium">{expense.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {expense.vendor && <span>{expense.vendor} • </span>}
                          {format(new Date(expense.date), 'MMM d, yyyy')}
                          {expense.isPaid && <span> • Paid</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold">${expense.amount.toLocaleString()}</div>
                        {!expense.isPaid && (
                          <div className="text-xs text-muted-foreground">Unpaid</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(expense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Expense Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What was this expense for?"
              />
            </div>

            <div>
              <Label htmlFor="edit-vendor">Vendor (optional)</Label>
              <Input
                id="edit-vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="Company or person name"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isPaid"
                checked={formData.isPaid}
                onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-isPaid">Paid</Label>
            </div>

            {formData.isPaid && (
              <div>
                <Label htmlFor="edit-paymentMethod">Payment Method</Label>
                <Input
                  id="edit-paymentMethod"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  placeholder="e.g., Credit Card, Cash, Transfer"
                />
              </div>
            )}

            <div>
              <Label htmlFor="edit-notes">Notes (optional)</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional details..."
                rows={3}
              />
            </div>

            <Button onClick={handleUpdateExpense} className="w-full">
              Update Expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}