import { Router } from 'express';
import { db } from '../db/client.js';

export const messagesRouter = Router();

// ── Keyword Rules ──

// GET /api/admin/messages/keywords — list all keyword rules
messagesRouter.get('/keywords', async (_req, res, next) => {
  try {
    const { data, error } = await db()
      .from('keyword_rules')
      .select('id, keyword, campaign_id, reply_type, reply_text, reply_flex, enabled, priority')
      .order('priority', { ascending: false });

    if (error) throw error;

    // Enrich with campaign brand name
    const enriched = await Promise.all(
      (data || []).map(async (rule) => {
        let campaignName = null;
        if (rule.campaign_id) {
          const { data: ver } = await db()
            .from('campaign_versions')
            .select('config')
            .eq('campaign_id', rule.campaign_id)
            .order('version', { ascending: false })
            .limit(1)
            .single();
          const cfg = ver?.config as Record<string, unknown> | null;
          campaignName = (cfg?.brand as Record<string, string>)?.name || rule.campaign_id;
        }
        return { ...rule, campaignName };
      }),
    );

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/messages/keywords — create a keyword rule
messagesRouter.post('/keywords', async (req, res, next) => {
  try {
    const { keyword, campaignId, replyType, replyText, replyFlex, priority } = req.body;

    if (!keyword || !keyword.trim()) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Keyword is required' } });
      return;
    }

    const kw = keyword.trim().toLowerCase();

    // Check duplicate
    const { data: existing } = await db()
      .from('keyword_rules')
      .select('id, keyword, campaign_id')
      .eq('keyword', kw)
      .single();

    if (existing) {
      res.status(409).json({
        error: {
          code: 'DUPLICATE',
          message: `keyword "${kw}" ถูกใช้แล้ว`,
          existingRule: existing,
        },
      });
      return;
    }

    const { data, error } = await db()
      .from('keyword_rules')
      .insert({
        keyword: kw,
        campaign_id: campaignId || null,
        reply_type: replyType || 'text',
        reply_text: replyText || null,
        reply_flex: replyFlex || null,
        priority: priority ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/messages/keywords/:id — update a keyword rule
messagesRouter.put('/keywords/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { keyword, campaignId, replyType, replyText, replyFlex, enabled, priority } = req.body;

    const updates: Record<string, unknown> = {};
    if (keyword !== undefined) {
      const kw = keyword.trim().toLowerCase();
      // Check duplicate (exclude self)
      const { data: dup } = await db()
        .from('keyword_rules')
        .select('id')
        .eq('keyword', kw)
        .neq('id', id)
        .single();

      if (dup) {
        res.status(409).json({ error: { code: 'DUPLICATE', message: `keyword "${kw}" ถูกใช้แล้ว` } });
        return;
      }
      updates.keyword = kw;
    }
    if (campaignId !== undefined) updates.campaign_id = campaignId || null;
    if (replyType !== undefined) updates.reply_type = replyType;
    if (replyText !== undefined) updates.reply_text = replyText;
    if (replyFlex !== undefined) updates.reply_flex = replyFlex;
    if (enabled !== undefined) updates.enabled = enabled;
    if (priority !== undefined) updates.priority = priority;

    const { data, error } = await db()
      .from('keyword_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/messages/keywords/:id
messagesRouter.delete('/keywords/:id', async (req, res, next) => {
  try {
    const { error } = await db()
      .from('keyword_rules')
      .delete()
      .eq('id', req.params.id as string);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── OA Settings (welcome message, etc.) ──

// GET /api/admin/messages/settings
messagesRouter.get('/settings', async (_req, res, next) => {
  try {
    const { data, error } = await db().from('oa_settings').select('key, value');
    if (error) throw error;

    const settings: Record<string, unknown> = {};
    for (const row of data || []) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/messages/settings/:key
messagesRouter.put('/settings/:key', async (req, res, next) => {
  try {
    const key = req.params.key as string;
    const { value } = req.body;

    const { error } = await db()
      .from('oa_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Preview — test what reply a keyword would get ──

// GET /api/admin/messages/preview?text=ควิซ
messagesRouter.get('/preview', async (req, res, next) => {
  try {
    const text = (req.query.text as string || '').trim().toLowerCase();
    if (!text) {
      res.json({ match: false });
      return;
    }

    const { data: rules } = await db()
      .from('keyword_rules')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false });

    const matched = (rules || []).find((r) => text.includes(r.keyword));
    if (!matched) {
      res.json({ match: false, text });
      return;
    }

    res.json({ match: true, text, rule: matched });
  } catch (err) {
    next(err);
  }
});

// ── Message Library ──

// GET /api/admin/messages/library
messagesRouter.get('/library', async (_req, res, next) => {
  try {
    const { data, error } = await db()
      .from('message_library')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/messages/library
messagesRouter.post('/library', async (req, res, next) => {
  try {
    const { name, type, body, title, cta, action, image_url, usage, areas } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'name is required' } });
      return;
    }
    const { data, error } = await db()
      .from('message_library')
      .insert({
        name: name.trim(),
        type: type || 'text',
        body: body || '',
        title: title || '',
        cta: cta || '',
        action: action || '',
        image_url: image_url || '',
        usage: usage || [],
        areas: areas || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/messages/library/:id
messagesRouter.put('/library/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { name, type, body, title, cta, action, image_url, usage, areas } = req.body;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (body !== undefined) updates.body = body;
    if (title !== undefined) updates.title = title;
    if (cta !== undefined) updates.cta = cta;
    if (action !== undefined) updates.action = action;
    if (image_url !== undefined) updates.image_url = image_url;
    if (usage !== undefined) updates.usage = usage;
    if (areas !== undefined) updates.areas = areas;
    const { data, error } = await db()
      .from('message_library')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/messages/library/:id
messagesRouter.delete('/library/:id', async (req, res, next) => {
  try {
    const { error } = await db()
      .from('message_library')
      .delete()
      .eq('id', req.params.id as string);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
