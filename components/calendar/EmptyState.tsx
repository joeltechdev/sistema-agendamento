interface Props {
  message?: string;
}

export default function EmptyState({ message = 'Nenhum horário disponível para esta data.' }: Props) {
  return (
    <div className="text-center p-4 text-muted bg-light rounded border border-dashed" aria-live="polite">
      <i className="bi bi-calendar-x display-6 d-block mb-3"></i>
      <p className="mb-0">{message}</p>
    </div>
  );
}
