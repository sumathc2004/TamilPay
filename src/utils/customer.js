/** Our API always returns the customer/client id as a plain lowercase "id". */
export const getCustomerId = (c) => c.id;

/** Every customer created through this app belongs to this one fixed client. */
export const MASTER_CLIENT_ID = 5;

/** Two-letter avatar initials from a full name, falling back to "?" when empty. */
export const getInitials = (fullName) => {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
