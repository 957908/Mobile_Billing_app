export const theme = {
  color: {
    surface: '#FFFFFF',
    onSurface: '#111111',
    surfaceSecondary: '#F5F5F7',
    onSurfaceSecondary: '#1C1C1E',
    surfaceTertiary: '#E5E5EA',
    onSurfaceTertiary: '#48484A',
    surfaceInverse: '#1C1C1E',
    onSurfaceInverse: '#FFFFFF',
    brand: '#274A3D',
    brandPrimary: '#274A3D',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#E9F0EC',
    onBrandSecondary: '#274A3D',
    brandTertiary: '#F1F5F3',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#8E8E93',
    border: '#E5E5EA',
    borderStrong: '#C7C7CC',
    divider: '#E5E5EA',
    muted: '#6B6B70',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    sm: 12, base: 14, lg: 16, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36,
  },
};

export function inr(n: number | undefined | null): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '₹0';
  const num = Number(n);
  const isNeg = num < 0;
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(abs);
  return `${isNeg ? '-' : ''}₹${formatted}`;
}
