import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TrailPlayArea from './TrailPlayArea'
import { config } from './trail.config'

describe('поле «Ланцюжка»', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('доходить до кінця, рахує помилки й «не перемкнувся»', () => {
    const onFinish = vi.fn()
    const level = { ...config.levels[2], size: 4 }
    render(<TrailPlayArea level={level} onFinish={onFinish} />)

    fireEvent.click(screen.getByRole('button', { name: 'Число 1' }))
    // 2 замість А — дитина не перемкнулась.
    fireEvent.click(screen.getByRole('button', { name: 'Число 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Літера А' }))
    // Повторний дотик до з'єднаного — не помилка.
    fireEvent.click(screen.getByRole('button', { name: 'Число 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Число 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Літера Б' }))

    expect(onFinish).toHaveBeenCalledOnce()
    expect(onFinish.mock.calls[0][0].metrics).toMatchObject({ total: 4, errors: 1, perseverations: 1 })
  })

  it('кружечки в DOM ідуть не по порядку ланцюжка', () => {
    // Перевірка на ймовірність: дванадцять кружечків випадково в порядку
    // 1…12 вишикуються раз на пів мільярда.
    render(<TrailPlayArea level={config.levels[0]} onFinish={vi.fn()} />)
    const labels = screen.getAllByRole('button').map((button) => button.textContent.replace(/\D/g, ''))
    expect(labels).not.toEqual(labels.slice().sort((a, b) => a - b))
  })
})
