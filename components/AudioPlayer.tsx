'use client';

import { useEffect, useRef } from 'react';
import type { CanvasTrack } from '@/types';

interface Props {
  trackId: string | null;
  tracks: CanvasTrack[];
}

export default function AudioPlayer({ trackId, tracks }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 0.7;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!trackId) {
      audio.pause();
      return;
    }

    const track = tracks.find((t) => t.id === trackId);
    if (!track?.previewUrl) {
      audio.pause();
      return;
    }

    if (audio.src !== track.previewUrl) {
      audio.src = track.previewUrl;
    }

    audio.play().catch(() => {});

    return () => {
      audio.pause();
    };
  }, [trackId, tracks]);

  return null;
}
