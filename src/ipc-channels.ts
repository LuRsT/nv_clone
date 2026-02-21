export const IPC = {
  VAULT_GET: 'vault:get',
  VAULT_SELECT: 'vault:select',
  NOTES_LIST: 'notes:list',
  NOTES_READ: 'notes:read',
  NOTES_WRITE: 'notes:write',
  NOTES_RENAME: 'notes:rename',
  NOTES_DELETE: 'notes:delete',
  NOTES_CHANGED: 'notes:changed',
  THEME_IS_DARK: 'theme:isDark',
  THEME_CHANGED: 'theme:changed',
} as const;
