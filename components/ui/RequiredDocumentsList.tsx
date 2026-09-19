import React from 'react';
import { AppointmentType } from '@/types/institutional';
import { getRequiredDocuments, getSystemSettings } from '@/services/institutionalService';

interface Props {
  appointmentType: AppointmentType;
}

export default async function RequiredDocumentsList({ appointmentType }: Props) {
  const documents = await getRequiredDocuments(appointmentType);
  const settings = await getSystemSettings(['second_issue_warning']);
  
  if (!documents || documents.length === 0) {
    return (
      <div className="alert alert-warning" role="alert">
        Nenhum documento encontrado ou serviço indisponível.
      </div>
    );
  }

  return (
    <div className="mb-4">
      {appointmentType === 'second_issue' && settings['second_issue_warning'] && (
        <div className="alert alert-danger shadow-sm mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {settings['second_issue_warning']}
        </div>
      )}

      <h3 className="h5 mb-3">
        Documentos Exigidos ({appointmentType === 'first_issue' ? '1ª Via' : '2ª Via'})
      </h3>
      
      <ul className="list-group shadow-sm">
        {documents.map((doc) => (
          <li key={doc.id} className="list-group-item d-flex justify-content-between align-items-start">
            <div className="ms-2 me-auto">
              <div className="fw-bold">{doc.document_name}</div>
              {doc.description && (
                <small className="text-muted">{doc.description}</small>
              )}
            </div>
            <i className="bi bi-check-circle-fill text-success mt-1"></i>
          </li>
        ))}
      </ul>
    </div>
  );
}
