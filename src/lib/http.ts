const CSRF_COOKIE = 'amnesia_csrf';

export const getCsrfToken = (): string => {
  const cookie = document.cookie.split('; ').find((value) => value.startsWith(`${CSRF_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(CSRF_COOKIE.length + 1)) : '';
};
