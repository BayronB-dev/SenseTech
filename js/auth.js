/**
 * SenseTech - Authentication JavaScript
 * Login and Signup form handling with validations
 */

document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();
  initSignupForm();
  initPasswordStrength();
  initTextSizeSelector();
});

// ========================================
// LOGIN FORM
// ========================================

function initLoginForm() {
  const form = document.getElementById('loginForm');
  
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = form.email.value.trim();
    const password = form.password.value;
    
    // Clear previous errors
    clearErrors(form);
    
    // Validate
    let isValid = true;
    
    if (!email) {
      showError('email', 'El correo electrónico es requerido');
      isValid = false;
    } else if (!validateEmail(email)) {
      showError('email', 'Ingresa un correo electrónico válido');
      isValid = false;
    }
    
    if (!password) {
      showError('password', 'La contraseña es requerida');
      isValid = false;
    }
    
    if (!isValid) return;
    
    // Check credentials
    const users = getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      showError('email', 'No existe una cuenta con este correo');
      return;
    }
    
    if (user.password !== password) {
      showError('password', 'Contraseña incorrecta');
      return;
    }
    
    // Login successful
    setCurrentUser(user);
    
    // Apply user's accessibility settings
    if (user.accessibility) {
      saveAccessibilitySettings(user.accessibility);
    }
    
    // Redirect to home
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<span class="loading-spinner" style="width: 20px; height: 20px;"></span> Ingresando...';
    submitBtn.disabled = true;
    
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 1000);
  });
}

// ========================================
// SIGNUP FORM
// ========================================

let currentStep = 1;

function initSignupForm() {
  const form = document.getElementById('signupForm');
  const nextBtn = document.getElementById('nextStep');
  const prevBtn = document.getElementById('prevStep');
  
  if (!form) return;
  
  // Next step button
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (validateStep1()) {
        goToStep(2);
      }
    });
  }
  
  // Previous step button
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      goToStep(1);
    });
  }
  
  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateStep2()) return;
    
    // Gather all data
    const userData = {
      id: Date.now().toString(),
      name: form.fullName.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      photo: null,
      accessibility: {
        textSize: getSelectedTextSize(),
        highContrast: form.highContrast.checked,
        largeCursor: form.largeCursor.checked,
        screenReader: false
      },
      createdAt: new Date().toISOString()
    };
    
    // Check if email already exists
    const users = getUsers();
    if (users.some(u => u.email === userData.email)) {
      goToStep(1);
      setTimeout(() => {
        showError('email', 'Ya existe una cuenta con este correo');
      }, 300);
      return;
    }
    
    // Save user
    users.push(userData);
    saveUsers(users);
    
    // Log in the user
    setCurrentUser(userData);
    
    // Apply accessibility settings
    saveAccessibilitySettings(userData.accessibility);
    applyAccessibilitySettings(userData.accessibility);
    
    // Show success and redirect
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<span class="loading-spinner" style="width: 20px; height: 20px;"></span> Creando cuenta...';
    submitBtn.disabled = true;
    
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 1500);
  });
}

function goToStep(step) {
  currentStep = step;
  
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const stepIndicators = document.querySelectorAll('.step');
  
  if (step === 1) {
    step1.style.display = 'block';
    step2.style.display = 'none';
    stepIndicators[0].classList.add('active');
    stepIndicators[0].classList.remove('completed');
    stepIndicators[1].classList.remove('active');
  } else {
    step1.style.display = 'none';
    step2.style.display = 'block';
    step2.style.animation = 'fadeIn 0.3s ease';
    stepIndicators[0].classList.remove('active');
    stepIndicators[0].classList.add('completed');
    stepIndicators[1].classList.add('active');
  }
}

function validateStep1() {
  const form = document.getElementById('signupForm');
  clearErrors(form);
  
  let isValid = true;
  
  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  
  // Name validation
  if (!fullName) {
    showError('fullName', 'El nombre es requerido');
    isValid = false;
  } else if (fullName.length < 2) {
    showError('fullName', 'El nombre debe tener al menos 2 caracteres');
    isValid = false;
  }
  
  // Email validation
  if (!email) {
    showError('email', 'El correo electrónico es requerido');
    isValid = false;
  } else if (!validateEmail(email)) {
    showError('email', 'Ingresa un correo electrónico válido');
    isValid = false;
  }
  
  // Password validation
  if (!password) {
    showError('password', 'La contraseña es requerida');
    isValid = false;
  } else if (password.length < 6) {
    showError('password', 'La contraseña debe tener al menos 6 caracteres');
    isValid = false;
  }
  
  // Confirm password validation
  if (!confirmPassword) {
    showError('confirmPassword', 'Confirma tu contraseña');
    isValid = false;
  } else if (password !== confirmPassword) {
    showError('confirmPassword', 'Las contraseñas no coinciden');
    isValid = false;
  }
  
  return isValid;
}

function validateStep2() {
  const form = document.getElementById('signupForm');
  
  if (!form.terms.checked) {
    showError('terms', 'Debes aceptar los términos y condiciones');
    return false;
  }
  
  return true;
}

// ========================================
// PASSWORD STRENGTH INDICATOR
// ========================================

function initPasswordStrength() {
  const passwordInputs = document.querySelectorAll('#password, #newPassword');
  
  passwordInputs.forEach(input => {
    const strengthContainer = input.closest('.form-group').querySelector('.password-strength');
    
    if (strengthContainer) {
      input.addEventListener('input', () => {
        updatePasswordStrength(input, strengthContainer);
      });
    }
  });
}

// ========================================
// TEXT SIZE SELECTOR
// ========================================

function initTextSizeSelector() {
  const buttons = document.querySelectorAll('.text-size-btn');
  
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      buttons.forEach(b => b.classList.remove('active'));
      // Add active to clicked
      btn.classList.add('active');
      
      // Apply immediately for preview
      const size = btn.dataset.size;
      document.documentElement.setAttribute('data-text-size', size);
    });
  });
}

function getSelectedTextSize() {
  const activeBtn = document.querySelector('.text-size-btn.active');
  return activeBtn ? activeBtn.dataset.size : 'medium';
}

// ========================================
// ERROR HANDLING
// ========================================

function showError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorDiv = document.getElementById(`${fieldId}Error`);
  
  if (input) {
    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
  }
  
  if (errorDiv) {
    errorDiv.innerHTML = `<span>⚠️</span> ${message}`;
    errorDiv.style.display = 'flex';
  }
  
  // Shake animation
  if (input) {
    input.classList.add('animate-shake');
    setTimeout(() => input.classList.remove('animate-shake'), 500);
  }
}

function clearErrors(form) {
  form.querySelectorAll('.form-input.error').forEach(input => {
    input.classList.remove('error');
    input.removeAttribute('aria-invalid');
  });
  
  form.querySelectorAll('.form-error').forEach(error => {
    error.innerHTML = '';
    error.style.display = 'none';
  });
}

// ========================================
// USER STORAGE
// ========================================

function getUsers() {
  try {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

// ========================================
// ACCESSIBILITY TOGGLE PREVIEW
// ========================================

const highContrastToggle = document.getElementById('highContrast');
const largeCursorToggle = document.getElementById('largeCursor');

if (highContrastToggle) {
  highContrastToggle.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-high-contrast', e.target.checked);
  });
}

if (largeCursorToggle) {
  largeCursorToggle.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-large-cursor', e.target.checked);
  });
}
