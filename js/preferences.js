/**
 * SenseTech - Preferences JavaScript
 * User profile and accessibility settings with Supabase integration
 */

let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication with Supabase
  const authenticated = await requireAuthSupabase();
  if (!authenticated) return;
  
  // Load user data from Supabase
  await loadUserDataFromDB();
  
  // Initialize preferences
  initPreferencesNav();
  initPersonalInfoForm();
  initAccessibilityForm();
  initPhotoUpload();
  
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
// LOAD USER DATA FROM DATABASE
// ========================================

async function loadUserDataFromDB() {
  const { user, profile } = await getCurrentUserWithProfile();
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = user;
  currentProfile = profile;
  
  // Update UI
  updatePreferencesUI();
  
  // Show admin button if user is admin
  if (profile?.role === 'admin') {
    showAdminButton();
  }
}

function showAdminButton() {
  const navbarNav = document.querySelector('.navbar-nav');
  if (navbarNav && !document.getElementById('adminNavLink')) {
    const adminLink = document.createElement('a');
    adminLink.id = 'adminNavLink';
    adminLink.href = 'admin.html';
    adminLink.className = 'nav-link admin-link';
    adminLink.innerHTML = '⚙️ Panel de Control';
    navbarNav.appendChild(adminLink);
  }
  
  const userMenuDropdown = document.querySelector('.user-menu-dropdown');
  if (userMenuDropdown && !document.getElementById('adminMenuLink')) {
    const divider = userMenuDropdown.querySelector('.user-menu-divider');
    if (divider) {
      const adminMenuItem = document.createElement('a');
      adminMenuItem.id = 'adminMenuLink';
      adminMenuItem.href = 'admin.html';
      adminMenuItem.className = 'user-menu-item admin-menu-item';
      adminMenuItem.innerHTML = '<span>⚙️</span> Panel de Control';
      divider.parentNode.insertBefore(adminMenuItem, divider);
    }
  }
}

function updatePreferencesUI() {
  // Personal info
  const editName = document.getElementById('editName');
  const editEmail = document.getElementById('editEmail');
  const profileAvatar = document.getElementById('profileAvatar');
  
  if (editName) editName.value = currentProfile?.name || '';
  if (editEmail) editEmail.value = currentUser?.email || '';
  
  if (profileAvatar) {
    if (currentProfile?.photo_url) {
      profileAvatar.innerHTML = `<img src="${currentProfile.photo_url}" alt="${currentProfile.name}">`;
    } else {
      profileAvatar.textContent = currentProfile?.name ? currentProfile.name.charAt(0).toUpperCase() : 'U';
    }
  }
  
  // Update navbar avatar
  const userAvatar = document.querySelector('.user-menu-trigger .avatar');
  const userName = document.querySelector('.user-menu-header h5');
  const userEmail = document.querySelector('.user-menu-header p');
  
  if (userAvatar && currentProfile) {
    if (currentProfile.photo_url) {
      userAvatar.innerHTML = `<img src="${currentProfile.photo_url}" alt="${currentProfile.name}">`;
    } else {
      userAvatar.textContent = currentProfile.name ? currentProfile.name.charAt(0).toUpperCase() : 'U';
    }
  }
  
  if (userName && currentProfile) {
    userName.textContent = currentProfile.name || 'Usuario';
  }
  
  if (userEmail && currentUser) {
    userEmail.textContent = currentUser.email;
  }
  
  // Accessibility settings
  const settings = currentProfile?.accessibility_settings || getAccessibilitySettings();
  
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
      updatePreferencesUI();
      clearFormErrors(form);
    });
  }
  
  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    clearFormErrors(form);
    
    if (!currentUser || !currentProfile) return;
    
    const newName = form.fullName.value.trim();
    const newEmail = form.email.value.trim();
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmNewPassword = form.confirmNewPassword.value;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
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
    }
    
    // Validate password change (if attempting)
    if (newPassword || confirmNewPassword || currentPassword) {
      if (!currentPassword) {
        showFormError('currentPassword', 'Ingresa tu contraseña actual');
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
    
    // Show loading
    submitBtn.innerHTML = '<span class="loading-spinner" style="width: 20px; height: 20px;"></span> Guardando...';
    submitBtn.disabled = true;
    
    try {
      // Update profile name in database
      if (newName !== currentProfile.name) {
        const { error: profileError } = await updateUserProfile(currentUser.id, { name: newName });
        if (profileError) throw profileError;
        currentProfile.name = newName;
      }
      
      // Update email if changed (Supabase Auth)
      if (newEmail !== currentUser.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) {
          if (emailError.message.includes('already registered')) {
            showFormError('editEmail', 'Este correo ya está en uso');
          } else {
            showFormError('editEmail', emailError.message);
          }
          throw emailError;
        }
      }
      
      // Update password if provided
      if (newPassword && currentPassword) {
        // First verify current password by re-authenticating
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: currentUser.email,
          password: currentPassword
        });
        
        if (signInError) {
          showFormError('currentPassword', 'Contraseña actual incorrecta');
          throw signInError;
        }
        
        // Update to new password
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) {
          showFormError('newPassword', passwordError.message);
          throw passwordError;
        }
      }
      
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
      
      // Update UI
      updatePreferencesUI();
      
      showToast('Información actualizada correctamente');
    } catch (error) {
      console.error('Update error:', error);
    } finally {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    }
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
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    // Get current selections
    const activeTextSize = document.querySelector('.text-size-btn.active');
    
    const settings = {
      textSize: activeTextSize ? activeTextSize.dataset.size : 'medium',
      highContrast: prefHighContrast ? prefHighContrast.checked : false,
      largeCursor: prefLargeCursor ? prefLargeCursor.checked : false,
      screenReader: false
    };
    
    // Show loading
    submitBtn.innerHTML = '<span class="loading-spinner" style="width: 20px; height: 20px;"></span> Guardando...';
    submitBtn.disabled = true;
    
    // Save to database
    const { error } = await updateAccessibilityInDB(currentUser.id, settings);
    
    if (error) {
      showToast('Error al guardar preferencias', 'error');
      console.error('Accessibility update error:', error);
    } else {
      // Save locally
      saveAccessibilitySettings(settings);
      currentProfile.accessibility_settings = settings;
      showToast('Preferencias de accesibilidad guardadas');
    }
    
    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;
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
    photoInput.addEventListener('change', async (e) => {
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
      
      if (!currentUser) return;
      
      // Show loading state on avatar
      if (profileAvatar) {
        profileAvatar.innerHTML = '<span class="loading-spinner"></span>';
      }
      
      // Upload to Supabase Storage
      const { url, error } = await uploadProfilePhoto(currentUser.id, file);
      
      if (error) {
        showToast('Error al subir la imagen', 'error');
        console.error('Upload error:', error);
        updatePreferencesUI();
        return;
      }
      
      // Update avatar with new URL
      if (profileAvatar && url) {
        profileAvatar.innerHTML = `<img src="${url}" alt="Foto de perfil">`;
        currentProfile.photo_url = url;
      }
      
      updatePreferencesUI();
      showToast('Foto actualizada correctamente');
    });
  }
  
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', async () => {
      if (!currentUser || !currentProfile) return;
      
      // Update profile to remove photo
      const { error } = await updateUserProfile(currentUser.id, { photo_url: null });
      
      if (error) {
        showToast('Error al eliminar la foto', 'error');
        return;
      }
      
      currentProfile.photo_url = null;
      
      // Update avatar
      if (profileAvatar) {
        profileAvatar.innerHTML = '';
        profileAvatar.textContent = currentProfile.name ? currentProfile.name.charAt(0).toUpperCase() : 'U';
      }
      
      updatePreferencesUI();
      showToast('Foto eliminada');
      
      // Clear input
      if (photoInput) {
        photoInput.value = '';
      }
    });
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
