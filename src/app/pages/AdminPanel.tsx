import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE, getAuthToken, useAuth } from '../context/AuthContext';

type UserRole = 'user' | 'admin';
type UserStatus = 'verified' | 'unverified' | 'suspended';

interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  twoFaMethods: string[];
  createdAt: number;
  lastLoginAt: number;
}

interface AdminUsersResponse {
  users: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const formatTimestamp = (unix?: number) => {
  if (!unix || unix <= 0) return 'Never';
  return new Date(unix * 1000).toLocaleString();
};

const statusBadgeClass = (status: UserStatus) => {
  if (status === 'verified') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'suspended') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
};

const readErrorMessage = async (response: Response, fallback: string) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null);
    if (typeof body?.error === 'string' && body.error.trim()) {
      return body.error;
    }
  }
  const bodyText = await response.text().catch(() => '');
  return bodyText.trim() || fallback;
};

export const AdminPanel = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;

  const authHeaders = useMemo(() => {
    const token = getAuthToken();
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }, []);

  const loadUsers = async (nextPage: number, nextSearch: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        search: nextSearch,
      });
      const response = await fetch(`${API_BASE}/admin/users?${params.toString()}`, { headers: authHeaders });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to load users (${response.status})`));
      }
      const payload = await response.json() as AdminUsersResponse;
      setUsers(payload.users || []);
      setPage(payload.page || nextPage);
      setTotalPages(Math.max(1, payload.totalPages || 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const refresh = () => loadUsers(page, search);

  const updateRole = async (target: AdminUser, nextRole: UserRole) => {
    if (target.id === user?.id && nextRole !== 'admin') return;

    const isPromote = nextRole === 'admin' && target.role !== 'admin';
    if (isPromote) {
      const confirmed = window.confirm(`Promote ${target.email} to admin?`);
      if (!confirmed) return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(target.id)}/role`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to update role (${response.status})`));
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const toggleSuspend = async (target: AdminUser) => {
    const nextStatus: UserStatus = target.status === 'suspended' ? 'verified' : 'suspended';
    const confirmed = window.confirm(
      nextStatus === 'suspended'
        ? `Suspend ${target.email}?`
        : `Unsuspend ${target.email}?`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(target.id)}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to update status (${response.status})`));
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const deleteUser = async (target: AdminUser) => {
    if (target.id === user?.id) return;
    const confirmed = window.confirm(`Delete ${target.email} and all their data permanently?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to delete user (${response.status})`));
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const forceLogout = async (target: AdminUser) => {
    try {
      const response = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(target.id)}/force-logout`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to force logout (${response.status})`));
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to force logout');
    }
  };

  const viewUser = async (target: AdminUser) => {
    try {
      const response = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(target.id)}`, { headers: authHeaders });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to load user details (${response.status})`));
      }
      const details = await response.json() as AdminUser;
      window.alert(
        `Email: ${details.email}\nRole: ${details.role}\nStatus: ${details.status}\n2FA: ${(details.twoFaMethods || []).join(', ') || 'None'}\nJoined: ${formatTimestamp(details.createdAt)}\nLast login: ${formatTimestamp(details.lastLoginAt)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to view user');
    }
  };

  const onSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 mt-1">Manage users, roles, statuses, and sessions.</p>
      </div>

      <form onSubmit={onSearchSubmit} className="flex gap-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by email"
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2.5"
        >
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-sm text-gray-600">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">2FA</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">Loading users...</td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">No users found.</td>
              </tr>
            )}
            {!loading && users.map((u) => {
              const isSelf = u.id === user?.id;
              return (
                <tr key={u.id} className="border-t border-gray-100 text-sm">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u, e.target.value as UserRole)}
                      disabled={isSelf}
                      className="rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(u.status)}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{u.twoFaMethods?.length ? u.twoFaMethods.join(', ') : 'None'}</td>
                  <td className="px-4 py-3 text-gray-700">{formatTimestamp(u.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatTimestamp(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => viewUser(u)} className="px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">View</button>
                      <button onClick={() => toggleSuspend(u)} className="px-2.5 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50">
                        {u.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button onClick={() => forceLogout(u)} className="px-2.5 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">Force logout</button>
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={isSelf}
                        className="px-2.5 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Page {page} of {totalPages} ({pageSize} per page)</p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
