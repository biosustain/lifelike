/**
 * Maintain enum to avoid misspelling
 */
export enum TRACKING_CATEGORIES {
  workbench = 'workbench'
}

/**
 * Maintain enum to avoid misspelling
 */
export enum TRACKING_ACTIONS {
  activeTabChanged = 'active_tab_changed'
}

/**
 * Represents a user action of interest occurring in the client.
 * Ressembles common fields used for event tracking by some popular
 * analytics tools like Google Analytics, Matomo and others.
 */
export interface TrackingEvent {
  /**
   * The type of event to track. (e.g. tabs, files, annotations, sankeys
   */
  category: TRACKING_CATEGORIES;
  /**
   * The specific action that is taken. (e.g. open, download, save, delete, annotate)
   */
  action: TRACKING_ACTIONS;
  /**
   * Optional name or reference to the element that is being interacted with. (e.g. my-paper.pdf, my-project, my-search-query)
   */
  label?: string;
  /**
   * Optional positive numeric value (e.g. file size, number of annotations, time spent)
   */
  value?: number;
  /**
   * Reference url related to the event
   */
  url?: string;
}
