/**
 * @file admin.ts
 * @description Entry point for admin panel UI behaviour.
 * Initialises the sidebar toggle and theme switcher controllers on page load.
 */

import { Theme, StorageKey, Selector, CssClass, BsAttr, ResolvedTheme } from './consts';

/**
 * Controls the collapsible sidebar.
 *
 * Reads the last persisted state from `localStorage` on construction and
 * wires the toggle button to flip the collapsed state and persist it.
 */
class SidebarController {
  private readonly toggleBtn: HTMLElement | null;

  constructor() {
    this.toggleBtn = document.querySelector<HTMLElement>(Selector.SidebarToggle);
    this.init();
  }

  /**
   * Applies the persisted collapsed state to `document.body` and attaches
   * the click listener to the toggle button.
   */
  private init = (): void => {
    const isCollapsed: boolean = localStorage.getItem(StorageKey.Sidebar) === 'true';
    document.body.classList.toggle(CssClass.SidebarCollapsed, isCollapsed);
    this.toggleBtn?.addEventListener('click', this.onToggle);
  };

  /**
   * Toggles the `sidebar-collapsed` class on `document.body` and persists
   * the new state to `localStorage`.
   */
  private onToggle = (): void => {
    const collapsed: boolean = document.body.classList.toggle(CssClass.SidebarCollapsed);
    localStorage.setItem(StorageKey.Sidebar, String(collapsed));
  };
}

/**
 * Controls the light / dark / system theme switcher.
 *
 * On construction it reads the stored theme preference, applies it immediately,
 * and wires each theme card to update the active selection and re-apply the theme.
 */
class ThemeController {
  constructor() {
    this.init();
  }

  /**
   * Resolves a `Theme` value to a concrete `ResolvedTheme`.
   * `Theme.System` is resolved using the OS `prefers-color-scheme` media query.
   *
   * @param theme - The theme to resolve.
   * @returns `Theme.Light` or `Theme.Dark`.
   */
  private resolveTheme = (theme: Theme): ResolvedTheme => {
    if (theme !== Theme.System) return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? Theme.Dark : Theme.Light;
  };

  /**
   * Applies a theme to the document root and persists the raw (pre-resolved)
   * value to `localStorage` so `Theme.System` is not overwritten.
   *
   * @param theme - The theme to apply.
   */
  private applyTheme = (theme: Theme): void => {
    const resolved: ResolvedTheme = this.resolveTheme(theme);
    document.documentElement.setAttribute(BsAttr.Theme, resolved);
    localStorage.setItem(StorageKey.Theme, theme);
  };

  /**
   * Returns the theme stored in `localStorage`, falling back to `Theme.Light`
   * if nothing has been persisted yet.
   *
   * @returns The stored `Theme` value.
   */
  private getStoredTheme = (): Theme => {
    return (localStorage.getItem(StorageKey.Theme) as Theme) ?? Theme.Light;
  };

  /**
   * Applies the stored theme and attaches click listeners to all `.theme-card` elements.
   */
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

  /**
   * Handles a theme card click: clears the active state from all cards,
   * marks the clicked card as active, and applies the selected theme.
   *
   * @param card - The `.theme-card` element that was clicked.
   * @param value - The `Theme` value associated with the clicked card.
   */
  private onCardClick = (card: HTMLElement, value: Theme): void => {
    document.querySelectorAll<HTMLElement>(Selector.ThemeCard).forEach((c: HTMLElement) =>
      c.classList.remove(CssClass.ThemeCardActive)
    );
    card.classList.add(CssClass.ThemeCardActive);
    this.applyTheme(value);
  };
}

new SidebarController();
new ThemeController();
