/** Lowest OTel SeverityNumber of each severity range. SeverityText carries the short name. */
export const SEVERITY_NUMBERS = {
  TRACE: 1,
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
  FATAL: 21,
} as const

export const SEVERITY_TEXTS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const

export const SEVERITY_TEXT_LENGTH = 30
export const BODY_LENGTH = 2000
export const SERVICE_ATTRIBUTE_LENGTH = 255
