import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#0b1220',
  surface: '#141d2e',
  surfaceAlt: '#1c2740',
  border: '#25334d',
  text: '#e8eefc',
  textMuted: '#93a3bd',
  accent: '#22c55e',
  accentDark: '#16a34a',
  warn: '#f59e0b',
  danger: '#ef4444',
  info: '#38bdf8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  h1: { color: colors.text, fontSize: 26, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 19, fontWeight: '600' },
  h3: { color: colors.text, fontSize: 16, fontWeight: '600' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});

/** Status colour, shared by membership badges and enrollment steps. */
export function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return colors.accent;
    case 'PAUSED':
    case 'WAITLISTED':
    case 'PENDING_APPROVAL':
    case 'PENDING_PAYMENT':
      return colors.warn;
    case 'CANCELLED':
    case 'EXPIRED':
    case 'REJECTED':
      return colors.danger;
    default:
      return colors.info;
  }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDay(dayOfWeek: number): string {
  return DAYS[dayOfWeek] ?? '';
}

/** Minutes from midnight → "4:30 pm". */
export function formatMinute(minute: number): string {
  const hours24 = Math.floor(minute / 60);
  const minutes = minute % 60;
  const period = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatSchedule(
  schedule: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>,
): string {
  if (schedule.length === 0) return 'Schedule to be confirmed';
  const days = schedule.map((slot) => formatDay(slot.dayOfWeek)).join(', ');
  const first = schedule[0];
  return first ? `${days} · ${formatMinute(first.startMinute)}` : days;
}

/** Paise → "₹2,500". Money is integer paise everywhere; never format from floats. */
export function formatInr(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
