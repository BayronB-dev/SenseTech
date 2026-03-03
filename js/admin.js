/**
 * SenseTech - Admin Panel
 * Handles resource management, user management, and analytics
 */

// State
let currentUser = null;
let currentProfile = null;
let allResources = [];
let allUsers = [];
let allCategories = [];
let allTypes = [];
let deleteTarget = null;

// Category config (loaded from database)
let categoryLabels = {};
let categoryIcons = {};

// Type config (loaded from database)
let typeLabels = {};
let typeIcons = {};

// Fallback type config (used if database table doesn't exist yet)
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

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  await initAdmin();
});

async function initAdmin() {
  // Check authentication and admin role
  const { user, profile } = await getCurrentUserWithProfile();
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  // Check if user is admin
  if (profile?.role !== 'admin') {
    window.location.href = 'home.html';
    return;
  }
  
  currentUser = user;
  currentProfile = profile;
  
  // Load categories and types from database
  await Promise.all([
    loadCategoriesFromDB(),
    loadTypesFromDB()
  ]);
  
  // Update admin display
  updateAdminDisplay();
  
  // Init navigation
  initNavigation();
  
  // Init sidebar toggle
  initSidebarToggle();
  
  // Init modals
  initModals();
  initCategoryModal();
  initTypeModal();
  
  // Load dashboard data
  await loadDashboard();
  
  // Init logout
  document.getElementById('adminLogoutBtn')?.addEventListener('click', logout);
}

function updateAdminDisplay() {
  const name = currentProfile?.name || 'Admin';
  const initial = name.charAt(0).toUpperCase();
  
  const avatarEl = document.getElementById('adminAvatar');
  const nameEl = document.getElementById('adminName');
  
  if (avatarEl) {
    if (currentProfile?.photo_url) {
      avatarEl.innerHTML = `<img src="${currentProfile.photo_url}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
      avatarEl.textContent = initial;
    }
  }
  
  if (nameEl) nameEl.textContent = name;
}

// ========================================
// NAVIGATION
// ========================================

function initNavigation() {
  const links = document.querySelectorAll('.sidebar-link[data-section]');
  
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const section = link.dataset.section;
      
      // Update active link
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      // Update page title
      document.getElementById('pageTitle').textContent = link.textContent.trim();
      
      // Show section
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${section}`).classList.add('active');
      
      // Load section data
      loadSectionData(section);
      
      // Close sidebar on mobile
      document.getElementById('adminSidebar').classList.remove('open');
    });
  });
}

function initSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('adminSidebar');
  
  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

async function loadSectionData(section) {
  switch (section) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'resources':
      await loadResources();
      break;
    case 'users':
      await loadUsers();
      break;
    case 'categories':
      await loadCategories();
      break;
    case 'types':
      await loadTypes();
      break;
  }
}

// ========================================
// DASHBOARD
// ========================================

async function loadDashboard() {
  try {
    // Load stats
    const [resourcesRes, usersRes] = await Promise.all([
      supabaseClient.from('resources').select('id, view_count, favorite_count'),
      supabaseClient.from('profiles').select('id')
    ]);
    
    const resources = resourcesRes.data || [];
    const users = usersRes.data || [];
    
    const totalViews = resources.reduce((sum, r) => sum + (r.view_count || 0), 0);
    const totalFavorites = resources.reduce((sum, r) => sum + (r.favorite_count || 0), 0);
    
    document.getElementById('statResources').textContent = resources.length;
    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statViews').textContent = totalViews;
    document.getElementById('statFavorites').textContent = totalFavorites;
    
    // Load recent resources
    const { data: recentResources } = await supabaseClient
      .from('resources')
      .select('id, title, type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    renderRecentResources(recentResources || []);
    
    // Load recent users
    const { data: recentUsers } = await supabaseClient
      .from('profiles')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    renderRecentUsers(recentUsers || []);
    
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

function renderRecentResources(resources) {
  const container = document.getElementById('recentResources');
  
  if (resources.length === 0) {
    container.innerHTML = '<p class="empty-text">No hay recursos</p>';
    return;
  }
  
  container.innerHTML = resources.map(r => {
    const typeInfo = getTypeConfig(r.type);
    return `
      <div class="recent-item">
        <div class="icon">${typeInfo.icon}</div>
        <div class="info">
          <div class="title">${r.title}</div>
          <div class="meta">${formatDate(r.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentUsers(users) {
  const container = document.getElementById('recentUsers');
  
  if (users.length === 0) {
    container.innerHTML = '<p class="empty-text">No hay usuarios</p>';
    return;
  }
  
  container.innerHTML = users.map(u => `
    <div class="recent-item">
      <div class="icon">👤</div>
      <div class="info">
        <div class="title">${u.name || 'Sin nombre'}</div>
        <div class="meta">${formatDate(u.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// ========================================
// RESOURCES MANAGEMENT
// ========================================

async function loadResources() {
  try {
    const { data, error } = await supabaseClient
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allResources = data || [];
    renderResourcesTable(allResources);
    
    // Init search and filter
    initResourceFilters();
    
  } catch (error) {
    console.error('Error loading resources:', error);
  }
}

function renderResourcesTable(resources) {
  const tbody = document.getElementById('resourcesTableBody');
  
  if (resources.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-text">No hay recursos</td></tr>';
    return;
  }
  
  tbody.innerHTML = resources.map(r => {
    const typeInfo = getTypeConfig(r.type);
    const categoryLabel = categoryLabels[r.category] || r.category || 'Sin categoría';
    
    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${typeInfo.icon}</span>
            <span>${r.title || 'Sin título'}</span>
          </div>
        </td>
        <td>${typeInfo.label}</td>
        <td>${categoryLabel}</td>
        <td>${r.view_count || 0}</td>
        <td>${r.favorite_count || 0}</td>
        <td class="actions">
          <button class="action-btn" onclick="editResource('${r.id}')" title="Editar">✏️</button>
          <button class="action-btn danger" onclick="deleteResource('${r.id}')" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function initResourceFilters() {
  const searchInput = document.getElementById('resourceSearch');
  const categoryFilter = document.getElementById('resourceFilter');
  const typeFilter = document.getElementById('resourceTypeFilter');
  const sortSelect = document.getElementById('resourceSort');
  
  const filterAndSortResources = () => {
    const search = searchInput?.value.toLowerCase() || '';
    const category = categoryFilter?.value || '';
    const type = typeFilter?.value || '';
    const sort = sortSelect?.value || 'popular';
    
    // Filtrar
    let filtered = allResources.filter(r => {
      const matchesSearch = !search || 
        r.title?.toLowerCase().includes(search) ||
        r.author?.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search);
      const matchesCategory = !category || r.category === category;
      const matchesType = !type || r.type === type;
      
      return matchesSearch && matchesCategory && matchesType;
    });
    
    // Ordenar
    switch (sort) {
      case 'popular':
        filtered.sort((a, b) => {
          const popA = (a.view_count || 0) + (a.favorite_count || 0);
          const popB = (b.view_count || 0) + (b.favorite_count || 0);
          return popB - popA;
        });
        break;
      case 'least-popular':
        filtered.sort((a, b) => {
          const popA = (a.view_count || 0) + (a.favorite_count || 0);
          const popB = (b.view_count || 0) + (b.favorite_count || 0);
          return popA - popB;
        });
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'title-asc':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'title-desc':
        filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      case 'views':
        filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        break;
      case 'favorites':
        filtered.sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0));
        break;
    }
    
    renderResourcesTable(filtered);
  };
  
  // Aplicar ordenamiento inicial
  filterAndSortResources();
  
  // Event listeners
  searchInput?.addEventListener('input', filterAndSortResources);
  categoryFilter?.addEventListener('change', filterAndSortResources);
  typeFilter?.addEventListener('change', filterAndSortResources);
  sortSelect?.addEventListener('change', filterAndSortResources);
}

// ========================================
// USERS MANAGEMENT
// ========================================

async function loadUsers() {
  try {
    console.log('Loading users from profiles table...');
    
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    console.log('Users loaded:', data, 'Error:', error);
    
    if (error) throw error;
    
    allUsers = data || [];
    renderUsersTable(allUsers);
    
    // Init search and filter
    initUserFilters();
    
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('usersTableBody').innerHTML = 
      '<tr><td colspan="5" class="empty-text">Error al cargar usuarios</td></tr>';
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-text">No hay usuarios</td></tr>';
    return;
  }
  
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="avatar" style="width: 32px; height: 32px; font-size: 14px;">
            ${u.photo_url 
              ? `<img src="${u.photo_url}" alt="${u.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
              : (u.name ? u.name.charAt(0).toUpperCase() : 'U')
            }
          </div>
          <span>${u.name || 'Sin nombre'}</span>
        </div>
      </td>
      <td>${u.id}</td>
      <td><span class="role-badge ${u.role || 'user'}">${u.role === 'admin' ? 'Admin' : 'Usuario'}</span></td>
      <td>${formatDate(u.created_at)}</td>
      <td class="actions">
        <button class="action-btn" onclick="toggleUserRole('${u.id}', '${u.role}')" title="Cambiar rol">
          ${u.role === 'admin' ? '👤' : '👑'}
        </button>
      </td>
    </tr>
  `).join('');
}

function initUserFilters() {
  const searchInput = document.getElementById('userSearch');
  const filterSelect = document.getElementById('userRoleFilter');
  
  const filterUsers = () => {
    const search = searchInput.value.toLowerCase();
    const role = filterSelect.value;
    
    const filtered = allUsers.filter(u => {
      const matchesSearch = !search || 
        u.name?.toLowerCase().includes(search) ||
        u.id?.toLowerCase().includes(search);
      const matchesRole = !role || u.role === role;
      
      return matchesSearch && matchesRole;
    });
    
    renderUsersTable(filtered);
  };
  
  searchInput?.addEventListener('input', filterUsers);
  filterSelect?.addEventListener('change', filterUsers);
}

async function toggleUserRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    
    if (error) throw error;
    
    // Reload users
    await loadUsers();
    showToast(`Rol actualizado a ${newRole === 'admin' ? 'Administrador' : 'Usuario'}`);
    
  } catch (error) {
    console.error('Error updating role:', error);
    showToast('Error al actualizar el rol', 'error');
  }
}

// ========================================
// CATEGORIES
// ========================================

async function loadCategoriesFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    allCategories = data || [];
    
    // Update lookup objects
    categoryLabels = {};
    categoryIcons = {};
    allCategories.forEach(cat => {
      categoryLabels[cat.slug] = cat.name;
      categoryIcons[cat.slug] = cat.icon || '📁';
    });
    
    // Update selects
    updateCategorySelects();
    
  } catch (error) {
    console.error('Error loading categories:', error);
    // Fallback defaults if table doesn't exist yet
    categoryLabels = { 'other': 'Otros' };
    categoryIcons = { 'other': '📁' };
  }
}

async function loadCategories() {
  const container = document.getElementById('categoriesGrid');
  
  try {
    // Reload from DB
    await loadCategoriesFromDB();
    
    // Count resources per category
    const counts = {};
    allResources.forEach(r => {
      if (r.category) {
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
    });
    
    if (allCategories.length === 0) {
      container.innerHTML = '<p class="empty-text">No hay categorías. Crea una nueva.</p>';
      return;
    }
    
    container.innerHTML = allCategories.map(cat => `
      <div class="category-card" data-category="${cat.slug}">
        <div class="icon">${cat.icon || '📁'}</div>
        <h4>${cat.name}</h4>
        <p class="count">${counts[cat.slug] || 0} recursos</p>
        <div class="category-actions">
          <button class="action-btn" onclick="editCategory('${cat.slug}')" title="Editar">✏️</button>
          <button class="action-btn danger" onclick="deleteCategoryBySlug('${cat.slug}')" title="Eliminar">🗑️</button>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading categories:', error);
    container.innerHTML = '<p class="empty-text">Error al cargar categorías</p>';
  }
}

function initCategoryModal() {
  const modal = document.getElementById('categoryModal');
  const addBtn = document.getElementById('addCategoryBtn');
  const closeBtn = document.getElementById('closeCategoryModal');
  const cancelBtn = document.getElementById('cancelCategoryBtn');
  const form = document.getElementById('categoryForm');
  const nameInput = document.getElementById('categoryName');
  const slugInput = document.getElementById('categorySlug');
  
  addBtn?.addEventListener('click', () => openCategoryModal());
  closeBtn?.addEventListener('click', () => closeCategoryModal());
  cancelBtn?.addEventListener('click', () => closeCategoryModal());
  form?.addEventListener('submit', saveCategory);
  
  // Auto-generate slug from name
  nameInput?.addEventListener('input', () => {
    if (!document.getElementById('categoryId').value) {
      slugInput.value = nameInput.value
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  });
  
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeCategoryModal();
  });
}

function openCategoryModal(categorySlug = null) {
  const modal = document.getElementById('categoryModal');
  const title = document.getElementById('categoryModalTitle');
  const form = document.getElementById('categoryForm');
  
  if (categorySlug) {
    const category = allCategories.find(c => c.slug === categorySlug);
    if (category) {
      title.textContent = 'Editar Categoría';
      document.getElementById('categoryId').value = category.id;
      document.getElementById('categoryName').value = category.name;
      document.getElementById('categorySlug').value = category.slug;
      document.getElementById('categoryIcon').value = category.icon || '';
      document.getElementById('categorySlug').readOnly = true;
    }
  } else {
    title.textContent = 'Nueva Categoría';
    form.reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categorySlug').readOnly = false;
  }
  
  modal.classList.add('active');
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
}

function editCategory(slug) {
  openCategoryModal(slug);
}

async function saveCategory(e) {
  e.preventDefault();
  
  const id = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim();
  const slug = document.getElementById('categorySlug').value.trim().toLowerCase();
  const icon = document.getElementById('categoryIcon').value.trim() || '📁';
  
  if (!name || !slug) {
    showToast('Nombre y slug son requeridos', 'error');
    return;
  }
  
  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    showToast('El slug solo puede contener letras minúsculas, números y guiones', 'error');
    return;
  }
  
  const saveBtn = document.getElementById('saveCategoryBtn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Guardando...';
  saveBtn.disabled = true;
  
  try {
    if (id) {
      // Update existing
      const { error } = await supabaseClient
        .from('categories')
        .update({ name, icon })
        .eq('id', parseInt(id));
      
      if (error) throw error;
      showToast('Categoría actualizada');
    } else {
      // Check if slug exists
      const existing = allCategories.find(c => c.slug === slug);
      if (existing) {
        showToast('Ya existe una categoría con ese identificador', 'error');
        return;
      }
      
      // Insert new
      const { error } = await supabaseClient
        .from('categories')
        .insert({ slug, name, icon });
      
      if (error) throw error;
      showToast('Categoría creada');
    }
    
    closeCategoryModal();
    await loadCategories();
    
  } catch (error) {
    console.error('Error saving category:', error);
    showToast('Error al guardar: ' + (error.message || 'Error desconocido'), 'error');
  } finally {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

function deleteCategoryBySlug(slug) {
  // Check if category has resources
  const resourceCount = allResources.filter(r => r.category === slug).length;
  
  if (resourceCount > 0) {
    showToast(`No se puede eliminar: hay ${resourceCount} recursos en esta categoría`, 'error');
    return;
  }
  
  const category = allCategories.find(c => c.slug === slug);
  if (!category) return;
  
  deleteTarget = { type: 'category', id: category.id, name: category.name };
  document.getElementById('deleteModal').classList.add('active');
}

function updateCategorySelects() {
  // Update category selects in resource form and filters
  const selects = [
    document.getElementById('resourceCategoryInput'),
    document.getElementById('resourceFilter')
  ];
  
  selects.forEach(select => {
    if (!select) return;
    
    const currentValue = select.value;
    const isFilter = select.id === 'resourceFilter';
    
    select.innerHTML = isFilter ? '<option value="">Todas las categorías</option>' : '<option value="">Seleccionar...</option>';
    
    allCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.slug;
      option.textContent = cat.name;
      select.appendChild(option);
    });
    
    select.value = currentValue;
  });
}

// ========================================
// MODALS & FILE UPLOAD
// ========================================

// File upload state
let selectedCoverFile = null;
let selectedResourceFile = null;

function initModals() {
  // Resource modal
  const resourceModal = document.getElementById('resourceModal');
  const addBtn = document.getElementById('addResourceBtn');
  const closeBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelResourceBtn');
  const form = document.getElementById('resourceForm');
  
  addBtn?.addEventListener('click', () => openResourceModal());
  closeBtn?.addEventListener('click', () => closeResourceModal());
  cancelBtn?.addEventListener('click', () => closeResourceModal());
  
  form?.addEventListener('submit', saveResource);
  
  // Toggle file/URL input based on type selection
  const typeSelect = document.getElementById('resourceTypeInput');
  typeSelect?.addEventListener('change', toggleFileUrlInput);
  
  // Delete modal
  const deleteModal = document.getElementById('deleteModal');
  const closeDeleteBtn = document.getElementById('closeDeleteModal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  
  closeDeleteBtn?.addEventListener('click', () => closeDeleteModal());
  cancelDeleteBtn?.addEventListener('click', () => closeDeleteModal());
  confirmDeleteBtn?.addEventListener('click', confirmDelete);
  
  // Close on overlay click
  resourceModal?.addEventListener('click', (e) => {
    if (e.target === resourceModal) closeResourceModal();
  });
  
  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });
  
  // Init file uploads
  initFileUploads();
}

function initFileUploads() {
  // Cover upload
  const coverArea = document.getElementById('coverUploadArea');
  const coverInput = document.getElementById('resourceCoverFile');
  const coverContent = document.getElementById('coverUploadContent');
  const coverPreview = document.getElementById('coverPreview');
  const coverPreviewImg = document.getElementById('coverPreviewImg');
  const removeCoverBtn = document.getElementById('removeCover');
  
  if (coverArea && coverInput) {
    // Click to select
    coverArea.addEventListener('click', () => coverInput.click());
    
    // Drag and drop
    coverArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      coverArea.classList.add('dragover');
    });
    
    coverArea.addEventListener('dragleave', () => {
      coverArea.classList.remove('dragover');
    });
    
    coverArea.addEventListener('drop', (e) => {
      e.preventDefault();
      coverArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handleCoverFile(file);
      }
    });
    
    // File input change
    coverInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleCoverFile(file);
    });
    
    // Remove cover
    removeCoverBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedCoverFile = null;
      coverContent.style.display = 'flex';
      coverPreview.style.display = 'none';
      coverInput.value = '';
    });
  }
  
  // Resource file upload
  const fileArea = document.getElementById('fileUploadArea');
  const fileInput = document.getElementById('resourceFileInput');
  const fileContent = document.getElementById('fileUploadContent');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const removeFileBtn = document.getElementById('removeFile');
  
  if (fileArea && fileInput) {
    // Click to select
    fileArea.addEventListener('click', () => fileInput.click());
    
    // Drag and drop
    fileArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileArea.classList.add('dragover');
    });
    
    fileArea.addEventListener('dragleave', () => {
      fileArea.classList.remove('dragover');
    });
    
    fileArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fileArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleResourceFile(file);
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleResourceFile(file);
    });
    
    // Remove file
    removeFileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedResourceFile = null;
      fileContent.style.display = 'flex';
      fileInfo.style.display = 'none';
      fileInput.value = '';
    });
  }
}

function handleCoverFile(file) {
  if (file.size > 2 * 1024 * 1024) {
    showToast('La imagen no puede superar 2MB', 'error');
    return;
  }
  
  selectedCoverFile = file;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('coverPreviewImg').src = e.target.result;
    document.getElementById('coverUploadContent').style.display = 'none';
    document.getElementById('coverPreview').style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function handleResourceFile(file) {
  if (file.size > 50 * 1024 * 1024) {
    showToast('El archivo no puede superar 50MB', 'error');
    return;
  }
  
  selectedResourceFile = file;
  
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);
  document.getElementById('fileUploadContent').style.display = 'none';
  document.getElementById('fileInfo').style.display = 'flex';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadFile(file, bucket, folder) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  
  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(fileName, file);
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(fileName);
  
  return urlData.publicUrl;
}

function toggleFileUrlInput() {
  const typeSelect = document.getElementById('resourceTypeInput');
  const fileUploadGroup = document.getElementById('fileUploadGroup');
  const externalUrlGroup = document.getElementById('externalUrlGroup');
  
  if (!typeSelect || !fileUploadGroup || !externalUrlGroup) return;
  
  const isLink = typeSelect.value === 'link';
  
  fileUploadGroup.style.display = isLink ? 'none' : 'block';
  externalUrlGroup.style.display = isLink ? 'block' : 'none';
}

function openResourceModal(resource = null) {
  const modal = document.getElementById('resourceModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('resourceForm');
  const downloadBtn = document.getElementById('downloadFileBtn');
  
  // Reset file uploads
  selectedCoverFile = null;
  selectedResourceFile = null;
  document.getElementById('coverUploadContent').style.display = 'flex';
  document.getElementById('coverPreview').style.display = 'none';
  document.getElementById('fileUploadContent').style.display = 'flex';
  document.getElementById('fileInfo').style.display = 'none';
  
  // Reset external URL
  document.getElementById('resourceExternalUrl').value = '';
  
  // Reset download button
  if (downloadBtn) {
    downloadBtn.style.display = 'none';
    downloadBtn.href = '#';
  }
  
  if (resource) {
    title.textContent = 'Editar Recurso';
    document.getElementById('resourceId').value = resource.id;
    document.getElementById('resourceTitleInput').value = resource.title || '';
    document.getElementById('resourceTypeInput').value = resource.type || '';
    document.getElementById('resourceCategoryInput').value = resource.category || '';
    document.getElementById('resourceAuthorInput').value = resource.author || '';
    document.getElementById('resourceDescriptionInput').value = resource.description || '';
    
    // Show existing cover if any
    if (resource.cover_url) {
      document.getElementById('coverPreviewImg').src = resource.cover_url;
      document.getElementById('coverUploadContent').style.display = 'none';
      document.getElementById('coverPreview').style.display = 'flex';
    }
    
    // Handle external URL for links
    if (resource.type === 'link' && resource.external_url) {
      document.getElementById('resourceExternalUrl').value = resource.external_url;
    }
    
    // Show existing file if any (for non-link types)
    if (resource.file_url && resource.type !== 'link') {
      const fileName = resource.file_url.split('/').pop() || 'Archivo existente';
      document.getElementById('fileName').textContent = fileName;
      document.getElementById('fileSize').textContent = 'Archivo actual';
      document.getElementById('fileUploadContent').style.display = 'none';
      document.getElementById('fileInfo').style.display = 'flex';
      
      // Show download button
      if (downloadBtn) {
        downloadBtn.href = resource.file_url;
        downloadBtn.style.display = 'inline-flex';
      }
    }
  } else {
    title.textContent = 'Nuevo Recurso';
    form.reset();
    document.getElementById('resourceId').value = '';
  }
  
  // Toggle file/URL input based on type
  toggleFileUrlInput();
  
  modal.classList.add('active');
}

function closeResourceModal() {
  document.getElementById('resourceModal').classList.remove('active');
}

async function saveResource(e) {
  e.preventDefault();
  
  const saveBtn = document.getElementById('saveResourceBtn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Guardando...';
  saveBtn.disabled = true;
  
  const id = document.getElementById('resourceId').value;
  
  try {
    // Get existing resource data if editing
    let existingResource = null;
    if (id) {
      existingResource = allResources.find(r => String(r.id) === String(id));
    }
    
    // Upload cover if new file selected
    let coverUrl = existingResource?.cover_url || null;
    if (selectedCoverFile) {
      saveBtn.textContent = 'Subiendo portada...';
      coverUrl = await uploadFile(selectedCoverFile, 'resources', 'covers');
    }
    
    const resourceType = document.getElementById('resourceTypeInput').value;
    const isLink = resourceType === 'link';
    
    // Handle file URL or external URL based on type
    let fileUrl = existingResource?.file_url || null;
    let externalUrl = existingResource?.external_url || null;
    
    if (isLink) {
      // For links, use the external URL field
      externalUrl = document.getElementById('resourceExternalUrl').value;
      fileUrl = null; // Clear file URL for links
    } else if (selectedResourceFile) {
      // For regular resources, upload the file
      saveBtn.textContent = 'Subiendo archivo...';
      fileUrl = await uploadFile(selectedResourceFile, 'resources', 'files');
    }
    
    const data = {
      title: document.getElementById('resourceTitleInput').value,
      type: resourceType,
      category: document.getElementById('resourceCategoryInput').value,
      author: document.getElementById('resourceAuthorInput').value,
      description: document.getElementById('resourceDescriptionInput').value,
      cover_url: coverUrl,
      file_url: fileUrl,
      external_url: externalUrl
    };
    
    saveBtn.textContent = 'Guardando...';
    
    if (id) {
      // Update
      const { error } = await supabaseClient
        .from('resources')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
      showToast('Recurso actualizado');
    } else {
      // Create
      const { error } = await supabaseClient
        .from('resources')
        .insert(data);
      
      if (error) throw error;
      showToast('Recurso creado');
    }
    
    closeResourceModal();
    await loadResources();
    
  } catch (error) {
    console.error('Error saving resource:', error);
    showToast('Error al guardar el recurso: ' + error.message, 'error');
  } finally {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

function editResource(id) {
  // Convertir a número para comparar correctamente
  const numericId = parseInt(id, 10);
  const resource = allResources.find(r => r.id === numericId);
  if (resource) {
    openResourceModal(resource);
  } else {
    console.error('Resource not found:', id);
    showToast('Recurso no encontrado', 'error');
  }
}

function deleteResource(id) {
  // Convertir a número para la operación de eliminación
  deleteTarget = { type: 'resource', id: parseInt(id, 10) };
  document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
  deleteTarget = null;
}

async function confirmDelete() {
  if (!deleteTarget) return;
  
  try {
    if (deleteTarget.type === 'resource') {
      console.log('Attempting to delete resource:', deleteTarget.id);
      
      // Primero eliminar registros relacionados en user_progress
      const { error: progressError } = await supabaseClient
        .from('user_progress')
        .delete()
        .eq('resource_id', deleteTarget.id);
      
      if (progressError) {
        console.warn('Error deleting user_progress (may not exist):', progressError);
      }
      
      // Luego eliminar el recurso
      const { error } = await supabaseClient
        .from('resources')
        .delete()
        .eq('id', deleteTarget.id);
      
      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }
      
      showToast('Recurso eliminado');
      await loadResources();
    } else if (deleteTarget.type === 'category') {
      const { error } = await supabaseClient
        .from('categories')
        .delete()
        .eq('id', deleteTarget.id);
      
      if (error) throw error;
      
      showToast('Categoría eliminada');
      await loadCategories();
    } else if (deleteTarget.type === 'resourceType') {
      const { error } = await supabaseClient
        .from('resource_types')
        .delete()
        .eq('id', deleteTarget.id);
      
      if (error) throw error;
      
      showToast('Tipo eliminado');
      await loadTypes();
    }
    
    closeDeleteModal();
    
  } catch (error) {
    console.error('Error deleting:', error);
    showToast('Error al eliminar: ' + (error.message || error.code || 'Error desconocido'), 'error');
  }
}

// ========================================
// HELPERS
// ========================================

function formatDate(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'error' ? 'var(--error-500)' : 'var(--success-500)'};
    color: white;
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

// ========================================
// RESOURCE TYPES
// ========================================

async function loadTypesFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from('resource_types')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    allTypes = data || [];
    
    // Update lookup objects
    typeLabels = {};
    typeIcons = {};
    allTypes.forEach(type => {
      typeLabels[type.slug] = type.name;
      typeIcons[type.slug] = type.icon || '📁';
    });
    
    // Update selects
    updateTypeSelects();
    
  } catch (error) {
    console.error('Error loading types:', error);
    // Use fallback defaults if table doesn't exist yet
    typeLabels = {};
    typeIcons = {};
    Object.entries(defaultTypeConfig).forEach(([slug, config]) => {
      typeLabels[slug] = config.label;
      typeIcons[slug] = config.icon;
    });
  }
}

async function loadTypes() {
  const container = document.getElementById('typesGrid');
  
  try {
    // Reload from DB
    await loadTypesFromDB();
    
    // Count resources per type
    const counts = {};
    allResources.forEach(r => {
      if (r.type) {
        counts[r.type] = (counts[r.type] || 0) + 1;
      }
    });
    
    if (allTypes.length === 0) {
      container.innerHTML = '<p class="empty-text">No hay tipos. Crea uno nuevo.</p>';
      return;
    }
    
    container.innerHTML = allTypes.map(type => `
      <div class="category-card" data-type="${type.slug}">
        <div class="icon">${type.icon || '📁'}</div>
        <h4>${type.name}</h4>
        <p class="count">${counts[type.slug] || 0} recursos</p>
        <div class="category-actions">
          <button class="action-btn" onclick="editType('${type.slug}')" title="Editar">✏️</button>
          <button class="action-btn danger" onclick="deleteTypeBySlug('${type.slug}')" title="Eliminar">🗑️</button>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading types:', error);
    container.innerHTML = '<p class="empty-text">Error al cargar tipos</p>';
  }
}

function initTypeModal() {
  const modal = document.getElementById('typeModal');
  const addBtn = document.getElementById('addTypeBtn');
  const closeBtn = document.getElementById('closeTypeModal');
  const cancelBtn = document.getElementById('cancelTypeBtn');
  const form = document.getElementById('typeForm');
  const nameInput = document.getElementById('typeName');
  const slugInput = document.getElementById('typeSlug');
  
  addBtn?.addEventListener('click', () => openTypeModal());
  closeBtn?.addEventListener('click', () => closeTypeModal());
  cancelBtn?.addEventListener('click', () => closeTypeModal());
  form?.addEventListener('submit', saveType);
  
  // Auto-generate slug from name
  nameInput?.addEventListener('input', () => {
    if (!document.getElementById('typeId').value) {
      slugInput.value = nameInput.value
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  });
  
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeTypeModal();
  });
}

function openTypeModal(typeSlug = null) {
  const modal = document.getElementById('typeModal');
  const title = document.getElementById('typeModalTitle');
  const form = document.getElementById('typeForm');
  
  if (typeSlug) {
    const type = allTypes.find(t => t.slug === typeSlug);
    if (type) {
      title.textContent = 'Editar Tipo';
      document.getElementById('typeId').value = type.id;
      document.getElementById('typeName').value = type.name;
      document.getElementById('typeSlug').value = type.slug;
      document.getElementById('typeIcon').value = type.icon || '';
      document.getElementById('typeSlug').readOnly = true;
    }
  } else {
    title.textContent = 'Nuevo Tipo';
    form.reset();
    document.getElementById('typeId').value = '';
    document.getElementById('typeSlug').readOnly = false;
  }
  
  modal.classList.add('active');
}

function closeTypeModal() {
  document.getElementById('typeModal').classList.remove('active');
}

function editType(slug) {
  openTypeModal(slug);
}

async function saveType(e) {
  e.preventDefault();
  
  const id = document.getElementById('typeId').value;
  const name = document.getElementById('typeName').value.trim();
  const slug = document.getElementById('typeSlug').value.trim().toLowerCase();
  const icon = document.getElementById('typeIcon').value.trim() || '📁';
  
  if (!name || !slug) {
    showToast('Nombre y slug son requeridos', 'error');
    return;
  }
  
  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    showToast('El slug solo puede contener letras minúsculas, números y guiones', 'error');
    return;
  }
  
  const saveBtn = document.getElementById('saveTypeBtn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Guardando...';
  saveBtn.disabled = true;
  
  try {
    if (id) {
      // Update existing
      const { error } = await supabaseClient
        .from('resource_types')
        .update({ name, icon })
        .eq('id', parseInt(id));
      
      if (error) throw error;
      showToast('Tipo actualizado');
    } else {
      // Check if slug exists
      const existing = allTypes.find(t => t.slug === slug);
      if (existing) {
        showToast('Ya existe un tipo con ese identificador', 'error');
        return;
      }
      
      // Insert new
      const { error } = await supabaseClient
        .from('resource_types')
        .insert({ slug, name, icon });
      
      if (error) throw error;
      showToast('Tipo creado');
    }
    
    closeTypeModal();
    await loadTypes();
    
  } catch (error) {
    console.error('Error saving type:', error);
    showToast('Error al guardar: ' + (error.message || 'Error desconocido'), 'error');
  } finally {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

function deleteTypeBySlug(slug) {
  // Check if type has resources
  const resourceCount = allResources.filter(r => r.type === slug).length;
  
  if (resourceCount > 0) {
    showToast(`No se puede eliminar: hay ${resourceCount} recursos de este tipo`, 'error');
    return;
  }
  
  const type = allTypes.find(t => t.slug === slug);
  if (!type) return;
  
  deleteTarget = { type: 'resourceType', id: type.id, name: type.name };
  document.getElementById('deleteModal').classList.add('active');
}

function updateTypeSelects() {
  // Update type selects in resource form
  const selects = [document.getElementById('resourceTypeInput')];
  
  selects.forEach(select => {
    if (!select) return;
    
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Seleccionar...</option>';
    
    allTypes.forEach(type => {
      const option = document.createElement('option');
      option.value = type.slug;
      option.textContent = `${type.icon || '📁'} ${type.name}`;
      select.appendChild(option);
    });
    
    select.value = currentValue;
  });
}

// Make functions available globally
window.editResource = editResource;
window.deleteResource = deleteResource;
window.toggleUserRole = toggleUserRole;
window.editType = editType;
window.deleteTypeBySlug = deleteTypeBySlug;
