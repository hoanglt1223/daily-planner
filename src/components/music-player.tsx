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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/* ─── Component ─── */

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<MusicPlaylist | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => playNext();
    const handleError = () => {
      console.error('Audio error:', audio.error);
      toast.error('Error playing track');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [volume]);

  /* ─── Playback Controls ─── */

  const playTrack = useCallback(async (track: MusicTrack, index: number) => {
    if (!audioRef.current) return;

    try {
      const blob = base64ToBlob(track.fileData, track.fileType);
      const url = URL.createObjectURL(blob);

      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }

      audioRef.current.src = url;
      await audioRef.current.play();
      setIsPlaying(true);
      setCurrentTrack(track);
      setCurrentIndex(index);

      // Update play count
      if (currentPlaylist) {
        await apiFetch(`/api/music/${currentPlaylist.id}?action=play`, {
          method: 'POST',
          body: JSON.stringify({ trackId: track.id }),
        });
      }
    } catch (error) {
      console.error('Failed to play track:', error);
      toast.error('Failed to play track');
    }
  }, [currentPlaylist]);

  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, currentTrack]);

  const playNext = useCallback(() => {
    if (!currentPlaylist || currentPlaylist.tracks.length === 0) return;

    const nextIndex = (currentIndex + 1) % currentPlaylist.tracks.length;
    const nextTrack = currentPlaylist.tracks[nextIndex];
    playTrack(nextTrack, nextIndex);
  }, [currentPlaylist, currentIndex, playTrack]);

  const playPrevious = useCallback(() => {
    if (!currentPlaylist || currentPlaylist.tracks.length === 0) return;

    const prevIndex = currentIndex === 0 ? currentPlaylist.tracks.length - 1 : currentIndex - 1;
    const prevTrack = currentPlaylist.tracks[prevIndex];
    playTrack(prevTrack, prevIndex);
  }, [currentPlaylist, currentIndex, playTrack]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

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
        setCurrentTrack(null);
        setIsPlaying(false);
      }
      toast.success('Playlist deleted');
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      toast.error('Failed to delete playlist');
    }
  }, [loadPlaylists, currentPlaylist]);

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
        setCurrentTrack(null);
        setIsPlaying(false);
      }
      toast.success('Track removed');
    } catch (error) {
      console.error('Failed to delete track:', error);
      toast.error('Failed to remove track');
    }
  }, [currentPlaylist, loadPlaylists, currentTrack]);

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
                  setCurrentTrack(null);
                  setIsPlaying(false);
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
            {currentPlaylist.tracks.map((track, index) => (
              <div
                key={track.id}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer',
                  currentTrack?.id === track.id && 'bg-accent'
                )}
                onClick={() => playTrack(track, index)}
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