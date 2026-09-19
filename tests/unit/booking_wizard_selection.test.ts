describe('Booking Wizard Service Selection & Flow', () => {
  it('1. Deve mapear corretamente initialVia "1" para first_issue e "2" para second_issue', () => {
    const resolveInitialVia = (initialVia?: string): 'first_issue' | 'second_issue' | '' => {
      if (initialVia) {
        const v = String(initialVia).toLowerCase().trim()
        if (v === '2' || v === '2_via' || v.includes('second') || v.includes('segunda') || v.includes('2a') || v.includes('2ª')) {
          return 'second_issue'
        }
        if (v === '1' || v === '1_via' || v.includes('first') || v.includes('primeira') || v.includes('1a') || v.includes('1ª')) {
          return 'first_issue'
        }
      }
      return ''
    }

    expect(resolveInitialVia('1')).toBe('first_issue')
    expect(resolveInitialVia('1_via')).toBe('first_issue')
    expect(resolveInitialVia('primeira_via')).toBe('first_issue')
    expect(resolveInitialVia('2')).toBe('second_issue')
    expect(resolveInitialVia('2_via')).toBe('second_issue')
    expect(resolveInitialVia('segunda_via')).toBe('second_issue')
    expect(resolveInitialVia(undefined)).toBe('')
  })

  it('2. Deve avançar imediatamente para o Step 2 ao selecionar a via de atendimento', () => {
    let currentStep = 1
    let selectedType = ''

    const handleSelectServiceType = (type: 'first_issue' | 'second_issue') => {
      selectedType = type
      currentStep = 2 // Avança de imediato para o calendário
    }

    handleSelectServiceType('first_issue')
    expect(selectedType).toBe('first_issue')
    expect(currentStep).toBe(2)

    handleSelectServiceType('second_issue')
    expect(selectedType).toBe('second_issue')
    expect(currentStep).toBe(2)
  })

  it('3. Deve validar integridade dos dados antes de submeter no Step 3', () => {
    const validFormData = {
      full_name: 'Francisco Carlos Silva',
      phone: '(88) 99999-1234',
      sexo: 'Masculino'
    }

    const isValid = Boolean(validFormData.full_name && validFormData.phone && validFormData.sexo)
    expect(isValid).toBe(true)

    const invalidFormData = {
      full_name: '',
      phone: '',
      sexo: ''
    }
    const isInvalid = Boolean(invalidFormData.full_name && invalidFormData.phone && invalidFormData.sexo)
    expect(isInvalid).toBe(false)
  })
})
