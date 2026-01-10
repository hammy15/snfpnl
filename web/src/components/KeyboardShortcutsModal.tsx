import { X } from 'lucide-react';
import { SHORTCUTS_HELP } from '../hooks/useKeyboardShortcuts';
import './KeyboardShortcutsModal.css';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="shortcuts-content">
          {SHORTCUTS_HELP.map(category => (
            <div key={category.category} className="shortcut-category">
              <h3>{category.category}</h3>
              <div className="shortcuts-list">
                {category.shortcuts.map((shortcut, idx) => (
                  <div key={idx} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx}>
                          <kbd>{key}</kbd>
                          {keyIdx < shortcut.keys.length - 1 && <span className="key-plus">+</span>}
                        </span>
                      ))}
                    </div>
                    <span className="shortcut-desc">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="shortcuts-footer">
          <p>Press <kbd>?</kbd> to toggle this help</p>
        </div>
      </div>
    </div>
  );
}
