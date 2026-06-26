export function saveTokens(access: string, refresh: string) {
  localStorage.setItem("gradeai_access", access);
  localStorage.setItem("gradeai_refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("gradeai_access");
  localStorage.removeItem("gradeai_refresh");
}

export function getAccessToken() {
  return typeof window !== "undefined" ? localStorage.getItem("gradeai_access") : null;
}
