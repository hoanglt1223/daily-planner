import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

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

interface MusicControlContextType {
  playPlaylist: (playlist: MusicPlaylist) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  currentPlaylist: MusicPlaylist | null;
  currentTrack: MusicTrack | null;
}

const MusicControlContext = createContext<MusicControlContextType | null>(null);

export function MusicControlProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playNextRef = useRef<(() => void) | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<MusicPlaylist | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 0.7;

      audioRef.current.addEventListener('ended', () => {
        playNextRef.current?.();
      });

      audioRef.current.addEventListener('error', () => {
        console.error('Audio error');
        setIsPlaying(false);
        toast.error('Error playing track');
      });
    }
  }, []);

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const playTrack = useCallback(async (track: MusicTrack, playlist: MusicPlaylist, index: number) => {
    if (!audioRef.current || playlist.tracks.length === 0) return;

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
      setCurrentPlaylist(playlist);
      setCurrentIndex(index);
    } catch (error) {
      console.error('Failed to play track:', error);
      toast.error('Failed to play track');
    }
  }, []);

  const playNextTrack = useCallback(() => {
    if (!currentPlaylist || currentPlaylist.tracks.length === 0) return;
    const nextIndex = (currentIndex + 1) % currentPlaylist.tracks.length;
    const nextTrack = currentPlaylist.tracks[nextIndex];
    playTrack(nextTrack, currentPlaylist, nextIndex);
  }, [currentPlaylist, currentIndex, playTrack]);

  // Store the playNext function in ref for event listeners
  useEffect(() => {
    playNextRef.current = playNextTrack;
  }, [playNextTrack]);

  const playPlaylist = useCallback(async (playlist: MusicPlaylist) => {
    if (!playlist || playlist.tracks.length === 0) {
      toast.error('Playlist is empty');
      return;
    }

    // If already playing this playlist, do nothing
    if (currentPlaylist?.id === playlist.id && isPlaying) {
      return;
    }

    // Start from first track or continue if same playlist
    const startIndex = currentPlaylist?.id === playlist.id ? currentIndex : 0;
    const startTrack = playlist.tracks[startIndex];
    await playTrack(startTrack, playlist, startIndex);
  }, [currentPlaylist, isPlaying, currentIndex, playTrack]);

  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const resume = useCallback(async () => {
    if (audioRef.current && currentTrack && !isPlaying) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to resume:', error);
        toast.error('Failed to resume playback');
      }
    }
  }, [isPlaying, currentTrack]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
      }
      setIsPlaying(false);
      setCurrentTrack(null);
      setCurrentPlaylist(null);
      setCurrentIndex(0);
    }
  }, []);

  return (
    <MusicControlContext.Provider
      value={{
        playPlaylist,
        pause,
        resume,
        stop,
        isPlaying,
        currentPlaylist,
        currentTrack,
      }}
    >
      {children}
    </MusicControlContext.Provider>
  );
}

export function useMusicControl() {
  const context = useContext(MusicControlContext);
  if (!context) {
    throw new Error('useMusicControl must be used within MusicControlProvider');
  }
  return context;
}