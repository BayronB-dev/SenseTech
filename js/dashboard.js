/**
 * SenseTech - Dashboard JavaScript
 * Home page functionality with Supabase integration
 */

let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication with Supabase
  const authenticated = await requireAuthSupabase();
  if (!authenticated) return;
  
  // Load user data
  await loadUserData();
  
  // Initialize dashboard features
  initQuickAccessibility();
  loadFeaturedResources();
  loadCategories();
  loadUserProgress();
});

// ========================================
// LOAD USER DATA
// ========================================

async function loadUserData() {
  const { user, profile } = await getCurrentUserWithProfile();
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = user;
  currentProfile = profile;
  
  // Update UI with user info
  updateDashboardUI();
  
  // Apply accessibility settings from profile
  if (profile && profile.accessibility_settings) {
    saveAccessibilitySettings(profile.accessibility_settings);
    applyAccessibilitySettings(profile.accessibility_settings);
  }
}

function updateDashboardUI() {
  const name = currentProfile?.name || 'Usuario';
  const email = currentUser?.email || 'usuario@email.com';
  const initial = name.charAt(0).toUpperCase();
  const photoUrl = currentProfile?.photo_url;
  const isAdmin = currentProfile?.role === 'admin';
  
  // Update welcome message (h1 with id welcomeName)
  const welcomeNameEl = document.getElementById('welcomeName');
  if (welcomeNameEl) {
    welcomeNameEl.textContent = name;
  }
  
  // Update avatar in navbar (by ID and class)
  const avatarElements = document.querySelectorAll('#userAvatar, .user-menu-trigger .avatar');
  avatarElements.forEach(avatar => {
    if (photoUrl) {
      avatar.innerHTML = `<img src="${photoUrl}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
      avatar.innerHTML = '';
      avatar.textContent = initial;
    }
  });
  
  // Update mobile avatars
  const mobileAvatars = document.querySelectorAll('#mobileUserAvatar, #mobileNavAvatar');
  mobileAvatars.forEach(avatar => {
    if (photoUrl) {
      avatar.innerHTML = `<img src="${photoUrl}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
      avatar.innerHTML = '';
      avatar.textContent = initial;
    }
  });
  
  // Update user name in menu (by ID)
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.textContent = name;
  }
  
  // Update user email in menu (by ID)
  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl) {
    userEmailEl.textContent = email;
  }
  
  // Update mobile user info
  const mobileNameEl = document.getElementById('mobileUserName');
  const mobileEmailEl = document.getElementById('mobileUserEmail');
  if (mobileNameEl) mobileNameEl.textContent = name;
  if (mobileEmailEl) mobileEmailEl.textContent = email;
  
  // Show admin button if user is admin
  if (isAdmin) {
    showAdminButton();
  }
  
  console.log('Dashboard UI updated:', { name, email, isAdmin });
}

function showAdminButton() {
  // Add admin link to navbar
  const navbarNav = document.querySelector('.navbar-nav');
  if (navbarNav && !document.getElementById('adminNavLink')) {
    const adminLink = document.createElement('a');
    adminLink.id = 'adminNavLink';
    adminLink.href = 'admin.html';
    adminLink.className = 'nav-link admin-link';
    adminLink.innerHTML = '⚙️ Panel de Control';
    navbarNav.appendChild(adminLink);
  }
  
  // Add admin link to user menu dropdown
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
  
  // Add to mobile nav
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileNav && !document.getElementById('adminMobileLink')) {
    const firstLink = mobileNav.querySelector('.nav-link');
    if (firstLink) {
      const adminMobileLink = document.createElement('a');
      adminMobileLink.id = 'adminMobileLink';
      adminMobileLink.href = 'admin.html';
      adminMobileLink.className = 'nav-link admin-link';
      adminMobileLink.innerHTML = '⚙️ Panel de Control';
      firstLink.parentNode.insertBefore(adminMobileLink, firstLink.nextSibling.nextSibling);
    }
  }
}

// ========================================
// QUICK ACCESSIBILITY TOGGLES
// ========================================

function initQuickAccessibility() {
  const settings = getAccessibilitySettings();
  
  const quickHighContrast = document.getElementById('quickHighContrast');
  const quickLargeCursor = document.getElementById('quickLargeCursor');
  
  if (quickHighContrast) {
    quickHighContrast.checked = settings.highContrast;
    quickHighContrast.addEventListener('change', async (e) => {
      settings.highContrast = e.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
      
      // Update in database
      if (currentUser) {
        await updateAccessibilityInDB(currentUser.id, settings);
      }
    });
  }
  
  if (quickLargeCursor) {
    quickLargeCursor.checked = settings.largeCursor;
    quickLargeCursor.addEventListener('change', async (e) => {
      settings.largeCursor = e.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
      
      // Update in database
      if (currentUser) {
        await updateAccessibilityInDB(currentUser.id, settings);
      }
    });
  }
}

// ========================================
// LOAD FEATURED RESOURCES
// ========================================

const typeConfig = {
  'book': { label: 'Libro', icon: '📕' },
  'pdf': { label: 'PDF', icon: '📄' },
  'video': { label: 'Video', icon: '🎬' },
  'article': { label: 'Artículo', icon: '📰' },
  'documentation': { label: 'Documentación', icon: '📋' }
};

// Categories will be loaded from database
let categoryConfig = {};

async function loadFeaturedResources() {
  const container = document.getElementById('featuredResourcesGrid');
  if (!container) return;
  
  try {
    const { data: resources, error } = await supabase
      .from('resources')
      .select('*')
      .order('favorite_count', { ascending: false })
      .limit(3);
    
    if (error || !resources || resources.length === 0) {
      container.innerHTML = `
        <div class="empty-state-small" style="grid-column: 1/-1;">
          <p>No hay recursos disponibles aún</p>
          <a href="library.html" class="btn btn-primary btn-sm">Ir a la biblioteca</a>
        </div>
      `;
      return;
    }
    
    container.innerHTML = resources.map(resource => {
      const typeInfo = typeConfig[resource.type] || { label: 'Recurso', icon: '📁' };
      return `
        <a href="resource.html#${resource.id}" class="card resource-card hover-lift">
          <div class="resource-image">${typeInfo.icon}</div>
          <div class="resource-content">
            <span class="resource-type">${typeInfo.label}</span>
            <h5>${resource.title}</h5>
            <p>${resource.description ? resource.description.substring(0, 60) + '...' : ''}</p>
            <div class="resource-meta">
              <span>👁️ ${resource.view_count || 0}</span>
              <span>❤️ ${resource.favorite_count || 0}</span>
            </div>
          </div>
        </a>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading featured resources:', error);
  }
}

async function loadCategories() {
  const container = document.getElementById('categoriesGrid');
  if (!container) return;
  
  try {
    // Load categories from database
    const { data: dbCategories } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    // Build categoryConfig from database
    if (dbCategories && dbCategories.length > 0) {
      dbCategories.forEach(cat => {
        categoryConfig[cat.slug] = { label: cat.name, icon: cat.icon || '📁' };
      });
    }
    
    // Count resources per category
    const { data: resources } = await supabase
      .from('resources')
      .select('category');
    
    const counts = {};
    (resources || []).forEach(r => {
      if (r.category) {
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
    });
    
    // Filter categories with resources
    const categoriesWithResources = Object.entries(categoryConfig)
      .filter(([key]) => counts[key] > 0)
      .sort((a, b) => (counts[b[0]] || 0) - (counts[a[0]] || 0));
    
    if (categoriesWithResources.length === 0) {
      container.innerHTML = `
        <div class="empty-state-small" style="grid-column: 1/-1;">
          <p>No hay categorías disponibles</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = categoriesWithResources.slice(0, 6).map(([key, config]) => `
      <a href="library.html?category=${key}" class="category-card hover-lift" data-category="${key}">
        <div class="category-icon">${config.icon}</div>
        <h6>${config.label}</h6>
        <small>${counts[key] || 0} recursos</small>
      </a>
    `).join('');
    
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// ========================================
// LOAD USER PROGRESS & STATS
// ========================================

async function loadUserProgress() {
  if (!currentUser) return;
  
  try {
    // Load user progress data
    const { data: progressData } = await supabase
      .from('user_progress')
      .select('*, resources(*)')
      .eq('user_id', currentUser.id);
    
    // Load total resources count
    const { count: totalResources } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true });
    
    const progress = progressData || [];
    
    // Calculate stats (handle both progress and progress_percentage fields)
    const getProgress = (p) => p.progress ?? p.progress_percentage ?? 0;
    
    const inProgress = progress.filter(p => getProgress(p) > 0 && getProgress(p) < 100).length;
    const completed = progress.filter(p => getProgress(p) >= 100).length;
    const favorites = progress.filter(p => p.is_favorite).length;
    
    // Update stats UI
    document.getElementById('statResourcesRead').textContent = inProgress;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statFavorites').textContent = favorites;
    document.getElementById('statTotalResources').textContent = totalResources || 0;
    
    // Render continue reading (sort by last read)
    const continueItems = progress
      .filter(p => getProgress(p) > 0 && getProgress(p) < 100)
      .sort((a, b) => new Date(b.last_read_at || b.updated_at || 0) - new Date(a.last_read_at || a.updated_at || 0));
    renderContinueReading(continueItems);
    
    // Render favorites
    renderFavorites(progress.filter(p => p.is_favorite));
    
  } catch (error) {
    console.error('Error loading user progress:', error);
  }
}

function renderContinueReading(progressItems) {
  const container = document.getElementById('continueReadingContainer');
  if (!container) return;
  
  if (progressItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>Aún no has comenzado ningún recurso</p>
        <a href="library.html" class="btn btn-primary btn-sm">Explorar biblioteca</a>
      </div>
    `;
    return;
  }
  
  const getProgress = (p) => p.progress ?? p.progress_percentage ?? 0;
  
  container.innerHTML = progressItems.slice(0, 3).map(item => {
    const resource = item.resources;
    const typeInfo = typeConfig[resource?.type] || { icon: '📁', label: 'Recurso' };
    const progressValue = getProgress(item);
    return `
      <a href="resource.html#${item.resource_id}" class="continue-card hover-lift">
        <div class="continue-image">${resource?.cover_url ? `<img src="${resource.cover_url}" alt="">` : typeInfo.icon}</div>
        <div class="continue-info">
          <span class="resource-type">${typeInfo.label}</span>
          <h5>${resource?.title || 'Recurso'}</h5>
          <p class="progress-text">${progressValue}% completado</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressValue}%;"></div>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

function renderFavorites(favoriteItems) {
  const container = document.getElementById('userFavoritesContainer');
  if (!container) return;
  
  if (favoriteItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>Aún no tienes favoritos</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="favorites-list">
      ${favoriteItems.slice(0, 3).map(item => {
        const resource = item.resources;
        const typeInfo = typeConfig[resource?.type] || { icon: '📁' };
        return `
          <a href="resource.html#${item.resource_id}" class="favorite-item hover-lift">
            <span class="favorite-icon">${typeInfo.icon}</span>
            <span class="favorite-title">${resource?.title || 'Recurso'}</span>
          </a>
        `;
      }).join('')}
      ${favoriteItems.length > 3 ? `<a href="library.html" class="btn btn-ghost btn-sm">Ver todos (${favoriteItems.length})</a>` : ''}
    </div>
  `;
}
