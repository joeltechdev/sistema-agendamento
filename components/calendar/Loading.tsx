export default function Loading() {
  return (
    <div className="d-flex justify-content-center align-items-center p-5" aria-live="polite">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Carregando disponibilidade...</span>
      </div>
    </div>
  );
}
