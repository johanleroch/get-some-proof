export type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      sitekey: string;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

export function browserTurnstile() {
  return (window as typeof window & { turnstile?: TurnstileApi }).turnstile;
}
