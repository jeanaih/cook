// Mobile Orientation Handler
// Handles portrait login and landscape gameplay with fullscreen

class MobileOrientationManager {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isLoggedIn = false;
        this.isInGame = false;
        this.pendingFullscreen = false;
        
        if (this.isMobile) {
            this.init();
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
    }

    init() {
        console.log('📱 Mobile device detected - initializing orientation manager');
        
        // Add mobile class to body
        document.body.classList.add('mobile-device');
        
        // Listen for orientation changes
        window.addEventListener('orientationchange', () => this.handleOrientationChange());
        window.addEventListener('resize', () => this.handleOrientationChange());
        
        // Listen for fullscreen changes
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
        
        // Initial check
        this.handleOrientationChange();
        
        // Listen for login events
        this.setupLoginListener();
        
        // Listen for game start events
        this.setupGameListener();
        
        // Create fullscreen button (hidden by default)
        this.createFullscreenButton();
    }

    handleFullscreenChange() {
        const isFullscreen = !!(document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement);
        
        console.log(`📱 Fullscreen: ${isFullscreen ? 'Active' : 'Exited'}`);
        
        // Show button if logged in and not in fullscreen
        if (this.isLoggedIn && !isFullscreen) {
            this.showFullscreenButton();
        } else {
            this.hideFullscreenButton();
        }
    }

    createFullscreenButton() {
        const button = document.createElement('button');
        button.id = 'fullscreen-restore-btn';
        button.className = 'fullscreen-restore-btn hidden';
        button.innerHTML = `
            <i class="bi bi-arrows-fullscreen"></i>
            <span>Tap to Enter Fullscreen</span>
        `;
        button.onclick = () => {
            this.requestFullscreen().then(() => {
                console.log('✅ Fullscreen activated via button');
            }).catch(err => {
                console.log('⚠️ Fullscreen failed:', err);
            });
        };
        document.body.appendChild(button);
    }

    showFullscreenButton() {
        const button = document.getElementById('fullscreen-restore-btn');
        if (button) {
            button.classList.remove('hidden');
            console.log('📱 Fullscreen button shown');
        }
    }

    hideFullscreenButton() {
        const button = document.getElementById('fullscreen-restore-btn');
        if (button) {
            button.classList.add('hidden');
            console.log('📱 Fullscreen button hidden');
        }
    }

    handleOrientationChange() {
        const isPortrait = window.innerHeight > window.innerWidth;
        const isLandscape = window.innerWidth > window.innerHeight;
        
        console.log(`📱 Orientation: ${isPortrait ? 'Portrait' : 'Landscape'}`);
        
        if (isPortrait) {
            document.body.classList.add('portrait-mode');
            document.body.classList.remove('landscape-mode');
        } else {
            document.body.classList.add('landscape-mode');
            document.body.classList.remove('portrait-mode');
        }

        // If in game and portrait, show rotation warning
        if (this.isInGame && isPortrait) {
            this.showRotationWarning();
        } else {
            this.hideRotationWarning();
        }

        // If logged in and landscape, try fullscreen
        if (this.isLoggedIn && isLandscape && !this.isInGame) {
            // Don't force fullscreen in lobby, only in game
        }
    }

    setupLoginListener() {
        // Hook into the existing login success event
        const originalLoginSuccess = window.socket?.on;
        if (originalLoginSuccess) {
            window.socket.on('loginSuccess', (user) => {
                this.isLoggedIn = true;
                console.log('📱 User logged in on mobile');
            });
        }
    }

    setupGameListener() {
        // Watch for game screen activation
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'game-screen' && mutation.target.classList.contains('active')) {
                    this.onGameStart();
                } else if (mutation.target.id === 'lobby-screen' && mutation.target.classList.contains('active')) {
                    this.onGameEnd();
                }
            });
        });

        const gameScreen = document.getElementById('game-screen');
        const lobbyScreen = document.getElementById('lobby-screen');
        
        if (gameScreen) {
            observer.observe(gameScreen, { attributes: true, attributeFilter: ['class'] });
        }
        if (lobbyScreen) {
            observer.observe(lobbyScreen, { attributes: true, attributeFilter: ['class'] });
        }

        // Also listen for any button clicks that might start the game
        // This ensures we have a user gesture for fullscreen
        document.addEventListener('click', (e) => {
            if (this.pendingFullscreen && !this.isInGame) {
                this.pendingFullscreen = false;
                this.requestFullscreen();
            }
        }, { once: false });
    }

    async onGameStart() {
        this.isInGame = true;
        console.log('📱 Game started - attempting fullscreen and landscape lock');
        
        // Always try to enter fullscreen first
        await this.requestFullscreen();
        
        // Then check orientation and show warning if needed
        const isPortrait = window.innerHeight > window.innerWidth;
        if (isPortrait) {
            this.showRotationWarning();
        }
    }

    onGameEnd() {
        this.isInGame = false;
        console.log('📱 Game ended - exiting fullscreen');
        this.hideRotationWarning();
        this.exitFullscreen();
    }

    async requestFullscreen() {
        try {
            const elem = document.documentElement;
            
            // Request fullscreen
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { // Safari
                await elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) { // Firefox
                await elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) { // IE/Edge
                await elem.msRequestFullscreen();
            }
            
            console.log('✅ Fullscreen activated');
            
            // Wait a bit for fullscreen to settle
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try to lock orientation to landscape
            if (screen.orientation && screen.orientation.lock) {
                try {
                    // Try landscape-primary first, then fallback to landscape
                    try {
                        await screen.orientation.lock('landscape-primary');
                        console.log('✅ Orientation locked to landscape-primary');
                    } catch (e) {
                        await screen.orientation.lock('landscape');
                        console.log('✅ Orientation locked to landscape');
                    }
                } catch (e) {
                    console.log('⚠️ Could not lock orientation:', e.message);
                }
            } else {
                console.log('⚠️ Screen orientation API not supported');
            }
            
            // For iOS Safari - try webkit fullscreen with orientation hint
            if (elem.webkitEnterFullscreen) {
                try {
                    elem.webkitEnterFullscreen();
                } catch (e) {
                    console.log('iOS fullscreen attempt:', e);
                }
            }
            
        } catch (error) {
            console.log('⚠️ Fullscreen request failed:', error.message);
            // Even if fullscreen fails, still show rotation warning if needed
            const isPortrait = window.innerHeight > window.innerWidth;
            if (isPortrait) {
                this.showRotationWarning();
            }
        }
    }

    exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            // Unlock orientation
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (error) {
            console.log('⚠️ Exit fullscreen failed:', error);
        }
    }

    showRotationWarning() {
        let warning = document.getElementById('rotation-warning');
        
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'rotation-warning';
            warning.className = 'rotation-warning';
            warning.innerHTML = `
                <div class="rotation-warning-content">
                    <i class="bi bi-phone-landscape"></i>
                    <h2>Please Rotate Your Device</h2>
                    <p>This game is best played in landscape mode</p>
                    <button class="btn-fullscreen-prompt" onclick="window.mobileOrientationManager.requestFullscreen()">
                        <i class="bi bi-arrows-fullscreen"></i> Enter Fullscreen
                    </button>
                </div>
            `;
            document.body.appendChild(warning);
        }
        
        warning.classList.add('active');
    }

    hideRotationWarning() {
        const warning = document.getElementById('rotation-warning');
        if (warning) {
            warning.classList.remove('active');
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mobileOrientationManager = new MobileOrientationManager();
    });
} else {
    window.mobileOrientationManager = new MobileOrientationManager();
}
