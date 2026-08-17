'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { CompanyList } from '@/app/components/admin';
import { useCompanies, useCreateCompany } from '@/hooks';
import { createCompanySchema } from '@/types/company';
import type { CompanyPlan } from '@/types/admin';

interface StoredUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  company_id: string;
}

const PLAN_OPTIONS: CompanyPlan[] = ['starter', 'professional', 'enterprise'];

export default function AdminCompaniesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);

  const { data: companies, loading, error, fetchCompanies } = useCompanies();
  const createCompanyHook = useCreateCompany();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '',
    slug: '',
    cnpj: '',
    description: '',
    plan: 'starter' as CompanyPlan,
  });
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const tokenStr = localStorage.getItem('access_token');

    if (!userStr || !tokenStr) {
      router.push('/login');
      return;
    }

    setCurrentUser(JSON.parse(userStr));
  }, [router]);

  const loadCompanies = useCallback(() => {
    fetchCompanies({ limit: 100 });
  }, [fetchCompanies]);

  useEffect(() => {
    if (currentUser) {
      loadCompanies();
    }
  }, [currentUser, loadCompanies]);

  const isMaster = currentUser ? ['owner', 'admin'].includes(currentUser.role) : false;

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setFormErrors({});

    // Client-side validation reusing the shared Zod schema from src/types/company.ts
    // before hitting the (master-auth-only) API. The API itself (src/types/admin.ts)
    // requires cnpj as mandatory, so we validate the raw form fields directly.
    const validation = createCompanySchema.safeParse({
      name: form.name,
      slug: form.slug,
      cnpj: form.cnpj,
      description: form.description || undefined,
      plan: form.plan,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setFormErrors(fieldErrors);
      return;
    }

    await createCompanyHook.createCompany({
      name: form.name,
      slug: form.slug,
      cnpj: form.cnpj,
      description: form.description || undefined,
      plan: form.plan,
    });
  };

  useEffect(() => {
    if (createCompanyHook.success) {
      setBanner({ type: 'success', message: `Company "${form.name}" created successfully.` });
      setForm({ name: '', slug: '', cnpj: '', description: '', plan: 'starter' });
      setShowCreateForm(false);
      createCompanyHook.reset();
      loadCompanies();
    } else if (createCompanyHook.error) {
      setBanner({ type: 'error', message: createCompanyHook.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createCompanyHook.success, createCompanyHook.error]);

  if (!currentUser) {
    return <div className="p-8 text-slate-500">Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar userName={currentUser.full_name || currentUser.email} userRole={currentUser.role} />

      <div className="flex-1 bg-gray-100">
        <header className="bg-white border-b border-gray-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-600 mt-1">Master administration: create and list companies.</p>
        </header>

        <main className="p-8 max-w-6xl mx-auto">
          {banner && (
            <div
              className={`mb-6 p-4 rounded-lg border flex justify-between items-start ${
                banner.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <span className="text-sm font-medium">{banner.message}</span>
              <button type="button" onClick={() => setBanner(null)} className="text-sm underline ml-4">
                Dismiss
              </button>
            </div>
          )}

          {error && !banner && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {!isMaster && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              This area requires a master/admin account. Requests will be rejected by the API for
              your current role ({currentUser.role}).
            </div>
          )}

          {showCreateForm && (
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Company</h3>
              <form onSubmit={handleCreateCompany} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="company-slug"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.slug && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.slug}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    required
                    value={form.cnpj}
                    onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                    placeholder="XX.XXX.XXX/XXXX-XX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.cnpj && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.cnpj}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                  <select
                    value={form.plan}
                    onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value as CompanyPlan }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan.charAt(0).toUpperCase() + plan.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createCompanyHook.loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    {createCompanyHook.loading ? 'Creating...' : 'Create Company'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <CompanyList
            companies={companies || []}
            onCreateClick={() => setShowCreateForm(true)}
          />
          {loading && <p className="text-sm text-gray-500 mt-4">Loading companies...</p>}
        </main>
      </div>
    </div>
  );
}
