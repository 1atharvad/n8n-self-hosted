/**
 * @file list.ts
 * @description UI behavior for the admin list view.
 * Initializes action column z-index management, frozen columns up to "id",
 * the filter panel toggle, and the filter builder dropdown.
 */

import { Selector, CssClass, BsEvent, ElementId, CssVar } from './consts';


/**
 * Manages the z-index of action column cells so that open action menus
 * always render above frozen and adjacent columns.
 *
 * On each action button click, resets all action columns to their default
 * z-index and elevates only the clicked cell by one.
 */
class ActionColumnController {
  private readonly allActionCols: HTMLElement[];
  private readonly baseZIndex: number;

  constructor() {
    this.allActionCols = Array.from(document.querySelectorAll<HTMLElement>(Selector.ActionCol));
    this.baseZIndex = this.readBaseZIndex();
    this.init();
  }

  /**
   * Reads the computed z-index of the first action column cell.
   * Falls back to `0` if no element is found or the value is not set.
   *
   * @returns The base z-index as a number.
   */
  private readBaseZIndex = (): number => {
    const el: HTMLElement | null = document.querySelector<HTMLElement>(Selector.ActionCol);
    return el ? parseInt(getComputedStyle(el).zIndex || '0', 10) : 0;
  };

  /**
   * Attaches a click listener to every action menu trigger button.
   */
  private init = (): void => {
    document.querySelectorAll<HTMLElement>(Selector.ActionCol).forEach((cell: HTMLElement) => {
      const trigger: HTMLElement | null = cell.querySelector<HTMLElement>(Selector.ActionMenuBtn);
      if (!trigger) return;
      trigger.addEventListener('click', () => this.onTriggerClick(cell));
    });
  };

  /**
   * Resets z-index on all action columns then elevates the active cell.
   *
   * @param activeCell - The action column cell whose menu was opened.
   */
  private onTriggerClick = (activeCell: HTMLElement): void => {
    this.allActionCols.forEach((el: HTMLElement) => { el.style.zIndex = ''; });
    activeCell.style.zIndex = String(this.baseZIndex + 1);
  };
}

/**
 * Freezes all table columns from the first up to and including the column
 * whose header text is "id".
 *
 * Computes cumulative left offsets from header cell widths and applies them
 * via the `--freeze-left` CSS custom property. Adds `freeze-col` to every
 * frozen cell and `freeze-col-last` to the boundary column.
 */
class FrozenColumnController {
  private readonly table: HTMLTableElement | null;

  constructor() {
    this.table = document.querySelector<HTMLTableElement>(Selector.TableScrollBar);
    this.init();
  }

  /**
   * Locates the "id" column header, computes offsets, and stamps the freeze
   * classes and custom properties onto every cell in the frozen range.
   */
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

  /**
   * Computes the cumulative left offset for each column up to `freezeUpTo`
   * using the rendered `offsetWidth` of each header cell.
   *
   * @param headerCells - All `<th>` elements in the table header row.
   * @param freezeUpTo - Index of the last column to freeze.
   * @returns Array of left offsets in pixels, one per frozen column.
   */
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

/**
 * Controls the visibility of the filter panel via the filters toggle button.
 */
class FilterPanelController {
  private readonly toggleBtn: HTMLElement | null;
  private readonly filterPanel: HTMLElement | null;

  constructor() {
    this.toggleBtn = document.getElementById(ElementId.FiltersToggle);
    this.filterPanel = document.getElementById(ElementId.FilterPanel);
    this.init();
  }

  /**
   * Attaches the click listener to the toggle button if both elements exist.
   */
  private init = (): void => {
    if (!this.toggleBtn || !this.filterPanel) return;
    this.toggleBtn.addEventListener('click', this.onToggle);
  };

  /**
   * Toggles the `d-none` class on the filter panel.
   */
  private onToggle = (): void => {
    this.filterPanel!.classList.toggle(CssClass.Hidden);
  };
}

/**
 * Controls the two-step filter builder dropdown.
 *
 * Step 1: the user selects a column to filter by.
 * Step 2: the user searches and selects a value to apply.
 *
 * On selection the page navigates to a URL with the filter appended as a
 * comma-separated query-string parameter, preserving existing active filters.
 */
class FilterBuilderController {
  private readonly addFilterBtn: HTMLElement | null;
  private readonly filterPanel: HTMLElement | null;

  /** URL query-string parameter name for the currently selected column. */
  private activeParam: string | null = null;
  /** All available option values for the currently selected column. */
  private allOptions: string[] = [];

  constructor() {
    this.addFilterBtn = document.getElementById(ElementId.AddFilterBtn);
    this.filterPanel = document.getElementById(ElementId.FilterPanel);
    this.init();
  }

  /**
   * Wires up all event listeners for the filter builder.
   */
  private init = (): void => {
    this.bindColumnItems();
    this.bindSearchInput();
    this.bindBackButton();
    this.bindDropdownEvents();
  };

  /**
   * Returns the currently active filter values for `activeParam` from the
   * page URL. Returns an empty array if no filter is set.
   *
   * @returns Array of active filter value strings.
   */
  private getActiveValues = (): string[] => {
    if (!this.activeParam) return [];
    const existing: string | null = new URL(window.location.href).searchParams.get(this.activeParam);
    return existing ? existing.split(',').map((v: string) => v.trim()).filter(Boolean) : [];
  };

  /**
   * Excludes already-active values from a list of options so the dropdown
   * never offers values that are already applied to the current filter.
   *
   * @param options - Full list of options for the selected column.
   * @returns Options not yet present in the active filter values.
   */
  private filterAvailable = (options: string[]): string[] => {
    const active: Set<string> = new Set(this.getActiveValues());
    return options.filter((o: string) => !active.has(o));
  };

  /**
   * Appends a filter value to the current URL and navigates to the result.
   * If the parameter already exists the value is added to the comma-separated list.
   *
   * @param val - The filter value to apply.
   */
  private applyValue = (val: string): void => {
    if (!val || !this.activeParam) return;
    const url: URL = new URL(window.location.href);
    const existing: string | null = url.searchParams.get(this.activeParam);
    if (existing) {
      const vals: string[] = existing.split(',').map((v: string) => v.trim()).filter(Boolean);
      if (!vals.includes(val)) vals.push(val);
      url.searchParams.set(this.activeParam, vals.join(','));
    } else {
      url.searchParams.set(this.activeParam, val);
    }
    window.location.href = url.toString();
  };

  /**
   * Renders a list of available filter options into `#fb-options-list`.
   * Shows an empty state message when no options match.
   *
   * @param options - The filtered options to display.
   */
  private renderOptions = (options: string[]): void => {
    const list: HTMLElement | null = document.getElementById(ElementId.FbOptionsList);
    if (!list) return;
    if (options.length === 0) {
      list.innerHTML = '<div class="fb-options-empty">No options found</div>';
      return;
    }
    list.innerHTML = options
      .map((o: string) => `<a class="dropdown-item fb-option-item" href="#">${o}</a>`)
      .join('');
    list.querySelectorAll<HTMLElement>(Selector.FbOptionItem).forEach((item: HTMLElement) => {
      item.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.applyValue(item.textContent ?? '');
      });
    });
  };

  /**
   * Attaches click listeners to each column item in step 1.
   * Sets `activeParam` and `allOptions`, advances to step 2, and renders
   * the initial options list (up to 7, unfiltered).
   */
  private bindColumnItems = (): void => {
    document.querySelectorAll<HTMLElement>(Selector.FbColItem).forEach((item: HTMLElement) => {
      item.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.activeParam = item.dataset.param ?? null;

        const label: HTMLElement | null = document.getElementById(ElementId.FbColLabel);
        if (label) label.textContent = item.dataset.title ?? '';

        try {
          this.allOptions = JSON.parse(item.dataset.options ?? '[]');
        } catch {
          this.allOptions = [];
        }

        this.renderOptions(this.filterAvailable(this.allOptions).slice(0, 7));
        this.goToStep(2);

        const inp = document.getElementById(ElementId.FbValueInput) as HTMLInputElement | null;
        if (inp) { inp.value = ''; inp.focus(); }
      });
    });
  };

  /**
   * Filters available options in real time as the user types in the search input.
   */
  private bindSearchInput = (): void => {
    document.getElementById(ElementId.FbValueInput)?.addEventListener('input', (e: Event) => {
      const search: string = (e.target as HTMLInputElement).value.trim().toLowerCase();
      const available: string[] = this.filterAvailable(this.allOptions);
      const filtered: string[] = search
        ? available.filter((o: string) => o.toLowerCase().includes(search))
        : available.slice(0, 7);
      this.renderOptions(filtered);
    });
  };

  /**
   * Returns the filter builder to step 1 when the back button is clicked.
   */
  private bindBackButton = (): void => {
    document.getElementById(ElementId.FbBack)?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.goToStep(1);
    });
  };

  /**
   * Resets state when the dropdown closes and ensures the filter panel is
   * visible when the dropdown opens.
   */
  private bindDropdownEvents = (): void => {
    if (!this.addFilterBtn) return;

    this.addFilterBtn.addEventListener(BsEvent.DropdownHide, () => {
      this.goToStep(1);
      const inp = document.getElementById(ElementId.FbValueInput) as HTMLInputElement | null;
      if (inp) inp.value = '';
      const list: HTMLElement | null = document.getElementById(ElementId.FbOptionsList);
      if (list) list.innerHTML = '';
      this.activeParam = null;
      this.allOptions = [];
    });

    this.addFilterBtn.addEventListener(BsEvent.DropdownShow, () => {
      this.filterPanel?.classList.remove(CssClass.Hidden);
    });
  };

  /**
   * Switches the filter builder between step 1 (column selection) and
   * step 2 (value selection) by toggling `d-none` on the step containers.
   *
   * @param step - The step number to show (`1` or `2`).
   */
  private goToStep = (step: 1 | 2): void => {
    document.getElementById(ElementId.FbStep1)?.classList.toggle(CssClass.Hidden, step !== 1);
    document.getElementById(ElementId.FbStep2)?.classList.toggle(CssClass.Hidden, step !== 2);
  };
}

new ActionColumnController();
new FrozenColumnController();
new FilterPanelController();
new FilterBuilderController();
