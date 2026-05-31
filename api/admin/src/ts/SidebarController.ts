import { StorageKey, Selector, CssClass } from './consts';

export class SidebarController {
  private readonly toggleBtn: HTMLElement | null;

  constructor() {
    this.toggleBtn = document.querySelector<HTMLElement>(Selector.SidebarToggle);
    this.init();
  }

  private init = (): void => {
    const isCollapsed: boolean = localStorage.getItem(StorageKey.Sidebar) === 'true';
    document.body.classList.toggle(CssClass.SidebarCollapsed, isCollapsed);
    this.toggleBtn?.addEventListener('click', this.onToggle);
  };

  private onToggle = (): void => {
    const collapsed: boolean = document.body.classList.toggle(CssClass.SidebarCollapsed);
    localStorage.setItem(StorageKey.Sidebar, String(collapsed));
  };
}
