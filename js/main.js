/**
 * SenseTech - Main JavaScript
 * Core functionality for theme, navigation, animations, and accessibility
 */

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  initMobileMenu();
  initScrollAnimations();
  initAccessibilitySettings();
  initUserMenu();
  initRippleEffect();
});

// ========================================
// THEME TOGGLE
// ========================================

function initTheme() {
  const themeToggles = document.querySelectorAll('.theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'light';
  
  // Apply saved theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  themeToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Add animation class
      document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    });
  });
}

// ========================================
// NAVBAR
// ========================================

function initNavbar() {
  const navbar = document.querySelector('.navbar');
  
  if (!navbar) return;
  
  // Scroll effect
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
  });
}

// ========================================
// MOBILE MENU
// ========================================

function initMobileMenu() {
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  
  if (!menuToggle || !mobileNav) return;
  
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.classList.toggle('active');
    mobileNav.classList.toggle('active');
    menuToggle.setAttribute('aria-expanded', isOpen);
    mobileNav.setAttribute('aria-hidden', !isOpen);
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  
  // Close menu when clicking a link
  mobileNav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      menuToggle.classList.remove('active');
      mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

// ========================================
// USER MENU DROPDOWN
// ========================================

function initUserMenu() {
  const userMenu = document.querySelector('.user-menu');
  
  if (!userMenu) return;
  
  const trigger = userMenu.querySelector('.user-menu-trigger');
  
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = userMenu.classList.toggle('active');
    trigger.setAttribute('aria-expanded', isOpen);
  });
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target)) {
      userMenu.classList.remove('active');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
  
  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      userMenu.classList.remove('active');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

// ========================================
// SCROLL ANIMATIONS
// ========================================

function initScrollAnimations() {
  // Animate individual elements
  const animatedElements = document.querySelectorAll('[data-animate]');
  
  if (animatedElements.length) {
    const elementObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add small delay for staggered effect
          const delay = entry.target.dataset.delay || 0;
          setTimeout(() => {
            entry.target.classList.add('animated');
          }, parseInt(delay));
          elementObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -80px 0px'
    });
    
    animatedElements.forEach(el => elementObserver.observe(el));
  }
  
  // Animate sections
  const sections = document.querySelectorAll('[data-section-animate]');
  
  if (sections.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
          sectionObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -50px 0px'
    });
    
    sections.forEach(section => sectionObserver.observe(section));
  }
}

// ========================================
// ACCESSIBILITY SETTINGS
// ========================================

function initAccessibilitySettings() {
  // Load saved settings
  const settings = getAccessibilitySettings();
  applyAccessibilitySettings(settings);
  
  // Quick accessibility toggles (on dashboard)
  const quickHighContrast = document.getElementById('quickHighContrast');
  const quickLargeCursor = document.getElementById('quickLargeCursor');
  
  if (quickHighContrast) {
    quickHighContrast.checked = settings.highContrast;
    quickHighContrast.addEventListener('change', (e) => {
      settings.highContrast = e.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
    });
  }
  
  if (quickLargeCursor) {
    quickLargeCursor.checked = settings.largeCursor;
    quickLargeCursor.addEventListener('change', (e) => {
      settings.largeCursor = e.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
    });
  }
}

function getAccessibilitySettings() {
  const defaults = {
    textSize: 'medium',
    highContrast: false,
    largeCursor: false,
    screenReader: false
  };
  
  try {
    const saved = localStorage.getItem('accessibilitySettings');
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch {
    return defaults;
  }
}

function saveAccessibilitySettings(settings) {
  localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
}

function applyAccessibilitySettings(settings) {
  const html = document.documentElement;
  
  // Text size
  html.setAttribute('data-text-size', settings.textSize);
  
  // High contrast
  html.setAttribute('data-high-contrast', settings.highContrast);
  
  // Large cursor
  html.setAttribute('data-large-cursor', settings.largeCursor);
}

// ========================================
// RIPPLE EFFECT
// ========================================

function initRippleEffect() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      
      ripple.className = 'ripple';
      ripple.style.left = `${e.clientX - rect.left}px`;
      ripple.style.top = `${e.clientY - rect.top}px`;
      
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// ========================================
// PASSWORD TOGGLE
// ========================================

document.querySelectorAll('.password-toggle').forEach(toggle => {
  toggle.addEventListener('click', function() {
    const wrapper = this.closest('.password-wrapper');
    const input = wrapper.querySelector('input');
    const icon = this.querySelector('.eye-icon');
    
    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = '🙈';
    } else {
      input.type = 'password';
      icon.textContent = '👁️';
    }
  });
});

// ========================================
// UTILITY FUNCTIONS
// ========================================

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${message}`;
  toast.style.background = type === 'success' ? 'var(--success-500)' : 'var(--error-500)';
  toast.style.transform = 'translateY(0)';
  toast.style.opacity = '1';
  
  setTimeout(() => {
    toast.style.transform = 'translateY(100px)';
    toast.style.opacity = '0';
  }, 3000);
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function getPasswordStrength(password) {
  let strength = 0;
  
  if (password.length >= 6) strength++;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  if (strength <= 1) return { level: 'weak', text: 'Débil', class: 'weak' };
  if (strength <= 2) return { level: 'fair', text: 'Regular', class: 'fair' };
  if (strength <= 3) return { level: 'good', text: 'Buena', class: 'good' };
  return { level: 'strong', text: 'Fuerte', class: 'strong' };
}

function updatePasswordStrength(input, strengthContainer) {
  const password = input.value;
  const fill = strengthContainer.querySelector('.strength-fill');
  const text = strengthContainer.querySelector('.strength-text');
  
  if (!password) {
    fill.className = 'strength-fill';
    fill.style.width = '0';
    text.textContent = '';
    return;
  }
  
  const strength = getPasswordStrength(password);
  fill.className = `strength-fill ${strength.class}`;
  text.textContent = strength.text;
}

// ========================================
// USER SESSION MANAGEMENT
// ========================================

function getCurrentUser() {
  try {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

// Update user info in navbar
function updateUserDisplay() {
  const user = getCurrentUser();
  
  if (!user) return;
  
  const avatars = document.querySelectorAll('#userAvatar, #profileAvatar');
  const names = document.querySelectorAll('#userName, #welcomeName');
  const emails = document.querySelectorAll('#userEmail');
  
  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
  
  avatars.forEach(avatar => {
    if (user.photo) {
      avatar.innerHTML = `<img src="${user.photo}" alt="${user.name}">`;
    } else {
      avatar.textContent = initial;
    }
  });
  
  names.forEach(el => {
    el.textContent = user.name || 'Usuario';
  });
  
  emails.forEach(el => {
    el.textContent = user.email || 'usuario@email.com';
  });
}

// Check if user is logged in (for protected pages)
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Logout handlers
document.querySelectorAll('#logoutBtn, #mobileLogoutBtn').forEach(btn => {
  if (btn) {
    btn.addEventListener('click', logout);
  }
});

// Update display on load
if (document.querySelector('#userAvatar')) {
  updateUserDisplay();
}
