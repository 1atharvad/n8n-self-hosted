/**
 * @file consts.ts
 * @description Shared enums, types, and constants used across admin TypeScript modules.
 */

/**
 * Supported theme options for the admin UI.
 * `System` resolves to `Light` or `Dark` at runtime based on the OS preference.
 */
export enum Theme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

/**
 * Keys used for reading and writing values to `localStorage`.
 */
export enum StorageKey {
  Sidebar = 'sidebar-collapsed',
  Theme = 'admin-theme',
  Filters = 'sqladmin_filters',
}

/**
 * CSS selector strings for querying DOM elements.
 * Using an enum prevents raw selector strings from being scattered across modules.
 */
export enum Selector {
  SidebarToggle = '#sidebar-toggle',
  ThemeCard = '.theme-card',
  ThemeRadio = '.theme-radio',
  /** Key name used to read `HTMLElement.dataset.themeValue` */
  ThemeValue = 'themeValue',
  ActionCol = '.table-actions-col',
  ActionMenuBtn = '.btn-action-menu',
  TableScrollBar = '.table-scroll-bar .table',
  FreezeCol = 'td, th',
  FbColItem = '.fb-col-item',
  FbOptionItem = '.fb-option-item',
}

/**
 * CSS class names applied or removed during runtime UI interactions.
 */
export enum CssClass {
  SidebarCollapsed = 'sidebar-collapsed',
  ThemeCardActive = 'theme-card-active',
  FreezeCol = 'freeze-col',
  FreezeColLast = 'freeze-col-last',
  Hidden = 'd-none',
}

/**
 * Bootstrap HTML attribute names set on DOM elements.
 */
export enum BsAttr {
  Theme = 'data-bs-theme',
}

/**
 * Bootstrap dropdown event names.
 */
export enum BsEvent {
  DropdownHide = 'hidden.bs.dropdown',
  DropdownShow = 'show.bs.dropdown',
}

/**
 * `id` attribute values for elements queried via `document.getElementById`.
 */
export enum ElementId {
  FiltersToggle = 'filters-toggle',
  FilterPanel = 'filter-panel',
  AddFilterBtn = 'add-filter-btn',
  FbStep1 = 'fb-step-1',
  FbStep2 = 'fb-step-2',
  FbColLabel = 'fb-col-label',
  FbValueInput = 'fb-value-input',
  FbOptionsList = 'fb-options-list',
  FbBack = 'fb-back',
}

/**
 * CSS custom property names set as inline styles on DOM elements.
 */
export enum CssVar {
  FreezeLeft = '--freeze-left',
}

/**
 * A resolved theme that has been narrowed from `Theme`.
 * Excludes `Theme.System` — by the time a theme is applied to the DOM it must be concrete.
 */
export type ResolvedTheme = Theme.Light | Theme.Dark;
