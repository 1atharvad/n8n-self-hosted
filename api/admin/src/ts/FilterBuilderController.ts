import { Selector, CssClass, BsEvent, ElementId } from './consts';

export class FilterBuilderController {
  private readonly addFilterBtn: HTMLElement | null;
  private readonly filterPanel: HTMLElement | null;

  private activeParam: string | null = null;
  private allOptions: string[] = [];

  constructor() {
    this.addFilterBtn = document.getElementById(ElementId.AddFilterBtn);
    this.filterPanel = document.getElementById(ElementId.FilterPanel);
    this.init();
  }

  private init = (): void => {
    this.bindColumnItems();
    this.bindSearchInput();
    this.bindBackButton();
    this.bindDropdownEvents();
  };

  private getActiveValues = (): string[] => {
    if (!this.activeParam) return [];
    const existing: string | null = new URL(window.location.href).searchParams.get(this.activeParam);
    return existing ? existing.split(',').map((v: string) => v.trim()).filter(Boolean) : [];
  };

  private filterAvailable = (options: string[]): string[] => {
    const active: Set<string> = new Set(this.getActiveValues());
    return options.filter((o: string) => !active.has(o));
  };

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

  private bindBackButton = (): void => {
    document.getElementById(ElementId.FbBack)?.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.goToStep(1);
    });
  };

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

  private goToStep = (step: 1 | 2): void => {
    document.getElementById(ElementId.FbStep1)?.classList.toggle(CssClass.Hidden, step !== 1);
    document.getElementById(ElementId.FbStep2)?.classList.toggle(CssClass.Hidden, step !== 2);
  };
}
