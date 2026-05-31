import { Theme, StorageKey, Selector, CssClass, BsAttr, ResolvedTheme } from './consts';

export class ThemeController {
  constructor() {
    this.init();
  }

  private resolveTheme = (theme: Theme): ResolvedTheme => {
    if (theme !== Theme.System) return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? Theme.Dark : Theme.Light;
  };

  private applyTheme = (theme: Theme): void => {
    const resolved: ResolvedTheme = this.resolveTheme(theme);
    document.documentElement.setAttribute(BsAttr.Theme, resolved);
    localStorage.setItem(StorageKey.Theme, theme);
  };

  private getStoredTheme = (): Theme => {
    return (localStorage.getItem(StorageKey.Theme) as Theme) ?? Theme.Light;
  };

  private init = (): void => {
    const stored: Theme = this.getStoredTheme();
    this.applyTheme(stored);

    document.querySelectorAll<HTMLElement>(Selector.ThemeCard).forEach((card: HTMLElement) => {
      const value: Theme = card.dataset[Selector.ThemeValue] as Theme;
      const radio: HTMLInputElement | null = card.querySelector<HTMLInputElement>(Selector.ThemeRadio);

      if (!value || !radio) return;

      if (value === stored) {
        radio.checked = true;
        card.classList.add(CssClass.ThemeCardActive);
      }

      card.addEventListener('click', () => this.onCardClick(card, value));
    });
  };

  private onCardClick = (card: HTMLElement, value: Theme): void => {
    document.querySelectorAll<HTMLElement>(Selector.ThemeCard).forEach((c: HTMLElement) =>
      c.classList.remove(CssClass.ThemeCardActive)
    );
    card.classList.add(CssClass.ThemeCardActive);
    this.applyTheme(value);
  };
}
