const DEFAULT_WEBSOCKET_SERVER_URL =
  'wss://web-whiteboard-signaling.minamidenshi.workers.dev/websocket';

const normalizeAiUrl = (input: string) => {
  try {
    const url = new URL(input);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return input.replace(/[?#].*$/, '').replace(/\/$/, '');
  }
};

const getAiProxyBaseUrl = () => {
  const explicit = import.meta.env.VITE_AI_PROXY_URL as string | undefined;
  if (explicit) return normalizeAiUrl(explicit);

  const wsUrl =
    (import.meta.env.VITE_Y_WEBSOCKET_SERVER_URL as string | undefined) ||
    DEFAULT_WEBSOCKET_SERVER_URL;
  try {
    const httpUrl = wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const url = new URL(httpUrl);
    url.pathname = url.pathname.replace(/\/websocket\/?$/, '') + '/ai';
    url.search = '';
    url.hash = '';
    return normalizeAiUrl(url.toString());
  } catch {
    return 'https://web-whiteboard-signaling.minamidenshi.workers.dev/ai';
  }
};

const requestAi = async <T>(path: string, payload: Record<string, unknown>): Promise<T> => {
  const response = await fetch(`${getAiProxyBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data && (data as { error?: string }).error) || 'AI request failed';
    throw new Error(message);
  }
  return data as T;
};

export const generateBrainstormingIdeas = async (topic: string): Promise<string[]> => {
  const data = await requestAi<{ ideas?: string[] }>('/brainstorm', { topic });
  return data.ideas || [];
};

export const analyzeBoard = async (imageData: string): Promise<string> => {
  const data = await requestAi<{ text?: string }>('/analyze', { imageData });
  return data.text || 'ボードを解析できませんでした。';
};
