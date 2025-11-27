/**
 * SenseTech - Supabase Configuration & Client
 * Database and Authentication integration
 */

// Supabase Configuration
const SUPABASE_URL = 'https://rxvlozzmqpultteyveye.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dmxvenptcXB1bHR0ZXl2ZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc0ODAsImV4cCI6MjA3OTc2MzQ4MH0.S_UyME1s6kmEBAaWTkso9ObZVjg2_o1CP5Lv8MFpt1Y';

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

/**
 * Register a new user
 */
async function supabaseSignUp(email, password, name, accessibilitySettings = {}) {
  try {
    // Prepare accessibility settings object
    const settings = {
      textSize: accessibilitySettings.textSize || 'medium',
      highContrast: accessibilitySettings.highContrast === true,
      largeCursor: accessibilitySettings.largeCursor === true,
      screenReader: false
    };
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          name,
          accessibility_settings: settings
        }
      }
    });

    if (authError) throw authError;

    // Wait a moment for the trigger to create the profile, then update it
    if (authData.user) {
      // Small delay to ensure trigger has executed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: name,
          accessibility_settings: settings
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        // Try upsert as fallback
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          name: name,
          accessibility_settings: settings
        });
      }
    }

    return { data: authData, error: null };
  } catch (error) {
    console.error('SignUp error:', error);
    return { data: null, error };
  }
}

/**
 * Sign in existing user
 */
async function supabaseSignIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Load profile and accessibility settings
    if (data.user) {
      const { profile } = await getCurrentUserWithProfile();
      if (profile && profile.accessibility_settings) {
        saveAccessibilitySettings(profile.accessibility_settings);
        applyAccessibilitySettings(profile.accessibility_settings);
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('SignIn error:', error);
    return { data: null, error };
  }
}

/**
 * Sign out current user
 */
async function supabaseSignOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessibilitySettings');
    
    return { error: null };
  } catch (error) {
    console.error('SignOut error:', error);
    return { error };
  }
}

/**
 * Get current session
 */
async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

/**
 * Get current user with profile
 */
async function getCurrentUserWithProfile() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) return { user: null, profile: null };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) console.error('Profile fetch error:', profileError);

    return { user, profile };
  } catch (error) {
    console.error('GetCurrentUser error:', error);
    return { user: null, profile: null };
  }
}

// ========================================
// PROFILE FUNCTIONS
// ========================================

/**
 * Update user profile
 */
async function updateUserProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('UpdateProfile error:', error);
    return { data: null, error };
  }
}

/**
 * Update accessibility settings in database
 */
async function updateAccessibilityInDB(userId, settings) {
  return updateUserProfile(userId, { accessibility_settings: settings });
}

/**
 * Upload profile photo to Supabase Storage
 */
async function uploadProfilePhoto(userId, file) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    await updateUserProfile(userId, { photo_url: publicUrl });

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('UploadPhoto error:', error);
    return { url: null, error };
  }
}

// ========================================
// RESOURCES FUNCTIONS
// ========================================

/**
 * Get resources with optional filters
 */
async function getResources(filters = {}) {
  try {
    let query = supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.type) query = query.eq('type', filters.type);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('GetResources error:', error);
    return { data: [], error };
  }
}

/**
 * Get featured resources
 */
async function getFeaturedResources(limit = 4) {
  return getResources({ limit });
}

/**
 * Get resource by ID
 */
async function getResourceById(id) {
  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('GetResourceById error:', error);
    return { data: null, error };
  }
}

// ========================================
// USER PROGRESS FUNCTIONS
// ========================================

/**
 * Get user's reading progress
 */
async function getUserProgress(userId) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*, resources(*)')
      .eq('user_id', userId)
      .order('last_read', { ascending: false });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('GetUserProgress error:', error);
    return { data: [], error };
  }
}

/**
 * Update reading progress
 */
async function updateReadingProgress(userId, resourceId, progress) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        resource_id: resourceId,
        progress: progress,
        last_read: new Date().toISOString()
      }, {
        onConflict: 'user_id,resource_id'
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('UpdateProgress error:', error);
    return { data: null, error };
  }
}

/**
 * Toggle favorite status
 */
async function toggleFavorite(userId, resourceId) {
  try {
    const { data: existing } = await supabase
      .from('user_progress')
      .select('is_favorite')
      .eq('user_id', userId)
      .eq('resource_id', resourceId)
      .single();

    const newState = existing ? !existing.is_favorite : true;

    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        resource_id: resourceId,
        is_favorite: newState,
        last_read: new Date().toISOString()
      }, {
        onConflict: 'user_id,resource_id'
      })
      .select()
      .single();

    if (error) throw error;

    return { data, isFavorite: newState, error: null };
  } catch (error) {
    console.error('ToggleFavorite error:', error);
    return { data: null, isFavorite: false, error };
  }
}

/**
 * Get user's favorites
 */
async function getFavorites(userId) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*, resources(*)')
      .eq('user_id', userId)
      .eq('is_favorite', true);

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('GetFavorites error:', error);
    return { data: [], error };
  }
}

// ========================================
// AUTH STATE & UTILITIES
// ========================================

/**
 * Check if user is authenticated
 */
async function isAuthenticated() {
  const { session } = await getSession();
  return !!session;
}

/**
 * Require authentication - redirect if not logged in
 */
async function requireAuthSupabase() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/**
 * Initialize auth state listener
 */
function initAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_OUT') {
      window.location.href = 'login.html';
    }
  });
}
