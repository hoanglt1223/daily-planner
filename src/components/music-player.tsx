import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Plus, Trash2, Music, Upload, List, Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useMusicControl } from '@/lib/music-control.tsx';

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

/* ─── Helper Functions ─── */

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* ─── Component ─── */

export function MusicPlayer() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const musicControl = useMusicControl();

  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<MusicPlaylist | null>(null);
  const [currentTime] = useState(0);
  const [duration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Use shared music control state
  const currentTrack = musicControl.currentTrack;
  const isPlaying = musicControl.isPlaying;
  const sharedCurrentPlaylist = musicControl.currentPlaylist;

  /* ─── Data Loading ─── */

  const loadPlaylists = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/api/music') as MusicPlaylist[];
      setPlaylists(data);

      // Set default playlist or first playlist
      const defaultPlaylist = data.find((p: MusicPlaylist) => p.isDefault) || data[0];
      if (defaultPlaylist) {
        setCurrentPlaylist(defaultPlaylist);
        setShowPlaylists(false);
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

  // Sync local state with shared music control
  useEffect(() => {
    if (sharedCurrentPlaylist && sharedCurrentPlaylist.id !== currentPlaylist?.id) {
      setCurrentPlaylist(sharedCurrentPlaylist);
    }
  }, [sharedCurrentPlaylist, currentPlaylist]);

  /* ─── Playback Controls ─── */

  const playTrack = useCallback(async (track: MusicTrack) => {
    if (!currentPlaylist) return;

    try {
      // Use shared music control
      await musicControl.playPlaylist(currentPlaylist);

      // Update play count
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

  const handleSeek = useCallback(() => {
    // Seeking is not supported in the shared audio control
    // This is a limitation of the shared control approach
    toast.info('Seeking not available in shared music mode');
  }, []);

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
    // The shared music control handles track progression automatically
    if (currentPlaylist) {
      musicControl.playPlaylist(currentPlaylist);
    }
  }, [currentPlaylist, musicControl]);

  const playPrevious = useCallback(() => {
    // Restart the current playlist from the beginning
    if (currentPlaylist && currentPlaylist.tracks.length > 0) {
      musicControl.stop();
      setTimeout(() => {
        musicControl.playPlaylist(currentPlaylist);
      }, 100);
    }
  }, [currentPlaylist, musicControl]);

  /* ─── Playlist Management ─── */

  const createPlaylist = useCallback(async () => {
    const name = prompt('Enter playlist name:');
    if (!name) return;

    try {
      await apiFetch('/api/music', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      await loadPlaylists();
      toast.success('Playlist created');
    } catch (error) {
      console.error('Failed to create playlist:', error);
      toast.error('Failed to create playlist');
    }
  }, [loadPlaylists]);

  const deletePlaylist = useCallback(async (id: string) => {
    if (!confirm('Delete this playlist and all its tracks?')) return;

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

  /* ─── Track Upload ─── */

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

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [currentPlaylist, loadPlaylists]);

  const deleteTrack = useCallback(async (trackId: string) => {
    if (!currentPlaylist || !confirm('Remove this track?')) return;

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

  /* ─── Render ─── */

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Music Player
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Music Player
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPlaylists(!showPlaylists)}
          >
            <List className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Playlist Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select
              value={currentPlaylist?.id || ''}
              onChange={(e) => {
                const playlist = playlists.find(p => p.id === e.target.value);
                if (playlist) {
                  setCurrentPlaylist(playlist);
                  // Stop any currently playing music
                  musicControl.stop();
                }
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} ({playlist.tracks.length})
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={createPlaylist}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {currentPlaylist && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deletePlaylist(currentPlaylist.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Current Track Info */}
        {currentTrack && (
          <div className="space-y-2">
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

            {/* Progress Bar */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 rounded-lg cursor-pointer"
            />

            {/* Controls */}
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

              {/* Volume Control */}
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
                  className="w-20 h-2 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Track List */}
        {currentPlaylist && currentPlaylist.tracks.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {currentPlaylist.tracks.map((track) => (
              <div
                key={track.id}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer',
                  currentTrack?.id === track.id && 'bg-accent'
                )}
                onClick={() => playTrack(track)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.artist || 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {track.playCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {track.playCount}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTrack(track.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={!currentPlaylist}
        >
          <Upload className="h-4 w-4 mr-2" />
          Add Track
        </Button>

        {/* Empty State */}
        {!currentPlaylist && (
          <div className="text-center text-sm text-muted-foreground">
            <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Select or create a playlist to get started</p>
          </div>
        )}

        {currentPlaylist && currentPlaylist.tracks.length === 0 && (
          <div className="text-center text-sm text-muted-foreground">
            <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No tracks yet. Upload some music to get started!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}