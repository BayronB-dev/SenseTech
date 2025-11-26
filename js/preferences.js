/**
 * SenseTech - Preferences JavaScript
 * User profile and accessibility settings management
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!requireAuth()) return;
  
  // Update user display
  updateUserDisplay();
  
  // Initialize preferences
  initPreferencesNav();
  initPersonalInfoForm();
  initAccessibilityForm();
  initPhotoUpload();
  loadUserData();
  
  // Check for hash navigation
  handleHashNavigation();
});

// ========================================
// PREFERENCES NAVIGATION
// ========================================

function initPreferencesNav() {
  const navItems = document.querySelectorAll('.preferences-nav-item');
  const sections = document.querySelectorAll('.preferences-section');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      
      // Update nav
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Update sections
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionId) {
          section.classList.add('active');
        }
      });
      
      // Update URL hash
      history.replaceState(null, null, `#${sectionId}`);
    });
  });
}

function handleHashNavigation() {
  const hash = window.location.hash.replace('#', '');
  
  if (hash) {
    const navItem = document.querySelector(`.preferences-nav-item[data-section="${hash}"]`);
    if (navItem) {
      navItem.click();
    }
  }
}

// ========================================
// LOAD USER DATA
// ========================================

function loadUserData() {
  const user = getCurrentUser();
  
  if (!user) return;
  
  // Personal info
  const editName = document.getElementById('editName');
  const editEmail = document.getElementById('editEmail');
  const profileAvatar = document.getElementById('profileAvatar');
  
  if (editName) editName.value = user.name || '';
  if (editEmail) editEmail.value = user.email || '';
  
  if (profileAvatar) {
    if (user.photo) {
      profileAvatar.innerHTML = `<img src="${user.photo}" alt="${user.name}">`;
    } else {
      profileAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    }
  }
  
  // Accessibility settings
  const settings = user.accessibility || getAccessibilitySettings();
  
  // Text size
  const textSizeBtns = document.querySelectorAll('.text-size-btn');
  textSizeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.size === settings.textSize) {
      btn.classList.add('active');
    }
  });
  
  // Toggles
  const prefHighContrast = document.getElementById('prefHighContrast');
  const prefLargeCursor = document.getElementById('prefLargeCursor');
  
  if (prefHighContrast) prefHighContrast.checked = settings.highContrast;
  if (prefLargeCursor) prefLargeCursor.checked = settings.largeCursor;
}

// ========================================
// PERSONAL INFO FORM
// ========================================

function initPersonalInfoForm() {
  const form = document.getElementById('personalInfoForm');
  const cancelBtn = document.getElementById('cancelPersonalBtn');
  
  if (!form) return;
  
  // Password strength
  const newPasswordInput = document.getElementById('newPassword');
  const strengthContainer = document.getElementById('newPasswordStrength');
  
  if (newPasswordInput && strengthContainer) {
    newPasswordInput.addEventListener('input', () => {
      updatePasswordStrength(newPasswordInput, strengthContainer);
    });
  }
  
  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      loadUserData();
      clearFormErrors(form);
    });
  }
  
  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    clearFormErrors(form);
    
    const user = getCurrentUser();
    if (!user) return;
    
    const newName = form.fullName.value.trim();
    const newEmail = form.email.value.trim();
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmNewPassword = form.confirmNewPassword.value;
    
    let isValid = true;
    
    // Validate name
    if (!newName) {
      showFormError('editName', 'El nombre es requerido');
      isValid = false;
    } else if (newName.length < 2) {
      showFormError('editName', 'El nombre debe tener al menos 2 caracteres');
      isValid = false;
    }
    
    // Validate email
    if (!newEmail) {
      showFormError('editEmail', 'El correo es requerido');
      isValid = false;
    } else if (!validateEmail(newEmail)) {
      showFormError('editEmail', 'Ingresa un correo válido');
      isValid = false;
    } else if (newEmail !== user.email) {
      // Check if email is already taken
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      if (users.some(u => u.email === newEmail && u.id !== user.id)) {
        showFormError('editEmail', 'Este correo ya está en uso');
        isValid = false;
      }
    }
    
    // Validate password change (if attempting)
    if (newPassword || confirmNewPassword || currentPassword) {
      if (!currentPassword) {
        showFormError('currentPassword', 'Ingresa tu contraseña actual');
        isValid = false;
      } else if (currentPassword !== user.password) {
        showFormError('currentPassword', 'Contraseña incorrecta');
        isValid = false;
      }
      
      if (!newPassword) {
        showFormError('newPassword', 'Ingresa la nueva contraseña');
        isValid = false;
      } else if (newPassword.length < 6) {
        showFormError('newPassword', 'Mínimo 6 caracteres');
        isValid = false;
      }
      
      if (newPassword !== confirmNewPassword) {
        showFormError('confirmNewPassword', 'Las contraseñas no coinciden');
        isValid = false;
      }
    }
    
    if (!isValid) return;
    
    // Update user
    user.name = newName;
    user.email = newEmail;
    
    if (newPassword) {
      user.password = newPassword;
    }
    
    // Save
    setCurrentUser(user);
    updateUserInStorage(user);
    updateUserDisplay();
    
    // Clear password fields
    form.currentPassword.value = '';
    form.newPassword.value = '';
    form.confirmNewPassword.value = '';
    
    // Reset password strength
    if (strengthContainer) {
      const fill = strengthContainer.querySelector('.strength-fill');
      const text = strengthContainer.querySelector('.strength-text');
      if (fill) {
        fill.className = 'strength-fill';
        fill.style.width = '0';
      }
      if (text) text.textContent = '';
    }
    
    showToast('Información actualizada correctamente');
  });
}

// ========================================
// ACCESSIBILITY FORM
// ========================================

function initAccessibilityForm() {
  const form = document.getElementById('accessibilityForm');
  const resetBtn = document.getElementById('resetAccessibilityBtn');
  
  if (!form) return;
  
  // Text size buttons
  const textSizeBtns = document.querySelectorAll('.text-size-btn');
  textSizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      textSizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Apply immediately
      document.documentElement.setAttribute('data-text-size', btn.dataset.size);
    });
  });
  
  // Toggle switches - apply immediately
  const prefHighContrast = document.getElementById('prefHighContrast');
  const prefLargeCursor = document.getElementById('prefLargeCursor');
  
  if (prefHighContrast) {
    prefHighContrast.addEventListener('change', (e) => {
      document.documentElement.setAttribute('data-high-contrast', e.target.checked);
    });
  }
  
  if (prefLargeCursor) {
    prefLargeCursor.addEventListener('change', (e) => {
      document.documentElement.setAttribute('data-large-cursor', e.target.checked);
    });
  }
  
  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Reset to defaults
      textSizeBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.size === 'medium') {
          btn.classList.add('active');
        }
      });
      
      if (prefHighContrast) prefHighContrast.checked = false;
      if (prefLargeCursor) prefLargeCursor.checked = false;
      
      // Apply defaults
      document.documentElement.setAttribute('data-text-size', 'medium');
      document.documentElement.setAttribute('data-high-contrast', 'false');
      document.documentElement.setAttribute('data-large-cursor', 'false');
    });
  }
  
  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) return;
    
    // Get current selections
    const activeTextSize = document.querySelector('.text-size-btn.active');
    
    const settings = {
      textSize: activeTextSize ? activeTextSize.dataset.size : 'medium',
      highContrast: prefHighContrast ? prefHighContrast.checked : false,
      largeCursor: prefLargeCursor ? prefLargeCursor.checked : false,
      screenReader: false
    };
    
    // Save to user
    user.accessibility = settings;
    setCurrentUser(user);
    updateUserInStorage(user);
    
    // Save to accessibility settings
    saveAccessibilitySettings(settings);
    
    showToast('Preferencias de accesibilidad guardadas');
  });
}

// ========================================
// PHOTO UPLOAD
// ========================================

function initPhotoUpload() {
  const photoInput = document.getElementById('photoInput');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const profileAvatar = document.getElementById('profileAvatar');
  
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      
      if (!file) return;
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        showToast('La imagen debe ser menor a 2MB', 'error');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast('Solo se permiten imágenes', 'error');
        return;
      }
      
      // Read and display
      const reader = new FileReader();
      reader.onload = (event) => {
        const photoData = event.target.result;
        
        // Update avatar
        if (profileAvatar) {
          profileAvatar.innerHTML = `<img src="${photoData}" alt="Foto de perfil">`;
        }
        
        // Save to user
        const user = getCurrentUser();
        if (user) {
          user.photo = photoData;
          setCurrentUser(user);
          updateUserInStorage(user);
          updateUserDisplay();
        }
        
        showToast('Foto actualizada correctamente');
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      const user = getCurrentUser();
      
      if (user) {
        user.photo = null;
        setCurrentUser(user);
        updateUserInStorage(user);
        
        // Update avatar
        if (profileAvatar) {
          profileAvatar.innerHTML = '';
          profileAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
        }
        
        updateUserDisplay();
        showToast('Foto eliminada');
      }
      
      // Clear input
      if (photoInput) {
        photoInput.value = '';
      }
    });
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function updateUserInStorage(updatedUser) {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const index = users.findIndex(u => u.id === updatedUser.id);
  
  if (index !== -1) {
    users[index] = updatedUser;
    localStorage.setItem('users', JSON.stringify(users));
  }
}

function showFormError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorDiv = document.getElementById(`${fieldId}Error`);
  
  if (input) {
    input.classList.add('error');
  }
  
  if (errorDiv) {
    errorDiv.innerHTML = `<span>⚠️</span> ${message}`;
    errorDiv.style.display = 'flex';
  }
}

function clearFormErrors(form) {
  form.querySelectorAll('.form-input.error').forEach(input => {
    input.classList.remove('error');
  });
  
  form.querySelectorAll('.form-error').forEach(error => {
    error.innerHTML = '';
    error.style.display = 'none';
  });
}
