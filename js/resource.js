/**
 * SenseTech - Resource Detail Page
 * Handles resource display, favorites, and progress tracking
 */

// State
let currentUser = null;
let currentResource = null;
let userProgress = null;
let categoryLabels = {};

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
    const { data, error } = await supabase
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

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  await initResourcePage();
});

async function initResourcePage() {
  // Check authentication
  const { user, profile } = await getCurrentUserWithProfile();
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = user;
  updateUserDisplay(profile);
  
  // Load categories and types from database
  await Promise.all([
    loadCategoriesFromDB(),
    loadTypesFromDB()
  ]);
  
  // Get resource ID from URL (try hash first, then query string)
  let resourceId = window.location.hash.slice(1); // Remove the # symbol
  
  if (!resourceId) {
    const urlParams = new URLSearchParams(window.location.search);
    resourceId = urlParams.get('id');
  }
  
  if (!resourceId) {
    console.error('No resource ID in URL');
    showError();
    return;
  }
  
  // Load resource
  await loadResource(resourceId);
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
    : null;
  
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
}

async function loadCategoriesFromDB() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name');
    
    if (error) throw error;
    
    categoryLabels = {};
    (data || []).forEach(cat => {
      categoryLabels[cat.slug] = cat.name;
    });
    
  } catch (error) {
    console.error('Error loading categories:', error);
    categoryLabels = { 'other': 'Otros' };
  }
}

// ========================================
// LOAD RESOURCE
// ========================================

async function loadResource(resourceId) {
  try {
    // Fetch resource
    const { data: resource, error } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .single();
    
    if (error || !resource) {
      console.error('Resource not found:', error);
      showError();
      return;
    }
    
    currentResource = resource;
    
    // Update page title
    document.title = `${resource.title} - SenseTech`;
    
    // Increment view count
    await incrementViewCount(resourceId);
    
    // Load user progress
    await loadUserProgress(resourceId);
    
    // Render resource
    renderResource();
    
    // Load related resources
    await loadRelatedResources();
    
    // Show content
    showContent();
    
    // Init actions
    initActions();
    
  } catch (error) {
    console.error('Error loading resource:', error);
    showError();
  }
}

async function incrementViewCount(resourceId) {
  try {
    // Convertir a número ya que resource_id es int4 en la base de datos
    const numericResourceId = parseInt(resourceId, 10);
    
    // Verificar si el usuario ya tiene un registro de progreso para este recurso
    const { data: existingProgress, error: selectError } = await supabase
      .from('user_progress')
      .select('id, has_viewed')
      .eq('user_id', currentUser.id)
      .eq('resource_id', numericResourceId)
      .maybeSingle();
    
    console.log('Checking view status:', { existingProgress, selectError });
    
    // Si ya vio este recurso, no incrementar
    if (existingProgress && existingProgress.has_viewed === true) {
      console.log('User already viewed this resource');
      return;
    }
    
    // Marcar como visto en user_progress
    if (existingProgress) {
      // Actualizar registro existente
      const { error: updateError } = await supabase
        .from('user_progress')
        .update({ has_viewed: true })
        .eq('id', existingProgress.id);
      
      if (updateError) console.error('Error updating has_viewed:', updateError);
    } else {
      // Crear nuevo registro
      const { error: insertError } = await supabase
        .from('user_progress')
        .insert({
          user_id: currentUser.id,
          resource_id: numericResourceId,
          has_viewed: true,
          progress: 0,
          is_favorite: false
        });
      
      if (insertError) console.error('Error inserting progress:', insertError);
    }
    
    // Incrementar contador de vistas
    const currentCount = parseInt(currentResource.view_count) || 0;
    const { error: viewError } = await supabase
      .from('resources')
      .update({ view_count: currentCount + 1 })
      .eq('id', numericResourceId);
    
    if (viewError) console.error('Error updating view_count:', viewError);
    else console.log('View count incremented successfully');
      
  } catch (error) {
    console.log('View count update failed:', error);
  }
}

async function loadUserProgress(resourceId) {
  try {
    const numericResourceId = parseInt(resourceId, 10);
    const { data } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('resource_id', numericResourceId)
      .maybeSingle();
    
    userProgress = data;
  } catch (error) {
    userProgress = null;
  }
}

// ========================================
// RENDER
// ========================================

function renderResource() {
  const resource = currentResource;
  const typeInfo = getTypeConfig(resource.type);
  const categoryLabel = categoryLabels[resource.category] || resource.category || 'General';
  
  // Cover
  const coverEl = document.getElementById('resourceCover');
  if (coverEl) {
    if (resource.cover_url) {
      coverEl.innerHTML = `<img src="${resource.cover_url}" alt="${resource.title}">`;
    } else {
      coverEl.innerHTML = `<span class="resource-icon">${typeInfo.icon}</span>`;
    }
  }
  
  // Badges
  document.getElementById('resourceType').textContent = typeInfo.label;
  document.getElementById('resourceCategory').textContent = categoryLabel;
  
  // Title & Author
  document.getElementById('resourceTitle').textContent = resource.title || 'Sin título';
  document.getElementById('resourceAuthor').textContent = resource.author ? `Por ${resource.author}` : '';
  
  // Stats - Solo mostrar +1 si el usuario no ha visto el recurso antes
  const hasViewed = userProgress?.has_viewed === true;
  const displayViewCount = hasViewed ? (resource.view_count || 0) : (resource.view_count || 0) + 1;
  document.getElementById('viewCount').textContent = displayViewCount;
  document.getElementById('favoriteCount').textContent = resource.favorite_count || 0;
  document.getElementById('dateAdded').textContent = formatDate(resource.created_at);
  
  // Description
  const descEl = document.getElementById('resourceDescription');
  if (descEl) {
    descEl.innerHTML = resource.description 
      ? `<p>${resource.description}</p>` 
      : '<p>No hay descripción disponible para este recurso.</p>';
  }
  
  // Details
  document.getElementById('detailType').textContent = typeInfo.label;
  document.getElementById('detailCategory').textContent = categoryLabel;
  document.getElementById('detailAuthor').textContent = resource.author || 'Desconocido';
  document.getElementById('detailDate').textContent = formatDate(resource.created_at);
  
  // Progress
  renderProgress();
  
  // Favorite button
  updateFavoriteButton();
}

function getButtonTextForType(type, state) {
  // state: 'start', 'continue', 'complete'
  const texts = {
    video: {
      start: 'Comenzar a ver',
      continue: 'Continuar viendo',
      complete: 'Volver a ver'
    },
    pdf: {
      start: 'Comenzar a leer',
      continue: 'Continuar leyendo',
      complete: 'Volver a leer'
    },
    documentation: {
      start: 'Comenzar a leer',
      continue: 'Continuar leyendo',
      complete: 'Volver a leer'
    },
    book: {
      start: 'Comenzar a leer',
      continue: 'Continuar leyendo',
      complete: 'Volver a leer'
    },
    link: {
      start: 'Abrir enlace externo',
      continue: 'Abrir enlace externo',
      complete: 'Abrir enlace externo'
    }
  };
  
  const typeKey = type?.toLowerCase() || 'pdf';
  return texts[typeKey]?.[state] || texts.pdf[state];
}

function getButtonIconForType(type, state) {
  const isVideo = type?.toLowerCase() === 'video';
  
  if (state === 'complete') {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 4v6h6M23 20v-6h-6"/>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
    </svg>`;
  }
  
  if (type?.toLowerCase() === 'link') {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>`;
  }
  
  // Play icon for video and documents
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>`;
}

function renderProgress() {
  const type = currentResource?.type?.toLowerCase();
  const isExternalLink = type === 'link';
  const progressSection = document.getElementById('progressSection');
  
  // Hide progress section for external links
  if (isExternalLink) {
    if (progressSection) {
      progressSection.style.display = 'none';
    }
    
    // Update button for external link
    const startBtn = document.getElementById('startReadingBtn');
    if (startBtn) {
      startBtn.innerHTML = `
        ${getButtonIconForType('link', 'start')}
        ${getButtonTextForType('link', 'start')}
      `;
    }
    return;
  }
  
  // Show progress section for regular resources
  if (progressSection) {
    progressSection.style.display = '';
  }
  
  const progressPercentage = userProgress?.progress || userProgress?.progress_percentage || 0;
  const lastAccessed = userProgress?.last_read || userProgress?.last_accessed_at;
  
  document.getElementById('progressPercentage').textContent = `${progressPercentage}%`;
  document.getElementById('progressBar').style.width = `${progressPercentage}%`;
  
  let progressText = 'Aún no has comenzado este recurso';
  if (progressPercentage === 100) {
    progressText = '¡Completado! 🎉';
  } else if (progressPercentage > 0) {
    progressText = `Último acceso: ${formatDate(lastAccessed)}`;
  }
  document.getElementById('progressText').textContent = progressText;
  
  // Update button text based on type and progress
  const startBtn = document.getElementById('startReadingBtn');
  if (startBtn) {
    let state = 'start';
    if (progressPercentage === 100) {
      state = 'complete';
    } else if (progressPercentage > 0) {
      state = 'continue';
    }
    
    startBtn.innerHTML = `
      ${getButtonIconForType(type, state)}
      ${getButtonTextForType(type, state)}
    `;
  }
}

function updateFavoriteButton() {
  const btn = document.getElementById('favoriteBtn');
  const icon = document.getElementById('favoriteIcon');
  const text = document.getElementById('favoriteText');
  
  const isFavorite = userProgress?.is_favorite || false;
  
  if (isFavorite) {
    btn.classList.add('active');
    icon.textContent = '❤️';
    text.textContent = 'En favoritos';
  } else {
    btn.classList.remove('active');
    icon.textContent = '🤍';
    text.textContent = 'Agregar a favoritos';
  }
}

// ========================================
// RATING SYSTEM
// ========================================

function initRatingSystem() {
  const starRating = document.getElementById('starRating');
  if (!starRating) return;
  
  const stars = starRating.querySelectorAll('.star-btn');
  
  // Hover effects
  stars.forEach((star, index) => {
    star.addEventListener('mouseenter', () => {
      highlightStars(index + 1);
    });
    
    star.addEventListener('mouseleave', () => {
      const currentRating = userProgress?.rating || 0;
      highlightStars(currentRating, true);
    });
    
    star.addEventListener('click', () => {
      submitRating(index + 1);
    });
  });
}

function highlightStars(rating, isActive = false) {
  const stars = document.querySelectorAll('.star-btn');
  stars.forEach((star, index) => {
    star.classList.remove('hovered', 'active');
    if (index < rating) {
      star.classList.add(isActive ? 'active' : 'hovered');
    }
  });
}

async function submitRating(rating) {
  if (!currentUser || !currentResource) return;
  
  try {
    // Update user_progress with rating
    const { error } = await supabase
      .from('user_progress')
      .update({ rating: rating })
      .eq('user_id', currentUser.id)
      .eq('resource_id', currentResource.id);
    
    if (error) throw error;
    
    // Update local state
    if (userProgress) {
      userProgress.rating = rating;
    }
    
    // Update UI
    highlightStars(rating, true);
    
    const ratingText = document.getElementById('ratingText');
    const ratingLabels = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];
    ratingText.textContent = `¡Gracias! Tu calificación: ${ratingLabels[rating]}`;
    ratingText.classList.add('submitted');
    
  } catch (error) {
    console.error('Error submitting rating:', error);
  }
}

function showRatingSection() {
  const progressPercentage = userProgress?.progress || 0;
  const ratingSection = document.getElementById('ratingSection');
  
  if (!ratingSection) return;
  
  // Only show for completed resources (not links)
  const isLink = currentResource?.type?.toLowerCase() === 'link';
  
  if (progressPercentage >= 100 && !isLink) {
    ratingSection.style.display = 'block';
    
    // Show existing rating if any
    const existingRating = userProgress?.rating || 0;
    if (existingRating > 0) {
      highlightStars(existingRating, true);
      const ratingLabels = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];
      const ratingText = document.getElementById('ratingText');
      ratingText.textContent = `Tu calificación: ${ratingLabels[existingRating]}`;
      ratingText.classList.add('submitted');
    }
  } else {
    ratingSection.style.display = 'none';
  }
}

async function loadRelatedResources() {
  const container = document.getElementById('relatedResources');
  if (!container) return;
  
  try {
    // Get resources from same category
    const { data: related } = await supabase
      .from('resources')
      .select('id, title, author, type, cover_url')
      .eq('category', currentResource.category)
      .neq('id', currentResource.id)
      .limit(4);
    
    if (!related || related.length === 0) {
      container.innerHTML = '<p class="no-related">No hay recursos relacionados disponibles.</p>';
      return;
    }
    
    container.innerHTML = related.map(resource => {
      const typeInfo = getTypeConfig(resource.type);
      return `
        <a href="resource.html#${resource.id}" class="related-card">
          <div class="related-card-image">
            ${resource.cover_url 
              ? `<img src="${resource.cover_url}" alt="${resource.title}">`
              : `<span class="icon">${typeInfo.icon}</span>`
            }
          </div>
          <div class="related-card-info">
            <div class="related-card-title">${resource.title}</div>
            <div class="related-card-author">${resource.author || 'Autor desconocido'}</div>
          </div>
        </a>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading related resources:', error);
    container.innerHTML = '<p class="no-related">Error al cargar recursos relacionados.</p>';
  }
}

// ========================================
// ACTIONS
// ========================================

function initActions() {
  // Favorite button
  document.getElementById('favoriteBtn')?.addEventListener('click', toggleFavorite);
  
  // Start reading button
  document.getElementById('startReadingBtn')?.addEventListener('click', startReading);
  
  // Rating system
  initRatingSystem();
  showRatingSection();
}

async function toggleFavorite() {
  if (!currentUser || !currentResource) return;
  
  const btn = document.getElementById('favoriteBtn');
  const isFavorite = btn.classList.contains('active');
  const resourceId = String(currentResource.id);
  
  try {
    // Check if progress record exists
    const { data: existing } = await supabase
      .from('user_progress')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('resource_id', resourceId)
      .single();
    
    if (isFavorite) {
      // Remove from favorites
      if (existing) {
        await supabase
          .from('user_progress')
          .update({ is_favorite: false })
          .eq('id', existing.id);
      }
      
      if (userProgress) userProgress.is_favorite = false;
      
      // Update favorite count
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
      
      currentResource.favorite_count = newCount;
      document.getElementById('favoriteCount').textContent = newCount;
      
    } else {
      // Add to favorites
      if (existing) {
        await supabase
          .from('user_progress')
          .update({ is_favorite: true })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_progress')
          .insert({
            user_id: currentUser.id,
            resource_id: resourceId,
            is_favorite: true,
            progress: 0
          });
      }
      
      if (userProgress) {
        userProgress.is_favorite = true;
      } else {
        userProgress = { is_favorite: true, progress: 0 };
      }
      
      // Update favorite count
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
      
      currentResource.favorite_count = newCount;
      document.getElementById('favoriteCount').textContent = newCount;
    }
    
    updateFavoriteButton();
    
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
}

function startReading() {
  if (!currentResource) return;
  
  const type = currentResource.type?.toLowerCase();
  const hasFile = currentResource.file_url;
  const hasExternal = currentResource.external_url;
  
  // External links (type 'link') always open in new tab
  if (type === 'link') {
    const url = hasExternal || hasFile;
    if (url) {
      window.open(url, '_blank');
      // Register view but no progress tracking for external links
      registerExternalView();
      return;
    }
    showToast('Este enlace no tiene URL configurada', 'error');
    return;
  }
  
  // Open internal reader for PDFs, books, and documents
  if (hasFile && (type === 'pdf' || type === 'book' || type === 'documentation')) {
    window.location.href = `reader.html#${currentResource.id}`;
    return;
  }
  
  // Open internal reader for videos with file
  if (hasFile && type === 'video') {
    window.location.href = `reader.html#${currentResource.id}`;
    return;
  }
  
  // External links open in new tab
  if (hasExternal) {
    window.open(hasExternal, '_blank');
    updateProgress(10);
    return;
  }
  
  // Fallback: open file directly if available
  if (hasFile) {
    window.location.href = `reader.html#${currentResource.id}`;
    return;
  }
  
  showToast('Este recurso no tiene contenido disponible', 'error');
}

async function registerExternalView() {
  if (!currentUser || !currentResource) return;
  
  try {
    // Just mark as viewed, no progress tracking
    const { data: existing } = await supabase
      .from('user_progress')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('resource_id', currentResource.id)
      .single();
    
    if (!existing) {
      await supabase
        .from('user_progress')
        .insert({
          user_id: currentUser.id,
          resource_id: currentResource.id,
          has_viewed: true,
          last_accessed_at: new Date().toISOString()
        });
    } else {
      await supabase
        .from('user_progress')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
  } catch (error) {
    console.error('Error registering external view:', error);
  }
}

async function updateProgress(percentage) {
  if (!currentUser || !currentResource) return;
  
  try {
    await supabase
      .from('user_progress')
      .upsert({
        user_id: currentUser.id,
        resource_id: currentResource.id,
        progress_percentage: percentage,
        last_accessed_at: new Date().toISOString()
      });
    
    userProgress = {
      ...userProgress,
      progress_percentage: percentage,
      last_accessed_at: new Date().toISOString()
    };
    
    renderProgress();
    
  } catch (error) {
    console.error('Error updating progress:', error);
  }
}

// ========================================
// UI HELPERS
// ========================================

function showContent() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('resourceContent').style.display = 'block';
}

function showError() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('resourceContent').style.display = 'none';
}

function formatDate(dateString) {
  if (!dateString) return '--';
  
  const date = new Date(dateString);
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
  return date.toLocaleDateString('es-ES', options);
}

function showToast(message, type = 'info') {
  // Use existing toast if available
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  
  // Fallback toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-card);
    color: var(--text-primary);
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideUp 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
