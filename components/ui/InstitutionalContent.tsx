import React from 'react';
import { getSystemSettings } from '@/services/institutionalService';

export default async function InstitutionalContent() {
  const settings = await getSystemSettings(['privacy_policy', 'terms_of_service']);

  return (
    <div className="accordion mt-4 shadow-sm" id="institutionalAccordion">
      <div className="accordion-item">
        <h2 className="accordion-header" id="headingPrivacy">
          <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePrivacy" aria-expanded="false" aria-controls="collapsePrivacy">
            <i className="bi bi-shield-lock me-2"></i> Política de Privacidade
          </button>
        </h2>
        <div id="collapsePrivacy" className="accordion-collapse collapse" aria-labelledby="headingPrivacy" data-bs-parent="#institutionalAccordion">
          <div className="accordion-body text-muted">
            {settings['privacy_policy'] || 'Informação não disponível no momento.'}
          </div>
        </div>
      </div>
      
      <div className="accordion-item">
        <h2 className="accordion-header" id="headingTerms">
          <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTerms" aria-expanded="false" aria-controls="collapseTerms">
            <i className="bi bi-file-earmark-text me-2"></i> Termos de Ciência e Serviço
          </button>
        </h2>
        <div id="collapseTerms" className="accordion-collapse collapse" aria-labelledby="headingTerms" data-bs-parent="#institutionalAccordion">
          <div className="accordion-body text-muted">
            {settings['terms_of_service'] || 'Informação não disponível no momento.'}
          </div>
        </div>
      </div>
    </div>
  );
}
