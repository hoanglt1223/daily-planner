import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Plus, Trash2, Music, Upload, List, Clock, GripVertical,
  Edit2, Disc,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useMusicControl } from '@/lib/music-control.tsx';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ─── Types ─── */

interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  fileData: string;
  fileType: string;
  order: number;
  playCount: number;
  lastPlayedAt: string | null;
}

interface MusicPlaylist {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  tracks: MusicTrack[];
  createdAt: string;
  updatedAt: string;
}

/* ─── Sortable Track Component ─── */

interface SortableTrackProps {
  track: MusicTrack;
  isPlaying: boolean;
  isCurrent: boolean;
  onPlay: (track: MusicTrack) => void;
  onDelete: (trackId: string) => void;
  onEdit: (track: MusicTrack) => void;
}

function SortableTrack({ track, isPlaying, isCurrent, onPlay, onDelete, onEdit }: SortableTrackProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group',
        isCurrent && 'border-primary/50 bg-primary/5'
      )}
      onClick={() => onPlay(track)}
    >
      <div
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{track.title}</p>
          {isPlaying && isCurrent && (
            <Badge variant="default" className="text-xs">Playing</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{track.artist || 'Unknown Artist'}</span>
          {track.album && <span>• {track.album}</span>}
          {track.playCount > 0 && (
            <span>• {track.playCount} plays</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(track);
          }}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(track.id);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export function MusicPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const musicControl = useMusicControl();

  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<MusicPlaylist | null>(null);
  const [currentTime] = useState(0);
  const [duration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<MusicPlaylist | null>(null);
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  const currentTrack = musicControl.currentTrack;
  const isPlaying = musicControl.isPlaying;
  const sharedCurrentPlaylist = musicControl.currentPlaylist;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /* ─── Data Loading ─── */

  const loadPlaylists = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/api/music') as MusicPlaylist[];
      setPlaylists(data);

      const defaultPlaylist = data.find((p: MusicPlaylist) => p.isDefault) || data[0];
      if (defaultPlaylist) {
        setCurrentPlaylist(defaultPlaylist);
      }
    } catch (error) {
      console.error('Failed to load playlists:', error);
      toast.error('Failed to load music playlists');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  /* ─── Audio Player Setup ─── */

  useEffect(() => {
    if (sharedCurrentPlaylist && sharedCurrentPlaylist.id !== currentPlaylist?.id) {
      setCurrentPlaylist(sharedCurrentPlaylist);
    }
  }, [sharedCurrentPlaylist, currentPlaylist]);

  /* ─── Playback Controls ─── */

  const playTrack = useCallback(async (track: MusicTrack) => {
    if (!currentPlaylist) return;

    try {
      await musicControl.playPlaylist(currentPlaylist);

      await apiFetch(`/api/music/${currentPlaylist.id}?action=play`, {
        method: 'POST',
        body: JSON.stringify({ trackId: track.id }),
      });
    } catch (error) {
      console.error('Failed to play track:', error);
      toast.error('Failed to play track');
    }
  }, [currentPlaylist, musicControl]);

  const togglePlayPause = useCallback(async () => {
    if (!currentTrack) return;

    if (isPlaying) {
      musicControl.pause();
    } else {
      await musicControl.resume();
    }
  }, [isPlaying, currentTrack, musicControl]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setVolume(volume);
      setIsMuted(false);
    } else {
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const playNext = useCallback(() => {
    if (currentPlaylist) {
      musicControl.playPlaylist(currentPlaylist);
    }
  }, [currentPlaylist, musicControl]);

  const playPrevious = useCallback(() => {
    if (currentPlaylist && currentPlaylist.tracks.length > 0) {
      musicControl.stop();
      setTimeout(() => {
        musicControl.playPlaylist(currentPlaylist);
      }, 100);
    }
  }, [currentPlaylist, musicControl]);

  /* ─── Playlist Management ─── */

  const createPlaylist = useCallback(async (name: string, description?: string) => {
    try {
      await apiFetch('/api/music', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      await loadPlaylists();
      setIsCreatingPlaylist(false);
      toast.success('Playlist created');
    } catch (error) {
      console.error('Failed to create playlist:', error);
      toast.error('Failed to create playlist');
    }
  }, [loadPlaylists]);

  const updatePlaylist = useCallback(async (playlist: MusicPlaylist, name: string, description?: string) => {
    try {
      await apiFetch(`/api/music/${playlist.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description }),
      });
      await loadPlaylists();
      setEditingPlaylist(null);
      toast.success('Playlist updated');
    } catch (error) {
      console.error('Failed to update playlist:', error);
      toast.error('Failed to update playlist');
    }
  }, [loadPlaylists]);

  const deletePlaylist = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/music/${id}`, { method: 'DELETE' });
      await loadPlaylists();
      if (currentPlaylist?.id === id) {
        setCurrentPlaylist(null);
        musicControl.stop();
      } else if (musicControl.currentPlaylist?.id === id) {
        musicControl.stop();
      }
      toast.success('Playlist deleted');
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      toast.error('Failed to delete playlist');
    }
  }, [loadPlaylists, currentPlaylist, musicControl]);

  /* ─── Track Management ─── */

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentPlaylist) return;

    const file = files[0];
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];

        await apiFetch(`/api/music/${currentPlaylist.id}?action=track`, {
          method: 'POST',
          body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, ''),
            fileData: base64,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        await loadPlaylists();
        toast.success('Track added');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload track:', error);
      toast.error('Failed to upload track');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [currentPlaylist, loadPlaylists]);

  const deleteTrack = useCallback(async (trackId: string) => {
    if (!currentPlaylist) return;

    try {
      await apiFetch(`/api/music/${currentPlaylist.id}?action=track&trackId=${trackId}`, {
        method: 'DELETE',
      });
      await loadPlaylists();
      if (currentTrack?.id === trackId) {
        musicControl.stop();
      }
      toast.success('Track removed');
    } catch (error) {
      console.error('Failed to delete track:', error);
      toast.error('Failed to remove track');
    }
  }, [currentPlaylist, loadPlaylists, currentTrack, musicControl]);

  const updateTrack = useCallback(async (track: MusicTrack, updates: Partial<MusicTrack>) => {
    if (!currentPlaylist) return;

    try {
      await apiFetch(`/api/music/${currentPlaylist.id}?action=track`, {
        method: 'PATCH',
        body: JSON.stringify({
          trackId: track.id,
          ...updates,
        }),
      });
      await loadPlaylists();
      setEditingTrack(null);
      toast.success('Track updated');
    } catch (error) {
      console.error('Failed to update track:', error);
      toast.error('Failed to update track');
    }
  }, [currentPlaylist, loadPlaylists]);

  /* ─── Drag and Drop ─── */

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !currentPlaylist) return;

    if (active.id !== over.id) {
      const oldIndex = currentPlaylist.tracks.findIndex((t) => t.id === active.id);
      const newIndex = currentPlaylist.tracks.findIndex((t) => t.id === over.id);

      const newTracks = arrayMove(currentPlaylist.tracks, oldIndex, newIndex);
      const updatedPlaylist = { ...currentPlaylist, tracks: newTracks };
      setCurrentPlaylist(updatedPlaylist);

      // Update track orders in database
      try {
        await Promise.all(
          newTracks.map((track, index) =>
            apiFetch(`/api/music/${currentPlaylist.id}?action=track`, {
              method: 'PATCH',
              body: JSON.stringify({
                trackId: track.id,
                order: index,
              }),
            })
          )
        );
        await loadPlaylists();
        toast.success('Track order updated');
      } catch (error) {
        console.error('Failed to update track order:', error);
        toast.error('Failed to update track order');
        await loadPlaylists();
      }
    }
  }, [currentPlaylist, loadPlaylists]);

  /* ─── Render ─── */

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center">
        <div className="text-center">
          <Disc className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading music library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Music Library</h1>
          <p className="text-sm text-muted-foreground">
            Manage your playlists and tracks. Drag tracks to reorder.
          </p>
        </div>
        <Button onClick={() => setIsCreatingPlaylist(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Playlist
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Playlist Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <List className="h-5 w-5" />
                Playlists
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors',
                    currentPlaylist?.id === playlist.id && 'bg-primary/10 border-primary/50'
                  )}
                  onClick={() => {
                    setCurrentPlaylist(playlist);
                    musicControl.stop();
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{playlist.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {playlist.tracks.length} tracks
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPlaylist(playlist);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlaylist(playlist.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {playlists.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No playlists yet</p>
                  <p className="text-xs">Create one to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Current Player */}
          {currentTrack && (
            <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  Now Playing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{currentTrack.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {currentTrack.artist || 'Unknown Artist'}
                    </p>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(currentTime)} / {formatTime(duration || 0)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={playPrevious}>
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="icon"
                      onClick={togglePlayPause}
                      className="h-10 w-10"
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={playNext}>
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={toggleMute}>
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-24 h-2 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Playlist */}
          {currentPlaylist ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{currentPlaylist.name}</CardTitle>
                    {currentPlaylist.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentPlaylist.description}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Add Track
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {currentPlaylist.tracks.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={currentPlaylist.tracks.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {currentPlaylist.tracks.map((track) => (
                          <SortableTrack
                            key={track.id}
                            track={track}
                            isPlaying={isPlaying}
                            isCurrent={currentTrack?.id === track.id}
                            onPlay={playTrack}
                            onDelete={deleteTrack}
                            onEdit={setEditingTrack}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No tracks in this playlist</p>
                    <p className="text-sm mt-1">Upload some music to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a playlist to view tracks</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Playlist Dialog */}
      {isCreatingPlaylist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Playlist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Playlist name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    if (target.value) {
                      createPlaylist(target.value);
                    }
                  }
                }}
              />
              <Textarea
                placeholder="Description (optional)"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreatingPlaylist(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const inputs = document.querySelectorAll('input, textarea');
                    const name = (inputs[0] as HTMLInputElement)?.value;
                    const desc = (inputs[1] as HTMLTextAreaElement)?.value;
                    if (name) createPlaylist(name, desc);
                  }}
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Playlist Dialog */}
      {editingPlaylist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Playlist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Playlist name"
                defaultValue={editingPlaylist.name}
                id="edit-playlist-name"
              />
              <Textarea
                placeholder="Description (optional)"
                rows={3}
                defaultValue={editingPlaylist.description || ''}
                id="edit-playlist-desc"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingPlaylist(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const name = (document.getElementById('edit-playlist-name') as HTMLInputElement)?.value;
                    const desc = (document.getElementById('edit-playlist-desc') as HTMLTextAreaElement)?.value;
                    if (name) updatePlaylist(editingPlaylist, name, desc);
                  }}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Track Dialog */}
      {editingTrack && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Track</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  defaultValue={editingTrack.title}
                  id="edit-track-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Artist</label>
                <Input
                  defaultValue={editingTrack.artist || ''}
                  id="edit-track-artist"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Album</label>
                <Input
                  defaultValue={editingTrack.album || ''}
                  id="edit-track-album"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingTrack(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const title = (document.getElementById('edit-track-title') as HTMLInputElement)?.value;
                    const artist = (document.getElementById('edit-track-artist') as HTMLInputElement)?.value || null;
                    const album = (document.getElementById('edit-track-album') as HTMLInputElement)?.value || null;
                    if (title) updateTrack(editingTrack, { title, artist, album });
                  }}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
