import React, { Suspense } from 'react';
import RequiredDocumentsList from '@/components/ui/RequiredDocumentsList';
import InstitutionalContent from '@/components/ui/InstitutionalContent';
import Link from 'next/link';

export default function OrientacoesPage({ searchParams }: { searchParams: { via?: string } }) {
  const isSecondIssue = searchParams.via === '2';
  const currentType = isSecondIssue ? 'second_issue' : 'first_issue';

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          
          <div className="text-center mb-5">
            <h1 className="display-5 fw-bold">Orientações de Atendimento</h1>
            <p className="lead text-muted">Consulte os documentos obrigatórios antes de agendar sua emissão.</p>
          </div>

          <div className="d-flex justify-content-center mb-4">
            <div className="btn-group shadow-sm" role="group" aria-label="Tipo de emissão">
              <Link 
                href="/orientacoes?via=1" 
                className={`btn btn-outline-primary ${!isSecondIssue ? 'active' : ''}`}
              >
                1ª Via de RG
              </Link>
              <Link 
                href="/orientacoes?via=2" 
                className={`btn btn-outline-primary ${isSecondIssue ? 'active' : ''}`}
              >
                2ª Via de RG
              </Link>
            </div>
          </div>

          {/* Utilizamos Suspense para permitir o fetch do componente no servidor (SSR) isoladamente */}
          <Suspense fallback={
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Carregando documentos...</span>
              </div>
            </div>
          }>
            <RequiredDocumentsList appointmentType={currentType} />
          </Suspense>

          <Suspense fallback={<div className="placeholder-glow"><span className="placeholder col-12 py-3"></span></div>}>
            <InstitutionalContent />
          </Suspense>

          <div className="text-center mt-5">
            <Link 
              href={isSecondIssue ? '/agendamento?via=2' : '/agendamento?via=1'} 
              className="btn btn-success btn-lg px-5 shadow-sm fw-bold d-inline-flex align-items-center gap-2"
            >
              <span>Prosseguir para Agendamento</span>
              <i className="bi bi-arrow-right"></i>
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}
