import type { VercelResponse } from '@vercel/node';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { musicPlaylists, musicTracks } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const id = req.query.id ? String(req.query.id) : null;
  const action = req.query.action ? String(req.query.action) : null;

  try {
    // === PLAYLISTS ===

    // GET all playlists
    if (req.method === 'GET' && !action && !id) {
      const playlists = await db.select().from(musicPlaylists).where(eq(musicPlaylists.userId, user.sub));
      const tracks = await db.select().from(musicTracks).where(eq(musicTracks.userId, user.sub));

      const playlistsTracks = playlists.map(playlist => ({
        ...playlist,
        tracks: tracks
          .filter(track => track.playlistId === playlist.id)
          .sort((a, b) => a.order - b.order)
      }));

      return res.status(200).json(playlistsTracks);
    }

    // POST create playlist
    if (req.method === 'POST' && !action && !id) {
      const body = req.body ?? {};
      if (!body.name) return res.status(400).json({ error: 'name_required' });

      const [playlist] = await db.insert(musicPlaylists).values({
        userId: user.sub,
        name: body.name,
        description: body.description ?? null,
        isDefault: body.isDefault ?? false,
      }).returning();

      return res.status(201).json(playlist);
    }

    // PATCH update playlist
    if (req.method === 'PATCH' && id && !action) {
      const body = req.body ?? {};
      const [playlist] = await db.update(musicPlaylists)
        .set({
          name: body.name,
          description: body.description,
          isDefault: body.isDefault,
          updatedAt: new Date(),
        })
        .where(and(eq(musicPlaylists.id, id), eq(musicPlaylists.userId, user.sub)))
        .returning();

      if (!playlist) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(playlist);
    }

    // DELETE playlist
    if (req.method === 'DELETE' && id && !action) {
      await db.delete(musicPlaylists).where(and(eq(musicPlaylists.id, id), eq(musicPlaylists.userId, user.sub)));
      return res.status(204).end();
    }

    // === TRACKS ===

    // POST add track to playlist
    if (req.method === 'POST' && action === 'track' && id) {
      const body = req.body ?? {};
      if (!body.title || !body.fileData) return res.status(400).json({ error: 'title_and_fileData_required' });

      // Get current max order for this playlist
      const existingTracks = await db.select().from(musicTracks)
        .where(eq(musicTracks.playlistId, id));
      const maxOrder = existingTracks.length > 0 ? Math.max(...existingTracks.map(t => t.order)) : -1;

      const [track] = await db.insert(musicTracks).values({
        playlistId: id,
        userId: user.sub,
        title: body.title,
        artist: body.artist ?? null,
        album: body.album ?? null,
        duration: body.duration ?? null,
        fileData: body.fileData,
        fileType: body.fileType ?? 'audio/mp3',
        fileSize: body.fileSize ?? null,
        order: maxOrder + 1,
      }).returning();

      return res.status(201).json(track);
    }

    // PATCH update track
    if (req.method === 'PATCH' && action === 'track' && id) {
      const body = req.body ?? {};
      const trackId = body.trackId;
      if (!trackId) return res.status(400).json({ error: 'trackId_required' });

      const [track] = await db.update(musicTracks)
        .set({
          title: body.title,
          artist: body.artist,
          album: body.album,
          order: body.order,
          playCount: body.playCount,
        })
        .where(and(
          eq(musicTracks.id, trackId),
          eq(musicTracks.playlistId, id),
          eq(musicTracks.userId, user.sub)
        ))
        .returning();

      if (!track) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(track);
    }

    // DELETE track
    if (req.method === 'DELETE' && action === 'track' && id) {
      const trackId = req.query.trackId ? String(req.query.trackId) : null;
      if (!trackId) return res.status(400).json({ error: 'trackId_required' });

      await db.delete(musicTracks).where(and(
        eq(musicTracks.id, trackId),
        eq(musicTracks.playlistId, id),
        eq(musicTracks.userId, user.sub)
      ));

      return res.status(204).end();
    }

    // POST update play count and last played
    if (req.method === 'POST' && action === 'play' && id) {
      const body = req.body ?? {};
      const trackId = body.trackId;
      if (!trackId) return res.status(400).json({ error: 'trackId_required' });

      // First get current play count
      const [existingTrack] = await db.select().from(musicTracks)
        .where(and(
          eq(musicTracks.id, trackId),
          eq(musicTracks.playlistId, id),
          eq(musicTracks.userId, user.sub)
        ));

      if (!existingTrack) return res.status(404).json({ error: 'not_found' });

      // Then update with incremented count
      const [track] = await db.update(musicTracks)
        .set({
          playCount: (existingTrack.playCount || 0) + 1,
          lastPlayedAt: new Date(),
        })
        .where(and(
          eq(musicTracks.id, trackId),
          eq(musicTracks.playlistId, id),
          eq(musicTracks.userId, user.sub)
        ))
        .returning();

      return res.status(200).json(track);
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}