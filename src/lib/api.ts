/**
 * API client helper to interact with our Node/Express backend proxy.
 * This completely isolates Firebase Auth from Supabase, keeping Supabase MAU at 0.
 */

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const body = await response.json();
      if (body.error) errorMsg = body.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}
