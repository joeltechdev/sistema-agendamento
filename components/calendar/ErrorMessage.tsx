interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message = 'Ocorreu um erro ao carregar o calendário.', onRetry }: Props) {
  return (
    <div className="alert alert-danger text-center shadow-sm" role="alert" aria-live="assertive">
      <i className="bi bi-exclamation-octagon-fill me-2"></i>
      {message}
      {onRetry && (
        <div className="mt-3">
          <button onClick={onRetry} className="btn btn-outline-danger btn-sm">Tentar Novamente</button>
        </div>
      )}
    </div>
  );
}
