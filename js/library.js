/**
 * SenseTech - Library Page
 * Handles resource catalog, search, filters, and pagination
 */

// State
let allResources = [];
let filteredResources = [];
let allCategories = [];
let categoryLabels = {};
let currentFilters = {
  search: '',
  category: '',
  type: '',
  sort: 'popular'
};
let currentPage = 1;
const ITEMS_PER_PAGE = 12;
let currentView = 'grid';
let currentUser = null;
let userFavorites = [];

// Type config (loaded from database)
let typeLabels = {};
let typeIcons = {};
let allTypes = [];

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
    const { data, error } = await supabase
      .from('resource_types')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    allTypes = data || [];
    allTypes.forEach(type => {
      typeLabels[type.slug] = type.name;
      typeIcons[type.slug] = type.icon || '📁';
    });
    
    // Update type filter menu
    updateTypeFilterMenu();
  } catch (error) {
    console.error('Error loading types:', error);
  }
}

function updateTypeFilterMenu() {
  const menu = document.getElementById('typeMenu');
  if (!menu) return;
  
  menu.innerHTML = '<button class="filter-option active" data-value="">Todos</button>';
  
  allTypes.forEach(type => {
    const btn = document.createElement('button');
    btn.className = 'filter-option';
    btn.dataset.value = type.slug;
    btn.textContent = `${type.icon || '📁'} ${type.name}`;
    menu.appendChild(btn);
  });
  
  // Re-attach event listeners
  menu.querySelectorAll('.filter-option').forEach(opt => {
    opt.addEventListener('click', () => {
      menu.querySelectorAll('.filter-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      currentFilters.type = opt.dataset.value;
      document.getElementById('typeLabel').textContent = opt.dataset.value ? getTypeConfig(opt.dataset.value).label : 'Tipo';
      document.getElementById('typeBtn').setAttribute('aria-expanded', 'false');
      menu.classList.remove('active');
      applyFilters();
    });
  });
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  await initLibrary();
  initSearch();
  initFilters();
  initViewToggle();
  initPagination();
});

async function initLibrary() {
  // Check authentication
  const { user, profile } = await getCurrentUserWithProfile();
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = user;
  
  // Update user display
  updateUserDisplay(profile);
  
  // Load categories and types from database
  await Promise.all([
    loadCategoriesFromDB(),
    loadTypesFromDB()
  ]);
  
  // Check URL for category filter
  applyUrlFilters();
  
  // Load user favorites
  await loadUserFavorites();
  
  // Load resources
  await loadResources();
}

function applyUrlFilters() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check for category parameter
  const category = urlParams.get('category');
  if (category && categoryLabels[category]) {
    currentFilters.category = category;
    
    // Update UI
    const categoryLabel = document.getElementById('categoryLabel');
    if (categoryLabel) {
      categoryLabel.textContent = categoryLabels[category];
    }
    
    // Update menu selection
    const menu = document.getElementById('categoryMenu');
    if (menu) {
      menu.querySelectorAll('.filter-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.value === category);
      });
    }
  }
  
  // Check for type parameter
  const type = urlParams.get('type');
  if (type) {
    currentFilters.type = type;
    const typeLabel = document.getElementById('typeLabel');
    if (typeLabel) {
      const typeNames = { 'book': 'Libros', 'pdf': 'PDFs', 'video': 'Videos', 'article': 'Artículos', 'documentation': 'Documentación' };
      typeLabel.textContent = typeNames[type] || type;
    }
  }
  
  // Check for search parameter
  const search = urlParams.get('search');
  if (search) {
    currentFilters.search = search;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = search;
      document.getElementById('clearSearch').style.display = 'block';
    }
  }
}

async function loadCategoriesFromDB() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    allCategories = data || [];
    
    // Update lookup object
    categoryLabels = {};
    allCategories.forEach(cat => {
      categoryLabels[cat.slug] = cat.name;
    });
    
    // Update category filter dropdown
    updateCategoryFilterOptions();
    
  } catch (error) {
    console.error('Error loading categories:', error);
    // Fallback
    categoryLabels = { 'other': 'Otros' };
  }
}

function updateCategoryFilterOptions() {
  const menu = document.getElementById('categoryMenu');
  if (!menu) return;
  
  // Keep the "Todas" option, replace the rest
  const allOption = menu.querySelector('[data-value=""]');
  menu.innerHTML = '';
  
  if (allOption) {
    menu.appendChild(allOption);
  } else {
    const opt = document.createElement('button');
    opt.className = 'filter-option active';
    opt.dataset.value = '';
    opt.textContent = 'Todas';
    menu.appendChild(opt);
  }
  
  allCategories.forEach(cat => {
    const opt = document.createElement('button');
    opt.className = 'filter-option';
    opt.dataset.value = cat.slug;
    opt.textContent = cat.name;
    menu.appendChild(opt);
  });
  
  // Re-attach event listeners
  menu.querySelectorAll('.filter-option').forEach(option => {
    option.addEventListener('click', () => {
      menu.querySelectorAll('.filter-option').forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      
      const value = option.dataset.value;
      currentFilters.category = value;
      
      const label = document.getElementById('categoryLabel');
      if (label) {
        label.textContent = value ? categoryLabels[value] : 'Categoría';
      }
      
      currentPage = 1;
      applyFilters();
      
      // Close dropdown properly using class
      const dropdown = menu.closest('.filter-dropdown');
      if (dropdown) {
        dropdown.classList.remove('open');
        dropdown.querySelector('.filter-btn')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

function updateUserDisplay(profile) {
  const name = profile?.name || 'Usuario';
  const email = currentUser?.email || 'usuario@email.com';
  const initial = name.charAt(0).toUpperCase();
  const photoUrl = profile?.photo_url;
  const isAdmin = profile?.role === 'admin';
  
  // Desktop elements
  const avatarEl = document.getElementById('userAvatar');
  const nameEl = document.getElementById('userName');
  const emailEl = document.getElementById('userEmail');
  
  // Mobile elements
  const mobileAvatarEl = document.getElementById('mobileUserAvatar');
  const mobileNavAvatarEl = document.getElementById('mobileNavAvatar');
  const mobileNameEl = document.getElementById('mobileUserName');
  const mobileEmailEl = document.getElementById('mobileUserEmail');
  
  const avatarContent = photoUrl 
    ? `<img src="${photoUrl}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
    : initial;
  
  // Update desktop
  if (avatarEl) {
    if (photoUrl) {
      avatarEl.innerHTML = avatarContent;
    } else {
      avatarEl.textContent = initial;
    }
  }
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;
  
  // Update mobile
  if (mobileAvatarEl) {
    if (photoUrl) {
      mobileAvatarEl.innerHTML = avatarContent;
    } else {
      mobileAvatarEl.textContent = initial;
    }
  }
  if (mobileNavAvatarEl) {
    if (photoUrl) {
      mobileNavAvatarEl.innerHTML = avatarContent;
    } else {
      mobileNavAvatarEl.textContent = initial;
    }
  }
  if (mobileNameEl) mobileNameEl.textContent = name;
  if (mobileEmailEl) mobileEmailEl.textContent = email;
  
  // Show admin button if user is admin
  if (isAdmin) {
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

async function loadUserFavorites() {
  if (!currentUser) return;
  
  try {
    // Get all user progress and filter favorites (handles both boolean and string)
    const { data } = await supabase
      .from('user_progress')
      .select('resource_id, is_favorite')
      .eq('user_id', currentUser.id);
    
    // Filter favorites - handle both boolean true and string 'true'
    userFavorites = data 
      ? data.filter(item => item.is_favorite === true || item.is_favorite === 'true')
             .map(item => item.resource_id)
      : [];
    
    console.log('Loaded favorites:', userFavorites);
  } catch (error) {
    console.error('Error loading favorites:', error);
  }
}

async function loadResources() {
  showLoading(true);
  
  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allResources = data || [];
    
    // Load average ratings for all resources
    await loadResourceRatings();
    
    // Update stats
    updateStats();
    
    // Apply filters and render
    applyFilters();
  } catch (error) {
    console.error('Error loading resources:', error);
    showEmptyState(true, 'Error al cargar los recursos');
  } finally {
    showLoading(false);
  }
}

// Store ratings by resource ID
let resourceRatings = {};

async function loadResourceRatings() {
  try {
    // Get all ratings grouped by resource
    const { data, error } = await supabase
      .from('user_progress')
      .select('resource_id, rating')
      .not('rating', 'is', null);
    
    if (error) throw error;
    
    // Calculate average rating per resource
    const ratingsByResource = {};
    
    data?.forEach(item => {
      const id = item.resource_id;
      if (!ratingsByResource[id]) {
        ratingsByResource[id] = { sum: 0, count: 0 };
      }
      ratingsByResource[id].sum += item.rating;
      ratingsByResource[id].count++;
    });
    
    // Convert to averages
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
    resourceRatings = {};
  }
}

// ========================================
// SEARCH
// ========================================

function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');
  
  if (!searchInput) return;
  
  let debounceTimer;
  
  searchInput.addEventListener('input', (e) => {
    const value = e.target.value;
    
    // Show/hide clear button
    clearBtn.style.display = value ? 'flex' : 'none';
    
    // Debounce search
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentFilters.search = value.toLowerCase();
      currentPage = 1;
      applyFilters();
    }, 300);
  });
  
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    currentFilters.search = '';
    currentPage = 1;
    applyFilters();
  });
}

// ========================================
// FILTERS
// ========================================

function initFilters() {
  // Category filter
  initFilterDropdown('category', 'categoryBtn', 'categoryMenu', 'categoryLabel');
  
  // Type filter
  initFilterDropdown('type', 'typeBtn', 'typeMenu', 'typeLabel');
  
  // Sort filter
  initFilterDropdown('sort', 'sortBtn', 'sortMenu', 'sortLabel');
  
  // Clear all filters
  document.getElementById('clearAllFilters')?.addEventListener('click', clearAllFilters);
  document.getElementById('resetFiltersBtn')?.addEventListener('click', clearAllFilters);
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown')) {
      document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));
    }
  });
}

function initFilterDropdown(filterKey, btnId, menuId, labelId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  const label = document.getElementById(labelId);
  
  if (!btn || !menu) return;
  
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Close other dropdowns
    document.querySelectorAll('.filter-dropdown').forEach(d => {
      if (d !== btn.parentElement) d.classList.remove('open');
    });
    
    // Toggle this dropdown
    btn.parentElement.classList.toggle('open');
    btn.setAttribute('aria-expanded', btn.parentElement.classList.contains('open'));
  });
  
  menu.querySelectorAll('.filter-option').forEach(option => {
    option.addEventListener('click', () => {
      const value = option.dataset.value;
      
      // Update active state
      menu.querySelectorAll('.filter-option').forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      
      // Update label
      if (filterKey === 'sort') {
        label.textContent = option.textContent;
      } else if (value) {
        label.textContent = option.textContent;
      } else {
        label.textContent = filterKey === 'category' ? 'Categoría' : 'Tipo';
      }
      
      // Update filter
      currentFilters[filterKey] = value;
      currentPage = 1;
      
      // Close dropdown
      btn.parentElement.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      
      // Apply filters
      applyFilters();
    });
  });
}

function applyFilters() {
  filteredResources = allResources.filter(resource => {
    // Search filter
    if (currentFilters.search) {
      const searchTerm = currentFilters.search;
      const matchesSearch = 
        resource.title?.toLowerCase().includes(searchTerm) ||
        resource.author?.toLowerCase().includes(searchTerm) ||
        resource.description?.toLowerCase().includes(searchTerm) ||
        resource.category?.toLowerCase().includes(searchTerm);
      
      if (!matchesSearch) return false;
    }
    
    // Category filter
    if (currentFilters.category && resource.category !== currentFilters.category) {
      return false;
    }
    
    // Type filter
    if (currentFilters.type && resource.type !== currentFilters.type) {
      return false;
    }
    
    return true;
  });
  
  // Sort
  sortResources();
  
  // Update UI
  updateActiveFilters();
  renderResources();
  updatePagination();
}

function sortResources() {
  switch (currentFilters.sort) {
    case 'newest':
      filteredResources.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    case 'oldest':
      filteredResources.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case 'title-asc':
      filteredResources.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'title-desc':
      filteredResources.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      break;
    case 'popular':
      // Popularidad = vistas + favoritos (misma prioridad)
      filteredResources.sort((a, b) => {
        const popularityA = (a.view_count || 0) + (a.favorite_count || 0);
        const popularityB = (b.view_count || 0) + (b.favorite_count || 0);
        return popularityB - popularityA;
      });
      break;
  }
}

function updateActiveFilters() {
  const container = document.getElementById('activeFilters');
  const tagsContainer = document.getElementById('filterTags');
  
  if (!container || !tagsContainer) return;
  
  const tags = [];
  
  if (currentFilters.search) {
    tags.push({ key: 'search', label: `Búsqueda: "${currentFilters.search}"` });
  }
  
  if (currentFilters.category) {
    tags.push({ key: 'category', label: categoryLabels[currentFilters.category] || currentFilters.category });
  }
  
  if (currentFilters.type) {
    const typeInfo = getTypeConfig(currentFilters.type);
    tags.push({ key: 'type', label: typeInfo.label });
  }
  
  if (tags.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'flex';
  tagsContainer.innerHTML = tags.map(tag => `
    <span class="filter-tag">
      ${tag.label}
      <button onclick="removeFilter('${tag.key}')" aria-label="Eliminar filtro">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </span>
  `).join('');
}

function removeFilter(key) {
  if (key === 'search') {
    currentFilters.search = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
  } else {
    currentFilters[key] = '';
    
    // Reset dropdown label
    const labelId = key + 'Label';
    const label = document.getElementById(labelId);
    if (label) {
      label.textContent = key === 'category' ? 'Categoría' : 'Tipo';
    }
    
    // Reset active option
    const menuId = key + 'Menu';
    const menu = document.getElementById(menuId);
    if (menu) {
      menu.querySelectorAll('.filter-option').forEach(o => o.classList.remove('active'));
      menu.querySelector('[data-value=""]')?.classList.add('active');
    }
  }
  
  currentPage = 1;
  applyFilters();
}

function clearAllFilters() {
  currentFilters = {
    search: '',
    category: '',
    type: '',
    sort: 'popular'
  };
  
  // Reset search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  document.getElementById('clearSearch').style.display = 'none';
  
  // Reset dropdowns
  ['category', 'type', 'sort'].forEach(key => {
    const label = document.getElementById(key + 'Label');
    const menu = document.getElementById(key + 'Menu');
    
    if (label) {
      if (key === 'category') label.textContent = 'Categoría';
      else if (key === 'type') label.textContent = 'Tipo';
      else label.textContent = 'Más populares';
    }
    
    if (menu) {
      menu.querySelectorAll('.filter-option').forEach(o => o.classList.remove('active'));
      menu.querySelector('[data-value=""]')?.classList.add('active') ||
      menu.querySelector('.filter-option')?.classList.add('active');
    }
  });
  
  currentPage = 1;
  applyFilters();
}

// ========================================
// VIEW TOGGLE
// ========================================

function initViewToggle() {
  const viewBtns = document.querySelectorAll('.view-btn');
  const grid = document.getElementById('resourcesGrid');
  
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentView = view;
      
      if (grid) {
        grid.classList.toggle('list-view', view === 'list');
      }
    });
  });
}

// ========================================
// RENDERING
// ========================================

function renderResources() {
  const grid = document.getElementById('resourcesGrid');
  const resultsCount = document.getElementById('resultsCount');
  
  if (!grid) return;
  
  // Calculate pagination
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageResources = filteredResources.slice(startIndex, endIndex);
  
  // Update results count
  if (resultsCount) {
    if (filteredResources.length === 0) {
      resultsCount.textContent = 'No se encontraron recursos';
    } else if (filteredResources.length === 1) {
      resultsCount.textContent = '1 recurso encontrado';
    } else {
      resultsCount.textContent = `${filteredResources.length} recursos encontrados`;
    }
  }
  
  // Show empty state if no resources
  if (pageResources.length === 0) {
    grid.innerHTML = '';
    showEmptyState(true);
    return;
  }
  
  showEmptyState(false);
  
  // Render cards
  grid.innerHTML = pageResources.map(resource => createResourceCard(resource)).join('');
  
  // Add event listeners
  grid.querySelectorAll('.resource-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.resource-favorite-btn')) {
        const resourceId = card.dataset.id;
        if (!resourceId) return;
        
        // Use hash instead of query string (more compatible with some servers)
        window.location.href = `resource.html#${resourceId}`;
      }
    });
  });
  
  grid.querySelectorAll('.resource-favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(btn);
    });
  });
}

function createResourceCard(resource) {
  const typeInfo = getTypeConfig(resource.type);
  const categoryLabel = categoryLabels[resource.category] || resource.category || 'General';
  // Compare as strings to handle both integer and UUID IDs
  const isFavorite = userFavorites.some(id => String(id) === String(resource.id));
  
  // Get rating info - show NA if no rating
  const ratingInfo = resourceRatings[resource.id];
  const ratingDisplay = ratingInfo ? ratingInfo.average : 'NA';
  const ratingTitle = ratingInfo ? `${ratingInfo.count} calificaciones` : 'Sin calificaciones';
  
  return `
    <article class="resource-card" data-id="${resource.id}">
      <div class="resource-card-image">
        ${resource.cover_url 
          ? `<img src="${resource.cover_url}" alt="${resource.title}">`
          : `<span class="resource-icon">${typeInfo.icon}</span>`
        }
        <span class="resource-type-badge">${typeInfo.label}</span>
        <button class="resource-favorite-btn ${isFavorite ? 'active' : ''}" 
                data-id="${resource.id}" 
                aria-label="${isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
          ${isFavorite ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="resource-card-content">
        <span class="resource-category">${categoryLabel}</span>
        <h3 class="resource-card-title">${resource.title || 'Sin título'}</h3>
        <p class="resource-card-author">${resource.author || 'Autor desconocido'}</p>
        <div class="resource-card-meta">
          <div class="resource-card-stats">
            <span>👁️ ${resource.view_count || 0}</span>
            <span>❤️ ${resource.favorite_count || 0}</span>
            <span class="resource-rating" title="${ratingTitle}">⭐ ${ratingDisplay}</span>
          </div>
          <button class="resource-card-action">Ver más →</button>
        </div>
      </div>
    </article>
  `;
}

async function toggleFavorite(btn) {
  if (!currentUser) return;
  
  const resourceId = btn.dataset.id;
  const isCurrentlyFavorite = btn.classList.contains('active');
  
  try {
    // Check if progress record exists
    const { data: existing } = await supabase
      .from('user_progress')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('resource_id', resourceId)
      .single();
    
    if (isCurrentlyFavorite) {
      // Remove from favorites
      if (existing) {
        const { error } = await supabase
          .from('user_progress')
          .update({ is_favorite: false })
          .eq('id', existing.id);
        
        if (error) console.error('Error updating favorite:', error);
      }
      
      // Decrement favorite_count in resources table
      const { data: resource } = await supabase
        .from('resources')
        .select('favorite_count')
        .eq('id', resourceId)
        .single();
      
      const newCount = Math.max(0, (resource?.favorite_count || 1) - 1);
      await supabase
        .from('resources')
        .update({ favorite_count: newCount })
        .eq('id', resourceId);
      
      userFavorites = userFavorites.filter(id => String(id) !== String(resourceId));
      btn.classList.remove('active');
      btn.innerHTML = '🤍';
      btn.setAttribute('aria-label', 'Agregar a favoritos');
      updateCardFavoriteCount(resourceId, -1);
      
    } else {
      // Add to favorites
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('user_progress')
          .update({ is_favorite: true })
          .eq('id', existing.id);
        
        if (error) console.error('Error updating favorite:', error);
      } else {
        // Insert new record
        const { error } = await supabase
          .from('user_progress')
          .insert({
            user_id: currentUser.id,
            resource_id: resourceId,
            is_favorite: true,
            progress: 0
          });
        
        if (error) console.error('Error inserting favorite:', error);
      }
      
      // Increment favorite_count in resources table
      const { data: resource } = await supabase
        .from('resources')
        .select('favorite_count')
        .eq('id', resourceId)
        .single();
      
      const newCount = (resource?.favorite_count || 0) + 1;
      await supabase
        .from('resources')
        .update({ favorite_count: newCount })
        .eq('id', resourceId);
      
      if (!userFavorites.some(id => String(id) === String(resourceId))) {
        userFavorites.push(resourceId);
      }
      btn.classList.add('active');
      btn.innerHTML = '❤️';
      btn.setAttribute('aria-label', 'Quitar de favoritos');
      updateCardFavoriteCount(resourceId, 1);
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
}

function updateCardFavoriteCount(resourceId, delta) {
  const card = document.querySelector(`.resource-card[data-id="${resourceId}"]`);
  if (!card) return;
  
  const statsContainer = card.querySelector('.resource-card-stats');
  if (!statsContainer) return;
  
  const favoriteSpan = statsContainer.querySelectorAll('span')[1]; // Second span is favorites
  if (favoriteSpan) {
    const currentCount = parseInt(favoriteSpan.textContent.replace('❤️ ', '')) || 0;
    const newCount = Math.max(0, currentCount + delta);
    favoriteSpan.textContent = `❤️ ${newCount}`;
  }
}

// ========================================
// PAGINATION
// ========================================

function initPagination() {
  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderResources();
      updatePagination();
      scrollToTop();
    }
  });
  
  document.getElementById('nextPage')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderResources();
      updatePagination();
      scrollToTop();
    }
  });
}

function updatePagination() {
  const pagination = document.getElementById('pagination');
  const currentPageEl = document.getElementById('currentPage');
  const totalPagesEl = document.getElementById('totalPages');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  
  const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);
  
  if (totalPages <= 1) {
    if (pagination) pagination.style.display = 'none';
    return;
  }
  
  if (pagination) pagination.style.display = 'flex';
  if (currentPageEl) currentPageEl.textContent = currentPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// UI HELPERS
// ========================================

function updateStats() {
  const totalResourcesEl = document.getElementById('totalResources');
  const totalCategoriesEl = document.getElementById('totalCategories');
  
  if (totalResourcesEl) {
    totalResourcesEl.textContent = allResources.length;
  }
  
  if (totalCategoriesEl) {
    const categories = new Set(allResources.map(r => r.category).filter(Boolean));
    totalCategoriesEl.textContent = categories.size;
  }
}

function showLoading(show) {
  const loading = document.getElementById('loadingState');
  const grid = document.getElementById('resourcesGrid');
  
  if (loading) loading.style.display = show ? 'block' : 'none';
  if (grid) grid.style.display = show ? 'none' : 'grid';
}

function showEmptyState(show, message = null) {
  const empty = document.getElementById('emptyState');
  const grid = document.getElementById('resourcesGrid');
  
  if (empty) {
    empty.style.display = show ? 'block' : 'none';
    if (message) {
      empty.querySelector('h3').textContent = message;
    }
  }
  if (grid) grid.style.display = show ? 'none' : 'grid';
}

// Make removeFilter available globally
window.removeFilter = removeFilter;
