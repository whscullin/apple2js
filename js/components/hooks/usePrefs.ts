import Prefs from 'js/prefs';

// Todo(whscullin): More robust preferences

const prefs = new Prefs();

export const usePrefs = () => prefs;
