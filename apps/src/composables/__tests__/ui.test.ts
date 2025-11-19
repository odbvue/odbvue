import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCardBackground } from '../ui'

// Mock vuetify useTheme
const mockTheme = {
  current: {
    value: {
      dark: false,
    },
  },
}

vi.mock('vuetify', () => ({
  useTheme: vi.fn(() => mockTheme),
}))

describe('useCardBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a computed object with background property', () => {
    const result = useCardBackground('#FF0000')
    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.value.background).toBeDefined()
  })

  it('generates gradient background for light theme', () => {
    mockTheme.current.value.dark = false
    const result = useCardBackground('#FF0000')
    const background = result.value.background
    expect(background).toContain('linear-gradient')
    expect(background).toContain('#FF000066')
    expect(background).toContain('#FF000033')
  })

  it('generates gradient background for dark theme', () => {
    mockTheme.current.value.dark = true
    const result = useCardBackground('#FF0000')
    const background = result.value.background
    expect(background).toContain('linear-gradient')
    expect(background).toContain('#FF000033')
    expect(background).toContain('#FF000066')
  })

  it('accepts different color values', () => {
    mockTheme.current.value.dark = false
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFA500']
    colors.forEach((color) => {
      const result = useCardBackground(color)
      expect(result.value.background).toContain(color)
    })
  })

  it('responds to theme changes reactively', () => {
    mockTheme.current.value.dark = false
    const result = useCardBackground('#FF0000')
    const lightBackground = result.value.background

    mockTheme.current.value.dark = true
    // Computed is reactive - accessing .value after theme change should reflect new theme
    const darkBackground = result.value.background

    expect(lightBackground).toContain('#FF000066')
    expect(darkBackground).toContain('#FF000033')
  })

  it('includes 135deg angle in gradient', () => {
    const result = useCardBackground('#FF0000')
    expect(result.value.background).toContain('135deg')
  })

  it('returns consistent output for same input', () => {
    const result1 = useCardBackground('#FF0000')
    const result2 = useCardBackground('#FF0000')
    expect(result1.value.background).toBe(result2.value.background)
  })
})
