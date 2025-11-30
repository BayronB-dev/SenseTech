/**
 * SenseTech - Document Reader
 * PDF viewer with progress tracking, bookmarks, and sync with user progress
 */

// PDF.js will be loaded dynamically
let pdfjsLib = null;

// State
let currentUser = null;
let currentResource = null;
let userProgress = null;
let bookmarks = [];

// PDF State
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.0;
let renderedPages = new Set();
let isRendering = false;

// UI State
let sidebarOpen = window.innerWidth > 768; // Closed by default on mobile
let isFullscreen = false;

// ========================================
// PDF.JS LOADER
// ========================================

async function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  await initReader();
});

async function initReader() {
  // Initialize theme first (doesn't require auth)
  initTheme();
  
  // Get resource ID from URL first
  const resourceId = window.location.hash.slice(1) || new URLSearchParams(window.location.search).get('id');
  
  if (!resourceId) {
    showError('No se especificó un recurso');
    return;
  }
  
  // Check authentication with retry
  let authAttempts = 0;
  let user = null;
  
  while (authAttempts < 3 && !user) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        user = session.user;
      } else {
        authAttempts++;
        if (authAttempts < 3) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Auth attempt failed:', error);
      authAttempts++;
      if (authAttempts < 3) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  if (!user) {
    // Store current URL to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = user;
  
  // Initialize UI controls (don't depend on resource data)
  initToolbar();
  initSidebar();
  initKeyboardShortcuts();
  
  // Load resource data
  await loadResource(resourceId);
  
  // Auto-save progress periodically
  setInterval(saveProgress, 30000); // Every 30 seconds
  
  // Save progress on page unload
  window.addEventListener('beforeunload', () => {
    // Use sendBeacon for reliable save on page close
    if (currentResource && userProgress) {
      const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
      const data = JSON.stringify({
        progress: progress,
        last_page: currentPage,
        last_read_at: new Date().toISOString()
      });
      
      // Try to save synchronously
      saveProgress();
    }
  });
  
  // Also save on visibility change (tab switch, minimize)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveProgress();
    }
  });
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
      showError('Recurso no encontrado');
      return;
    }
    
    currentResource = resource;
    
    // Update UI
    document.getElementById('resourceTitle').textContent = resource.title;
    document.getElementById('resourceMeta').textContent = resource.author || '';
    document.title = `${resource.title} - SenseTech Reader`;
    
    // Load user progress
    await loadUserProgress(resourceId);
    
    // Load bookmarks
    await loadBookmarks(resourceId);
    
    // Determine viewer type and load content
    const type = resource.type?.toLowerCase();
    
    if (type === 'video') {
      loadVideo(resource);
    } else if (type === 'article' || type === 'documentation') {
      loadArticle(resource);
    } else {
      // Default to PDF viewer for books, pdfs, etc.
      loadPDF(resource);
    }
    
  } catch (error) {
    console.error('Error loading resource:', error);
    showError('Error al cargar el recurso');
  }
}

async function loadUserProgress(resourceId) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('resource_id', parseInt(resourceId))
      .maybeSingle();
    
    if (data) {
      userProgress = data;
      currentPage = data.last_page || 1;
      console.log('Loaded progress:', { last_page: data.last_page, progress: data.progress, currentPage });
      updateProgressUI(data.progress || 0);
    } else {
      // Create initial progress record
      const { data: newProgress } = await supabase
        .from('user_progress')
        .insert({
          user_id: currentUser.id,
          resource_id: parseInt(resourceId),
          progress: 0,
          last_page: 1,
          has_viewed: true
        })
        .select()
        .single();
      
      userProgress = newProgress;
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
}

async function loadBookmarks(resourceId) {
  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('resource_id', parseInt(resourceId))
      .order('page_number');
    
    if (data) {
      bookmarks = data;
      renderBookmarksList();
    }
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    // Table might not exist yet, that's ok
    bookmarks = [];
  }
}

// ========================================
// PDF VIEWER
// ========================================

async function loadPDF(resource) {
  const fileUrl = resource.file_url;
  
  if (!fileUrl) {
    showError('Este recurso no tiene un archivo asociado');
    return;
  }
  
  document.getElementById('readerLoading').style.display = 'flex';
  document.getElementById('pdfViewer').style.display = 'none';
  document.getElementById('pageNavigation').style.display = 'flex';
  
  try {
    // Load PDF.js library if not already loaded
    if (!pdfjsLib) {
      await loadPdfJs();
    }
    
    const loadingTask = pdfjsLib.getDocument(fileUrl);
    
    loadingTask.onProgress = (progress) => {
      if (progress.total > 0) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        document.getElementById('loadingProgressBar').style.width = percent + '%';
      }
    };
    
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('currentPageInput').max = totalPages;
    
    // Hide loading, show viewer
    document.getElementById('readerLoading').style.display = 'none';
    document.getElementById('pdfViewer').style.display = 'block';
    
    // Load outline (table of contents)
    await loadOutline();
    
    // Generate thumbnails
    generateThumbnails();
    
    // Render all pages for proper scroll size
    await renderAllPages();
    
    // Update page input with current page
    document.getElementById('currentPageInput').value = currentPage;
    
    // Go to last read page after a short delay to ensure rendering is complete
    if (currentPage > 1) {
      setTimeout(() => {
        const pageDiv = document.getElementById(`page-${currentPage}`);
        const viewer = document.getElementById('pdfViewer');
        if (pageDiv && viewer) {
          const containerTop = document.getElementById('pdfContainer').offsetTop;
          const pageTop = pageDiv.offsetTop;
          viewer.scrollTo({
            top: pageTop - containerTop,
            behavior: 'instant'
          });
        }
        updateProgress();
      }, 100);
    }
    
    // Setup scroll listener for progress tracking
    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.addEventListener('scroll', handleScroll);
    
  } catch (error) {
    console.error('Error loading PDF:', error);
    showError('No se pudo cargar el documento PDF');
  }
}

async function renderAllPages() {
  const container = document.getElementById('pdfContainer');
  container.innerHTML = '';
  renderedPages.clear();
  
  // Create all page containers
  for (let i = 1; i <= totalPages; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.id = `page-${i}`;
    pageDiv.dataset.pageNum = i;
    container.appendChild(pageDiv);
  }
  
  // Render all pages
  for (let i = 1; i <= totalPages; i++) {
    await renderPage(i);
  }
}

async function renderVisiblePages() {
  if (isRendering) return;
  isRendering = true;
  
  const container = document.getElementById('pdfContainer');
  const viewer = document.getElementById('pdfViewer');
  
  // Determine visible pages
  const viewerRect = viewer.getBoundingClientRect();
  const buffer = viewerRect.height * 2; // Render two screens ahead/behind
  
  for (let i = 1; i <= totalPages; i++) {
    const pageDiv = document.getElementById(`page-${i}`);
    if (!pageDiv) continue;
    
    const pageRect = pageDiv.getBoundingClientRect();
    
    const isVisible = pageRect.bottom > viewerRect.top - buffer && 
                      pageRect.top < viewerRect.bottom + buffer;
    
    if (isVisible && !renderedPages.has(i)) {
      await renderPage(i);
    }
  }
  
  isRendering = false;
}

async function renderPage(pageNum) {
  if (renderedPages.has(pageNum)) return;
  
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  
  const pageDiv = document.getElementById(`page-${pageNum}`);
  pageDiv.innerHTML = '';
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  pageDiv.appendChild(canvas);
  // Don't set fixed dimensions on pageDiv - let it size to canvas
  
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;
  
  renderedPages.add(pageNum);
}

async function reRenderAllPages() {
  const savedPage = currentPage;
  
  renderedPages.clear();
  const container = document.getElementById('pdfContainer');
  container.innerHTML = '';
  
  // Render all pages completely
  for (let i = 1; i <= totalPages; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.id = `page-${i}`;
    pageDiv.dataset.pageNum = i;
    container.appendChild(pageDiv);
  }
  
  // Render all pages
  for (let i = 1; i <= totalPages; i++) {
    await renderPage(i);
  }
  
  // Restore position to saved page
  setTimeout(() => {
    const pageDiv = document.getElementById(`page-${savedPage}`);
    const viewer = document.getElementById('pdfViewer');
    if (pageDiv && viewer) {
      const containerTop = document.getElementById('pdfContainer').offsetTop;
      const pageTop = pageDiv.offsetTop;
      viewer.scrollTo({
        top: pageTop - containerTop,
        behavior: 'instant'
      });
    }
  }, 50);
}

function goToPage(pageNum) {
  pageNum = Math.max(1, Math.min(pageNum, totalPages));
  currentPage = pageNum;
  
  document.getElementById('currentPageInput').value = pageNum;
  
  const pageDiv = document.getElementById(`page-${pageNum}`);
  const viewer = document.getElementById('pdfViewer');
  
  if (pageDiv && viewer) {
    // Calculate scroll position manually to account for container padding
    const containerTop = document.getElementById('pdfContainer').offsetTop;
    const pageTop = pageDiv.offsetTop;
    viewer.scrollTo({
      top: pageTop - containerTop,
      behavior: 'smooth'
    });
  }
  
  updateThumbnailSelection();
  updateProgress();
}

function handleScroll() {
  // Determine current page based on scroll position
  const viewer = document.getElementById('pdfViewer');
  const viewerRect = viewer.getBoundingClientRect();
  const viewerCenter = viewerRect.top + viewerRect.height / 2;
  
  for (let i = 1; i <= totalPages; i++) {
    const pageDiv = document.getElementById(`page-${i}`);
    if (pageDiv) {
      const pageRect = pageDiv.getBoundingClientRect();
      if (pageRect.top <= viewerCenter && pageRect.bottom >= viewerCenter) {
        if (currentPage !== i) {
          currentPage = i;
          document.getElementById('currentPageInput').value = i;
          updateThumbnailSelection();
          updateProgress();
        }
        break;
      }
    }
  }
  
  // Render visible pages
  renderVisiblePages();
}

async function loadOutline() {
  try {
    const outline = await pdfDoc.getOutline();
    const outlineList = document.getElementById('outlineList');
    const outlineEmpty = document.getElementById('outlineEmpty');
    
    if (outline && outline.length > 0) {
      outlineEmpty.style.display = 'none';
      outlineList.innerHTML = '';
      renderOutlineItems(outline, outlineList, 1);
    } else {
      outlineEmpty.style.display = 'flex';
    }
  } catch (error) {
    console.error('Error loading outline:', error);
  }
}

function renderOutlineItems(items, container, level) {
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = `outline-item level-${level}`;
    li.textContent = item.title;
    li.addEventListener('click', async () => {
      if (item.dest) {
        const dest = typeof item.dest === 'string' 
          ? await pdfDoc.getDestination(item.dest)
          : item.dest;
        if (dest) {
          const pageIndex = await pdfDoc.getPageIndex(dest[0]);
          goToPage(pageIndex + 1);
        }
      }
    });
    container.appendChild(li);
    
    if (item.items && item.items.length > 0) {
      renderOutlineItems(item.items, container, Math.min(level + 1, 3));
    }
  });
}

async function generateThumbnails() {
  const grid = document.getElementById('thumbnailsGrid');
  grid.innerHTML = '';
  
  for (let i = 1; i <= totalPages; i++) {
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumbnail-item' + (i === currentPage ? ' active' : '');
    thumbDiv.dataset.page = i;
    thumbDiv.addEventListener('click', () => goToPage(i));
    
    const canvas = document.createElement('canvas');
    thumbDiv.appendChild(canvas);
    
    const pageNum = document.createElement('span');
    pageNum.className = 'thumbnail-page-num';
    pageNum.textContent = i;
    thumbDiv.appendChild(pageNum);
    
    grid.appendChild(thumbDiv);
    
    // Render thumbnail asynchronously
    renderThumbnail(i, canvas);
  }
}

async function renderThumbnail(pageNum, canvas) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.2 });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
  } catch (error) {
    console.error(`Error rendering thumbnail ${pageNum}:`, error);
  }
}

function updateThumbnailSelection() {
  document.querySelectorAll('.thumbnail-item').forEach(thumb => {
    thumb.classList.toggle('active', parseInt(thumb.dataset.page) === currentPage);
  });
}

// ========================================
// VIDEO VIEWER
// ========================================

function loadVideo(resource) {
  document.getElementById('readerLoading').style.display = 'none';
  document.getElementById('pageNavigation').style.display = 'none';
  document.getElementById('videoViewer').style.display = 'flex';
  
  const video = document.getElementById('videoPlayer');
  const source = document.getElementById('videoSource');
  
  if (resource.file_url) {
    source.src = resource.file_url;
    video.load();
    
    // Track video progress
    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const progress = Math.round((video.currentTime / video.duration) * 100);
        updateProgress(progress);
      }
    });
    
    // Resume from last position
    if (userProgress?.last_position) {
      video.currentTime = userProgress.last_position;
    }
  } else if (resource.external_url) {
    // External video (YouTube, etc.)
    document.getElementById('videoViewer').style.display = 'none';
    loadArticle(resource);
  }
}

// ========================================
// ARTICLE VIEWER
// ========================================

function loadArticle(resource) {
  document.getElementById('readerLoading').style.display = 'none';
  document.getElementById('pageNavigation').style.display = 'none';
  document.getElementById('articleViewer').style.display = 'block';
  
  const url = resource.external_url || resource.file_url;
  
  if (!url) {
    showError('Este recurso no tiene contenido asociado');
    return;
  }
  
  // Check if URL can be embedded
  const canEmbed = !url.includes('youtube.com') && !url.includes('youtu.be');
  
  if (canEmbed) {
    document.getElementById('articleFrame').src = url;
    document.getElementById('externalNotice').style.display = 'none';
  } else {
    document.getElementById('articleFrame').style.display = 'none';
    document.getElementById('externalNotice').style.display = 'flex';
    document.getElementById('externalLink').href = url;
  }
  
  // Mark as viewed after some time
  setTimeout(() => updateProgress(100), 5000);
}

// ========================================
// PROGRESS TRACKING
// ========================================

// Debounce timer for saving progress
let saveProgressTimeout = null;

function updateProgress(customProgress = null) {
  let progress;
  
  if (customProgress !== null) {
    progress = customProgress;
  } else if (totalPages > 0) {
    progress = Math.round((currentPage / totalPages) * 100);
  } else {
    return;
  }
  
  updateProgressUI(progress);
  
  // Debounced save - save after 2 seconds of no changes
  if (saveProgressTimeout) {
    clearTimeout(saveProgressTimeout);
  }
  saveProgressTimeout = setTimeout(() => {
    saveProgress();
  }, 2000);
}

function updateProgressUI(progress) {
  const ring = document.getElementById('progressRing');
  const text = document.getElementById('progressText');
  
  ring.setAttribute('stroke-dasharray', `${progress}, 100`);
  text.textContent = `${progress}%`;
}

async function saveProgress() {
  if (!currentResource || !userProgress) return;
  
  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  
  try {
    const updateData = {
      progress: progress,
      last_page: currentPage,
      last_read_at: new Date().toISOString()
    };
    
    // For videos, also save position
    const video = document.getElementById('videoPlayer');
    if (video && !video.paused) {
      updateData.last_position = video.currentTime;
    }
    
    const { error } = await supabase
      .from('user_progress')
      .update(updateData)
      .eq('id', userProgress.id);
    
    if (error) {
      console.error('Error updating progress:', error);
    } else {
      console.log('Progress saved:', { progress: progress + '%', last_page: currentPage });
    }
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

// ========================================
// BOOKMARKS
// ========================================

function openBookmarkModal() {
  document.getElementById('bookmarkPageNum').textContent = currentPage;
  document.getElementById('bookmarkTitle').value = `Página ${currentPage}`;
  document.getElementById('bookmarkNote').value = '';
  document.getElementById('bookmarkModal').classList.add('active');
  document.getElementById('bookmarkTitle').focus();
}

function closeBookmarkModal() {
  document.getElementById('bookmarkModal').classList.remove('active');
}

async function saveBookmark() {
  const title = document.getElementById('bookmarkTitle').value.trim();
  const note = document.getElementById('bookmarkNote').value.trim();
  
  if (!title) {
    showToast('El título es requerido', 'error');
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .insert({
        user_id: currentUser.id,
        resource_id: currentResource.id,
        page_number: currentPage,
        title: title,
        note: note
      })
      .select()
      .single();
    
    if (error) throw error;
    
    bookmarks.push(data);
    renderBookmarksList();
    closeBookmarkModal();
    showToast('Marcador guardado');
  } catch (error) {
    console.error('Error saving bookmark:', error);
    showToast('Error al guardar el marcador', 'error');
  }
}

async function deleteBookmark(bookmarkId) {
  try {
    await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId);
    
    bookmarks = bookmarks.filter(b => b.id !== bookmarkId);
    renderBookmarksList();
    showToast('Marcador eliminado');
  } catch (error) {
    console.error('Error deleting bookmark:', error);
  }
}

function renderBookmarksList() {
  const list = document.getElementById('bookmarksList');
  const empty = document.getElementById('bookmarksEmpty');
  
  if (bookmarks.length === 0) {
    empty.style.display = 'flex';
    list.innerHTML = '';
    return;
  }
  
  empty.style.display = 'none';
  list.innerHTML = bookmarks.map(b => `
    <li class="bookmark-item" data-page="${b.page_number}">
      <span class="bookmark-icon">🔖</span>
      <div class="bookmark-content" onclick="goToPage(${b.page_number})">
        <div class="bookmark-title">${escapeHtml(b.title)}</div>
        ${b.note ? `<div class="bookmark-note">${escapeHtml(b.note)}</div>` : ''}
        <div class="bookmark-page">Página ${b.page_number}</div>
      </div>
      <button class="bookmark-delete" onclick="deleteBookmark(${b.id})" title="Eliminar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </li>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========================================
// TOOLBAR CONTROLS
// ========================================

function initToolbar() {
  // Page navigation
  document.getElementById('prevPage').addEventListener('click', () => goToPage(currentPage - 1));
  document.getElementById('nextPage').addEventListener('click', () => goToPage(currentPage + 1));
  
  document.getElementById('currentPageInput').addEventListener('change', (e) => {
    goToPage(parseInt(e.target.value) || 1);
  });
  
  // Zoom controls
  document.getElementById('zoomIn').addEventListener('click', () => setZoom(scale + 0.25));
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(scale - 0.25));
  
  // Bookmarks
  document.getElementById('bookmarkBtn').addEventListener('click', openBookmarkModal);
  document.getElementById('closeBookmarkModal').addEventListener('click', closeBookmarkModal);
  document.getElementById('cancelBookmark').addEventListener('click', closeBookmarkModal);
  document.getElementById('saveBookmark').addEventListener('click', saveBookmark);
  
  // Sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
  
  // Fullscreen
  document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
  
  // Theme
  document.getElementById('themeToggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

function setZoom(newScale) {
  scale = Math.max(0.5, Math.min(3, newScale));
  document.getElementById('zoomLevel').textContent = Math.round(scale * 100) + '%';
  reRenderAllPages();
}

function toggleSidebar() {
  const sidebar = document.getElementById('readerSidebar');
  const btn = document.getElementById('sidebarToggle');
  
  sidebarOpen = !sidebarOpen;
  sidebar.classList.toggle('collapsed', !sidebarOpen);
  btn.classList.toggle('active', sidebarOpen);
}

function toggleFullscreen() {
  const btn = document.getElementById('fullscreenBtn');
  
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    document.body.classList.add('fullscreen');
    btn.querySelector('.expand-icon').style.display = 'none';
    btn.querySelector('.compress-icon').style.display = 'block';
  } else {
    document.exitFullscreen();
    document.body.classList.remove('fullscreen');
    btn.querySelector('.expand-icon').style.display = 'block';
    btn.querySelector('.compress-icon').style.display = 'none';
  }
}

// ========================================
// SIDEBAR
// ========================================

function initSidebar() {
  const sidebar = document.getElementById('readerSidebar');
  const btn = document.getElementById('sidebarToggle');
  
  // Set initial state based on screen size
  if (!sidebarOpen) {
    sidebar.classList.add('collapsed');
    btn.classList.remove('active');
  } else {
    sidebar.classList.remove('collapsed');
    btn.classList.add('active');
  }
  
  const tabs = document.querySelectorAll('.sidebar-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update panels
      document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(tabName + 'Panel').classList.add('active');
    });
  });
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch (e.key) {
      case 'ArrowLeft':
      case 'PageUp':
        goToPage(currentPage - 1);
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        goToPage(currentPage + 1);
        e.preventDefault();
        break;
      case 'Home':
        goToPage(1);
        e.preventDefault();
        break;
      case 'End':
        goToPage(totalPages);
        e.preventDefault();
        break;
      case '+':
      case '=':
        setZoom(scale + 0.25);
        e.preventDefault();
        break;
      case '-':
        setZoom(scale - 0.25);
        e.preventDefault();
        break;
      case '0':
        // Reset zoom to 100%
        setZoom(1);
        e.preventDefault();
        break;
      case 'b':
        if (e.ctrlKey || e.metaKey) {
          openBookmarkModal();
          e.preventDefault();
        }
        break;
      case 's':
        toggleSidebar();
        e.preventDefault();
        break;
      case 'f':
        if (e.ctrlKey || e.metaKey) {
          toggleFullscreen();
          e.preventDefault();
        }
        break;
      case 'Escape':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        closeBookmarkModal();
        break;
    }
  });
}

// ========================================
// THEME
// ========================================

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// ========================================
// ERROR HANDLING
// ========================================

function showError(message) {
  document.getElementById('readerLoading').style.display = 'none';
  document.getElementById('readerError').style.display = 'flex';
  document.getElementById('errorMessage').textContent = message;
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
