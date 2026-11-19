export type ValidationRule =
  | { type: 'required'; params?: boolean; message?: string }
  | { type: 'min-length' | 'max-length'; params: number; message?: string }
  | { type: 'equals' | 'equals-not'; params: string; message?: string }
  | { type: 'greater-than' | 'less-than'; params: number; message?: string }
  | { type: 'in-range'; params: [number, number]; message?: string }
  | { type: 'set'; params: string[]; message?: string }
