export const BETA_MODE = typeof window !== 'undefined'
  && localStorage.getItem('ivee-beta-mode') === 'true';
