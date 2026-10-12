const sastHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Johannesburg',
  hour: 'numeric',
  hourCycle: 'h23',
});

export function getSastGreeting(now = new Date()): string {
  const hour = Number(sastHour.format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
