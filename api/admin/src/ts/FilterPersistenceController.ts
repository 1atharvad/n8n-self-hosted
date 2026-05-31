import { StorageKey } from './consts';

export class FilterPersistenceController {
  private static readonly NAV_ONLY = new Set(['page', 'pageSize', 'sortBy', 'sort']);
  private readonly storageKey: string;

  constructor() {
    this.storageKey = `${StorageKey.Filters}:${window.location.pathname}`;
    this.init();
  }

  private init = (): void => {
    const params = new URLSearchParams(window.location.search);
    const filterEntries: [string, string][] = [];
    params.forEach((v, k) => {
      if (!FilterPersistenceController.NAV_ONLY.has(k)) filterEntries.push([k, v]);
    });

    if (filterEntries.length > 0) {
      sessionStorage.setItem(this.storageKey, new URLSearchParams(filterEntries).toString());
    } else {
      const ref = document.referrer;
      const fromAction = ref && /\/(edit|create|details)/.test(ref);
      if (fromAction) {
        const saved = sessionStorage.getItem(this.storageKey);
        if (saved) {
          const restored = new URLSearchParams(window.location.search);
          new URLSearchParams(saved).forEach((v, k) => restored.set(k, v));
          window.location.replace(window.location.pathname + '?' + restored.toString());
        }
      }
    }
  };
}
