import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// iOS Visual Viewport API — handles keyboard avoidance & dynamic height
function setupViewportHandler() {
  const root = document.documentElement

  function updateHeight() {
    // Use visualViewport if available (handles iOS keyboard)
    const vh = window.visualViewport?.height ?? window.innerHeight
    root.style.setProperty('--app-height', `${vh}px`)
  }

  updateHeight()

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateHeight)
    window.visualViewport.addEventListener('scroll', updateHeight)
  } else {
    window.addEventListener('resize', updateHeight)
  }
}

// Track keyboard state on body class for CSS hooks
function setupKeyboardDetection() {
  if (!window.visualViewport) return

  const threshold = 150 // px difference = keyboard likely open

  window.visualViewport.addEventListener('resize', () => {
    const diff = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight)
    if (diff > threshold) {
      document.body.classList.add('keyboard-open')
    } else {
      document.body.classList.remove('keyboard-open')
    }
  })
}

// Prevent iOS Safari bounce/overscroll on the document level
function preventOverscroll() {
  document.addEventListener('touchmove', (e) => {
    // Allow scrolling inside .scroll-area elements
    let target = e.target as HTMLElement | null
    while (target && target !== document.body) {
      if (target.classList.contains('scroll-area')) return
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return
      target = target.parentElement
    }
    // Prevent document-level scroll (rubber banding)
    if (e.cancelable) e.preventDefault()
  }, { passive: false })
}

// iOS standalone mode: handle status bar tap to scroll to top
function setupStandaloneFeatures() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true
  if (isStandalone) {
    document.documentElement.classList.add('standalone')
  }
}

// Initialize all iOS optimizations
setupViewportHandler()
setupKeyboardDetection()
preventOverscroll()
setupStandaloneFeatures()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
