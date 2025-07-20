import React, { useState, useEffect } from 'react';
import { getUserSettings, UserSettings } from '../utils/localStorage';

interface UserAvatarProps {
  onClick: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ onClick }) => {
  const [userSettings, setUserSettings] = useState<UserSettings>({
    name: '',
    email: '',
    title: '',
    avatar: undefined,
  });

  useEffect(() => {
    const settings = getUserSettings();
    setUserSettings(settings);

    // Listen for storage changes to update avatar when settings change
    const handleStorageChange = () => {
      const updatedSettings = getUserSettings();
      setUserSettings(updatedSettings);
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event in case of same-tab updates
    window.addEventListener('userSettingsUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userSettingsUpdated', handleStorageChange);
    };
  }, []);

  const getInitials = (name: string): string => {
    if (!name.trim()) return '👤';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = userSettings.name || 'User';

  return (
    <button
      className="user-avatar-button"
      onClick={onClick}
      title={`${displayName}${userSettings.title ? ` - ${userSettings.title}` : ''}\nClick to edit settings`}
    >
      <div className="user-avatar">
        {userSettings.avatar ? (
          <img 
            src={userSettings.avatar} 
            alt={displayName}
            className="user-avatar-image"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const initials = e.currentTarget.parentElement?.querySelector('.user-avatar-initials');
              if (initials) {
                (initials as HTMLElement).style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div 
          className="user-avatar-initials"
          style={{ display: userSettings.avatar ? 'none' : 'flex' }}
        >
          {getInitials(userSettings.name)}
        </div>
      </div>
      <span className="user-avatar-name">{displayName}</span>
    </button>
  );
};