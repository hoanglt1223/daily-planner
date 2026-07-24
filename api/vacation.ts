import type { VercelResponse } from '@vercel/node';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { timeBlocks, users } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res);
  if (!me) return;

  const action = String(req.query.action || '');

  try {
    // GET vacation status and balance
    if (req.method === 'GET' && action === 'status') {
      const user = await db.select().from(users).where(eq(users.id, me.sub)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ error: 'user_not_found' });
      }

      const userData = user[0];

      // Get current year's vacation blocks
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

      const vacationBlocks = await db.select().from(timeBlocks).where(and(
        eq(timeBlocks.userId, me.sub),
        eq(timeBlocks.isVacation, true),
        gte(timeBlocks.startAt, yearStart),
        lte(timeBlocks.startAt, yearEnd)
      )).orderBy(desc(timeBlocks.startAt));

      return res.status(200).json({
        vacationDaysAvailable: userData.vacationDaysAvailable,
        vacationDaysUsed: userData.vacationDaysUsed,
        vacationDaysAccrualRate: userData.vacationDaysAccrualRate,
        vacationAccrualLastReset: userData.vacationAccrualLastReset,
        vacationBlocks
      });
    }

    // POST create vacation request (time block)
    if (req.method === 'POST' && action === 'request') {
      const { title, startAt, endAt, note } = req.body || {};

      if (!title || !startAt || !endAt) {
        return res.status(400).json({ error: 'missing_required_fields' });
      }

      const startDate = new Date(startAt);
      const endDate = new Date(endAt);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'invalid_dates' });
      }

      // Calculate vacation days (8 hours = 1 day)
      const totalHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      const vacationDays = Math.round(totalHours / 8 * 10) / 10; // Round to 1 decimal

      // Get current user balance
      const userResult = await db.select().from(users).where(eq(users.id, me.sub)).limit(1);
      if (userResult.length === 0) {
        return res.status(404).json({ error: 'user_not_found' });
      }

      const userData = userResult[0];

      if (userData.vacationDaysAvailable < vacationDays) {
        return res.status(400).json({
          error: 'insufficient_balance',
          available: userData.vacationDaysAvailable,
          requested: vacationDays
        });
      }

      // Create vacation time block
      const [newBlock] = await db.insert(timeBlocks).values({
        userId: me.sub,
        taskId: null,
        title,
        startAt: startDate,
        endAt: endDate,
        status: 'planned',
        isVacation: true,
        note: note || null
      }).returning();

      // Update user balance
      await db.update(users)
        .set({
          vacationDaysAvailable: userData.vacationDaysAvailable - vacationDays,
          vacationDaysUsed: userData.vacationDaysUsed + vacationDays
        })
        .where(eq(users.id, me.sub));

      return res.status(201).json({
        ...newBlock,
        vacationDays,
        newBalance: userData.vacationDaysAvailable - vacationDays
      });
    }

    // PATCH update vacation balance (admin/manual adjustment)
    if (req.method === 'PATCH' && action === 'balance') {
      const { vacationDaysAvailable, vacationDaysUsed } = req.body || {};

      if (typeof vacationDaysAvailable !== 'number' && typeof vacationDaysUsed !== 'number') {
        return res.status(400).json({ error: 'invalid_balance_values' });
      }

      const updateData: any = {};
      if (typeof vacationDaysAvailable === 'number') {
        updateData.vacationDaysAvailable = vacationDaysAvailable;
      }
      if (typeof vacationDaysUsed === 'number') {
        updateData.vacationDaysUsed = vacationDaysUsed;
      }

      const [updated] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, me.sub))
        .returning();

      return res.status(200).json(updated);
    }

    // DELETE cancel vacation request
    if (req.method === 'DELETE' && req.query.id) {
      const blockId = String(req.query.id);

      const blockResult = await db.select().from(timeBlocks).where(
        eq(timeBlocks.id, blockId)
      ).limit(1);

      if (blockResult.length === 0) {
        return res.status(404).json({ error: 'block_not_found' });
      }

      const block = blockResult[0];

      if (block.userId !== me.sub) {
        return res.status(403).json({ error: 'forbidden' });
      }

      if (!block.isVacation) {
        return res.status(400).json({ error: 'not_vacation_block' });
      }

      // Calculate days to refund
      const totalHours = (block.endAt.getTime() - block.startAt.getTime()) / (1000 * 60 * 60);
      const vacationDays = Math.round(totalHours / 8 * 10) / 10;

      // Get current user balance
      const userResult = await db.select().from(users).where(eq(users.id, me.sub)).limit(1);
      const userData = userResult[0];

      // Delete block and refund balance
      await db.delete(timeBlocks).where(eq(timeBlocks.id, blockId));

      await db.update(users)
        .set({
          vacationDaysAvailable: userData.vacationDaysAvailable + vacationDays,
          vacationDaysUsed: Math.max(0, userData.vacationDaysUsed - vacationDays)
        })
        .where(eq(users.id, me.sub));

      return res.status(200).json({
        deleted: blockId,
        vacationDaysRefunded: vacationDays,
        newBalance: userData.vacationDaysAvailable + vacationDays
      });
    }

    return res.status(404).json({ error: 'unknown_action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}
