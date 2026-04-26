'use client';

const COLORS = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#3498db',
  '#9b59b6',
  '#1abc9c',
  '#e91e63',
];

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="color-picker">
      {COLORS.map((hex) => (
        <button
          key={hex}
          className={`color-swatch${value === hex ? ' selected' : ''}`}
          style={{ background: hex }}
          onClick={() => onChange(hex)}
          aria-label={hex}
        />
      ))}
    </div>
  );
}

export { COLORS };
