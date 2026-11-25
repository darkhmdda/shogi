import { describe, expect, it } from 'vitest'
import { translateAuthError } from './supabase'

describe('mensajes de Supabase en español', () => {
  it('traduce los errores habituales', () => {
    expect(translateAuthError('Invalid login credentials')).toBe('Correo o contraseña incorrectos.')
    expect(translateAuthError('Email not confirmed')).toContain('confirmado')
    expect(translateAuthError('User already registered')).toBe('Ya existe una cuenta con ese correo.')
    expect(translateAuthError('fetch failed')).toBe('No se pudo conectar con el servidor.')
    expect(translateAuthError('TypeError: Failed to fetch')).toBe('No se pudo conectar con el servidor.')
  })

  it('deja intactos los mensajes desconocidos', () => {
    expect(translateAuthError('Algo raro')).toBe('Algo raro')
  })
})
