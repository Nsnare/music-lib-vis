'use client';

import { useState } from 'react';
import ColorPicker, { COLORS } from './ColorPicker';

interface Props {
  onConfirm: (name: string, color: string) => void;
  onClose: () => void;
}

export default function ClusterCreateModal({ onConfirm, onClose }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, color);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>New Cluster</h2>

        <label htmlFor="cluster-name">Name</label>
        <input
          id="cluster-name"
          type="text"
          placeholder="e.g. Late Night"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          autoFocus
        />

        <label>Color</label>
        <ColorPicker value={color} onChange={setColor} />

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-confirm" onClick={handleConfirm} disabled={!name.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
