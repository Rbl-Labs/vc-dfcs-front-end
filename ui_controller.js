// ui_controller.js
// UI Controller for Dialogflow Voice Chat Interface

class UIController {
    constructor() {
        this.isInitialized = false;
        this.animations = new Map();
        
        console.log('🎨 UIController initialized');
    }
    
    initialize() {
        console.log('🚀 Initializing UI Controller...');
        
        try {
            this.setupResponsiveHandlers();
            this.setupAnimations();
            this.setupAccessibility();
            this.setupThemeHandling();
            
            this.isInitialized = true;
            console.log('✅ UI Controller initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize UI Controller:', error);
            throw error;
        }
    }
    
    setupResponsiveHandlers() {
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
        
        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResize();
            }, 500);
        });
        
        console.log('📱 Responsive handlers set up');
    }
    
    setupAnimations() {
        // Intersection Observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);
        
        // Observe elements for animation
        const animateElements = document.querySelectorAll('.voice-panel, .conversation-panel, .text-input-panel');
        animateElements.forEach(el => {
            this.scrollObserver.observe(el);
        });
        
        console.log('✨ Animations set up');
    }
    
    setupAccessibility() {
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
        
        // Focus management
        this.setupFocusManagement();
        
        // ARIA labels and announcements
        this.setupAriaAnnouncements();
        
        console.log('♿ Accessibility features set up');
    }
    
    setupThemeHandling() {
        // Detect system theme preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Listen for theme changes
        prefersDark.addEventListener('change', (e) => {
            this.handleThemeChange(e.matches);
        });
        
        // Apply initial theme
        this.handleThemeChange(prefersDark.matches);
        
        console.log('🎨 Theme handling set up');
    }
    
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        console.log(`📐 Window resized: ${width}x${height}`);
        
        // Adjust conversation container height on mobile
        if (width <= 768) {
            const conversationContainer = document.getElementById('conversation-container');
            if (conversationContainer) {
                const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
                const voicePanelHeight = document.querySelector('.voice-panel')?.offsetHeight || 0;
                const footerHeight = document.querySelector('.footer')?.offsetHeight || 0;
                const padding = 40; // Total padding
                
                const availableHeight = height - headerHeight - voicePanelHeight - footerHeight - padding;
                conversationContainer.style.maxHeight = `${Math.max(200, availableHeight)}px`;
            }
        }
        
        // Update audio visualizer size
        this.updateVisualizerSize();
    }
    
    handleKeyboardNavigation(e) {
        // Space bar to toggle recording (when talk button is focused)
        if (e.code === 'Space' && document.activeElement.id === 'talk-button') {
            e.preventDefault();
            this.toggleRecording();
        }
        
        // Enter to send text message (when text input is focused)
        if (e.key === 'Enter' && document.activeElement.id === 'text-input') {
            e.preventDefault();
            this.sendTextMessage();
        }
        
        // Escape to clear conversation
        if (e.key === 'Escape') {
            this.clearConversation();
        }
    }
    
    setupFocusManagement() {
        // Focus trap for modal-like states
        const talkButton = document.getElementById('talk-button');
        const textInput = document.getElementById('text-input');
        
        // Ensure proper focus indicators
        const focusableElements = [talkButton, textInput, document.getElementById('send-text')];
        
        focusableElements.forEach(el => {
            if (el) {
                el.addEventListener('focus', () => {
                    el.classList.add('focused');
                });
                
                el.addEventListener('blur', () => {
                    el.classList.remove('focused');
                });
            }
        });
    }
    
    setupAriaAnnouncements() {
        // Create live region for announcements
        if (!document.getElementById('aria-live-region')) {
            const liveRegion = document.createElement('div');
            liveRegion.id = 'aria-live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.style.position = 'absolute';
            liveRegion.style.left = '-10000px';
            liveRegion.style.width = '1px';
            liveRegion.style.height = '1px';
            liveRegion.style.overflow = 'hidden';
            document.body.appendChild(liveRegion);
        }
    }
    
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('aria-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }
    
    handleThemeChange(isDark) {
        // For future dark mode implementation
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        console.log(`🎨 Theme changed to: ${isDark ? 'dark' : 'light'}`);
    }
    
    updateVisualizerSize() {
        const visualizer = document.getElementById('audio-visualizer');
        if (visualizer) {
            const container = visualizer.parentElement;
            const containerWidth = container.offsetWidth;
            
            // Adjust number of bars based on container width
            const barCount = Math.min(Math.max(3, Math.floor(containerWidth / 20)), 10);
            const currentBars = visualizer.children.length;
            
            if (barCount !== currentBars) {
                // Clear existing bars
                visualizer.innerHTML = '';
                
                // Add new bars
                for (let i = 0; i < barCount; i++) {
                    const bar = document.createElement('div');
                    bar.className = 'visualizer-bar';
                    bar.style.animationDelay = `${i * 0.1}s`;
                    visualizer.appendChild(bar);
                }
            }
        }
    }
    
    // UI State Management
    showLoadingState(element, message = 'Loading...') {
        if (!element) return;
        
        element.classList.add('loading');
        const originalText = element.textContent;
        element.textContent = message;
        
        // Store original text for restoration
        element.dataset.originalText = originalText;
    }
    
    hideLoadingState(element) {
        if (!element) return;
        
        element.classList.remove('loading');
        if (element.dataset.originalText) {
            element.textContent = element.dataset.originalText;
            delete element.dataset.originalText;
        }
    }
    
    showNotification(message, type = 'info', duration = 5000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: type === 'error' ? '#ea4335' : type === 'success' ? '#34a853' : '#4285f4',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: '10000',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease',
            maxWidth: '300px'
        });
        
        // Add to document
        document.body.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        
        // Close button handler
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }
        
        // Announce to screen readers
        this.announceToScreenReader(message);
        
        return notification;
    }
    
    removeNotification(notification) {
        if (notification && notification.parentElement) {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }
    
    // Animation helpers
    animateElement(element, animation, duration = 300) {
        if (!element) return Promise.resolve();
        
        return new Promise((resolve) => {
            element.style.animation = `${animation} ${duration}ms ease-in-out`;
            
            const handleAnimationEnd = () => {
                element.style.animation = '';
                element.removeEventListener('animationend', handleAnimationEnd);
                resolve();
            };
            
            element.addEventListener('animationend', handleAnimationEnd);
        });
    }
    
    // Utility methods
    toggleRecording() {
        const talkButton = document.getElementById('talk-button');
        if (talkButton && !talkButton.disabled) {
            // Trigger the recording logic in DialogflowClient
            if (window.dialogflowClient) {
                if (window.dialogflowClient.isRecording) {
                    window.dialogflowClient.stopRecording();
                } else {
                    window.dialogflowClient.startRecording();
                }
            }
        }
    }
    
    sendTextMessage() {
        if (window.dialogflowClient) {
            window.dialogflowClient.sendTextMessage();
        }
    }
    
    clearConversation() {
        if (window.dialogflowClient) {
            window.dialogflowClient.clearConversation();
        }
        this.announceToScreenReader('Conversation cleared');
    }
    
    // Debug and utility methods
    getUIState() {
        const talkButton = document.getElementById('talk-button');
        const textInput = document.getElementById('text-input');
        
        return {
            initialized: this.isInitialized,
            talkButtonDisabled: talkButton?.disabled,
            textInputDisabled: textInput?.disabled,
            windowSize: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            theme: document.documentElement.getAttribute('data-theme')
        };
    }
}

// Export for global access
window.UIController = UIController;