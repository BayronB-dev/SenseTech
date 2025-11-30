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
  initTTS();
  
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
  onPageChange(); // Update TTS when page changes
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
          onPageChange(); // Update TTS when page changes
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
      <div class="bookmark-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="bookmark-content" onclick="goToPage(${b.page_number})">
        <div class="bookmark-title">${escapeHtml(b.title)}</div>
        ${b.note ? `<div class="bookmark-note">${escapeHtml(b.note)}</div>` : ''}
        <div class="bookmark-page">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Página ${b.page_number}
        </div>
      </div>
      <button class="bookmark-delete" onclick="event.stopPropagation(); deleteBookmark(${b.id})" title="Eliminar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        closeTTSPanel();
        break;
      case 'r':
        // Toggle TTS panel
        toggleTTSPanel();
        e.preventDefault();
        break;
      case 'p':
        // Play/Pause TTS
        if (document.getElementById('ttsPanel').classList.contains('active')) {
          toggleTTSPlayback();
          e.preventDefault();
        }
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

// ========================================
// TEXT-TO-SPEECH (TTS)
// ========================================

// TTS State
let ttsState = {
  isSupported: false,
  isPlaying: false,
  isPaused: false,
  currentUtterance: null,
  voices: [],
  selectedVoice: null,
  rate: 1,
  pageTexts: [], // Array of text content per page
  currentPageIndex: 0,
  currentParagraphIndex: 0,
  paragraphs: [] // Current page paragraphs
};

function initTTS() {
  // Check if Web Speech API is supported
  if (!('speechSynthesis' in window)) {
    console.warn('TTS not supported in this browser');
    document.getElementById('ttsBtn').style.display = 'none';
    return;
  }
  
  ttsState.isSupported = true;
  
  // Load voices
  loadVoices();
  
  // Voices may load asynchronously
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  
  // Setup event listeners
  setupTTSListeners();
}

function loadVoices() {
  const allVoices = speechSynthesis.getVoices();
  
  // Only keep Spanish voices
  ttsState.voices = allVoices.filter(v => v.lang.startsWith('es'));
  
  const voiceSelect = document.getElementById('ttsVoiceSelect');
  voiceSelect.innerHTML = '';
  
  if (ttsState.voices.length > 0) {
    ttsState.voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = voice.name;
      // Clean up voice name for display
      const langName = voice.lang.includes('ES') ? 'España' : 
                       voice.lang.includes('MX') ? 'México' :
                       voice.lang.includes('CO') ? 'Colombia' :
                       voice.lang.includes('AR') ? 'Argentina' : voice.lang;
      option.textContent = `${voice.name.replace('Microsoft ', '').replace(' Online (Natural)', '')} (${langName})`;
      if (index === 0) option.selected = true;
      voiceSelect.appendChild(option);
    });
    ttsState.selectedVoice = ttsState.voices[0];
  } else {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No hay voces en español disponibles';
    voiceSelect.appendChild(option);
  }
}

function setupTTSListeners() {
  // Main TTS button in toolbar
  document.getElementById('ttsBtn').addEventListener('click', toggleTTSPanel);
  
  // Close panel
  document.getElementById('closeTtsPanel').addEventListener('click', closeTTSPanel);
  
  // Play/Pause
  document.getElementById('ttsPlayPause').addEventListener('click', toggleTTSPlayback);
  
  // Stop
  document.getElementById('ttsStop').addEventListener('click', stopTTS);
  
  // Previous/Next paragraph
  document.getElementById('ttsPrevParagraph').addEventListener('click', ttsPrevParagraph);
  document.getElementById('ttsNextParagraph').addEventListener('click', ttsNextParagraph);
  
  // Speed buttons
  document.querySelectorAll('.tts-speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tts-speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ttsState.rate = parseFloat(btn.dataset.speed);
      
      // If currently playing, restart current paragraph with new speed
      if (ttsState.isPlaying && !ttsState.isPaused) {
        restartCurrentParagraph();
      }
    });
  });
  
  // Voice selection
  document.getElementById('ttsVoiceSelect').addEventListener('change', (e) => {
    const voiceName = e.target.value;
    ttsState.selectedVoice = ttsState.voices.find(v => v.name === voiceName);
    
    // If currently playing, restart current paragraph with new voice
    if (ttsState.isPlaying && !ttsState.isPaused) {
      restartCurrentParagraph();
    }
  });
}

// Restart current paragraph without resetting position
function restartCurrentParagraph() {
  speechSynthesis.cancel();
  // Don't reset paragraph index, just restart speaking
  setTimeout(() => speakCurrentParagraph(), 100);
}

function toggleTTSPanel() {
  const panel = document.getElementById('ttsPanel');
  const btn = document.getElementById('ttsBtn');
  
  if (panel.classList.contains('active')) {
    closeTTSPanel();
  } else {
    panel.classList.add('active');
    btn.classList.add('active');
    
    // Extract text from current page if not already done
    if (ttsState.paragraphs.length === 0) {
      extractCurrentPageText();
    }
  }
}

function closeTTSPanel() {
  const panel = document.getElementById('ttsPanel');
  const btn = document.getElementById('ttsBtn');
  
  panel.classList.remove('active');
  btn.classList.remove('active');
}

async function extractCurrentPageText() {
  if (!pdfDoc) return;
  
  try {
    const page = await pdfDoc.getPage(currentPage);
    const textContent = await page.getTextContent();
    
    // Build text with proper spacing based on character positions
    let paragraphs = [];
    let currentLine = '';
    let lastY = null;
    let lastX = null;
    let lastWidth = 0;
    
    textContent.items.forEach(item => {
      const x = item.transform[4];
      const y = item.transform[5];
      const width = item.width || 0;
      const str = item.str;
      
      // If Y position changed significantly, it's a new line
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        // Check if it's a new paragraph (larger Y gap)
        if (Math.abs(y - lastY) > 15) {
          if (currentLine.trim()) {
            paragraphs.push(cleanText(currentLine.trim()));
          }
          currentLine = str;
        } else {
          // Same paragraph, new line - add space if needed
          if (currentLine && !currentLine.endsWith(' ') && !currentLine.endsWith('-')) {
            currentLine += ' ';
          } else if (currentLine.endsWith('-')) {
            // Remove hyphen for word continuation
            currentLine = currentLine.slice(0, -1);
          }
          currentLine += str;
        }
      } else {
        // Same line - check horizontal spacing
        if (lastX !== null && x > lastX + lastWidth + 2) {
          // There's a gap, add space
          if (!currentLine.endsWith(' ')) {
            currentLine += ' ';
          }
        }
        currentLine += str;
      }
      
      lastX = x;
      lastY = y;
      lastWidth = width;
    });
    
    // Add last paragraph
    if (currentLine.trim()) {
      paragraphs.push(cleanText(currentLine.trim()));
    }
    
    // Filter out very short paragraphs (likely headers or page numbers)
    paragraphs = paragraphs.filter(p => p.length > 10);
    
    ttsState.paragraphs = paragraphs;
    ttsState.currentParagraphIndex = 0;
    ttsState.currentPageIndex = currentPage;
    
    // Update UI
    if (paragraphs.length > 0) {
      document.getElementById('ttsCurrentText').textContent = paragraphs[0];
      document.getElementById('ttsStatus').textContent = `🔊 Página ${currentPage} - Párrafo 1/${paragraphs.length}`;
    } else {
      document.getElementById('ttsCurrentText').textContent = 'No se encontró texto en esta página';
      document.getElementById('ttsStatus').textContent = '🔊 Sin texto disponible';
    }
    
    updateTTSProgress();
    
  } catch (error) {
    console.error('Error extracting text:', error);
    document.getElementById('ttsCurrentText').textContent = 'Error al extraer el texto';
  }
}

// Clean extracted text - fix common PDF extraction issues
function cleanText(text) {
  let cleaned = text;
  
  // First pass: detect and fix spaced-out words (like "D i s e ñ a r")
  // Pattern: single letter followed by space, repeated multiple times
  cleaned = cleaned.replace(/\b([a-záéíóúüñA-ZÁÉÍÓÚÜÑ])\s+(?=[a-záéíóúüñA-ZÁÉÍÓÚÜÑ](\s+[a-záéíóúüñA-ZÁÉÍÓÚÜÑ])+\b)/g, 
    (match, letter) => letter);
  
  // Second pass: join remaining isolated single letters
  // This catches patterns like "a l g o r i t m o"
  let words = cleaned.split(/\s+/);
  let result = [];
  let buffer = '';
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // If it's a single letter (not common single-letter words)
    if (word.length === 1 && !/^[aeouyAEOUY]$/i.test(word)) {
      buffer += word;
    } else if (word.length === 1 && buffer.length > 0) {
      // Single letter that could be part of spaced word
      buffer += word;
    } else {
      // Regular word
      if (buffer.length > 0) {
        // Check if buffer forms a valid-looking word (3+ chars)
        if (buffer.length >= 3) {
          result.push(buffer);
        } else {
          // Too short, probably separate letters
          result.push(...buffer.split(''));
        }
        buffer = '';
      }
      result.push(word);
    }
  }
  
  // Don't forget remaining buffer
  if (buffer.length >= 3) {
    result.push(buffer);
  } else if (buffer.length > 0) {
    result.push(...buffer.split(''));
  }
  
  cleaned = result.join(' ');
  
  // Final cleanup
  return cleaned
    // Remove bullet point symbols that TTS reads literally
    .replace(/[•●○◦▪▫■□▸▹►▻◆◇★☆→⇒➤➢✓✔✗✘☐☑☒]/g, '')
    // Remove other common list markers
    .replace(/^[\-–—]\s*/gm, '')
    // Fix multiple spaces
    .replace(/\s+/g, ' ')
    // Fix spaces before punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    // Fix spaces after opening brackets
    .replace(/\(\s+/g, '(')
    // Fix spaces before closing brackets
    .replace(/\s+\)/g, ')')
    // Fix number spacing (like "1 . 2 ." -> "1. 2.")
    .replace(/(\d)\s+\./g, '$1.')
    .trim();
}

function toggleTTSPlayback() {
  if (!ttsState.isSupported) return;
  
  if (ttsState.isPlaying && !ttsState.isPaused) {
    pauseTTS();
  } else if (ttsState.isPaused) {
    resumeTTS();
  } else {
    startTTS();
  }
}

// Note: We don't use pause/resume anymore due to browser bugs
// Instead, we cancel and restart from the current paragraph

function startTTS() {
  if (ttsState.paragraphs.length === 0) {
    extractCurrentPageText().then(() => {
      if (ttsState.paragraphs.length > 0) {
        speakCurrentParagraph();
      }
    });
  } else {
    speakCurrentParagraph();
  }
}

function speakCurrentParagraph() {
  if (ttsState.currentParagraphIndex >= ttsState.paragraphs.length) {
    // Move to next page
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
      ttsState.currentParagraphIndex = 0;
      extractCurrentPageText().then(() => {
        if (ttsState.paragraphs.length > 0) {
          speakCurrentParagraph();
        } else {
          stopTTS();
        }
      });
    } else {
      stopTTS();
      showToast('Lectura completada', 'success');
    }
    return;
  }
  
  const text = ttsState.paragraphs[ttsState.currentParagraphIndex];
  
  // Cancel any ongoing speech
  speechSynthesis.cancel();
  
  // Create utterance
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = ttsState.selectedVoice;
  utterance.rate = ttsState.rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  
  // Event handlers
  utterance.onstart = () => {
    ttsState.isPlaying = true;
    ttsState.isPaused = false;
    updateTTSUI(true);
  };
  
  utterance.onend = () => {
    // Move to next paragraph
    ttsState.currentParagraphIndex++;
    updateTTSProgress();
    
    if (ttsState.isPlaying && !ttsState.isPaused) {
      speakCurrentParagraph();
    }
  };
  
  utterance.onerror = (event) => {
    console.error('TTS Error:', event.error);
    if (event.error !== 'interrupted') {
      showToast('Error en la lectura por voz', 'error');
    }
  };
  
  ttsState.currentUtterance = utterance;
  
  // Update UI
  document.getElementById('ttsCurrentText').textContent = text;
  document.getElementById('ttsStatus').textContent = 
    `🔊 Página ${currentPage} - Párrafo ${ttsState.currentParagraphIndex + 1}/${ttsState.paragraphs.length}`;
  
  // Speak
  speechSynthesis.speak(utterance);
}

function pauseTTS() {
  if (speechSynthesis.speaking) {
    speechSynthesis.pause();
    ttsState.isPaused = true;
    ttsState.isPlaying = true; // Keep playing state
    updateTTSUI(false);
  }
}

function resumeTTS() {
  if (ttsState.isPaused) {
    // Always restart from current paragraph - more reliable than resume()
    ttsState.isPaused = false;
    speakCurrentParagraph();
  }
}

function stopTTS() {
  speechSynthesis.cancel();
  ttsState.isPlaying = false;
  ttsState.isPaused = false;
  ttsState.currentParagraphIndex = 0;
  updateTTSUI(false);
  updateTTSProgress();
  
  if (ttsState.paragraphs.length > 0) {
    document.getElementById('ttsCurrentText').textContent = ttsState.paragraphs[0];
  }
}

function ttsPrevParagraph() {
  if (ttsState.currentParagraphIndex > 0) {
    ttsState.currentParagraphIndex--;
    updateTTSProgress();
    
    if (ttsState.isPlaying) {
      speechSynthesis.cancel();
      speakCurrentParagraph();
    } else {
      document.getElementById('ttsCurrentText').textContent = 
        ttsState.paragraphs[ttsState.currentParagraphIndex];
      document.getElementById('ttsStatus').textContent = 
        `🔊 Página ${currentPage} - Párrafo ${ttsState.currentParagraphIndex + 1}/${ttsState.paragraphs.length}`;
    }
  } else if (currentPage > 1) {
    // Go to previous page
    goToPage(currentPage - 1);
    extractCurrentPageText().then(() => {
      ttsState.currentParagraphIndex = ttsState.paragraphs.length - 1;
      updateTTSProgress();
      
      if (ttsState.paragraphs.length > 0) {
        document.getElementById('ttsCurrentText').textContent = 
          ttsState.paragraphs[ttsState.currentParagraphIndex];
        document.getElementById('ttsStatus').textContent = 
          `🔊 Página ${currentPage} - Párrafo ${ttsState.currentParagraphIndex + 1}/${ttsState.paragraphs.length}`;
        
        if (ttsState.isPlaying) {
          speakCurrentParagraph();
        }
      }
    });
  }
}

function ttsNextParagraph() {
  if (ttsState.currentParagraphIndex < ttsState.paragraphs.length - 1) {
    ttsState.currentParagraphIndex++;
    updateTTSProgress();
    
    if (ttsState.isPlaying) {
      speechSynthesis.cancel();
      speakCurrentParagraph();
    } else {
      document.getElementById('ttsCurrentText').textContent = 
        ttsState.paragraphs[ttsState.currentParagraphIndex];
      document.getElementById('ttsStatus').textContent = 
        `🔊 Página ${currentPage} - Párrafo ${ttsState.currentParagraphIndex + 1}/${ttsState.paragraphs.length}`;
    }
  } else if (currentPage < totalPages) {
    // Go to next page
    goToPage(currentPage + 1);
    extractCurrentPageText().then(() => {
      ttsState.currentParagraphIndex = 0;
      updateTTSProgress();
      
      if (ttsState.paragraphs.length > 0) {
        document.getElementById('ttsCurrentText').textContent = 
          ttsState.paragraphs[0];
        document.getElementById('ttsStatus').textContent = 
          `🔊 Página ${currentPage} - Párrafo 1/${ttsState.paragraphs.length}`;
        
        if (ttsState.isPlaying) {
          speakCurrentParagraph();
        }
      }
    });
  }
}

function updateTTSUI(isPlaying) {
  const playBtn = document.getElementById('ttsPlayPause');
  const ttsBtn = document.getElementById('ttsBtn');
  const playIcon = playBtn.querySelector('.play-icon');
  const pauseIcon = playBtn.querySelector('.pause-icon');
  const toolbarPlayIcon = ttsBtn.querySelector('.tts-icon-play');
  const toolbarPauseIcon = ttsBtn.querySelector('.tts-icon-pause');
  
  if (isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    playBtn.classList.add('playing');
    ttsBtn.classList.add('speaking');
    toolbarPlayIcon.style.display = 'none';
    toolbarPauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    playBtn.classList.remove('playing');
    ttsBtn.classList.remove('speaking');
    toolbarPlayIcon.style.display = 'block';
    toolbarPauseIcon.style.display = 'none';
  }
}

function updateTTSProgress() {
  const progressBar = document.getElementById('ttsProgressBar');
  
  if (ttsState.paragraphs.length > 0) {
    const progress = ((ttsState.currentParagraphIndex) / ttsState.paragraphs.length) * 100;
    progressBar.style.width = progress + '%';
  } else {
    progressBar.style.width = '0%';
  }
}

// Reset TTS when page changes
function onPageChange() {
  if (ttsState.currentPageIndex !== currentPage) {
    const wasPlaying = ttsState.isPlaying && !ttsState.isPaused;
    
    if (wasPlaying) {
      speechSynthesis.cancel();
    }
    
    ttsState.paragraphs = [];
    ttsState.currentParagraphIndex = 0;
    
    // If TTS panel is open, extract new page text
    if (document.getElementById('ttsPanel').classList.contains('active')) {
      extractCurrentPageText().then(() => {
        if (wasPlaying && ttsState.paragraphs.length > 0) {
          speakCurrentParagraph();
        }
      });
    }
  }
}
