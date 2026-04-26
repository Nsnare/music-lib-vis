'use client';

import { initiateLogin } from '@/lib/spotify';

export default function LoginScreen() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Music Library Visualizer</h1>
        <p>Arrange your Spotify saved tracks on a freeform canvas using colored clusters.</p>
        <button className="login-btn" onClick={initiateLogin}>
          Connect with Spotify
        </button>
      </div>
    </div>
  );
}
