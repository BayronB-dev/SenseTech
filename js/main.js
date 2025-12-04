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
  initPageTransitions();
  initTour();
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

async function logout() {
  // Check if Supabase is available
  if (typeof supabaseSignOut === 'function') {
    await supabaseSignOut();
  }
  localStorage.removeItem('currentUser');
  localStorage.removeItem('accessibilitySettings');
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

// ========================================
// PAGE TRANSITIONS
// ========================================

function initPageTransitions() {
  // Create transition overlay if not exists
  if (!document.querySelector('.page-transition-overlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    overlay.innerHTML = `
      <div class="page-loader">
        <div class="page-loader-spinner"></div>
        <span class="page-loader-text">Cargando...</span>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  
  // Add transition to internal links
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    
    // Skip external links, anchors, and javascript
    if (!href || 
        href.startsWith('http') || 
        href.startsWith('#') || 
        href.startsWith('javascript') ||
        href.startsWith('mailto') ||
        link.hasAttribute('download') ||
        link.target === '_blank') {
      return;
    }
    
    link.addEventListener('click', (e) => {
      // Don't transition for same page
      if (href === window.location.pathname.split('/').pop()) return;
      
      e.preventDefault();
      
      const overlay = document.querySelector('.page-transition-overlay');
      if (overlay) {
        overlay.classList.add('active');
        
        setTimeout(() => {
          window.location.href = href;
        }, 300);
      } else {
        window.location.href = href;
      }
    });
  });
  
  // Hide overlay on page load
  window.addEventListener('load', () => {
    const overlay = document.querySelector('.page-transition-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    
    // Fade in page content
    document.body.style.opacity = '0';
    requestAnimationFrame(() => {
      document.body.style.transition = 'opacity 0.3s ease';
      document.body.style.opacity = '1';
    });
  });
}

// ========================================
// GUIDED TOUR FOR NEW USERS
// ========================================

const tourSteps = {
  'home.html': [
    {
      target: '.welcome-message',
      title: '¡Bienvenido a SenseTech!',
      content: 'Este es tu panel principal donde puedes ver tu progreso y acceder a tus recursos.',
      position: 'bottom'
    },
    {
      target: '#continueReadingContainer',
      title: 'Continúa donde lo dejaste',
      content: 'Aquí verás los recursos que has comenzado a leer para retomar fácilmente.',
      position: 'bottom'
    },
    {
      target: '.quick-stats',
      title: 'Tu progreso',
      content: 'Visualiza tus estadísticas: recursos en progreso, completados y favoritos.',
      position: 'left'
    },
    {
      target: '.reading-goal-card',
      title: 'Meta semanal',
      content: 'Establece una meta de lectura semanal y sigue tu progreso.',
      position: 'left'
    },
    {
      target: '.navbar-nav',
      mobileTarget: '.mobile-menu-toggle',
      title: 'Navegación',
      content: 'Usa el menú para ir a la biblioteca y explorar todos los recursos disponibles.',
      mobileContent: 'Toca el menú para acceder a la biblioteca y otras secciones.',
      position: 'bottom'
    }
  ],
  'library.html': [
    {
      target: '.search-box',
      title: 'Buscar recursos',
      content: 'Usa la barra de búsqueda para encontrar recursos por título o descripción.',
      position: 'bottom'
    },
    {
      target: '.filter-controls',
      title: 'Filtros',
      content: 'Filtra por categoría, tipo de recurso y más para encontrar exactamente lo que necesitas.',
      position: 'bottom'
    }
  ],
  'reader.html': [
    {
      target: '.tts-btn',
      title: 'Lectura por voz',
      content: 'Activa el lector de voz para escuchar el contenido del documento.',
      position: 'bottom'
    },
    {
      target: '#bookmarkBtn',
      title: 'Marcadores',
      content: 'Guarda marcadores en las páginas importantes para volver a ellas después.',
      position: 'bottom'
    },
    {
      target: '.reader-sidebar',
      title: 'Panel lateral',
      content: 'Accede al índice, tus marcadores y miniaturas de las páginas.',
      position: 'right'
    }
  ]
};

function initTour() {
  // Check if user has seen the tour
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const tourKey = `tour_seen_${currentPage}`;
  
  // Only show tour on authenticated pages and if not seen before
  if (!localStorage.getItem(tourKey) && tourSteps[currentPage]) {
    // Wait for page to fully load
    setTimeout(() => {
      // Check if user is new (less than 1 day since first visit)
      const firstVisit = localStorage.getItem('first_visit');
      if (!firstVisit) {
        localStorage.setItem('first_visit', Date.now().toString());
        startTour(currentPage);
      } else {
        const daysSinceFirst = (Date.now() - parseInt(firstVisit)) / (1000 * 60 * 60 * 24);
        if (daysSinceFirst < 1) {
          startTour(currentPage);
        }
      }
    }, 1000);
  }
}

function startTour(page) {
  const steps = tourSteps[page];
  if (!steps || steps.length === 0) return;
  
  // Create tour overlay
  const tourOverlay = document.createElement('div');
  tourOverlay.className = 'tour-overlay';
  tourOverlay.innerHTML = `
    <div class="tour-backdrop"></div>
    <div class="tour-tooltip">
      <div class="tour-header">
        <span class="tour-step-indicator">1/${steps.length}</span>
        <button class="tour-close">&times;</button>
      </div>
      <h4 class="tour-title"></h4>
      <p class="tour-content"></p>
      <div class="tour-footer">
        <button class="tour-skip">Omitir tour</button>
        <div class="tour-nav">
          <button class="tour-prev" disabled>Anterior</button>
          <button class="tour-next">Siguiente</button>
        </div>
      </div>
    </div>
    <div class="tour-highlight"></div>
  `;
  document.body.appendChild(tourOverlay);
  
  let currentStep = 0;
  let isAnimating = false;
  
  async function showStep(index) {
    if (isAnimating) return;
    isAnimating = true;
    
    const step = steps[index];
    const isMobile = window.innerWidth <= 768;
    
    // Use mobile target/content if available and on mobile
    const targetSelector = (isMobile && step.mobileTarget) ? step.mobileTarget : step.target;
    const content = (isMobile && step.mobileContent) ? step.mobileContent : step.content;
    
    const target = document.querySelector(targetSelector);
    
    if (!target) {
      isAnimating = false;
      // Skip to next step if target not found
      if (index < steps.length - 1) {
        showStep(index + 1);
      } else {
        endTour();
      }
      return;
    }
    
    // Temporarily enable scroll for smooth scrolling
    document.body.style.overflow = '';
    
    // First scroll to target with smooth animation
    const targetRect = target.getBoundingClientRect();
    const targetCenter = targetRect.top + window.scrollY - (window.innerHeight / 2) + (targetRect.height / 2);
    
    // Smooth scroll to element
    window.scrollTo({
      top: Math.max(0, targetCenter),
      behavior: 'smooth'
    });
    
    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Block scroll again after scrolling
    document.body.style.overflow = 'hidden';
    
    // Get updated position after scroll
    const rect = target.getBoundingClientRect();
    
    // Update tooltip content
    tourOverlay.querySelector('.tour-step-indicator').textContent = `${index + 1}/${steps.length}`;
    tourOverlay.querySelector('.tour-title').textContent = step.title;
    tourOverlay.querySelector('.tour-content').textContent = content;
    
    // Position highlight with padding (using fixed positioning)
    const highlight = tourOverlay.querySelector('.tour-highlight');
    const padding = 12;
    highlight.style.top = `${rect.top - padding}px`;
    highlight.style.left = `${rect.left - padding}px`;
    highlight.style.width = `${rect.width + padding * 2}px`;
    highlight.style.height = `${rect.height + padding * 2}px`;
    
    // Position tooltip
    const tooltip = tourOverlay.querySelector('.tour-tooltip');
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let top, left;
    const margin = 20;
    
    // Calculate best position based on available space
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const spaceRight = viewportWidth - rect.right;
    const spaceLeft = rect.left;
    
    // Determine best position
    let position = step.position;
    if (position === 'bottom' && spaceBelow < tooltipRect.height + margin) {
      position = spaceAbove > spaceBelow ? 'top' : 'bottom';
    } else if (position === 'top' && spaceAbove < tooltipRect.height + margin) {
      position = spaceBelow > spaceAbove ? 'bottom' : 'top';
    } else if (position === 'right' && spaceRight < tooltipRect.width + margin) {
      position = spaceLeft > spaceRight ? 'left' : 'right';
    } else if (position === 'left' && spaceLeft < tooltipRect.width + margin) {
      position = spaceRight > spaceLeft ? 'right' : 'left';
    }
    
    switch (position) {
      case 'bottom':
        top = rect.bottom + margin;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'top':
        top = rect.top - tooltipRect.height - margin;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - margin;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + margin;
        break;
      default:
        top = rect.bottom + margin;
        left = rect.left;
    }
    
    // Keep tooltip in viewport with margins
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    
    // Update buttons
    tourOverlay.querySelector('.tour-prev').disabled = index === 0;
    tourOverlay.querySelector('.tour-next').textContent = index === steps.length - 1 ? 'Finalizar' : 'Siguiente';
    
    currentStep = index;
    isAnimating = false;
  }
  
  function endTour() {
    // Restore body scroll
    document.body.style.overflow = '';
    tourOverlay.remove();
    localStorage.setItem(`tour_seen_${page}`, 'true');
  }
  
  // Event listeners
  tourOverlay.querySelector('.tour-close').addEventListener('click', endTour);
  tourOverlay.querySelector('.tour-skip').addEventListener('click', endTour);
  tourOverlay.querySelector('.tour-backdrop').addEventListener('click', endTour);
  
  tourOverlay.querySelector('.tour-prev').addEventListener('click', () => {
    if (currentStep > 0 && !isAnimating) showStep(currentStep - 1);
  });
  
  tourOverlay.querySelector('.tour-next').addEventListener('click', () => {
    if (isAnimating) return;
    if (currentStep < steps.length - 1) {
      showStep(currentStep + 1);
    } else {
      endTour();
    }
  });
  
  // Prevent scroll with wheel during tour
  tourOverlay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  
  // Start tour
  tourOverlay.classList.add('active');
  showStep(0);
}
