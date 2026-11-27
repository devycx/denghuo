/** 主题切换：以点击点为圆心，用 View Transitions 做圆形扩散（无依赖）。 */
export type Theme = 'dark' | 'light';
type Point = { x: number; y: number };

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => void;
};

export function transitionToTheme(theme: Theme, origin: Point, apply: () => void): void {
  const root = document.documentElement;
  root.style.setProperty('--theme-origin-x', `${origin.x}px`);
  root.style.setProperty('--theme-origin-y', `${origin.y}px`);

  const commit = () => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000');
    apply();
  };

  const doc = document as ViewTransitionDocument;
  if (doc.startViewTransition) doc.startViewTransition(commit);
  else commit();
}

export function originFrom(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
