import { supabase } from './supabase';
import type { TxnRow, TxnType } from './finance';

export type AccountKind = 'investment' | 'loan';
export type MemberRole = 'owner' | 'editor';
export type InviteStatus = 'pending' | 'accepted' | 'cancelled';

export interface Account {
  id: string;
  owner_id: string;
  kind: AccountKind;
  name: string;
  category: string | null;
  currency: string;
  start_date: string | null;
  notes: string | null;
  interest_rate: number | null;
  original_principal: number | null;
  tenure_months: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountMember {
  account_id: string;
  user_id: string;
  role: MemberRole;
  added_at: string;
  email?: string | null;
  display_name?: string | null;
}

export interface AccountInvite {
  id: string;
  account_id: string;
  invited_email: string;
  invited_by: string | null;
  status: InviteStatus;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
}

// ---------------------------------------------------------------------------
// Reads (direct table endpoints — SELECT policies are `{public}` scoped)
// ---------------------------------------------------------------------------

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function fetchAccount(id: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as Account | null) ?? null;
}

export async function fetchTransactions(accountId: string): Promise<TxnRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TxnRow[];
}

export async function fetchAllTransactionsForAccounts(
  accountIds: string[],
): Promise<TxnRow[]> {
  if (accountIds.length === 0) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .in('account_id', accountIds)
    .is('deleted_at', null)
    .order('txn_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TxnRow[];
}

export async function fetchAccountMembers(
  accountId: string,
): Promise<AccountMember[]> {
  const { data, error } = await supabase
    .from('account_members')
    .select('account_id, user_id, role, added_at, profiles:profiles!inner(email, display_name)')
    .eq('account_id', accountId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      account_id: string;
      user_id: string;
      role: MemberRole;
      added_at: string;
      profiles:
        | { email: string; display_name: string | null }
        | Array<{ email: string; display_name: string | null }>
        | null;
    };
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      account_id: r.account_id,
      user_id: r.user_id,
      role: r.role,
      added_at: r.added_at,
      email: profile?.email ?? null,
      display_name: profile?.display_name ?? null,
    };
  });
}

export async function fetchAccountInvites(
  accountId: string,
): Promise<AccountInvite[]> {
  const { data, error } = await supabase
    .from('account_invites')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccountInvite[];
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

// ---------------------------------------------------------------------------
// Writes (routed through security-definer RPCs — see migration 0007)
// ---------------------------------------------------------------------------

export interface CreateAccountInput {
  kind: AccountKind;
  name: string;
  category?: string | null;
  start_date?: string | null;
  notes?: string | null;
  interest_rate?: number | null;
  original_principal?: number | null;
  tenure_months?: number | null;
}

export async function createAccount(
  input: CreateAccountInput,
  _ownerId: string,
): Promise<Account> {
  const { data, error } = await supabase.rpc('kosha_create_account', {
    p_kind: input.kind,
    p_name: input.name,
    p_category: input.category ?? null,
    p_start_date: input.start_date ?? null,
    p_notes: input.notes ?? null,
    p_interest_rate: input.interest_rate ?? null,
    p_original_principal: input.original_principal ?? null,
    p_tenure_months: input.tenure_months ?? null,
  });
  if (error) throw error;
  const acc = await fetchAccount(data as string);
  if (!acc) throw new Error('Account created but not visible yet');
  return acc;
}

export async function updateAccount(
  id: string,
  patch: Partial<CreateAccountInput>,
  _userId: string,
): Promise<void> {
  const existing = await fetchAccount(id);
  if (!existing) throw new Error('Account not found');
  const { error } = await supabase.rpc('kosha_update_account', {
    p_id: id,
    p_name: patch.name ?? existing.name,
    p_category: patch.category ?? existing.category,
    p_start_date: patch.start_date ?? existing.start_date,
    p_notes: patch.notes ?? existing.notes,
    p_interest_rate: patch.interest_rate ?? existing.interest_rate,
    p_original_principal: patch.original_principal ?? existing.original_principal,
    p_tenure_months: patch.tenure_months ?? existing.tenure_months,
  });
  if (error) throw error;
}

export async function softDeleteAccount(id: string): Promise<void> {
  const { error } = await supabase.rpc('kosha_soft_delete_account', { p_id: id });
  if (error) throw error;
}

export interface CreateTxnInput {
  account_id: string;
  txn_type: TxnType;
  amount: number;
  principal_component?: number | null;
  interest_component?: number | null;
  txn_date: string;
  notes?: string | null;
}

export async function createTransaction(
  input: CreateTxnInput,
  _userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('kosha_create_transaction', {
    p_account_id: input.account_id,
    p_txn_type: input.txn_type,
    p_amount: input.amount,
    p_principal_component: input.principal_component ?? null,
    p_interest_component: input.interest_component ?? null,
    p_txn_date: input.txn_date,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
}

export async function updateTransaction(
  id: string,
  patch: Partial<CreateTxnInput>,
  _userId: string,
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error('Transaction not found');
  const e = existing as TxnRow;
  const { error } = await supabase.rpc('kosha_update_transaction', {
    p_id: id,
    p_txn_type: patch.txn_type ?? e.txn_type,
    p_amount: patch.amount ?? e.amount,
    p_principal_component: patch.principal_component ?? e.principal_component,
    p_interest_component: patch.interest_component ?? e.interest_component,
    p_txn_date: patch.txn_date ?? e.txn_date,
    p_notes: patch.notes ?? e.notes,
  });
  if (error) throw error;
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.rpc('kosha_soft_delete_transaction', { p_id: id });
  if (error) throw error;
}

export async function createInvite(
  accountId: string,
  email: string,
  _invitedBy: string,
): Promise<void> {
  const { error } = await supabase.rpc('kosha_create_invite', {
    p_account_id: accountId,
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
}

export async function cancelInvite(id: string): Promise<void> {
  const { error } = await supabase.rpc('kosha_cancel_invite', { p_id: id });
  if (error) throw error;
}

export async function removeAccountMember(
  accountId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('kosha_remove_account_member', {
    p_account_id: accountId,
    p_user_id: userId,
  });
  if (error) throw error;
}
