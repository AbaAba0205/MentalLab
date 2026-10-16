export interface Account { id: string; email: string; name: string; role: 'user' | 'admin'; onboarded: boolean; }
export class APIError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: data === undefined ? undefined : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const payload = await response.json();
  if (!response.ok) throw new APIError(payload.error || '服务器暂时无法完成请求', response.status);
  return payload as T;
}
