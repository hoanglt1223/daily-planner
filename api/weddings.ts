import type { VercelResponse } from '@vercel/node';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { weddings, weddingContacts, weddingEmergencyPlans, weddingChecklist } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';
import { nanoid } from 'nanoid';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || 'list';
  const id = url.searchParams.get('id');

  if (action === 'list') {
    return listWeddings(req, res, user.sub);
  } else if (action === 'create') {
    return createWedding(req, res, user.sub);
  } else if (action === 'update' && id) {
    return updateWedding(req, res, id, user.sub);
  } else if (action === 'delete' && id) {
    return deleteWedding(req, res, id, user.sub);
  } else if (action === 'get' && id) {
    return getWedding(req, res, id, user.sub);
  } else if (action === 'contact-list' && id) {
    return listContacts(req, res, id);
  } else if (action === 'contact-create' && id) {
    return createContact(req, res, id);
  } else if (action === 'contact-update' && url.searchParams.get('contactId')) {
    return updateContact(req, res, url.searchParams.get('contactId')!);
  } else if (action === 'contact-delete' && url.searchParams.get('contactId')) {
    return deleteContact(req, res, url.searchParams.get('contactId')!);
  } else if (action === 'emergency-list' && id) {
    return listEmergencyPlans(req, res, id);
  } else if (action === 'emergency-create' && id) {
    return createEmergencyPlan(req, res, id);
  } else if (action === 'emergency-update' && url.searchParams.get('planId')) {
    return updateEmergencyPlan(req, res, url.searchParams.get('planId')!);
  } else if (action === 'emergency-delete' && url.searchParams.get('planId')) {
    return deleteEmergencyPlan(req, res, url.searchParams.get('planId')!);
  } else if (action === 'checklist-list' && id) {
    return listChecklist(req, res, id);
  } else if (action === 'checklist-create' && id) {
    return createChecklist(req, res, id);
  } else if (action === 'checklist-update' && url.searchParams.get('checklistId')) {
    return updateChecklist(req, res, url.searchParams.get('checklistId')!);
  } else if (action === 'checklist-delete' && url.searchParams.get('checklistId')) {
    return deleteChecklist(req, res, url.searchParams.get('checklistId')!);
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }
}

async function listWeddings(req: AuthedRequest, res: VercelResponse, userId: string) {
  try {
    const userWeddings = await db.query.weddings.findMany({
      where: eq(weddings.userId, userId),
      orderBy: [desc(weddings.weddingDate)],
    });

    const weddingWithCounts = await Promise.all(
      userWeddings.map(async (wedding) => {
        const [contacts, emergencyPlans, checklistItems] = await Promise.all([
          db.query.weddingContacts.findMany({
            where: eq(weddingContacts.weddingId, wedding.id),
          }),
          db.query.weddingEmergencyPlans.findMany({
            where: eq(weddingEmergencyPlans.weddingId, wedding.id),
          }),
          db.query.weddingChecklist.findMany({
            where: eq(weddingChecklist.weddingId, wedding.id),
          }),
        ]);

        const completedChecklist = checklistItems.filter(item => item.completed).length;

        return {
          ...wedding,
          counts: {
            contacts: contacts.length,
            emergencyPlans: emergencyPlans.length,
            checklistTotal: checklistItems.length,
            checklistCompleted: completedChecklist,
          },
          daysUntilWedding: Math.ceil((new Date(wedding.weddingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        };
      })
    );

    return res.status(200).json(weddingWithCounts);
  } catch (error) {
    console.error('Error fetching weddings:', error);
    return res.status(500).json({ error: 'Failed to fetch weddings' });
  }
}

async function getWedding(req: AuthedRequest, res: VercelResponse, id: string, userId: string) {
  try {
    const wedding = await db.query.weddings.findFirst({
      where: and(eq(weddings.id, id), eq(weddings.userId, userId)),
    });

    if (!wedding) {
      return res.status(404).json({ error: 'Wedding not found' });
    }

    const [contacts, emergencyPlans, checklistItems] = await Promise.all([
      db.query.weddingContacts.findMany({
        where: eq(weddingContacts.weddingId, id),
      }),
      db.query.weddingEmergencyPlans.findMany({
        where: eq(weddingEmergencyPlans.weddingId, id),
      }),
      db.query.weddingChecklist.findMany({
        where: eq(weddingChecklist.weddingId, id),
        orderBy: [weddingChecklist.priority, weddingChecklist.category],
      }),
    ]);

    return res.status(200).json({
      ...wedding,
      contacts,
      emergencyPlans,
      checklist: checklistItems,
      daysUntilWedding: Math.ceil((new Date(wedding.weddingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    });
  } catch (error) {
    console.error('Error fetching wedding:', error);
    return res.status(500).json({ error: 'Failed to fetch wedding' });
  }
}

async function createWedding(req: AuthedRequest, res: VercelResponse, userId: string) {
  try {
    const body = req.body ?? {};
    const { partnerName, weddingDate, venueName, venueAddress, guestCount, budget, notes } = body;

    if (!partnerName || !weddingDate || !venueName) {
      return res.status(400).json({ error: 'Partner name, wedding date, and venue name are required' });
    }

    const newWedding = await db.insert(weddings).values({
      id: nanoid(),
      userId,
      partnerName: partnerName.trim(),
      weddingDate: new Date(weddingDate),
      venueName: venueName.trim(),
      venueAddress: venueAddress?.trim() || null,
      guestCount: guestCount || null,
      budget: budget || null,
      notes: notes?.trim() || null,
      status: 'planning',
      stressLevel: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return res.status(201).json(newWedding[0]);
  } catch (error) {
    console.error('Error creating wedding:', error);
    return res.status(500).json({ error: 'Failed to create wedding' });
  }
}

async function updateWedding(req: AuthedRequest, res: VercelResponse, id: string, userId: string) {
  try {
    const body = req.body ?? {};
    const { partnerName, weddingDate, venueName, venueAddress, guestCount, budget, status, stressLevel, notes } = body;

    const existing = await db.query.weddings.findFirst({
      where: and(eq(weddings.id, id), eq(weddings.userId, userId)),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Wedding not found' });
    }

    const updated = await db.update(weddings)
      .set({
        partnerName: partnerName?.trim() || existing.partnerName,
        weddingDate: weddingDate ? new Date(weddingDate) : existing.weddingDate,
        venueName: venueName?.trim() || existing.venueName,
        venueAddress: venueAddress !== undefined ? venueAddress?.trim() : existing.venueAddress,
        guestCount: guestCount !== undefined ? guestCount : existing.guestCount,
        budget: budget !== undefined ? budget : existing.budget,
        status: status || existing.status,
        stressLevel: stressLevel !== undefined ? stressLevel : existing.stressLevel,
        notes: notes !== undefined ? notes?.trim() : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(weddings.id, id))
      .returning();

    return res.status(200).json(updated[0]);
  } catch (error) {
    console.error('Error updating wedding:', error);
    return res.status(500).json({ error: 'Failed to update wedding' });
  }
}

async function deleteWedding(req: AuthedRequest, res: VercelResponse, id: string, userId: string) {
  try {
    const existing = await db.query.weddings.findFirst({
      where: and(eq(weddings.id, id), eq(weddings.userId, userId)),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Wedding not found' });
    }

    await db.delete(weddings).where(eq(weddings.id, id));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting wedding:', error);
    return res.status(500).json({ error: 'Failed to delete wedding' });
  }
}

async function listContacts(req: AuthedRequest, res: VercelResponse, weddingId: string) {
  try {
    const contacts = await db.query.weddingContacts.findMany({
      where: eq(weddingContacts.weddingId, weddingId),
      orderBy: [weddingContacts.role],
    });

    return res.status(200).json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return res.status(500).json({ error: 'Failed to fetch contacts' });
  }
}

async function createContact(req: AuthedRequest, res: VercelResponse, weddingId: string) {
  try {
    const body = req.body ?? {};
    const { role, name, company, phone, email, notes, backupContact, hasBackup } = body;

    if (!role || !name || !phone) {
      return res.status(400).json({ error: 'Role, name, and phone are required' });
    }

    const newContact = await db.insert(weddingContacts).values({
      id: nanoid(),
      weddingId,
      role,
      name: name.trim(),
      company: company?.trim() || null,
      phone: phone.trim(),
      email: email?.trim() || null,
      notes: notes?.trim() || null,
      backupContact: backupContact?.trim() || null,
      hasBackup: hasBackup || false,
      confirmed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return res.status(201).json(newContact[0]);
  } catch (error) {
    console.error('Error creating contact:', error);
    return res.status(500).json({ error: 'Failed to create contact' });
  }
}

async function updateContact(req: AuthedRequest, res: VercelResponse, contactId: string) {
  try {
    const body = req.body ?? {};
    const { role, name, company, phone, email, notes, backupContact, hasBackup, confirmed } = body;

    const updated = await db.update(weddingContacts)
      .set({
        role: role || undefined,
        name: name?.trim(),
        company: company !== undefined ? company?.trim() : undefined,
        phone: phone?.trim(),
        email: email !== undefined ? email?.trim() : undefined,
        notes: notes !== undefined ? notes?.trim() : undefined,
        backupContact: backupContact !== undefined ? backupContact?.trim() : undefined,
        hasBackup: hasBackup !== undefined ? hasBackup : undefined,
        confirmed: confirmed !== undefined ? confirmed : undefined,
        updatedAt: new Date(),
      })
      .where(eq(weddingContacts.id, contactId))
      .returning();

    return res.status(200).json(updated[0]);
  } catch (error) {
    console.error('Error updating contact:', error);
    return res.status(500).json({ error: 'Failed to update contact' });
  }
}

async function deleteContact(req: AuthedRequest, res: VercelResponse, contactId: string) {
  try {
    await db.delete(weddingContacts).where(eq(weddingContacts.id, contactId));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return res.status(500).json({ error: 'Failed to delete contact' });
  }
}

async function listEmergencyPlans(req: AuthedRequest, res: VercelResponse, weddingId: string) {
  try {
    const plans = await db.query.weddingEmergencyPlans.findMany({
      where: eq(weddingEmergencyPlans.weddingId, weddingId),
      orderBy: [weddingEmergencyPlans.priority, weddingEmergencyPlans.scenario],
    });

    return res.status(200).json(plans);
  } catch (error) {
    console.error('Error fetching emergency plans:', error);
    return res.status(500).json({ error: 'Failed to fetch emergency plans' });
  }
}

async function createEmergencyPlan(req: AuthedRequest, res: VercelResponse, weddingId: string) {
  try {
    const body = req.body ?? {};
    const { scenario, title, steps, contacts, supplies, priority } = body;

    if (!scenario || !title || !steps || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'Scenario, title, and steps are required' });
    }

    const newPlan = await db.insert(weddingEmergencyPlans).values({
      id: nanoid(),
      weddingId,
      scenario,
      title: title.trim(),
      steps,
      contacts: contacts || [],
      supplies: supplies || [],
      priority: priority || 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return res.status(201).json(newPlan[0]);
  } catch (error) {
    console.error('Error creating emergency plan:', error);
    return res.status(500).json({ error: 'Failed to create emergency plan' });
  }
}

async function updateEmergencyPlan(req: AuthedRequest, res: VercelResponse, planId: string) {
  try {
    const body = req.body ?? {};
    const { scenario, title, steps, contacts, supplies, priority } = body;

    const updated = await db.update(weddingEmergencyPlans)
      .set({
        scenario: scenario || undefined,
        title: title?.trim(),
        steps: steps || undefined,
        contacts: contacts !== undefined ? contacts : undefined,
        supplies: supplies !== undefined ? supplies : undefined,
        priority: priority !== undefined ? priority : undefined,
        updatedAt: new Date(),
      })
      .where(eq(weddingEmergencyPlans.id, planId))
      .returning();

    return res.status(200).json(updated[0]);
  } catch (error) {
    console.error('Error updating emergency plan:', error);
    return res.status(500).json({ error: 'Failed to update emergency plan' });
  }
}

async function deleteEmergencyPlan(req: AuthedRequest, res: VercelResponse, planId: string) {
  try {
    await db.delete(weddingEmergencyPlans).where(eq(weddingEmergencyPlans.id, planId));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting emergency plan:', error);
    return res.status(500).json({ error: 'Failed to delete emergency plan' });
  }
}

async function listChecklist(req: AuthedRequest, res: VercelResponse, weddingId: string) {
  try {
    const checklist = await db.query.weddingChecklist.findMany({
      where: eq(weddingChecklist.weddingId, weddingId),
      orderBy: [weddingChecklist.category, weddingChecklist.priority],
    });

    return res.status(200).json(checklist);
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return res.status(500).json({ error: 'Failed to fetch checklist' });
  }
}

async function createChecklist(req: AuthedRequest, res: VercelResponse, weddingId: string) {
  try {
    const body = req.body ?? {};
    const { category, task, priority, assignee, notes } = body;

    if (!category || !task) {
      return res.status(400).json({ error: 'Category and task are required' });
    }

    const newItem = await db.insert(weddingChecklist).values({
      id: nanoid(),
      weddingId,
      category,
      task: task.trim(),
      priority: priority || 3,
      assignee: assignee?.trim() || null,
      notes: notes?.trim() || null,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return res.status(201).json(newItem[0]);
  } catch (error) {
    console.error('Error creating checklist item:', error);
    return res.status(500).json({ error: 'Failed to create checklist item' });
  }
}

async function updateChecklist(req: AuthedRequest, res: VercelResponse, checklistId: string) {
  try {
    const body = req.body ?? {};
    const { category, task, priority, assignee, notes, completed } = body;

    const updated = await db.update(weddingChecklist)
      .set({
        category: category || undefined,
        task: task?.trim(),
        priority: priority !== undefined ? priority : undefined,
        assignee: assignee !== undefined ? assignee?.trim() : undefined,
        notes: notes !== undefined ? notes?.trim() : undefined,
        completed: completed !== undefined ? completed : undefined,
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(weddingChecklist.id, checklistId))
      .returning();

    return res.status(200).json(updated[0]);
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return res.status(500).json({ error: 'Failed to update checklist item' });
  }
}

async function deleteChecklist(req: AuthedRequest, res: VercelResponse, checklistId: string) {
  try {
    await db.delete(weddingChecklist).where(eq(weddingChecklist.id, checklistId));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return res.status(500).json({ error: 'Failed to delete checklist item' });
  }
}