import { Router } from 'express';
import { db } from '../db/client.js';
import { CampaignConfig } from '../config/schema.js';
import { clearCache } from '../config/loader.js';
import { adminForceGroupComplete } from '../services/group.js';

export const adminRouter = Router();

// GET /api/admin/campaigns — list all campaigns
adminRouter.get('/campaigns', async (_req, res, next) => {
  try {
    const { data, error } = await db()
      .from('campaigns')
      .select('id, type, status, current_version, starts_at, ends_at, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get latest config version for each to show mode + brand name
    const enriched = await Promise.all(
      (data || []).map(async (c) => {
        const { data: ver } = await db()
          .from('campaign_versions')
          .select('config')
          .eq('campaign_id', c.id)
          .eq('version', c.current_version)
          .single();

        const config = ver?.config as Record<string, unknown> | null;
        return {
          id: c.id,
          type: c.type,
          status: c.status,
          currentVersion: c.current_version,
          mode: (config?.mode as string) || 'pair',
          brandName: (config?.brand as Record<string, string>)?.name || c.id,
          createdAt: c.created_at,
        };
      }),
    );

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/campaigns — create a new campaign
adminRouter.post('/campaigns', async (req, res, next) => {
  try {
    const { id, mode } = req.body;

    if (!id || !/^[a-z0-9_]+$/.test(id)) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'ID must be lowercase, digits and _ only' } });
      return;
    }

    // Check if exists
    const { data: existing } = await db().from('campaigns').select('id').eq('id', id).single();
    if (existing) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Campaign already exists' } });
      return;
    }

    // Create with minimal default config
    const campaignType = (req.body.type === 'group' ? 'group' : 'buddy_quiz') as 'buddy_quiz' | 'group';
    const defaultConfig = {
      id,
      type: campaignType,
      mode: mode || 'pair',
      version: 1,
      brand: { name: id, primary: '#FF3D8B', surface: '#1B1430', on_surface: '#FFF3E4' },
      copy: {
        intro_title: 'ควิซ',
        intro_body: 'ตอบคำถามแล้วดูผลลัพธ์',
        intro_cta: 'เริ่มตอบ',
        demo_cta: 'ลองกับคู่หูตัวอย่าง',
        question_counter: 'ข้อ {current} จาก {total}',
        result_eyebrow: mode === 'solo' ? 'คุณคือ' : 'คุณสองคนคือ',
        result_share_cta: 'อวดผลให้คนอื่น',
        result_again_cta: mode === 'solo' ? 'ลองทำอีกครั้ง' : 'ชวนอีกคน',
        waiting_title: 'รอคู่หูตอบอยู่',
        waiting_close: 'ปิดหน้าต่าง',
        invited_title: '{inviter} ชวนคุณมาตอบ',
        invited_cta: 'ตอบเลย',
        share_title: 'ส่งให้คู่หูตอบ',
        share_cta: 'เลือกเพื่อนแล้วส่ง',
        friend_gate_title: 'เพิ่มเพื่อนก่อนดูผล',
        expired_title: 'คำเชิญหมดอายุแล้ว',
        limit_title: 'วันนี้ครบโควตาแล้ว',
      },
      axes: mode === 'solo'
        ? [
            { id: 'ei', label: 'E/I', poles: ['Extrovert', 'Introvert'] },
            { id: 'sn', label: 'S/N', poles: ['Sensing', 'Intuition'] },
            { id: 'tf', label: 'T/F', poles: ['Thinking', 'Feeling'] },
            { id: 'jp', label: 'J/P', poles: ['Judging', 'Perceiving'] },
          ]
        : [
            { id: 'axis_1', label: 'แกน 1' },
            { id: 'axis_2', label: 'แกน 2' },
            { id: 'axis_3', label: 'แกน 3' },
          ],
      questions: [
        {
          id: 'q_1', text: 'คำถามข้อ 1',
          options: [
            { id: 'q_1_a', label: 'ตัวเลือก A', scores: {} },
            { id: 'q_1_b', label: 'ตัวเลือก B', scores: {} },
            { id: 'q_1_c', label: 'ตัวเลือก C', scores: {} },
          ],
        },
        {
          id: 'q_2', text: 'คำถามข้อ 2',
          options: [
            { id: 'q_2_a', label: 'ตัวเลือก A', scores: {} },
            { id: 'q_2_b', label: 'ตัวเลือก B', scores: {} },
          ],
        },
        {
          id: 'q_3', text: 'คำถามข้อ 3',
          options: [
            { id: 'q_3_a', label: 'ตัวเลือก A', scores: {} },
            { id: 'q_3_b', label: 'ตัวเลือก B', scores: {} },
          ],
        },
      ],
      results: [
        { code: 'result_1', title: 'ผลลัพธ์ 1', body: '' },
        { code: 'fallback', title: 'ผลลัพธ์ทั่วไป', body: '' },
      ],
      fallback_result: 'fallback',
      rules: { invite_ttl_hours: 48, require_friend: false, max_pairs_per_user_per_day: 10, allow_self_pair: false },
      messages: {
        invite: { template: 'invite_v1', slots: { title: 'มาตอบควิซกัน', body: '', cta: 'ตอบเลย' } },
        partner_done: { template: 'notify_v1', slots: { title: 'คู่หูตอบแล้ว', body: '', cta: 'ดูผล' } },
        welcome: { template: 'notify_v1', slots: { title: 'ยินดีต้อนรับ', body: '', cta: 'เริ่มเลย' } },
      },
    };

    await db().from('campaigns').insert({
      id,
      type: campaignType,
      status: 'draft',
      current_version: 1,
    });

    await db().from('campaign_versions').insert({
      campaign_id: id,
      version: 1,
      config: defaultConfig,
      published_at: new Date().toISOString(),
    });

    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/campaign/:id — load current config
adminRouter.get('/campaign/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;

    // Query base columns (always present) then try draft_version separately
    const { data: campaign, error: campErr } = await db()
      .from('campaigns')
      .select('id, type, status, current_version')
      .eq('id', id)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      return;
    }

    // Try to get draft_version — column may not exist on older DBs
    const { data: draftRow } = await db()
      .from('campaigns')
      .select('draft_version')
      .eq('id', id)
      .single();

    const draftVersion: number | null = (draftRow as { draft_version?: number | null } | null)?.draft_version ?? null;

    // If there's a draft, load that for the admin editor; otherwise load current (published) version
    const editorVersion = draftVersion ?? campaign.current_version;

    const { data: version, error: verErr } = await db()
      .from('campaign_versions')
      .select('config, version, published_at')
      .eq('campaign_id', id)
      .eq('version', editorVersion)
      .single();

    if (verErr || !version) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Config version not found' } });
      return;
    }

    res.json({
      campaign: {
        id: campaign.id,
        type: campaign.type,
        status: campaign.status,
        currentVersion: campaign.current_version,
        draftVersion: draftVersion,
      },
      config: version.config,
    });
  } catch (err) {
    next(err);
  }
});

// Helper: try to read/write draft_version, silently ignore if column missing
async function getDraftVersion(id: string): Promise<number | null> {
  try {
    const { data } = await db()
      .from('campaigns')
      .select('draft_version')
      .eq('id', id)
      .single();
    return (data as { draft_version?: number | null } | null)?.draft_version ?? null;
  } catch {
    return null;
  }
}
async function setDraftVersion(id: string, version: number | null): Promise<void> {
  try {
    await db().from('campaigns').update({ draft_version: version }).eq('id', id);
  } catch {
    // column may not exist — ignore
  }
}

// PUT /api/admin/campaign/:id — save config (creates new version)
adminRouter.put('/campaign/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const configRaw = req.body.config;

    if (!configRaw) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing config' } });
      return;
    }

    // Validate config against schema
    const parsed = CampaignConfig.safeParse(configRaw);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Config validation failed',
          details: parsed.error.issues,
        },
      });
      return;
    }

    // Get current campaign
    const { data: campaign, error: campErr } = await db()
      .from('campaigns')
      .select('id, current_version')
      .eq('id', id)
      .single();

    if (campErr || !campaign) {
      // Create new campaign if it doesn't exist
      const newVersion = parsed.data.version || 1;

      await db().from('campaigns').insert({
        id,
        type: parsed.data.type,
        status: 'live',
        current_version: newVersion,
      });

      await db().from('campaign_versions').insert({
        campaign_id: id,
        version: newVersion,
        config: configRaw,
        published_at: new Date().toISOString(),
      });

      clearCache();
      res.json({ ok: true, version: newVersion, created: true, isDraft: false });
      return;
    }

    // Derive new version from actual max in versions table to avoid
    // duplicate-key errors when current_version is stale (e.g. rapid saves).
    const { data: maxVerRow } = await db()
      .from('campaign_versions')
      .select('version')
      .eq('campaign_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .single();
    const newVersion = (maxVerRow?.version ?? campaign.current_version) + 1;
    const configWithVersion = { ...configRaw, version: newVersion };

    // Save as DRAFT — published_at is null, does NOT affect live LIFF
    const { error: insertErr } = await db().from('campaign_versions').insert({
      campaign_id: id,
      version: newVersion,
      config: configWithVersion,
      published_at: null,
    });

    if (insertErr) {
      res.status(500).json({ error: { code: 'INSERT_FAILED', message: insertErr.message } });
      return;
    }

    // Update draft_version only — current_version (live) stays unchanged
    await setDraftVersion(id, newVersion);

    // Do NOT clearCache() — live config did not change

    res.json({ ok: true, version: newVersion, isDraft: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/campaign/:id/publish — publish the current draft
adminRouter.post('/campaign/:id/publish', async (req, res, next) => {
  try {
    const id = req.params.id as string;

    const { data: campaign, error: campErr } = await db()
      .from('campaigns')
      .select('id, current_version')
      .eq('id', id)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      return;
    }

    const draftVersion = await getDraftVersion(id);
    if (draftVersion == null) {
      res.status(400).json({ error: { code: 'NO_DRAFT', message: 'No draft to publish' } });
      return;
    }

    // Mark the draft version as published
    const { error: verErr } = await db()
      .from('campaign_versions')
      .update({ published_at: new Date().toISOString() })
      .eq('campaign_id', id)
      .eq('version', draftVersion);

    if (verErr) {
      res.status(500).json({ error: { code: 'UPDATE_FAILED', message: verErr.message } });
      return;
    }

    // Promote draft to current_version and clear draft_version
    await db().from('campaigns').update({ current_version: draftVersion }).eq('id', id);
    await setDraftVersion(id, null);

    clearCache();

    res.json({ ok: true, version: draftVersion });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/campaign/:id/status — change campaign status
adminRouter.put('/campaign/:id/status', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!['draft', 'live', 'ended'].includes(status)) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid status' } });
      return;
    }

    const { error } = await db()
      .from('campaigns')
      .update({ status })
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: { code: 'UPDATE_FAILED', message: error.message } });
      return;
    }

    res.json({ ok: true, status });
  } catch (err) {
    next(err);
  }
});


// POST /api/admin/group/:id/force-complete — push group-complete card regardless of member count (testing)
adminRouter.post('/group/:id/force-complete', async (req, res, next) => {
  try {
    const result = await adminForceGroupComplete(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
