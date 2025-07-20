import React, { useState, useEffect } from 'react';
import { UserSettings as UserSettingsType, getUserSettings, updateUserSettings } from '../utils/localStorage';

interface UserSettingsProps {
  onClose: () => void;
}

export const UserSettings: React.FC<UserSettingsProps> = ({ onClose }) => {
  const [formData, setFormData] = useState<UserSettingsType>({
    name: '',
    email: '',
    title: '',
    avatar: '',
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const settings = getUserSettings();
    setFormData(settings);
  }, []);

  const handleInputChange = (field: keyof UserSettingsType, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const settingsToSave = {
      ...formData,
      avatar: formData.avatar || undefined,
    };
    updateUserSettings(settingsToSave);
    setHasChanges(false);
    
    // Dispatch custom event to update avatar in other components
    window.dispatchEvent(new CustomEvent('userSettingsUpdated'));
    
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal user-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>User Settings</h3>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-content">
          <div className="user-settings-form">
            {/* Avatar Preview */}
            <div className="avatar-section">
              <div className="avatar-preview">
                {formData.avatar ? (
                  <img 
                    src={formData.avatar} 
                    alt="Avatar" 
                    className="avatar-image"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : (
                  <div className="avatar-initials">
                    {formData.name ? getInitials(formData.name) : '👤'}
                  </div>
                )}
              </div>
              <div className="avatar-info">
                <h4>{formData.name || 'Your Name'}</h4>
                <p>{formData.title || 'Your Title'}</p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="settings-section">
              <h4>Personal Information</h4>
              
              <div className="form-group">
                <label htmlFor="user-name">Full Name</label>
                <input
                  id="user-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user-email">Email Address</label>
                <input
                  id="user-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter your email address"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user-title">Job Title</label>
                <input
                  id="user-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter your job title"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user-avatar">Avatar URL (optional)</label>
                <input
                  id="user-avatar"
                  type="url"
                  value={formData.avatar || ''}
                  onChange={(e) => handleInputChange('avatar', e.target.value)}
                  placeholder="https://example.com/your-avatar.jpg"
                />
                <small className="form-help">
                  Enter a URL to an image for your avatar, or leave blank to use initials.
                </small>
              </div>
            </div>

            {/* Storage Information */}
            <div className="settings-section">
              <h4>Data Storage</h4>
              <div className="storage-info">
                <p>
                  <strong>📱 Local Storage:</strong> Your settings are stored locally in your browser. 
                  They won't be shared with other devices or users.
                </p>
                <p>
                  <strong>🔒 Privacy:</strong> Your information is never sent to any server and 
                  remains completely private.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            <span className="storage-indicator">
              💾 Stored locally in browser
            </span>
          </div>
          <div className="footer-right">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};