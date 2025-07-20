export interface UserSettings {
  name: string;
  email: string;
  title: string;
  avatar?: string;
}

export interface AppSettings {
  selectedBoardId: number | null;
  userSettings: UserSettings;
  autoFillCommentAuthor: boolean;
}

const STORAGE_KEY = 'kanban-app-settings';

const defaultUserSettings: UserSettings = {
  name: '',
  email: '',
  title: '',
  avatar: undefined,
};

const defaultAppSettings: AppSettings = {
  selectedBoardId: null,
  userSettings: defaultUserSettings,
  autoFillCommentAuthor: true,
};

export const getStoredSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new fields
      return {
        ...defaultAppSettings,
        ...parsed,
        userSettings: {
          ...defaultUserSettings,
          ...parsed.userSettings,
        },
      };
    }
  } catch (error) {
    console.warn('Failed to parse stored settings:', error);
  }
  return defaultAppSettings;
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export const updateUserSettings = (userSettings: Partial<UserSettings>): void => {
  const currentSettings = getStoredSettings();
  const updatedSettings: AppSettings = {
    ...currentSettings,
    userSettings: {
      ...currentSettings.userSettings,
      ...userSettings,
    },
  };
  saveSettings(updatedSettings);
};

export const updateSelectedBoard = (boardId: number | null): void => {
  const currentSettings = getStoredSettings();
  const updatedSettings: AppSettings = {
    ...currentSettings,
    selectedBoardId: boardId,
  };
  saveSettings(updatedSettings);
};

export const getUserSettings = (): UserSettings => {
  return getStoredSettings().userSettings;
};

export const getSelectedBoardId = (): number | null => {
  return getStoredSettings().selectedBoardId;
};

export const getAutoFillCommentAuthor = (): boolean => {
  return getStoredSettings().autoFillCommentAuthor;
};

export const updateAutoFillCommentAuthor = (enabled: boolean): void => {
  const currentSettings = getStoredSettings();
  const updatedSettings: AppSettings = {
    ...currentSettings,
    autoFillCommentAuthor: enabled,
  };
  saveSettings(updatedSettings);
};