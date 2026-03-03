/**
 * SenseTech - Dashboard JavaScript
 * Home page functionality with Supabase integration
 */

let currentUser = null;
let currentProfile = null;
let userActivityData = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication with Supabase
  const authenticated = await requireAuthSupabase();
  if (!authenticated) return;
  
  // Load user data and types
  await Promise.all([
    loadUserData(),
    loadTypesFromDB()
  ]);
  
  // Initialize dashboard features
  initQuickAccessibility();
  initActivityChart();
  initGoalEditor();
  
  // Load all data
  await Promise.all([
    loadFeaturedResources(),
    loadCategories(),
    loadUserProgress(),
    loadRecommendations(),
    loadUserStreak(),
    loadActivityData(),
    loadRelatedResources()
  ]);
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

// Type config (loaded from database)
let typeLabels = {};
let typeIcons = {};

// Fallback type config
const defaultTypeConfig = {
  'book': { label: 'Libro', icon: '📕' },
  'pdf': { label: 'PDF', icon: '📄' },
  'video': { label: 'Video', icon: '🎬' },
  'article': { label: 'Artículo', icon: '📰' },
  'documentation': { label: 'Documentación', icon: '📋' },
  'link': { label: 'Enlace', icon: '🔗' }
};

// Dynamic typeConfig getter
function getTypeConfig(slug) {
  if (typeLabels[slug]) {
    return { label: typeLabels[slug], icon: typeIcons[slug] || '📁' };
  }
  return defaultTypeConfig[slug] || { label: 'Recurso', icon: '📁' };
}

// Load types from database
async function loadTypesFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from('resource_types')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    (data || []).forEach(type => {
      typeLabels[type.slug] = type.name;
      typeIcons[type.slug] = type.icon || '📁';
    });
  } catch (error) {
    console.error('Error loading types:', error);
  }
}

// Categories will be loaded from database
let categoryConfig = {};

// Store ratings by resource ID
let resourceRatings = {};

async function loadResourceRatings() {
  try {
    const { data, error } = await supabaseClient
      .from('user_progress')
      .select('resource_id, rating')
      .not('rating', 'is', null);
    
    if (error) throw error;
    
    const ratingsByResource = {};
    data?.forEach(item => {
      const id = item.resource_id;
      if (!ratingsByResource[id]) {
        ratingsByResource[id] = { sum: 0, count: 0 };
      }
      ratingsByResource[id].sum += item.rating;
      ratingsByResource[id].count++;
    });
    
    resourceRatings = {};
    Object.keys(ratingsByResource).forEach(id => {
      const { sum, count } = ratingsByResource[id];
      resourceRatings[id] = {
        average: (sum / count).toFixed(1),
        count: count
      };
    });
  } catch (error) {
    console.error('Error loading ratings:', error);
  }
}

function getRatingHtml(resourceId) {
  const ratingInfo = resourceRatings[resourceId];
  const ratingDisplay = ratingInfo ? ratingInfo.average : 'NA';
  const ratingTitle = ratingInfo ? `${ratingInfo.count} calificaciones` : 'Sin calificaciones';
  return `<span class="resource-rating" title="${ratingTitle}">⭐ ${ratingDisplay}</span>`;
}

async function loadFeaturedResources() {
  const container = document.getElementById('featuredResourcesGrid');
  if (!container) return;
  
  try {
    // Load ratings first
    await loadResourceRatings();
    
    const { data: resources, error } = await supabaseClient
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
      const typeInfo = getTypeConfig(resource.type);
      return `
        <a href="resource.html#${resource.id}" class="resource-card hover-lift">
          <div class="resource-card-image">
            ${resource.cover_url 
              ? `<img src="${resource.cover_url}" alt="${resource.title}">`
              : `<span class="resource-icon">${typeInfo.icon}</span>`
            }
            <span class="resource-type-badge">${typeInfo.label}</span>
          </div>
          <div class="resource-card-content">
            <h3 class="resource-card-title">${resource.title}</h3>
            <p class="resource-card-author">${resource.author || ''}</p>
            <div class="resource-card-meta">
              <div class="resource-card-stats">
                <span>👁️ ${resource.view_count || 0}</span>
                <span>❤️ ${resource.favorite_count || 0}</span>
                ${getRatingHtml(resource.id)}
              </div>
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
    const { data: dbCategories } = await supabaseClient
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
    const { data: resources } = await supabaseClient
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
  if (!currentUser) {
    // Clear skeletons with empty state
    renderContinueReading([]);
    renderFavorites([]);
    return;
  }
  
  try {
    // Load user progress data
    const { data: progressData } = await supabaseClient
      .from('user_progress')
      .select('*, resources(*)')
      .eq('user_id', currentUser.id);
    
    // Load total resources count
    const { count: totalResources } = await supabaseClient
      .from('resources')
      .select('*', { count: 'exact', head: true });
    
    const progress = progressData || [];
    
    // Calculate stats (handle both progress and progress_percentage fields)
    const getProgress = (p) => p.progress ?? p.progress_percentage ?? 0;
    
    const inProgress = progress.filter(p => getProgress(p) > 0 && getProgress(p) < 100).length;
    const completed = progress.filter(p => getProgress(p) >= 100).length;
    const favorites = progress.filter(p => p.is_favorite).length;
    
    // Calculate total reading time from all progress entries
    const totalMinutes = progress.reduce((sum, p) => sum + (p.reading_time || 0), 0);
    let timeDisplay;
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      timeDisplay = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else if (totalMinutes > 0) {
      timeDisplay = `${totalMinutes}m`;
    } else {
      timeDisplay = '0m';
    }
    
    // Update stats UI
    const statResourcesRead = document.getElementById('statResourcesRead');
    const statCompleted = document.getElementById('statCompleted');
    const statFavorites = document.getElementById('statFavorites');
    const statReadingTime = document.getElementById('statReadingTime');
    
    if (statResourcesRead) statResourcesRead.textContent = inProgress;
    if (statCompleted) statCompleted.textContent = completed;
    if (statFavorites) statFavorites.textContent = favorites;
    if (statReadingTime) statReadingTime.textContent = timeDisplay;
    
    // Render continue reading (sort by last read, exclude external links)
    const continueItems = progress
      .filter(p => getProgress(p) > 0 && getProgress(p) < 100 && p.resources?.type !== 'link')
      .sort((a, b) => new Date(b.last_read || b.updated_at || 0) - new Date(a.last_read || a.updated_at || 0));
    renderContinueReading(continueItems);
    
    // Render favorites
    renderFavorites(progress.filter(p => p.is_favorite));
    
  } catch (error) {
    console.error('Error loading user progress:', error);
    // Show empty state on error
    renderContinueReading([]);
    renderFavorites([]);
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
    const typeInfo = getTypeConfig(resource?.type);
    const progressValue = getProgress(item);
    const resourceTitle = (resource?.title || 'Recurso').replace(/'/g, "\\'");
    return `
      <div class="continue-card-wrapper">
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
        <button class="continue-card-remove" onclick="removeFromContinueReading(${item.id}, '${resourceTitle}', event)" title="Quitar de la lista">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

let pendingRemoveProgressId = null;

function removeFromContinueReading(progressId, resourceTitle, event) {
  event.preventDefault();
  event.stopPropagation();
  
  pendingRemoveProgressId = progressId;
  
  const modal = document.getElementById('removeResourceModal');
  const titleEl = document.getElementById('removeResourceTitle');
  
  if (titleEl) titleEl.textContent = resourceTitle || 'Este recurso';
  if (modal) modal.classList.add('active');
}

function closeRemoveModal() {
  const modal = document.getElementById('removeResourceModal');
  if (modal) modal.classList.remove('active');
  pendingRemoveProgressId = null;
}

async function confirmRemoveResource() {
  if (!pendingRemoveProgressId) return;
  
  try {
    // Reset progress to 0 so it no longer appears in continue reading
    const { error } = await supabaseClient
      .from('user_progress')
      .update({ progress: 0, last_page: 1 })
      .eq('id', pendingRemoveProgressId);
    
    if (error) throw error;
    
    closeRemoveModal();
    
    // Reload all affected sections
    await Promise.all([
      loadUserProgress(),  // Updates continue reading and stats
      loadGoal()           // Updates weekly goal counter
    ]);
    
  } catch (error) {
    console.error('Error removing from continue reading:', error);
    closeRemoveModal();
  }
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
        const typeInfo = getTypeConfig(resource?.type);
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

// ========================================
// RECOMMENDATIONS SYSTEM
// ========================================

async function loadRecommendations() {
  const container = document.getElementById('recommendationsGrid');
  if (!container) return;
  
  if (!currentUser) {
    container.innerHTML = `
      <div class="empty-state-small" style="grid-column: 1/-1;">
        <p>Inicia sesión para ver recomendaciones</p>
      </div>
    `;
    return;
  }
  
  try {
    // Get user's reading history (categories and types they've read)
    const { data: userProgress } = await supabaseClient
      .from('user_progress')
      .select('resources(category, type)')
      .eq('user_id', currentUser.id);
    
    // Extract preferred categories and types
    const categories = {};
    const types = {};
    
    (userProgress || []).forEach(p => {
      if (p.resources?.category) {
        categories[p.resources.category] = (categories[p.resources.category] || 0) + 1;
      }
      if (p.resources?.type) {
        types[p.resources.type] = (types[p.resources.type] || 0) + 1;
      }
    });
    
    // Get top category and type
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0];
    
    // Get resources user hasn't started yet
    const { data: startedIds } = await supabaseClient
      .from('user_progress')
      .select('resource_id')
      .eq('user_id', currentUser.id);
    
    const excludeIds = (startedIds || []).map(p => p.resource_id);
    
    // Build query for recommendations
    let query = supabaseClient
      .from('resources')
      .select('*')
      .order('favorite_count', { ascending: false })
      .limit(6);
    
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }
    
    // Prefer user's top category if available
    if (topCategory) {
      query = query.eq('category', topCategory);
    }
    
    let { data: recommendations } = await query;
    
    // If not enough recommendations, get popular ones
    if (!recommendations || recommendations.length < 3) {
      const { data: popular } = await supabaseClient
        .from('resources')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(3);
      
      recommendations = [...(recommendations || []), ...(popular || [])].slice(0, 3);
    }
    
    if (!recommendations || recommendations.length === 0) {
      container.innerHTML = `
        <div class="empty-state-small" style="grid-column: 1/-1;">
          <p>Explora la biblioteca para obtener recomendaciones personalizadas</p>
          <a href="library.html" class="btn btn-primary btn-sm">Explorar</a>
        </div>
      `;
      return;
    }
    
    container.innerHTML = recommendations.slice(0, 3).map(resource => {
      const typeInfo = getTypeConfig(resource.type);
      return `
        <a href="resource.html#${resource.id}" class="resource-card hover-lift">
          <div class="resource-card-image">
            ${resource.cover_url 
              ? `<img src="${resource.cover_url}" alt="${resource.title}">`
              : `<span class="resource-icon">${typeInfo.icon}</span>`
            }
            <span class="resource-type-badge">${typeInfo.label}</span>
          </div>
          <div class="resource-card-content">
            <h3 class="resource-card-title">${resource.title}</h3>
            <p class="resource-card-author">${resource.author || ''}</p>
            <div class="resource-card-meta">
              <div class="resource-card-stats">
                <span>👁️ ${resource.view_count || 0}</span>
                <span>❤️ ${resource.favorite_count || 0}</span>
                ${getRatingHtml(resource.id)}
              </div>
            </div>
          </div>
        </a>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading recommendations:', error);
    container.innerHTML = `
      <div class="empty-state-small" style="grid-column: 1/-1;">
        <p>Explora la biblioteca para obtener recomendaciones</p>
        <a href="library.html" class="btn btn-primary btn-sm">Explorar</a>
      </div>
    `;
  }
}

// ========================================
// USER STREAK
// ========================================

async function loadUserStreak() {
  if (!currentUser) return;
  
  try {
    // Get user's activity dates
    const { data: activity } = await supabaseClient
      .from('user_progress')
      .select('last_read, updated_at')
      .eq('user_id', currentUser.id)
      .order('last_read', { ascending: false });
    
    if (!activity || activity.length === 0) return;
    
    // Calculate streak
    const dates = activity
      .map(a => {
        const date = a.last_read || a.updated_at;
        return date ? new Date(date).toDateString() : null;
      })
      .filter(Boolean);
    
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
    
    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    // Check if user was active today or yesterday
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      streak = 1;
      let checkDate = new Date(uniqueDates[0]);
      
      for (let i = 1; i < uniqueDates.length; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (uniqueDates[i] === checkDate.toDateString()) {
          streak++;
        } else {
          break;
        }
      }
    }
    
    // Show streak badge if streak > 1
    if (streak > 1) {
      const streakBadge = document.getElementById('streakBadge');
      const streakCount = document.getElementById('streakCount');
      
      if (streakBadge && streakCount) {
        streakCount.textContent = streak;
        streakBadge.style.display = 'flex';
      }
    }
    
  } catch (error) {
    console.error('Error loading streak:', error);
  }
}

// ========================================
// ACTIVITY CHART
// ========================================

function initActivityChart() {
  const periodBtns = document.querySelectorAll('.period-btn');
  
  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderActivityChart(btn.dataset.period);
    });
  });
}

async function loadActivityData() {
  if (!currentUser) return;
  
  try {
    // Get ALL user progress
    const { data: progress, error } = await supabaseClient
      .from('user_progress')
      .select('*, resources(type)')
      .eq('user_id', currentUser.id);
    
    if (error) {
      console.error('Error fetching progress:', error);
      return;
    }
    
    console.log('Raw progress data:', progress);
    
    // Calculate total reading time for the summary
    const totalReadingTime = progress?.reduce((sum, p) => sum + (p.reading_time || 0), 0) || 0;
    
    userActivityData = [];
    const today = new Date().toDateString();
    
    if (progress && progress.length > 0) {
      // Log first item to see available fields
      console.log('Available fields:', Object.keys(progress[0]));
      
      progress.forEach(p => {
        // Try different possible date field names
        const activityDate = p.last_read || p.last_accessed_at || p.updated_at || p.created_at;
        if (!activityDate) return;
        
        const readingTime = p.reading_time || 0;
        const dateStr = new Date(activityDate).toDateString();
        
        console.log('Resource activity:', {
          date: dateStr,
          isToday: dateStr === today,
          reading_time: readingTime,
          activityDate: activityDate
        });
        
        // Only include if there's actual reading time
        if (readingTime > 0) {
          userActivityData.push({
            created_at: activityDate,
            duration_minutes: readingTime,
            resource_type: p.resources?.type
          });
        }
      });
    }
    
    console.log('Activity data loaded:', userActivityData.length, 'entries');
    
    renderActivityChart('week');
    updateActivitySummary(totalReadingTime);
    updateTotalReadingTime(progress || []);
    
  } catch (error) {
    console.error('Error loading activity data:', error);
    renderActivityChart('week');
  }
}

function updateTotalReadingTime(progressData) {
  // Calculate total reading time from all user_progress entries
  const totalMinutes = progressData.reduce((sum, p) => sum + (p.reading_time || 0), 0);
  
  let timeDisplay;
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    timeDisplay = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } else {
    timeDisplay = `${totalMinutes}m`;
  }
  
  const statReadingTime = document.getElementById('statReadingTime');
  if (statReadingTime) {
    statReadingTime.textContent = timeDisplay;
  }
}

function renderActivityChart(period = 'week') {
  const container = document.getElementById('activityChart');
  if (!container) return;
  
  const days = period === 'week' ? 7 : 30;
  const labels = period === 'week' 
    ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    : Array.from({ length: 30 }, (_, i) => i + 1);
  
  // Calculate activity per day
  const activityByDay = {};
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (days - 1 - i));
    const key = date.toDateString();
    activityByDay[key] = 0;
  }
  
  // Sum up activity - normalize dates to local timezone
  userActivityData.forEach(session => {
    const sessionDate = new Date(session.created_at);
    // Create a date string in local timezone
    const localDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    const dateKey = localDate.toDateString();
    
    if (activityByDay.hasOwnProperty(dateKey)) {
      activityByDay[dateKey] += session.duration_minutes || 0;
      console.log('Added', session.duration_minutes, 'min to', dateKey);
    } else {
      console.log('Date not in range:', dateKey, 'from', session.created_at);
    }
  });
  
  console.log('Activity by day:', activityByDay);
  
  const values = Object.values(activityByDay);
  const maxValue = Math.max(...values, 1);
  
  if (period === 'week') {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const todayIndex = today.getDay();
    
    container.innerHTML = Object.entries(activityByDay).map(([date, minutes], index) => {
      const height = (minutes / maxValue) * 150;
      const dateObj = new Date(date);
      const isToday = dateObj.toDateString() === today.toDateString();
      const dayLabel = dayNames[dateObj.getDay()];
      
      return `
        <div class="chart-bar ${isToday ? 'today' : ''}">
          <div class="chart-bar-fill" style="height: ${Math.max(height, 4)}px;" title="${minutes} min"></div>
          <span class="chart-bar-label">${dayLabel}</span>
        </div>
      `;
    }).join('');
  } else {
    // Monthly view - show every 5th day label
    container.innerHTML = Object.entries(activityByDay).map(([date, minutes], index) => {
      const height = (minutes / maxValue) * 150;
      const dateObj = new Date(date);
      const isToday = dateObj.toDateString() === today.toDateString();
      const showLabel = index % 5 === 0 || index === days - 1;
      
      return `
        <div class="chart-bar ${isToday ? 'today' : ''}">
          <div class="chart-bar-fill" style="height: ${Math.max(height, 4)}px;" title="${minutes} min"></div>
          <span class="chart-bar-label">${showLabel ? dateObj.getDate() : ''}</span>
        </div>
      `;
    }).join('');
  }
}

function updateActivitySummary(totalReadingTimeOverride = null) {
  // Filter activity data for this week
  const now = new Date();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  
  const weekActivity = userActivityData.filter(s => {
    const activityDate = new Date(s.created_at);
    const localDate = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
    return localDate >= weekAgo;
  });
  
  // Use the total from all resources accessed this week
  const totalMinutes = weekActivity.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  
  console.log('Week activity:', weekActivity.length, 'resources,', totalMinutes, 'minutes');
  
  // Format time display
  let timeDisplay;
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    timeDisplay = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } else if (totalMinutes > 0) {
    timeDisplay = `${totalMinutes}m`;
  } else {
    timeDisplay = '0m';
  }
  
  const totalReadingTimeEl = document.getElementById('totalReadingTime');
  if (totalReadingTimeEl) {
    totalReadingTimeEl.textContent = timeDisplay;
  }
  
  // Resources this week
  const resourcesThisWeekEl = document.getElementById('resourcesThisWeek');
  if (resourcesThisWeekEl) {
    resourcesThisWeekEl.textContent = weekActivity.length;
  }
  
  // Pages read (estimate based on time - ~2 pages per minute)
  const pagesReadEl = document.getElementById('pagesRead');
  if (pagesReadEl) {
    const estimatedPages = Math.round(totalMinutes * 2);
    pagesReadEl.textContent = estimatedPages;
  }
}

// ========================================
// READING GOAL
// ========================================

function initGoalEditor() {
  const editBtn = document.getElementById('editGoalBtn');
  if (!editBtn) return;
  
  editBtn.addEventListener('click', openGoalModal);
  
  // Load saved goal
  loadGoal();
}

function openGoalModal() {
  const currentTarget = parseInt(document.getElementById('goalTarget')?.textContent || '5');
  const goalInput = document.getElementById('goalInput');
  const modal = document.getElementById('goalModal');
  
  if (goalInput) goalInput.value = currentTarget;
  if (modal) modal.classList.add('active');
}

function closeGoalModal() {
  const modal = document.getElementById('goalModal');
  if (modal) modal.classList.remove('active');
}

function adjustGoal(delta) {
  const goalInput = document.getElementById('goalInput');
  if (!goalInput) return;
  
  let value = parseInt(goalInput.value) || 5;
  value = Math.max(1, Math.min(50, value + delta));
  goalInput.value = value;
}

function saveGoalFromModal() {
  const goalInput = document.getElementById('goalInput');
  if (!goalInput) return;
  
  const newTarget = parseInt(goalInput.value);
  if (newTarget && newTarget >= 1 && newTarget <= 50) {
    updateGoalTarget(newTarget);
    closeGoalModal();
  }
}

async function loadGoal() {
  if (!currentUser) return;
  
  try {
    // Get goal from profile or use default
    const target = currentProfile?.weekly_goal || 5;
    
    // Count resources accessed this week (with actual activity)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data: weekProgress } = await supabaseClient
      .from('user_progress')
      .select('resource_id, progress, reading_time')
      .eq('user_id', currentUser.id)
      .gte('last_read', weekAgo.toISOString());
    
    // Count only resources with actual activity
    const activeResources = weekProgress?.filter(p => 
      (p.progress > 0) || (p.reading_time > 0)
    ) || [];
    
    const current = activeResources.length;
    
    updateGoalUI(current, target);
    
  } catch (error) {
    console.error('Error loading goal:', error);
  }
}

function updateGoalUI(current, target) {
  const goalCurrent = document.getElementById('goalCurrent');
  const goalTarget = document.getElementById('goalTarget');
  const goalFill = document.getElementById('goalFill');
  
  if (goalCurrent) goalCurrent.textContent = current;
  if (goalTarget) goalTarget.textContent = target;
  
  if (goalFill) {
    const percentage = Math.min((current / target) * 100, 100);
    goalFill.setAttribute('stroke-dasharray', `${percentage}, 100`);
    
    // Change color if goal reached
    if (percentage >= 100) {
      goalFill.style.stroke = 'var(--success-500)';
    }
  }
}

async function updateGoalTarget(newTarget) {
  if (!currentUser) return;
  
  try {
    await supabaseClient
      .from('profiles')
      .update({ weekly_goal: newTarget })
      .eq('id', currentUser.id);
    
    // Reload goal
    currentProfile.weekly_goal = newTarget;
    loadGoal();
    
  } catch (error) {
    console.error('Error updating goal:', error);
  }
}

// ========================================
// RELATED RESOURCES
// ========================================

async function loadRelatedResources() {
  const container = document.getElementById('relatedResourcesContainer');
  if (!container) return;
  
  if (!currentUser) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No hay recursos relacionados</p>
      </div>
    `;
    return;
  }
  
  try {
    // Get user's last read resource
    const { data: lastRead } = await supabaseClient
      .from('user_progress')
      .select('resources(category, type)')
      .eq('user_id', currentUser.id)
      .order('last_read', { ascending: false })
      .limit(1)
      .single();
    
    if (!lastRead?.resources) {
      container.innerHTML = `
        <div class="empty-state-small">
          <p>Lee un recurso para ver relacionados</p>
        </div>
      `;
      return;
    }
    
    // Get related resources
    const { data: related } = await supabaseClient
      .from('resources')
      .select('id, title, type')
      .eq('category', lastRead.resources.category)
      .neq('type', lastRead.resources.type)
      .limit(3);
    
    if (!related || related.length === 0) {
      container.innerHTML = `
        <div class="empty-state-small">
          <p>No hay recursos relacionados</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="favorites-list">
        ${related.map(resource => {
          const typeInfo = getTypeConfig(resource.type);
          return `
            <a href="resource.html#${resource.id}" class="favorite-item hover-lift">
              <span class="favorite-icon">${typeInfo.icon}</span>
              <span class="favorite-title">${resource.title}</span>
            </a>
          `;
        }).join('')}
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading related resources:', error);
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No hay recursos relacionados</p>
      </div>
    `;
  }
}
