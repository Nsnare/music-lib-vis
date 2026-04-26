export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  previewUrl: string | null;
}

export interface CanvasTrack extends SpotifyTrack {
  x: number;
  y: number;
}

export interface Cluster {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface Membership {
  trackId: string;
  clusterId: string;
}

export interface LayoutData {
  tracks: Array<{ id: string; x: number; y: number }>;
  clusters: Cluster[];
  memberships: Membership[];
}
