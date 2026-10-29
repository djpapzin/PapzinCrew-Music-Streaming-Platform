export function authErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map(item => {
      if (!item || typeof item.msg !== 'string') return '';
      const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : '';
      const label = field === 'username' ? 'Username' : field === 'password' ? 'Password' : field === 'email' ? 'Email' : 'Details';
      return `${label}: ${item.msg.replace(/^Value error, /, '')}`;
    }).filter(Boolean);
    if (messages.length) return messages.join(' ');
  }
  return 'Unable to sign in. Please try again.';
}
