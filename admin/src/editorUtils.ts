import type { CampaignConfig, EditorState, EditorAxis, EditorOption, EditorQuestion } from './types';
import { PALETTE, pairKey } from './utils';

export function configToEditorState(cfg: CampaignConfig & { archetypes?: { id: string; name: string; order?: number }[] }): EditorState {
  // Support both internal format (axes) and schema_v1 format (archetypes)
  const rawAxes = cfg.axes?.length
    ? cfg.axes
    : (cfg.archetypes || [])
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => ({ id: a.id, label: a.name }));

  const axes: EditorAxis[] = rawAxes.map((a, i) => {
    const ax = a as EditorAxis & { poles?: string[] };
    return {
      id: ax.id,
      label: ax.label,
      color: PALETTE[i % PALETTE.length],
      ...(ax.label_en   ? { label_en:   ax.label_en   } : {}),
      ...(ax.body       ? { body:        ax.body       } : {}),
      ...(ax.short      ? { short:       ax.short      } : {}),
      ...(ax.image_url  ? { image_url:   ax.image_url  } : {}),
      ...(ax.order      ? { order:       ax.order      } : {}),
      ...(ax.poles      ? { poles:       ax.poles      } : {}),
      ...(ax.group_weight !== undefined ? { group_weight: ax.group_weight } : {}),
    };
  });

  const questions: EditorQuestion[] = (cfg.questions || []).map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options.map((o) => ({
      id: o.id,
      label: o.label,
      // Support both scores (internal) and weights (schema_v1)
      scores: { ...((o.scores || (o as unknown as { weights?: Record<string, number> }).weights) || {}) },
    })),
  }));

  const mode = cfg.mode || 'pair';
  const results: Record<string, { title: string; body: string; image_url?: string }> = {};
  let fallbackCode: string | undefined;

  if (mode === 'mbti') {
    for (const r of cfg.results || []) {
      if (r.code === cfg.fallback_result) fallbackCode = r.code;
      results[r.code] = { title: r.title, body: r.body, ...(r.image_url ? { image_url: r.image_url } : {}) };
    }
  } else {
    const totalResults = (cfg.results || []).length;
    for (const r of cfg.results || []) {
      const raw = r as unknown as {
        pair_key?: string;
        survival_display?: string;
        rank?: number;
        reason?: string;
      };

      // schema_v1: derive pair from pair_key, title from survival_display, body from rank+reason
      if (raw.pair_key && !r.pair) {
        const parts = raw.pair_key.split('|');
        if (parts.length === 2) {
          const title = raw.survival_display ? `เรารอดได้ ${raw.survival_display}` : r.title;
          const rankLine = raw.rank != null ? `อันดับที่ ${raw.rank} จาก ${totalResults} คู่\n\n` : '';
          const body = raw.reason ? `${rankLine}${raw.reason}` : r.body;
          results[pairKey(parts[0], parts[1])] = { title, body };
        }
        continue;
      }

      if (r.pair && r.pair.length === 2) {
        results[pairKey(r.pair[0], r.pair[1])] = {
          title: r.title,
          body: r.body,
          image_url: r.image_url,
        };
      }
    }
  }

  const fallbackResult = (cfg.results || []).find((r) => r.code === cfg.fallback_result && !r.pair) ||
    (cfg.results || []).find((r) => !r.pair) ||
    (cfg.results || []).find((r) => r.code === cfg.fallback_result);

  const fallback = fallbackResult
    ? { title: fallbackResult.title, body: fallbackResult.body }
    : { title: 'คู่หูสายกลาง', body: 'ไม่มีใครสุดทางไหน' };

  return {
    axes,
    questions,
    results,
    fallback,
    ...(fallbackCode !== undefined ? { fallbackCode } : {}),
    brand: { ...cfg.brand },
    copy: { ...(cfg.copy || {}) },
    rules: { ...(cfg.rules || { invite_ttl_hours: 48, require_friend: true, max_pairs_per_user_per_day: 5, allow_self_pair: false }) },
    messages: {
      invite_title: cfg.messages?.invite?.slots?.title || 'มาตอบควิซกัน',
      invite_cta: cfg.messages?.invite?.slots?.cta || 'ตอบเลย',
      partner_done_title: cfg.messages?.partner_done?.slots?.title || 'คู่หูตอบแล้ว',
    },
    mode,
    rewards: cfg.rewards ? { ...cfg.rewards } : undefined,
    group: cfg.group ? { ...cfg.group } : undefined,
    appearance: cfg.appearance ? { ...cfg.appearance } : undefined,
  };
}

export function editorStateToConfig(state: EditorState, campaignId: string, version: number): CampaignConfig {
  const axisIds = state.axes.map((a) => a.id);
  const resultsArray: CampaignConfig['results'] = [];

  if (state.mode === 'mbti') {
    for (const [code, r] of Object.entries(state.results)) {
      resultsArray.push({
        code,
        title: r.title,
        body: r.body,
        ...(r.image_url ? { image_url: r.image_url } : {}),
      });
    }
  } else {
    for (let i = 0; i < axisIds.length; i++) {
      for (let j = i; j < axisIds.length; j++) {
        const key = pairKey(axisIds[i], axisIds[j]);
        const r = state.results[key];
        if (r) {
          resultsArray.push({
            code: key.replace(/\|/g, '_'),
            pair: [axisIds[i], axisIds[j]],
            title: r.title,
            body: r.body,
            ...(r.image_url ? { image_url: r.image_url } : {}),
          });
        }
      }
    }

    resultsArray.push({
      code: 'balanced',
      title: state.fallback.title,
      body: state.fallback.body,
    });
  }

  const questions = state.questions.map((q, qi) => ({
    id: q.id || 'q_' + (qi + 1),
    text: q.text,
    options: q.options.map((o: EditorOption, oi: number) => ({
      id: o.id || (q.id || 'q_' + (qi + 1)) + '_' + String.fromCharCode(97 + oi),
      label: o.label,
      scores: { ...(o.scores || {}) },
    })),
  }));

  const messages: CampaignConfig['messages'] = state.mode === 'mbti'
    ? {
        welcome: {
          template: 'notify_v1',
          slots: { title: 'ยินดีต้อนรับ', body: '', cta: 'เริ่มเลย' },
        },
      }
    : {
        invite: {
          template: 'invite_v1',
          slots: {
            title: state.messages.invite_title,
            body: state.copy.intro_body || '',
            cta: state.messages.invite_cta,
          },
        },
        partner_done: {
          template: 'notify_v1',
          slots: {
            title: state.messages.partner_done_title,
            body: '',
            cta: 'ดูผลลัพธ์',
          },
        },
        welcome: {
          template: 'notify_v1',
          slots: { title: 'ยินดีต้อนรับ', body: '', cta: 'เริ่มเลย' },
        },
      };

  const fallbackResult = state.mode === 'mbti'
    ? (state.fallbackCode || Object.keys(state.results)[0] || 'fallback')
    : 'balanced';

  return {
    id: campaignId,
    type: state.group?.enabled ? 'group' : 'buddy_quiz',
    mode: state.mode,
    version,
    brand: { ...state.brand },
    copy: { ...state.copy },
    axes: state.axes.map((a) => ({
      id: a.id,
      label: a.label,
      ...(a.label_en  ? { label_en:  a.label_en  } : {}),
      ...(a.body      ? { body:      a.body      } : {}),
      ...(a.short     ? { short:     a.short     } : {}),
      ...(a.image_url ? { image_url: a.image_url } : {}),
      ...(a.order     ? { order:     a.order     } : {}),
      ...(a.poles     ? { poles:     a.poles     } : {}),
      ...(a.group_weight !== undefined ? { group_weight: a.group_weight } : {}),
    })),
    questions,
    results: resultsArray,
    fallback_result: fallbackResult,
    rules: { ...state.rules },
    ...(state.rewards ? { rewards: state.rewards } : {}),
    ...(state.group ? { group: state.group } : {}),
    ...(state.appearance ? { appearance: state.appearance } : {}),
    messages,
  };
}
