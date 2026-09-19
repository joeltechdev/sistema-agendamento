import CancelButton from './CancelButton'

interface AppointmentData {
  id: string
  appointment_date: string
  appointment_time: string
  appointment_type: string
  status: string
  protocol_number: string
  created_at: string
  services: { name: string } | null
}

interface Props {
  appointment: AppointmentData
  isSecondIssueWarning: string | null
}

export default function AppointmentCard({ appointment, isSecondIssueWarning }: Props) {
  const formattedDate = appointment.appointment_date 
    ? appointment.appointment_date.split('-').reverse().join('/') 
    : ''
  const formattedTime = appointment.appointment_time 
    ? appointment.appointment_time.substring(0, 5) 
    : ''
  
  return (
    <div className="card shadow-sm border-0 mb-3" role="region" aria-label={`Agendamento para ${formattedDate}`}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h5 className="card-title mb-1">
              {appointment.services?.name || 'Emissão de RG'}
            </h5>
            <div className="text-muted small">
              {appointment.appointment_type === 'first_issue' ? '1ª Via' : '2ª Via'}
            </div>
          </div>
          <CancelButton appointmentId={appointment.id} status={appointment.status} />
        </div>
        
        <div className="row g-2 mt-3">
          <div className="col-sm-6">
            <div className="p-3 bg-light rounded h-100 border border-dashed">
              <strong className="d-block small text-muted text-uppercase mb-1">Protocolo</strong>
              <span className="fs-5 text-monospace fw-bold">{appointment.protocol_number}</span>
            </div>
          </div>
          <div className="col-sm-6">
            <div className="p-3 bg-light rounded h-100 border border-dashed">
              <strong className="d-block small text-muted text-uppercase mb-1">Data / Hora</strong>
              <span className="fs-5 fw-bold">
                {formattedDate} às {formattedTime}
              </span>
            </div>
          </div>
        </div>

        {appointment.appointment_type === 'second_issue' && isSecondIssueWarning && appointment.status !== 'cancelled' && (
          <div className="alert alert-warning mt-3 mb-0 small py-2">
            <i className="bi bi-info-circle-fill me-2"></i>
            {isSecondIssueWarning}
          </div>
        )}
      </div>
    </div>
  )
}
