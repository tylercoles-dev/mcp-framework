import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">User Settings</h3>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Avatar Preview */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--spacing-lg)', 
            padding: 'var(--spacing-lg)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-full)',
              background: formData.avatar ? `url(${formData.avatar})` : 'var(--color-primary)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              color: 'white',
              fontWeight: '600',
              border: '3px solid var(--color-border)',
              boxShadow: 'var(--shadow-md)'
            }}>
              {!formData.avatar && (formData.name ? getInitials(formData.name) : '👤')}
            </div>
            <div>
              <h4 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: 'var(--color-text-primary)', 
                margin: '0 0 var(--spacing-xs) 0' 
              }}>
                {formData.name || 'Your Name'}
              </h4>
              <p style={{ 
                fontSize: '0.875rem', 
                color: 'var(--color-text-secondary)', 
                margin: '0' 
              }}>
                {formData.title || 'Your Title'}
              </p>
            </div>
          </div>

          {/* Personal Information */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h4 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              marginBottom: 'var(--spacing-md)', 
              color: 'var(--color-text-primary)' 
            }}>
              Personal Information
            </h4>
            
            <div className="form-group">
              <label htmlFor="user-name" className="form-label">Full Name</label>
              <input
                id="user-name"
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-email" className="form-label">Email Address</label>
              <input
                id="user-email"
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter your email address"
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-title" className="form-label">Job Title</label>
              <input
                id="user-title"
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter your job title"
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-avatar" className="form-label">Avatar URL (optional)</label>
              <input
                id="user-avatar"
                type="url"
                className="form-input"
                value={formData.avatar || ''}
                onChange={(e) => handleInputChange('avatar', e.target.value)}
                placeholder="https://example.com/your-avatar.jpg"
              />
              <div style={{ 
                fontSize: '0.875rem', 
                color: 'var(--color-text-tertiary)', 
                marginTop: 'var(--spacing-xs)' 
              }}>
                Enter a URL to an image for your avatar, or leave blank to use initials.
              </div>
            </div>
          </div>

          {/* Storage Information */}
          <div style={{ 
            padding: 'var(--spacing-lg)',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <h4 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              marginBottom: 'var(--spacing-sm)', 
              color: 'var(--color-info)' 
            }}>
              Data Storage & Privacy
            </h4>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 var(--spacing-sm) 0' }}>
                <strong>📱 Local Storage:</strong> Your settings are stored locally in your browser and won't be shared with other devices or users.
              </p>
              <p style={{ margin: '0' }}>
                <strong>🔒 Privacy:</strong> Your information is never sent to any server and remains completely private.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--color-text-tertiary)' }}>
            💾 Stored locally in browser
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
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
    </div>,
    document.body
  );
};