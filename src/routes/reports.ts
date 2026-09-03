/**
 * Reports API
 *
 * GET /api/reports/:campaignId          — per-campaign report JSON
 * GET /api/reports/:campaignId/export   — participant CSV (no PII)
 * GET /api/reports/oa/summary           — aggregate across all campaigns
 */

import { Router } from 'express';
import { db } from '../db/client.js';

export const reportsRouter = Router();

// ── Auth guard ────────────────────────────────────────────────────────
// Simple admin-key check reusing the same CRON_SECRET pattern used elsewhere.
function checkAdminAuth(req: import('express').Request, res: import('express').Response): boolean {
  const auth = req.headers['authorization'];
  const adminKey = process.env.ADMIN_REPORT_KEY || process.env.CRON_SECRET || 'dev-admin';
  if (auth !== `Bearer ${adminKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── Per-campaign report ───────────────────────────────────────────────

reportsRouter.get('/:campaignId', async (req, res, next) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const { campaignId } = req.params;

    // Campaign meta
    const { data: campaign, error: campErr } = await db()
      .from('campaigns')
      .select('id, type, status, starts_at, ends_at, created_at, current_version')
      .eq('id', campaignId)
      .single();

    if (campErr || !campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Funnel from events
    const { data: funnelRows } = await db()
      .from('events')
      .select('type')
      .eq('campaign_id', campaignId);

    const funnel = { opens: 0, starts: 0, completions: 0, pairs_done: 0, shares: 0, follows: 0 };
    for (const e of funnelRows ?? []) {
      switch (e.type) {
        case 'open':        funnel.opens++;        break;
        case 'quiz_start':  funnel.starts++;       break;
        case 'quiz_done':   funnel.completions++;  break;
        case 'pair_done':   funnel.pairs_done++;   break;
        case 'share_click': funnel.shares++;       break;
        case 'follow':      funnel.follows++;      break;
      }
    }

    // Participant stats
    const { data: participants } = await db()
      .from('participants')
      .select('status, result_id, source, invites_sent, invites_converted, referral_depth')
      .eq('campaign_id', campaignId);

    const totalParticipants = participants?.length ?? 0;
    const completed = participants?.filter(p => p.status === 'completed').length ?? 0;
    const dropped   = participants?.filter(p => p.status === 'dropped').length ?? 0;

    // Top results
    const resultCounts: Record<string, number> = {};
    for (const p of participants ?? []) {
      if (p.result_id) resultCounts[p.result_id] = (resultCounts[p.result_id] ?? 0) + 1;
    }
    const topResults = Object.entries(resultCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([resultId, count]) => ({ resultId, count, pct: totalParticipants > 0 ? Math.round(count / totalParticipants * 100) : 0 }));

    // Source breakdown
    const sourceCounts: Record<string, number> = {};
    for (const p of participants ?? []) {
      const src = p.source ?? 'organic';
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }

    // Viral metrics
    const totalInvitesSent = participants?.reduce((s, p) => s + (p.invites_sent ?? 0), 0) ?? 0;
    const totalInvitesConverted = participants?.reduce((s, p) => s + (p.invites_converted ?? 0), 0) ?? 0;
    const viralCoeff = totalParticipants > 0 ? totalInvitesSent / totalParticipants : 0;
    const inviteConversionRate = totalInvitesSent > 0 ? totalInvitesConverted / totalInvitesSent : 0;
    const maxDepth = participants?.reduce((m, p) => Math.max(m, p.referral_depth ?? 0), 0) ?? 0;

    // Daily trend (last 30 days from rollups)
    const { data: rollups } = await db()
      .from('daily_rollups')
      .select('date, opens, starts, completions, pairs_done, new_participants')
      .eq('campaign_id', campaignId)
      .eq('tier', 'all')
      .order('date', { ascending: false })
      .limit(30);

    // Pairs stats — exclude 'expired' (ลบออก / timeout)
    const { data: pairRows } = await db()
      .from('pairs')
      .select('status')
      .eq('campaign_id', campaignId)
      .neq('status', 'expired');                          // ไม่นับอันที่หมดอายุ

    const pairsTotal     = pairRows?.length ?? 0;
    const pairsCompleted = pairRows?.filter(p => p.status === 'completed').length ?? 0;
    const pairsWaiting   = pairRows?.filter(p => p.status === 'waiting').length ?? 0;

    // Groups stats
    const { data: groupRows } = await db()
      .from('groups')
      .select('id, status, locked_archetype_code, min_members, max_members')
      .eq('campaign_id', campaignId);

    const groupsTotal     = groupRows?.length ?? 0;
    const groupsCompleted = groupRows?.filter(g => g.locked_archetype_code != null).length ?? 0;
    const groupsActive    = groupRows?.filter(g => g.status === 'active' && g.locked_archetype_code == null).length ?? 0;

    res.json({
      campaignId,
      generatedAt: new Date().toISOString(),
      campaign: {
        status: campaign.status,
        startsAt: campaign.starts_at,
        endsAt: campaign.ends_at,
        createdAt: campaign.created_at,
      },
      funnel,
      participants: {
        total: totalParticipants,
        completed,
        dropped,
        completionRate: totalParticipants > 0 ? Math.round(completed / totalParticipants * 100) : 0,
      },
      pairs: {
        total: pairsTotal,
        completed: pairsCompleted,
        waiting: pairsWaiting,
        completionRate: pairsTotal > 0 ? Math.round(pairsCompleted / pairsTotal * 100) : 0,
      },
      groups: {
        total: groupsTotal,
        completed: groupsCompleted,
        active: groupsActive,
        completionRate: groupsTotal > 0 ? Math.round(groupsCompleted / groupsTotal * 100) : 0,
      },
      topResults,
      sourceBreakdown: sourceCounts,
      viral: {
        totalInvitesSent,
        totalInvitesConverted,
        viralCoefficient: Math.round(viralCoeff * 100) / 100,
        inviteConversionRate: Math.round(inviteConversionRate * 100) / 100,
        maxReferralDepth: maxDepth,
      },
      dailyTrend: (rollups ?? []).reverse(),
    });
  } catch (err) {
    next(err);
  }
});

// ── Participant CSV export (no PII) ───────────────────────────────────

reportsRouter.get('/:campaignId/export', async (req, res, next) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const { campaignId } = req.params;

    const { data: participants } = await db()
      .from('participants')
      .select('participant_hash, result_id, source, status, referral_depth, first_seen_at, last_seen_at, tags')
      .eq('campaign_id', campaignId)
      .order('first_seen_at', { ascending: false });

    const rows = participants ?? [];
    const header = 'participant_hash,result_id,source,status,referral_depth,first_seen_at,last_seen_at,tags';
    const lines = rows.map(p =>
      [
        p.participant_hash ?? '',
        p.result_id ?? '',
        p.source ?? 'organic',
        p.status ?? '',
        p.referral_depth ?? 0,
        p.first_seen_at ?? '',
        p.last_seen_at ?? '',
        JSON.stringify(p.tags ?? []).replace(/"/g, '""'),
      ].join(','),
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${campaignId}-participants.csv"`);
    res.send([header, ...lines].join('\n'));
  } catch (err) {
    next(err);
  }
});

// ── OA aggregate summary ──────────────────────────────────────────────

reportsRouter.get('/oa/summary', async (req, res, next) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    // All live/ended campaigns
    const { data: campaigns, error: campErr } = await db()
      .from('campaigns')
      .select('id, type, status, starts_at, ends_at, created_at')
      .in('status', ['live', 'ended'])
      .order('created_at', { ascending: false });

    if (campErr) throw campErr;

    const summary = await Promise.all(
      (campaigns ?? []).map(async (c) => {
        const { data: evts } = await db()
          .from('events')
          .select('type')
          .eq('campaign_id', c.id);

        const funnel = { opens: 0, starts: 0, completions: 0, pairs_done: 0, shares: 0 };
        for (const e of evts ?? []) {
          switch (e.type) {
            case 'open':        funnel.opens++;        break;
            case 'quiz_start':  funnel.starts++;       break;
            case 'quiz_done':   funnel.completions++;  break;
            case 'pair_done':   funnel.pairs_done++;   break;
            case 'share_click': funnel.shares++;       break;
          }
        }

        const { count: participantCount } = await db()
          .from('participants')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', c.id);

        const { count: completedCount } = await db()
          .from('participants')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', c.id)
          .eq('status', 'completed');

        return {
          campaignId: c.id,
          type: c.type,
          status: c.status,
          startsAt: c.starts_at,
          endsAt: c.ends_at,
          funnel,
          participants: participantCount ?? 0,
          completed: completedCount ?? 0,
          completionRate: participantCount
            ? Math.round((completedCount ?? 0) / participantCount * 100)
            : 0,
        };
      }),
    );

    // OA-level totals
    const totals = summary.reduce(
      (acc, c) => ({
        opens: acc.opens + c.funnel.opens,
        starts: acc.starts + c.funnel.starts,
        completions: acc.completions + c.funnel.completions,
        pairs_done: acc.pairs_done + c.funnel.pairs_done,
        shares: acc.shares + c.funnel.shares,
        participants: acc.participants + c.participants,
        completed: acc.completed + c.completed,
      }),
      { opens: 0, starts: 0, completions: 0, pairs_done: 0, shares: 0, participants: 0, completed: 0 },
    );

    res.json({
      generatedAt: new Date().toISOString(),
      campaignCount: summary.length,
      totals,
      campaigns: summary,
    });
  } catch (err) {
    next(err);
  }
});

// ── AI analysis ───────────────────────────────────────────────────────

reportsRouter.post('/:campaignId/analyze', async (req, res, next) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const { campaignId } = req.params;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
      return;
    }

    const [evtRes, partRes] = await Promise.all([
      db().from('events').select('type').eq('campaign_id', campaignId),
      db().from('participants').select('status, result_id, source, invites_sent, invites_converted, referral_depth').eq('campaign_id', campaignId),
    ]);

    const funnel = { opens: 0, starts: 0, completions: 0, pairs_done: 0, shares: 0 };
    for (const e of evtRes.data ?? []) {
      switch (e.type) {
        case 'open':        funnel.opens++;        break;
        case 'quiz_start':  funnel.starts++;       break;
        case 'quiz_done':   funnel.completions++;  break;
        case 'pair_done':   funnel.pairs_done++;   break;
        case 'share_click': funnel.shares++;       break;
      }
    }

    const parts = partRes.data ?? [];
    const total = parts.length;
    const completed = parts.filter(p => p.status === 'completed').length;
    const resultCounts: Record<string, number> = {};
    for (const p of parts) {
      if (p.result_id) resultCounts[p.result_id] = (resultCounts[p.result_id] ?? 0) + 1;
    }
    const topResults = Object.entries(resultCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const totalInvites = parts.reduce((s, p) => s + (p.invites_sent ?? 0), 0);
    const viralCoeff = total > 0 ? (totalInvites / total).toFixed(2) : '0';

    const prompt = `คุณคือผู้ช่วยวิเคราะห์ผลแคมเปญสำหรับทีมการตลาด กรุณาเขียนรายงานวิเคราะห์เป็นภาษาไทย สำหรับคนที่ไม่ใช่ผู้เชี่ยวชาญด้านเทคนิค

ข้อมูลแคมเปญ "${campaignId}":
- เปิดแคมเปญทั้งหมด: ${funnel.opens} ครั้ง
- เริ่มตอบคำถาม: ${funnel.starts} คน
- ตอบครบ: ${funnel.completions} คน
- จับคู่สำเร็จ: ${funnel.pairs_done} คู่
- แชร์: ${funnel.shares} ครั้ง
- ผู้เล่นที่ติดตาม (unique): ${total} คน
- จบกิจกรรมครบ: ${completed} คน (${total > 0 ? Math.round(completed / total * 100) : 0}%)
- อัตราการบอกต่อ: ${viralCoeff} คนต่อผู้เล่น 1 คน
- ผลลัพธ์ยอดนิยม: ${topResults.map(([id, n]) => `${id} (${n} คน)`).join(', ') || 'ยังไม่มีข้อมูล'}

กรุณาเขียน:
1. **สรุปภาพรวม** (2-3 ประโยค)
2. **จุดเด่น** ที่น่าสนใจ
3. **ข้อสังเกต** หรือสิ่งที่ควรปรับปรุง
4. **คำแนะนำ** สำหรับแคมเปญครั้งต่อไป

เขียนให้กระชับ อ่านง่าย ไม่ใช้ศัพท์เทคนิค`;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const analysis = result.response.text();
    res.json({ analysis, generatedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
