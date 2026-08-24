import { Router, type Response } from 'express';
import { db } from '../db/client.js';
import { env } from '../env.js';

export const richMenusRouter = Router();

// ── Types ──

interface AreaAction {
  type: 'uri' | 'message' | 'postback' | 'richmenuswitch';
  uri?: string;
  text?: string;
  data?: string;
  displayText?: string;
  richMenuAliasId?: string;
  switchData?: string;
}

interface AreaConfig {
  cell: number;
  label: string;
  action: AreaAction;
}

interface LineBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LineArea {
  bounds: LineBounds;
  action: Record<string, string>;
}

// ── Helpers ──

function getCellCount(layout: string): number {
  switch (layout) {
    case '3x2': return 6;
    case '3x1': return 3;
    case '2x2': return 4;
    case '2x1': return 2;
    default: return 6;
  }
}

function buildBounds(layout: string, cell: number): LineBounds {
  switch (layout) {
    case '3x2': {
      // 3 cols x 2 rows, full 2500x1686
      const col = cell % 3;
      const row = Math.floor(cell / 3);
      return { x: col * 833, y: row * 843, width: 833, height: 843 };
    }
    case '3x1': {
      // 3 cols x 1 row, compact 2500x843
      return { x: cell * 833, y: 0, width: 833, height: 843 };
    }
    case '2x2': {
      // 2 cols x 2 rows, full 2500x1686
      const col = cell % 2;
      const row = Math.floor(cell / 2);
      return { x: col * 1250, y: row * 843, width: 1250, height: 843 };
    }
    case '2x1': {
      // 2 cols x 1 row, compact 2500x843
      return { x: cell * 1250, y: 0, width: 1250, height: 843 };
    }
    default: {
      const col = cell % 3;
      const row = Math.floor(cell / 3);
      return { x: col * 833, y: row * 843, width: 833, height: 843 };
    }
  }
}

function buildLineAction(action: AreaAction): Record<string, string> {
  switch (action.type) {
    case 'uri':
      return { type: 'uri', uri: action.uri || 'https://line.me' };
    case 'message':
      return { type: 'message', text: action.text || '' };
    case 'postback':
      return {
        type: 'postback',
        data: action.data || '',
        ...(action.displayText ? { displayText: action.displayText } : {}),
      };
    case 'richmenuswitch':
      return {
        type: 'richmenuswitch',
        richMenuAliasId: action.richMenuAliasId || '',
        data: action.switchData || '',
      };
    default:
      return { type: 'uri', uri: 'https://line.me' };
  }
}

function buildLineRichMenu(menu: {
  name: string;
  size: string;
  layout: string;
  areas: AreaConfig[];
}) {
  const height = menu.size === 'full' ? 1686 : 843;

  const lineAreas: LineArea[] = menu.areas.map((area) => ({
    bounds: buildBounds(menu.layout, area.cell),
    action: buildLineAction(area.action),
  }));

  return {
    size: { width: 2500, height },
    selected: false,
    name: menu.name,
    chatBarText: 'เมนู',
    areas: lineAreas,
  };
}

async function lineRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${env().LINE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── Error helper ──

function handleDbError(res: Response, error: { code?: string; message?: string } | null, context = 'DB error'): void {
  if (!error) return;
  if (error.code === '23505') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'ID or alias_id already exists' } });
    return;
  }
  console.error(`[richmenus] ${context}:`, error);
  res.status(500).json({ error: { code: 'DB_ERROR', message: error.message || context } });
}

// ── Routes ──

// GET /api/admin/richmenus — list all from DB
richMenusRouter.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await db()
      .from('rich_menus')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { handleDbError(res, error, 'select rich_menus'); return; }
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/richmenus — create in DB
richMenusRouter.post('/', async (req, res, next) => {
  try {
    const { id, name, alias_id, size, layout } = req.body as {
      id: string;
      name: string;
      alias_id: string;
      size?: string;
      layout?: string;
    };

    if (!id || !/^[a-z0-9_-]+$/.test(id)) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'ID must be lowercase, digits, _ or - only' } });
      return;
    }
    if (!name?.trim()) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'name is required' } });
      return;
    }
    if (!alias_id?.trim()) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'alias_id is required' } });
      return;
    }

    const { data, error } = await db()
      .from('rich_menus')
      .insert({
        id,
        name: name.trim(),
        alias_id: alias_id.trim(),
        size: size || 'full',
        layout: layout || '3x2',
        areas: [],
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      handleDbError(res, error, 'insert rich_menus');
      return;
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/richmenus/:id — update in DB
richMenusRouter.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { name, areas, is_default, image_url, layout, size } = req.body as {
      name?: string;
      areas?: AreaConfig[];
      is_default?: boolean;
      image_url?: string;
      layout?: string;
      size?: string;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (areas !== undefined) updates.areas = areas;
    if (is_default !== undefined) updates.is_default = is_default;
    if (image_url !== undefined) updates.image_url = image_url;
    if (layout !== undefined) updates.layout = layout;
    if (size !== undefined) updates.size = size;

    const { data, error } = await db()
      .from('rich_menus')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) { handleDbError(res, error, 'update rich_menus'); return; }
    if (!data) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rich menu not found' } });
      return;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/richmenus/:id — delete from DB + LINE if deployed
richMenusRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;

    const { data: menu, error: fetchErr } = await db()
      .from('rich_menus')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !menu) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rich menu not found' } });
      return;
    }

    // Delete from LINE if deployed
    if (menu.line_id) {
      // Delete alias first
      await lineRequest('DELETE', `/v2/bot/richmenu/alias/${menu.alias_id}`);
      // Delete rich menu
      await lineRequest('DELETE', `/v2/bot/richmenu/${menu.line_id}`);
    }

    const { error: deleteErr } = await db()
      .from('rich_menus')
      .delete()
      .eq('id', id);

    if (deleteErr) { handleDbError(res, deleteErr, 'delete rich_menus'); return; }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/richmenus/:id/deploy — create on LINE + upload to alias + optionally set default
richMenusRouter.post('/:id/deploy', async (req, res, next) => {
  try {
    const id = req.params.id as string;

    const { data: menu, error: fetchErr } = await db()
      .from('rich_menus')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !menu) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rich menu not found' } });
      return;
    }

    // 1. Build LINE rich menu JSON
    const lineMenu = buildLineRichMenu({
      name: menu.name as string,
      size: menu.size as string,
      layout: menu.layout as string,
      areas: (menu.areas || []) as AreaConfig[],
    });

    // 2. Create rich menu on LINE
    const createRes = await lineRequest('POST', '/v2/bot/richmenu', lineMenu);
    if (!createRes.ok) {
      res.status(502).json({
        error: {
          code: 'LINE_ERROR',
          message: 'Failed to create rich menu on LINE',
          details: createRes.data,
        },
      });
      return;
    }

    const richMenuId = (createRes.data as { richMenuId: string }).richMenuId;

    // 3. Create or update alias
    // Try to create alias first
    const aliasCreateRes = await lineRequest('POST', '/v2/bot/richmenu/alias', {
      richMenuAliasId: menu.alias_id,
      richMenuId,
    });

    if (!aliasCreateRes.ok) {
      // If alias already exists, update it
      if ((aliasCreateRes.data as { message?: string }).message?.includes('already')) {
        const aliasUpdateRes = await lineRequest('PUT', `/v2/bot/richmenu/alias/${menu.alias_id}`, {
          richMenuId,
        });
        if (!aliasUpdateRes.ok) {
          res.status(502).json({
            error: {
              code: 'LINE_ERROR',
              message: 'Failed to update rich menu alias on LINE',
              details: aliasUpdateRes.data,
            },
          });
          return;
        }
      } else {
        res.status(502).json({
          error: {
            code: 'LINE_ERROR',
            message: 'Failed to create rich menu alias on LINE',
            details: aliasCreateRes.data,
          },
        });
        return;
      }
    }

    // 4. If is_default, set as default for all users
    if (menu.is_default) {
      await lineRequest('POST', `/v2/bot/user/all/richmenu/${richMenuId}`);
    }

    // 5. Save line_id + deployed_at to DB
    const { data: updated, error: updateErr } = await db()
      .from('rich_menus')
      .update({
        line_id: richMenuId,
        deployed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) { handleDbError(res, updateErr, 'update rich_menus after deploy'); return; }

    res.json({ ok: true, lineId: richMenuId, menu: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/richmenus/:id/set-default — set as default for all users
richMenusRouter.post('/:id/set-default', async (req, res, next) => {
  try {
    const id = req.params.id as string;

    const { data: menu, error: fetchErr } = await db()
      .from('rich_menus')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !menu) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rich menu not found' } });
      return;
    }

    if (!menu.line_id) {
      res.status(400).json({ error: { code: 'NOT_DEPLOYED', message: 'Rich menu must be deployed first' } });
      return;
    }

    const lineRes = await lineRequest('POST', `/v2/bot/user/all/richmenu/${menu.line_id}`);
    if (!lineRes.ok) {
      res.status(502).json({
        error: {
          code: 'LINE_ERROR',
          message: 'Failed to set default rich menu on LINE',
          details: lineRes.data,
        },
      });
      return;
    }

    // Update is_default in DB (clear others first)
    await db().from('rich_menus').update({ is_default: false, updated_at: new Date().toISOString() }).neq('id', id);
    await db().from('rich_menus').update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', id);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
