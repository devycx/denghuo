import { useEffect, useState } from 'react';

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function toast(message: string): void {
  listeners.forEach((fn) => fn(message));
}

interface Notice {
  id: number;
  text: string;
}

export function ToastHost() {
  const [items, setItems] = useState<Notice[]>([]);

  useEffect(() => {
    const listener: Listener = (text) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, text }]);
      window.setTimeout(() => setItems((prev) => prev.filter((n) => n.id !== id)), 2800);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div className="toast-host" aria-live="polite">
      {items.map((item) => (
        <div className="toast" key={item.id}>
          {item.text}
        </div>
      ))}
    </div>
  );
}
