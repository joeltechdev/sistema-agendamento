'use client';

interface Props {
  time: string;
  isSelected: boolean;
  onSelect: (time: string) => void;
}

export default function TimeSlot({ time, isSelected, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`btn w-100 mb-2 shadow-sm ${isSelected ? 'btn-primary' : 'btn-outline-primary'}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(time)}
      aria-label={`Selecionar horário ${time}`}
    >
      {time}
    </button>
  );
}
