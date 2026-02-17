/**
 * VIDEO DOWNLOADER - JavaScript Moderno
 * Funcionalidades: Download de vídeos com URLs diretas, preview, progresso
 * Autor: Sistema Avançado de Desenvolvimento Web
 * Versão: 1.0.0
 */

'use strict';

// ============================================
// CONFIGURAÇÕES E CONSTANTES
// ============================================
const CONFIG = {
  SUPPORTED_FORMATS: ['.mp4', '.webm', '.ogv', '.ogg', '.mov', '.avi'],
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for progress
  TIMEOUT: 30000, // 30 segundos
  RETRY_ATTEMPTS: 3,
  ANIMATION_DURATION: 300
};

// ============================================
// ESTADO DA APLICAÇÃO
// ============================================
const state = {
  isDownloading: false,
  currentUrl: '',
  currentFileName: '',
  downloadProgress: 0,
  abortController: null,
  retryCount: 0
};

// ============================================
// ELEMENTOS DO DOM
// ============================================
const elements = {
  // Form elements
  form: document.getElementById('downloadForm'),
  urlInput: document.getElementById('videoUrl'),
  clearBtn: document.getElementById('clearUrl'),
  downloadBtn: document.getElementById('downloadBtn'),
  
  // Preview elements
  previewSection: document.getElementById('previewSection'),
  previewVideo: document.getElementById('previewVideo'),
  previewInfo: document.getElementById('previewInfo'),
  closePreview: document.getElementById('closePreview'),
  
  // Progress elements
  progressSection: document.getElementById('progressSection'),
  progressFill: document.getElementById('progressFill'),
  progressStatus: document.getElementById('progressStatus'),
  progressInfo: document.getElementById('progressInfo')
};

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  setupEventListeners();
  setupInputValidation();
  loadSavedUrl();
  
  console.info('🎬 Video Downloader inicializado com sucesso!');
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Form submission
  elements.form.addEventListener('submit', handleFormSubmit);
  
  // URL input events
  elements.urlInput.addEventListener('input', handleUrlInput);
  elements.urlInput.addEventListener('paste', handleUrlPaste);
  elements.clearBtn.addEventListener('click', clearUrl);
  
  // Preview events
  elements.closePreview.addEventListener('click', hidePreview);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Before unload
  window.addEventListener('beforeunload', handleBeforeUnload);
}

// ============================================
// VALIDAÇÃO E FORMATAÇÃO
// ============================================
function setupInputValidation() {
  // Auto-formatar URL se necessário
  elements.urlInput.addEventListener('blur', () => {
    const url = elements.urlInput.value.trim();
    if (url && !url.startsWith('http')) {
      elements.urlInput.value = 'https://' + url;
    }
  });
}

function isValidVideoUrl(url) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSupportedFormat(url) {
  return CONFIG.SUPPORTED_FORMATS.some(format => 
    url.toLowerCase().includes(format)
  );
}

function extractFileName(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split('/').pop();
    return fileName || 'video_download.mp4';
  } catch {
    return 'video_download.mp4';
  }
}

// ============================================
// HANDLERS DE INPUT
// ============================================
function handleUrlInput(event) {
  const url = event.target.value.trim();
  
  // Toggle clear button
  elements.clearBtn.style.display = url ? 'flex' : 'none';
  
  // Auto-preview after valid URL
  if (isValidVideoUrl(url) && isSupportedFormat(url)) {
    debounce(() => showPreview(url), 1000)();
  }
}

function handleUrlPaste(event) {
  setTimeout(() => {
    const url = elements.urlInput.value.trim();
    if (isValidVideoUrl(url) && isSupportedFormat(url)) {
      showPreview(url);
    }
  }, 0);
}

function clearUrl() {
  elements.urlInput.value = '';
  elements.urlInput.focus();
  elements.clearBtn.style.display = 'none';
  hidePreview();
}

// ============================================
// PRÉ-VISUALIZAÇÃO
// ============================================
async function showPreview(url) {
  if (state.isDownloading) return;
  
  try {
    elements.previewVideo.src = url;
    elements.previewSection.hidden = false;
    
    // Get video info
    const info = await getVideoInfo(url);
    displayVideoInfo(info);
    
    // Save URL for persistence
    saveUrl(url);
    
  } catch (error) {
    console.warn('Erro ao carregar pré-visualização:', error);
    elements.previewSection.hidden = true;
  }
}

function hidePreview() {
  elements.previewSection.hidden = true;
  elements.previewVideo.pause();
  elements.previewVideo.src = '';
}

function displayVideoInfo(info) {
  const infoHtml = `
    <div class="info-item">
      <strong>Formato:</strong> ${info.format}
    </div>
    <div class="info-item">
      <strong>Tamanho:</strong> ${info.size || 'Desconhecido'}
    </div>
    <div class="info-item">
      <strong>Duração:</strong> ${info.duration || 'Desconhecida'}
    </div>
    ${info.resolution ? `<div class="info-item"><strong>Resolução:</strong> ${info.resolution}</div>` : ''}
  `;
  
  elements.previewInfo.innerHTML = infoHtml;
}

async function getVideoInfo(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.addEventListener('loadedmetadata', () => {
      const format = url.split('.').pop()?.toUpperCase() || 'Desconhecido';
      const duration = formatTime(video.duration);
      const resolution = video.videoWidth && video.videoHeight ? 
        `${video.videoWidth}x${video.videoHeight}` : null;
      
      resolve({
        format,
        duration,
        resolution,
        size: null // Tamanho requer requisição adicional
      });
    });
    
    video.addEventListener('error', () => {
      resolve({
        format: url.split('.').pop()?.toUpperCase() || 'Desconhecido',
        duration: 'Desconhecida',
        resolution: null,
        size: null
      });
    });
    
    video.src = url;
  });
}

// ============================================
// DOWNLOAD DE VÍDEO
// ============================================
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const url = elements.urlInput.value.trim();
  
  // Validações
  if (!isValidVideoUrl(url)) {
    showError('Por favor, insira uma URL válida');
    return;
  }
  
  if (!isSupportedFormat(url)) {
    showError('Formato de vídeo não suportado. Use: MP4, WebM, OGG, MOV ou AVI');
    return;
  }
  
  if (state.isDownloading) {
    return; // Evita downloads simultâneos
  }
  
  startDownload(url);
}

async function startDownload(url) {
  state.isDownloading = true;
  state.currentUrl = url;
  state.currentFileName = extractFileName(url);
  state.downloadProgress = 0;
  state.retryCount = 0;
  
  updateUIForDownload();
  
  try {
    await downloadVideo(url);
  } catch (error) {
    handleDownloadError(error);
  }
}

async function downloadVideo(url) {
  state.abortController = new AbortController();
  
  const response = await fetch(url, {
    signal: state.abortController.signal,
    mode: 'cors'
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  
  if (total > CONFIG.MAX_FILE_SIZE) {
    throw new Error('Arquivo muito grande. Máximo permitido: 500MB');
  }
  
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  
  updateProgress(0, total, 'Baixando vídeo...');
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    received += value.length;
    
    if (total > 0) {
      const progress = Math.round((received / total) * 100);
      updateProgress(progress, total, `Baixando... ${formatBytes(received)} / ${formatBytes(total)}`);
    } else {
      updateProgress(0, 0, `Baixando... ${formatBytes(received)}`);
    }
  }
  
  // Combine chunks
  const blob = new Blob(chunks);
  
  // Create download link
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = state.currentFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  URL.revokeObjectURL(downloadUrl);
  
  updateProgress(100, total, 'Download completo!');
  
  setTimeout(() => {
    completeDownload();
  }, 1500);
}

function updateProgress(percent, total, message) {
  state.downloadProgress = percent;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressStatus.textContent = `${percent}%`;
  elements.progressInfo.textContent = message;
}

function updateUIForDownload() {
  elements.downloadBtn.disabled = true;
  elements.downloadBtn.classList.add('btn--loading');
  elements.progressSection.hidden = false;
  elements.urlInput.disabled = true;
}

function completeDownload() {
  state.isDownloading = false;
  
  // Reset UI
  elements.downloadBtn.disabled = false;
  elements.downloadBtn.classList.remove('btn--loading');
  elements.urlInput.disabled = false;
  
  setTimeout(() => {
    elements.progressSection.hidden = true;
    elements.progressFill.style.width = '0%';
  }, 2000);
  
  showSuccess('Download concluído com sucesso!');
}

function handleDownloadError(error) {
  console.error('Erro no download:', error);
  
  if (error.name === 'AbortError') {
    showInfo('Download cancelado');
  } else if (state.retryCount < CONFIG.RETRY_ATTEMPTS) {
    state.retryCount++;
    showInfo(`Tentando novamente... (${state.retryCount}/${CONFIG.RETRY_ATTEMPTS})`);
    setTimeout(() => startDownload(state.currentUrl), 2000);
    return;
  } else {
    showError(`Erro ao baixar vídeo: ${error.message}`);
  }
  
  // Reset UI
  state.isDownloading = false;
  elements.downloadBtn.disabled = false;
  elements.downloadBtn.classList.remove('btn--loading');
  elements.urlInput.disabled = false;
  elements.progressSection.hidden = true;
  elements.progressFill.style.width = '0%';
}

// ============================================
// UTILITÁRIOS
// ============================================
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds <= 0) return 'Desconhecida';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============================================
// NOTIFICAÇÕES
// ============================================
function showError(message) {
  console.error('❌ Erro:', message);
  // Implementar notificação visual se desejado
  alert(`Erro: ${message}`);
}

function showSuccess(message) {
  console.info('✅ Sucesso:', message);
  // Implementar notificação visual se desejado
  alert(message);
}

function showInfo(message) {
  console.info('ℹ️ Info:', message);
  // Implementar notificação visual se desejado
}

// ============================================
// PERSISTÊNCIA LOCAL
// ============================================
function saveUrl(url) {
  try {
    localStorage.setItem('videoDownloader_lastUrl', url);
  } catch (error) {
    console.warn('Não foi possível salvar URL no localStorage:', error);
  }
}

function loadSavedUrl() {
  try {
    const savedUrl = localStorage.getItem('videoDownloader_lastUrl');
    if (savedUrl && isValidVideoUrl(savedUrl)) {
      elements.urlInput.value = savedUrl;
      elements.clearBtn.style.display = 'flex';
      showPreview(savedUrl);
    }
  } catch (error) {
    console.warn('Não foi possível carregar URL do localStorage:', error);
  }
}

// ============================================
// ATALHOS DE TECLADO
// ============================================
function handleKeyboardShortcuts(event) {
  // Ctrl/Cmd + L - Focus URL input
  if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
    event.preventDefault();
    elements.urlInput.focus();
    elements.urlInput.select();
  }
  
  // Escape - Cancel download or close preview
  if (event.key === 'Escape') {
    if (state.isDownloading && state.abortController) {
      state.abortController.abort();
    } else if (!elements.previewSection.hidden) {
      hidePreview();
    }
  }
}

function handleBeforeUnload(event) {
  if (state.isDownloading) {
    event.preventDefault();
    event.returnValue = '';
    return '';
  }
}

// ============================================
// SERVICE WORKER (OPCIONAL - PARA OFFLINE)
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.info('SW registrado com sucesso:', registration.scope);
      })
      .catch(error => {
        console.warn('SW registro falhou:', error);
      });
  });
}