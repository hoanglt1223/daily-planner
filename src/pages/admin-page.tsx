import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type Role = 'user' | 'manager' | 'admin';
type AdminUser = {
  id: string; email: string; name: string;
  role: Role;
  privacy: 'details_to_managers' | 'busy_only_to_managers' | 'private';
};
type Mapping = { managerId: string; userId: string };

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [pickedManager, setPickedManager] = useState('');
  const [pickedUser, setPickedUser] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ managerId: string; userId: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      apiFetch<AdminUser[]>('/api/admin/users'),
      apiFetch<Mapping[]>('/api/admin/list-mappings'),
    ]).then(([u, m]) => { setUsers(u); setMappings(m); })
      .catch(e => toast.error((e as Error).message));
  }, []);
  useEffect(load, [load]);

  async function setRole(userId: string, role: Role) {
    const prev = users?.find(u => u.id === userId)?.role;
    setUsers(us => us?.map(u => u.id === userId ? { ...u, role } : u) ?? null);
    try {
      await apiFetch('/api/admin/set-role', { method: 'POST', body: JSON.stringify({ userId, role }) });
      toast.success('Role updated');
    } catch (e) {
      toast.error((e as Error).message);
      if (prev) setUsers(us => us?.map(u => u.id === userId ? { ...u, role: prev } : u) ?? null);
    }
  }
  async function assign() {
    if (!pickedManager || !pickedUser || pickedManager === pickedUser || assigning) return;
    setAssigning(true);
    try {
      await apiFetch('/api/admin/assign-manager', {
        method: 'POST', body: JSON.stringify({ managerId: pickedManager, userId: pickedUser }),
      });
      toast.success('Mapping added');
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setAssigning(false); }
  }
  async function unassign(managerId: string, userId: string) {
    const key = `${managerId}-${userId}`;
    if (removing === key) return;
    setRemoving(key);
    setConfirmRemove(null);
    try {
      await apiFetch('/api/admin/unassign-manager', {
        method: 'POST', body: JSON.stringify({ managerId, userId }),
      });
      setMappings(ms => ms.filter(m => !(m.managerId === managerId && m.userId === userId)));
      toast.success('Mapping removed');
    } catch (e) { toast.error((e as Error).message); }
    finally { setRemoving(null); }
  }

  const byId = (id: string) => users?.find(u => u.id === id);
  const managers = users?.filter(u => u.role === 'manager' || u.role === 'admin') ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>{users ? `${users.length} accounts` : 'Loading…'}</CardDescription>
        </CardHeader>
        <CardContent>
          {!users ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-36">Role</TableHead>
                  <TableHead>Privacy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={v => setRole(u.id, v as Role)}>
                        <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">user</SelectItem>
                          <SelectItem value="manager">manager</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{u.privacy}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manager ↔ User mapping</CardTitle>
          <CardDescription>Managers can view free/busy of their mapped users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Manager</Label>
              <Select value={pickedManager} onValueChange={setPickedManager}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select manager…" /></SelectTrigger>
                <SelectContent>
                  {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>User</Label>
              <Select value={pickedUser} onValueChange={setPickedUser}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select user…" /></SelectTrigger>
                <SelectContent>
                  {(users ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={assign} disabled={!pickedManager || !pickedUser || pickedManager === pickedUser || assigning}>
              {assigning ? 'Assigning…' : 'Assign'}
            </Button>
          </div>

          <ul className="space-y-1 text-sm">
            {mappings.length === 0 && <li className="text-xs text-muted-foreground">No mappings.</li>}
            {mappings.map(m => {
              const key = `${m.managerId}-${m.userId}`;
              const isConfirming = confirmRemove?.managerId === m.managerId && confirmRemove?.userId === m.userId;
              const isBusy = removing === key;
              return (
                <li key={key}
                  className="flex items-center justify-between rounded-md ring-hairline px-3 py-1.5">
                  <span>
                    <b>{byId(m.managerId)?.name ?? m.managerId}</b>
                    <span className="text-muted-foreground"> manages </span>
                    <b>{byId(m.userId)?.name ?? m.userId}</b>
                  </span>
                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" disabled={isBusy}
                        onClick={() => unassign(m.managerId, m.userId)}>
                        {isBusy ? '…' : 'Confirm'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                        onClick={() => setConfirmRemove(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" disabled={isBusy}
                      onClick={() => setConfirmRemove({ managerId: m.managerId, userId: m.userId })}>
                      Remove
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
