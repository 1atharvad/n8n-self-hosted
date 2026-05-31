import { ElementId, CssClass } from './consts';

export class FilterPanelController {
  private readonly toggleBtn: HTMLElement | null;
  private readonly filterPanel: HTMLElement | null;

  constructor() {
    this.toggleBtn = document.getElementById(ElementId.FiltersToggle);
    this.filterPanel = document.getElementById(ElementId.FilterPanel);
    this.init();
  }

  private init = (): void => {
    if (!this.toggleBtn || !this.filterPanel) return;
    this.toggleBtn.addEventListener('click', this.onToggle);
  };

  private onToggle = (): void => {
    this.filterPanel!.classList.toggle(CssClass.Hidden);
  };
}
