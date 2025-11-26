/**
 * SenseTech - Dashboard JavaScript
 * Home page functionality after login
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!requireAuth()) return;
  
  // Update user display
  updateUserDisplay();
  
  // Initialize dashboard features
  initQuickAccessibility();
});

// ========================================
// QUICK ACCESSIBILITY TOGGLES
// ========================================

function initQuickAccessibility() {
  const settings = getAccessibilitySettings();
  
  const quickHighContrast = document.getElementById('quickHighContrast');
  const quickLargeCursor = document.getElementById('quickLargeCursor');
  
  if (quickHighContrast) {
    quickHighContrast.checked = settings.highContrast;
    quickHighContrast.addEventListener('change', (e) => {
      settings.highContrast = e.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
      
      // Also update user data
      const user = getCurrentUser();
      if (user) {
        user.accessibility = settings;
        setCurrentUser(user);
        updateUserInStorage(user);
      }
    });
  }
  
  if (quickLargeCursor) {
    quickLargeCursor.checked = settings.largeCursor;
    quickLargeCursor.addEventListener('change', (e) => {
      settings.largeCursor = e.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
      
      // Also update user data
      const user = getCurrentUser();
      if (user) {
        user.accessibility = settings;
        setCurrentUser(user);
        updateUserInStorage(user);
      }
    });
  }
}

// ========================================
// UPDATE USER IN STORAGE
// ========================================

function updateUserInStorage(updatedUser) {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const index = users.findIndex(u => u.id === updatedUser.id);
  
  if (index !== -1) {
    users[index] = updatedUser;
    localStorage.setItem('users', JSON.stringify(users));
  }
}
