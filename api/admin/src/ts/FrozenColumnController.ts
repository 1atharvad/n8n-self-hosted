import { Selector, CssClass, CssVar } from './consts';

export class FrozenColumnController {
  private readonly table: HTMLTableElement | null;

  constructor() {
    this.table = document.querySelector<HTMLTableElement>(Selector.TableScrollBar);
    this.init();
  }

  private init = (): void => {
    if (!this.table) return;

    const headerCells: HTMLElement[] = Array.from(
      this.table.querySelectorAll<HTMLElement>('thead tr th')
    );
    const freezeUpTo: number = headerCells.findIndex(
      (th: HTMLElement) => th.textContent?.trim().toLowerCase() === 'id'
    );

    if (freezeUpTo < 0) return;

    const offsets: number[] = this.computeOffsets(headerCells, freezeUpTo);

    this.table.querySelectorAll<HTMLElement>('tr').forEach((row: HTMLElement) => {
      const cells: HTMLElement[] = Array.from(row.querySelectorAll<HTMLElement>(Selector.FreezeCol));
      for (let i: number = 0; i <= freezeUpTo; i++) {
        const cell: HTMLElement | undefined = cells[i];
        if (!cell) continue;
        cell.classList.add(CssClass.FreezeCol);
        if (i === freezeUpTo) cell.classList.add(CssClass.FreezeColLast);
        cell.style.setProperty(CssVar.FreezeLeft, offsets[i] + 'px');
      }
    });
  };

  private computeOffsets = (headerCells: HTMLElement[], freezeUpTo: number): number[] => {
    const offsets: number[] = [];
    let cumulative: number = 0;
    for (let i: number = 0; i <= freezeUpTo; i++) {
      offsets.push(cumulative);
      cumulative += headerCells[i].offsetWidth;
    }
    return offsets;
  };
}
