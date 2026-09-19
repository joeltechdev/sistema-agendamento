'use client';

import React, { useState } from 'react';
import Loading from './Loading';

interface Props {
  availableSlots: string[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onTimeSelect: (time: string) => void;
  onFindNextAvailableDate?: () => void;
  selectedTime?: string;
  isLoading?: boolean;
  isSearchingNextDate?: boolean;
}

export default function Calendar({ 
  availableSlots, 
  selectedDate, 
  onDateChange, 
  onTimeSelect, 
  onFindNextAvailableDate,
  selectedTime, 
  isLoading,
  isSearchingNextDate
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isWeekend = (day: number) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).getDay();
    return d === 0 || d === 6;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renderDays = () => {
    const blanks = Array.from({ length: firstDayOfWeek }).map((_, i) => (
      <div key={`blank-${i}`} style={{ width: '14.28%', aspectRatio: '1/1' }}></div>
    ));

    const days = Array.from({ length: daysInMonth }).map((_, i) => {
      const dayNum = i + 1;
      const thisDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum);
      thisDate.setHours(0, 0, 0, 0);

      const isPast = thisDate < today;
      const disabled = isWeekend(dayNum) || isPast;
      const isSelected = selectedDate.getDate() === dayNum && 
                         selectedDate.getMonth() === currentMonth.getMonth() && 
                         selectedDate.getFullYear() === currentMonth.getFullYear();
      
      const isToday = thisDate.getTime() === today.getTime();

      return (
        <div 
          key={dayNum} 
          className="d-flex align-items-center justify-content-center" 
          style={{ width: '14.28%', aspectRatio: '1/1', padding: '3px' }}
        >
          <button
            type="button"
            className="w-100 h-100 border-0 d-flex flex-column align-items-center justify-content-center position-relative"
            style={{
              backgroundColor: isSelected ? '#1E3A8A' : 'transparent',
              color: isSelected ? '#FFFFFF' : disabled ? '#9CA3AF' : isToday ? '#1E3A8A' : '#1E293B',
              fontWeight: isSelected || isToday ? 700 : 500,
              fontSize: '13.5px',
              borderRadius: '8px',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.15s ease-in-out',
              fontFamily: 'inherit'
            }}
            disabled={disabled}
            aria-pressed={isSelected}
            aria-disabled={disabled}
            aria-label={`Dia ${dayNum}`}
            onClick={() => {
              if (!disabled) {
                const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum);
                onDateChange(newDate);
              }
            }}
            onMouseEnter={(e) => {
              if (!disabled && !isSelected) {
                e.currentTarget.style.backgroundColor = '#EEF2FB';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && !isSelected) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span>{dayNum}</span>
            {/* Discrete 4px indicator dot for Today when unselected */}
            {isToday && !isSelected && (
              <span 
                className="position-absolute" 
                style={{ 
                  bottom: '4px', 
                  width: '4px', 
                  height: '4px', 
                  borderRadius: '50%', 
                  backgroundColor: '#1E3A8A' 
                }}
              ></span>
            )}
          </button>
        </div>
      );
    });

    return [...blanks, ...days];
  };

  const monthName = currentMonth.toLocaleString('pt-BR', { month: 'long' });
  const yearName = currentMonth.getFullYear();
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Full extended date in words (e.g. "Quarta-feira, 16 de setembro")
  const weekdayName = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' });
  const capitalizedWeekday = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);
  const fullDateSubtitle = `${capitalizedWeekday}, ${selectedDate.getDate()} de ${selectedDate.toLocaleDateString('pt-BR', { month: 'long' })}`;

  return (
    <div className="row g-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* 1. Painel do Calendário */}
      <div className="col-lg-7">
        <div 
          className="bg-white h-100"
          style={{
            border: '1px solid #E5E8EC',
            borderRadius: '14px',
            padding: '22px'
          }}
        >
          {/* Header do Calendário */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <button 
              type="button" 
              className="btn btn-sm d-flex align-items-center justify-content-center p-0"
              onClick={handlePrevMonth} 
              aria-label="Mês anterior"
              style={{
                width: '30px',
                height: '30px',
                border: '1px solid #E2E6EC',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <i className="bi bi-chevron-left" style={{ fontSize: '13px' }}></i>
            </button>
            
            <div className="d-flex align-items-center gap-2" style={{ fontSize: '15.5px', fontWeight: 700, color: '#10182B' }}>
              <i className="bi bi-calendar3" style={{ color: '#1E3A8A' }}></i>
              <span>{capitalizedMonth} de {yearName}</span>
            </div>
            
            <button 
              type="button" 
              className="btn btn-sm d-flex align-items-center justify-content-center p-0"
              onClick={handleNextMonth} 
              aria-label="Próximo mês"
              style={{
                width: '30px',
                height: '30px',
                border: '1px solid #E2E6EC',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#334155'
              }}
            >
              <i className="bi bi-chevron-right" style={{ fontSize: '13px' }}></i>
            </button>
          </div>

          {/* Cabeçalho dos dias da semana (Uniforme, sem vermelho de plugin) */}
          <div className="d-flex text-center mb-2" style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((letter, idx) => (
              <div 
                key={idx} 
                style={{ 
                  width: '14.28%', 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: '#64748B', 
                  textTransform: 'uppercase' 
                }}
              >
                {letter}
              </div>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="d-flex flex-wrap">
            {renderDays()}
          </div>
        </div>
      </div>
      
      {/* 2. Painel "Horários Disponíveis" */}
      <div className="col-lg-5">
        <div 
          className="bg-white h-100 d-flex flex-column"
          style={{
            border: '1px solid #E5E8EC',
            borderRadius: '14px',
            padding: '22px'
          }}
        >
          {/* Header do Painel */}
          <div className="mb-3 pb-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div className="d-flex align-items-center gap-2" style={{ fontSize: '15.5px', fontWeight: 700, color: '#10182B' }}>
              <i className="bi bi-clock-history" style={{ color: '#1E3A8A' }}></i>
              <span>Horários disponíveis</span>
            </div>
            <div className="mt-1 ms-4" style={{ fontSize: '12.5px', color: '#64748B' }}>
              {fullDateSubtitle}
            </div>
          </div>

          {/* Conteúdo: Loading, Estado Vazio ou Grade de Chips */}
          <div className="flex-grow-1 d-flex flex-column justify-content-center">
            {isLoading ? (
              <Loading />
            ) : availableSlots.length === 0 ? (
              /* Estado VAZIO com Badge Tonal e Ação de Próxima Data */
              <div 
                className="text-center p-4"
                style={{
                  backgroundColor: '#FAFBFC',
                  border: '1px solid #E5E8EC',
                  borderRadius: '10px',
                  padding: '36px 20px'
                }}
              >
                <div 
                  className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: '44px', height: '44px', backgroundColor: '#EEF2FB', color: '#1E3A8A' }}
                >
                  <i className="bi bi-calendar2-x fs-5"></i>
                </div>
                
                <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#10182B', marginBottom: '6px' }}>
                  Nenhum horário disponível
                </h4>
                
                <p className="mb-3 mx-auto col-11" style={{ fontSize: '12.5px', color: '#64748B', lineHeight: '1.4' }}>
                  Não há vagas para esta data. Experimente escolher outro dia no calendário.
                </p>

                {onFindNextAvailableDate && (
                  <button
                    type="button"
                    className="btn btn-sm d-inline-flex align-items-center gap-2 rounded-pill shadow-2xs"
                    onClick={onFindNextAvailableDate}
                    disabled={isSearchingNextDate}
                    style={{
                      backgroundColor: '#EEF2FB',
                      color: '#1E3A8A',
                      border: '1px solid #BFDBFE',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      padding: '8px 18px'
                    }}
                  >
                    {isSearchingNextDate ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        <span>Buscando vagas...</span>
                      </>
                    ) : (
                      <>
                        <span>Ver próxima data disponível</span>
                        <i className="bi bi-arrow-right"></i>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              /* Grade de Chips de Horário */
              <div>
                <div className="row row-cols-3 g-2">
                  {availableSlots.map(time => {
                    const isSelected = selectedTime === time;
                    return (
                      <div className="col" key={time}>
                        <button
                          type="button"
                          className="btn w-100 py-2 d-flex align-items-center justify-content-center"
                          style={{
                            border: `1px solid ${isSelected ? '#1E3A8A' : '#E2E6EC'}`,
                            borderRadius: '8px',
                            backgroundColor: isSelected ? '#EEF2FB' : '#FFFFFF',
                            color: isSelected ? '#1E3A8A' : '#1E293B',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => onTimeSelect(time)}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#1E3A8A';
                              e.currentTarget.style.color = '#1E3A8A';
                              e.currentTarget.style.backgroundColor = '#EEF2FB';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#E2E6EC';
                              e.currentTarget.style.color = '#1E293B';
                              e.currentTarget.style.backgroundColor = '#FFFFFF';
                            }
                          }}
                          aria-label={`Selecionar horário ${time}`}
                        >
                          {time}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
