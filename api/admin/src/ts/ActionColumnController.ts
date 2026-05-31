import { Selector } from './consts';

export class ActionColumnController {
  private readonly allActionCols: HTMLElement[];
  private readonly baseZIndex: number;

  constructor() {
    this.allActionCols = Array.from(document.querySelectorAll<HTMLElement>(Selector.ActionCol));
    this.baseZIndex = this.readBaseZIndex();
    this.init();
  }

  private readBaseZIndex = (): number => {
    const el: HTMLElement | null = document.querySelector<HTMLElement>(Selector.ActionCol);
    return el ? parseInt(getComputedStyle(el).zIndex || '0', 10) : 0;
  };

  private init = (): void => {
    document.querySelectorAll<HTMLElement>(Selector.ActionCol).forEach((cell: HTMLElement) => {
      const trigger: HTMLElement | null = cell.querySelector<HTMLElement>(Selector.ActionMenuBtn);
      if (!trigger) return;
      trigger.addEventListener('click', () => this.onTriggerClick(cell));
    });
  };

  private onTriggerClick = (activeCell: HTMLElement): void => {
    this.allActionCols.forEach((el: HTMLElement) => { el.style.zIndex = ''; });
    activeCell.style.zIndex = String(this.baseZIndex + 1);
  };
}
