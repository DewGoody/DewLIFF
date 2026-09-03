import type { CampaignMeta, CampaignConfig, AppearanceConfig } from './types';

const BASE = '';

export async function fetchCampaigns(): Promise<CampaignMeta[]> {
  const res = await fetch(BASE + '/api/admin/campaigns');
  if (!res.ok) throw new Error('Failed to load campaigns');
  return res.json();
}

export async function createCampaign(id: string, mode: string, type: string = 'buddy_quiz'): Promise<{ ok: boolean; id: string }> {
  const res = await fetch(BASE + '/api/admin/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, mode, type }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Create failed');
  return data;
}

export async function fetchCampaign(id: string): Promise<{ campaign: CampaignMeta; config: CampaignConfig }> {
  const res = await fetch(BASE + '/api/admin/campaign/' + id);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: { message?: string } }).error?.message || 'Not found');
  }
  return res.json();
}

export async function saveCampaign(
  id: string,
  config: CampaignConfig
): Promise<{ ok: boolean; version: number; isDraft: boolean }> {
  const res = await fetch(BASE + '/api/admin/campaign/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = (data as { error?: { message?: string; details?: Array<{ path: string[]; message: string }> } }).error;
    if (err?.details) {
      throw new Error('Validation error:\n' + err.details.map((d) => '• ' + d.path.join('.') + ': ' + d.message).join('\n'));
    }
    throw new Error(err?.message || 'Save failed');
  }
  return data;
}

export async function publishCampaign(id: string): Promise<{ ok: boolean; version: number }> {
  const res = await fetch(BASE + '/api/admin/campaign/' + id + '/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'Publish failed');
  return data;
}

export const fetchAppearance = (campaignId: string): Promise<AppearanceConfig> =>
  fetchCampaign(campaignId).then(r => r.config?.appearance ?? {});

export const saveAppearance = (campaignId: string, appearance: AppearanceConfig): Promise<{ ok: boolean; version: number }> =>
  fetchCampaign(campaignId).then(r => {
    const config = { ...r.config, appearance };
    return saveCampaign(campaignId, config);
  });

export async function setCampaignStatus(id: string, status: 'draft' | 'live' | 'ended'): Promise<void> {
  const res = await fetch(BASE + '/api/admin/campaign/' + id + '/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: { message?: string } }).error?.message || 'Status update failed');
  }
}

// ── Keyword Rules ──

export interface KeywordRule {
  id: number;
  keyword: string;
  campaign_id: string | null;
  reply_type: 'flex_campaign' | 'text' | 'flex_custom';
  reply_text: string | null;
  reply_flex: unknown | null;
  enabled: boolean;
  priority: number;
  campaignName?: string | null;
}

export async function fetchKeywords(): Promise<KeywordRule[]> {
  const res = await fetch(BASE + '/api/admin/messages/keywords');
  if (!res.ok) throw new Error('Failed to load keywords');
  return res.json();
}

export async function createKeyword(payload: {
  keyword: string;
  campaignId?: string | null;
  replyType: KeywordRule['reply_type'];
  replyText?: string | null;
  priority?: number;
}): Promise<KeywordRule> {
  const res = await fetch(BASE + '/api/admin/messages/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'Create failed');
  return data as KeywordRule;
}

export async function updateKeyword(id: number, payload: {
  enabled?: boolean;
  priority?: number;
  replyType?: KeywordRule['reply_type'];
  replyText?: string | null;
  campaignId?: string | null;
}): Promise<KeywordRule> {
  const res = await fetch(BASE + '/api/admin/messages/keywords/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'Update failed');
  return data as KeywordRule;
}

export async function deleteKeyword(id: number): Promise<void> {
  const res = await fetch(BASE + '/api/admin/messages/keywords/' + id, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

// ── OA Settings ──

export async function fetchSettings(): Promise<Record<string, unknown>> {
  const res = await fetch(BASE + '/api/admin/messages/settings');
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const res = await fetch(BASE + '/api/admin/messages/settings/' + key, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error('Save setting failed');
}

export async function previewKeyword(text: string): Promise<{ match: boolean; text?: string; rule?: KeywordRule }> {
  const res = await fetch(BASE + '/api/admin/messages/preview?text=' + encodeURIComponent(text));
  if (!res.ok) throw new Error('Preview failed');
  return res.json();
}

// ── Message Library ──

export interface LibraryMsg {
  id: number;
  name: string;
  type: string;
  body: string;
  title: string;
  cta: string;
  action: string;
  image_url: string;
  usage: string[];
  areas?: { label: string; action: string }[] | null;
  created_at: string;
  updated_at: string;
}

export async function fetchLibrary(): Promise<LibraryMsg[]> {
  const res = await fetch(BASE + '/api/admin/messages/library');
  if (!res.ok) throw new Error('Failed to load message library');
  return res.json();
}

export async function createLibraryMsg(payload: Omit<LibraryMsg, 'id' | 'created_at' | 'updated_at'>): Promise<LibraryMsg> {
  const res = await fetch(BASE + '/api/admin/messages/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'Create failed');
  return data as LibraryMsg;
}

export async function updateLibraryMsg(id: number, payload: Partial<Omit<LibraryMsg, 'id' | 'created_at'>>): Promise<LibraryMsg> {
  const res = await fetch(BASE + '/api/admin/messages/library/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'Update failed');
  return data as LibraryMsg;
}

export async function deleteLibraryMsg(id: number): Promise<void> {
  const res = await fetch(BASE + '/api/admin/messages/library/' + id, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

// ── Rich Menus ──

export interface RichMenuArea {
  cell: number;
  label: string;
  action: {
    type: 'uri' | 'message' | 'postback' | 'richmenuswitch';
    uri?: string;
    text?: string;
    data?: string;
    displayText?: string;
    richMenuAliasId?: string;
    switchData?: string;
  };
}

export interface RichMenu {
  id: string;
  name: string;
  alias_id: string;
  line_id: string | null;
  size: 'full' | 'compact';
  layout: '3x2' | '3x1' | '2x2' | '2x1';
  areas: RichMenuArea[];
  image_url: string | null;
  is_default: boolean;
  deployed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchRichMenus(): Promise<RichMenu[]> {
  const res = await fetch(BASE + '/api/admin/richmenus');
  if (!res.ok) throw new Error('Failed to load rich menus');
  return res.json();
}

export async function createRichMenu(
  payload: Pick<RichMenu, 'id' | 'name' | 'alias_id' | 'size' | 'layout'>,
): Promise<RichMenu> {
  const res = await fetch(BASE + '/api/admin/richmenus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'Create failed');
  return data as RichMenu;
}

export async function updateRichMenu(
  id: string,
  payload: Partial<Pick<RichMenu, 'name' | 'areas' | 'is_default' | 'image_url'> & { layout: string; size: string }>,
): Promise<RichMenu> {
  const res = await fetch(BASE + '/api/admin/richmenus/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'Update failed');
  return data as RichMenu;
}

export async function deleteRichMenu(id: string): Promise<void> {
  const res = await fetch(BASE + '/api/admin/richmenus/' + id, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

export async function deployRichMenu(id: string): Promise<{ ok: boolean; lineId: string }> {
  const res = await fetch(BASE + '/api/admin/richmenus/' + id + '/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'Deploy failed');
  return data as { ok: boolean; lineId: string };
}

export async function setDefaultRichMenu(id: string): Promise<void> {
  const res = await fetch(BASE + '/api/admin/richmenus/' + id + '/set-default', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Set default failed');
}

// ── Reward Pools ──

export async function fetchRewardPools(): Promise<{ pools: unknown[] }> {
  const res = await fetch(BASE + '/api/admin/rewards/pools');
  if (!res.ok) throw new Error('Failed to load reward pools');
  return res.json();
}

export async function createRewardPool(data: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(BASE + '/api/admin/rewards/pools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Create failed');
  return json;
}

export async function updateRewardPool(id: string, data: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(BASE + '/api/admin/rewards/pools/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Update failed');
  return json;
}

export async function deleteRewardPool(id: string): Promise<void> {
  const res = await fetch(BASE + '/api/admin/rewards/pools/' + id, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

export async function importRewardCodes(id: string, codes: string[]): Promise<{ ok: boolean; imported: number }> {
  const res = await fetch(BASE + '/api/admin/rewards/pools/' + id + '/codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codes }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Import failed');
  return json as { ok: boolean; imported: number };
}

export async function fetchRewardCodes(id: string, page = 1): Promise<{ codes: unknown[]; total: number; page: number; limit: number }> {
  const res = await fetch(BASE + '/api/admin/rewards/pools/' + id + '/codes?page=' + page);
  if (!res.ok) throw new Error('Failed to load codes');
  return res.json();
}

export async function fetchPoolStats(id: string): Promise<{ pool: unknown; stats: { total_codes: number; available_codes: number; total_claims: number }; triggers: unknown[] }> {
  const res = await fetch(BASE + '/api/admin/rewards/pools/' + id);
  if (!res.ok) throw new Error('Failed to load pool stats');
  return res.json();
}

// ── Reward Triggers ──

export async function fetchPoolTriggers(poolId: string): Promise<{ triggers: unknown[] }> {
  const res = await fetch(BASE + '/api/admin/rewards/pools/' + poolId + '/triggers');
  if (!res.ok) throw new Error('Failed to load triggers');
  return res.json();
}

export async function createRewardTrigger(poolId: string, data: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(BASE + '/api/admin/rewards/pools/' + poolId + '/triggers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Create failed');
  return json;
}

export async function updateRewardTrigger(triggerId: string, data: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(BASE + '/api/admin/rewards/triggers/' + triggerId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Update failed');
  return json;
}

export async function deleteRewardTrigger(triggerId: string): Promise<void> {
  const res = await fetch(BASE + '/api/admin/rewards/triggers/' + triggerId, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

// ── Reward Claims ──

export async function fetchRewardClaims(params?: {
  campaign_id?: string;
  pool_id?: string;
  delivery_status?: string;
  status?: string;
}): Promise<{ claims: unknown[] }> {
  const q = new URLSearchParams();
  if (params?.campaign_id)    q.set('campaign_id', params.campaign_id);
  if (params?.pool_id)        q.set('pool_id', params.pool_id);
  if (params?.delivery_status) q.set('delivery_status', params.delivery_status);
  if (params?.status)         q.set('status', params.status);
  const res = await fetch(BASE + '/api/admin/rewards/claims?' + q.toString());
  if (!res.ok) throw new Error('Failed to load claims');
  return res.json();
}

export async function updateRewardClaim(id: string, data: {
  delivery_status?: string;
  tracking_number?: string;
  admin_note?: string;
  status?: string;
}): Promise<unknown> {
  const res = await fetch(BASE + '/api/admin/rewards/claims/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Update failed');
  return json;
}
