// Virtual Joystick for Mobile Touch Controls
// Provides movement control on the left side of the screen

class VirtualJoystick {
    constructor() {
        this.active = false;
        this.baseX = 0;
        this.baseY = 0;
        this.stickX = 0;
        this.stickY = 0;
        this.deltaX = 0;
        this.deltaY = 0;
        this.maxDistance = 50; // Maximum stick movement distance
        this.deadzone = 0.2; // Dead zone threshold (20% of max distance)
        this.touchId = null;
        
        this.baseElement = null;
        this.stickElement = null;
        this.containerElement = null;
        
        this.isMobile = this.detectMobile();
        
        if (this.isMobile) {
            this.init();
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
    }

    init() {
        console.log('🕹️ Initializing virtual joystick');
        this.createJoystickElements();
        this.attachEventListeners();
        this.hideJoystick(); // Hidden by default, shows in game
    }

    createJoystickElements() {
        // Container (covers left half of screen for tap area)
        this.containerElement = document.createElement('div');
        this.containerElement.id = 'virtual-joystick-container';
        this.containerElement.className = 'virtual-joystick-container';
        
        // Base (outer circle)
        this.baseElement = document.createElement('div');
        this.baseElement.className = 'joystick-base';
        
        // Stick (inner circle)
        this.stickElement = document.createElement('div');
        this.stickElement.className = 'joystick-stick';
        
        // Assemble
        this.baseElement.appendChild(this.stickElement);
        this.containerElement.appendChild(this.baseElement);
        document.body.appendChild(this.containerElement);
        
        // Show at default position with low opacity
        this.baseElement.style.left = '80px';
        this.baseElement.style.top = 'calc(100vh - 80px)';
        this.baseElement.style.opacity = '0.3';
        this.baseElement.style.pointerEvents = 'none';
        
        console.log('✅ Joystick elements created');
    }

    attachEventListeners() {
        // Touch events
        this.containerElement.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        document.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
        
        // Mouse events for testing on desktop
        this.containerElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        console.log('✅ Joystick event listeners attached');
    }

    onTouchStart(e) {
        e.preventDefault();
        
        if (this.touchId !== null) return; // Already tracking a touch
        
        const touch = e.changedTouches[0];
        this.touchId = touch.identifier;
        
        this.startJoystick(touch.clientX, touch.clientY);
    }

    onTouchMove(e) {
        if (this.touchId === null) return;
        
        // Find the touch we're tracking
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this.touchId) {
                e.preventDefault();
                this.moveJoystick(touch.clientX, touch.clientY);
                break;
            }
        }
    }

    onTouchEnd(e) {
        if (this.touchId === null) return;
        
        // Check if our tracked touch ended
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this.touchId) {
                this.endJoystick();
                break;
            }
        }
    }

    onMouseDown(e) {
        e.preventDefault();
        this.startJoystick(e.clientX, e.clientY);
    }

    onMouseMove(e) {
        if (!this.active) return;
        this.moveJoystick(e.clientX, e.clientY);
    }

    onMouseUp(e) {
        if (!this.active) return;
        this.endJoystick();
    }

    startJoystick(x, y) {
        this.active = true;
        
        // Position joystick at tap location
        this.baseX = x;
        this.baseY = y;
        this.stickX = x;
        this.stickY = y;
        
        // Position the base at touch point
        this.baseElement.style.left = `${x}px`;
        this.baseElement.style.top = `${y}px`;
        this.baseElement.style.opacity = '1';
        this.baseElement.style.pointerEvents = 'auto';
        this.baseElement.style.transform = 'translate(-50%, -50%) scale(1)';
        
        // Show with animation
        this.containerElement.classList.add('touching');
        
        // Reset stick to center
        this.stickElement.style.transition = '';
        this.stickElement.style.transform = 'translate(-50%, -50%)';
        
        this.updateDelta();
        
        console.log('🕹️ Joystick activated at', x, y);
    }

    moveJoystick(x, y) {
        if (!this.active) return;
        
        // Calculate offset from base
        let deltaX = x - this.baseX;
        let deltaY = y - this.baseY;
        
        // Calculate distance
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Apply deadzone - no movement if within deadzone
        const deadzoneDistance = this.maxDistance * this.deadzone;
        if (distance < deadzoneDistance) {
            // Within deadzone - reset to center
            this.stickElement.style.transform = 'translate(-50%, -50%)';
            this.deltaX = 0;
            this.deltaY = 0;
            this.updateDelta();
            return;
        }
        
        // Limit to max distance
        if (distance > this.maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            deltaX = Math.cos(angle) * this.maxDistance;
            deltaY = Math.sin(angle) * this.maxDistance;
        }
        
        // Update stick position
        this.stickX = this.baseX + deltaX;
        this.stickY = this.baseY + deltaY;
        
        // Move the stick element
        this.stickElement.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
        
        // Update normalized delta (-1 to 1) with deadzone compensation
        // Scale the output so deadzone edge = 0 and max distance = 1
        const adjustedDistance = distance - deadzoneDistance;
        const adjustedMaxDistance = this.maxDistance - deadzoneDistance;
        const scale = Math.min(adjustedDistance / adjustedMaxDistance, 1);
        
        const angle = Math.atan2(deltaY, deltaX);
        this.deltaX = Math.cos(angle) * scale;
        this.deltaY = Math.sin(angle) * scale;
        
        this.updateDelta();
    }

    endJoystick() {
        this.active = false;
        this.touchId = null;
        this.deltaX = 0;
        this.deltaY = 0;
        
        // Return to default position with low opacity
        this.baseElement.style.opacity = '0.3';
        this.baseElement.style.left = '80px';
        this.baseElement.style.top = 'calc(100vh - 80px)';
        this.baseElement.style.transform = 'translate(-50%, -50%) scale(1)';
        this.containerElement.classList.remove('touching');
        
        // Reset stick to center with smooth transition
        this.stickElement.style.transition = 'transform 0.2s ease-out';
        this.stickElement.style.transform = 'translate(-50%, -50%)';
        
        // Remove transition after animation
        setTimeout(() => {
            this.stickElement.style.transition = '';
            this.baseElement.style.pointerEvents = 'none';
        }, 200);
        
        this.updateDelta();
        
        console.log('🕹️ Joystick deactivated');
    }

    updateDelta() {
        // Emit custom event with joystick data
        const event = new CustomEvent('joystickMove', {
            detail: {
                active: this.active,
                deltaX: this.deltaX,
                deltaY: this.deltaY,
                angle: Math.atan2(this.deltaY, this.deltaX),
                distance: Math.sqrt(this.deltaX * this.deltaX + this.deltaY * this.deltaY)
            }
        });
        document.dispatchEvent(event);
    }

    showJoystick() {
        if (this.containerElement) {
            this.containerElement.classList.add('active');
            console.log('🕹️ Joystick visible');
        }
    }

    hideJoystick() {
        if (this.containerElement) {
            this.containerElement.classList.remove('active');
            this.endJoystick(); // Reset if active
            console.log('🕹️ Joystick hidden');
        }
    }

    getDelta() {
        return {
            x: this.deltaX,
            y: this.deltaY,
            active: this.active
        };
    }

    // Get direction for WASD-style input
    getDirection() {
        const threshold = 0.25; // Minimum movement to register (increased from 0.3)
        
        return {
            up: this.deltaY < -threshold,
            down: this.deltaY > threshold,
            left: this.deltaX < -threshold,
            right: this.deltaX > threshold,
            active: this.active
        };
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.virtualJoystick = new VirtualJoystick();
        
        // Show joystick when game starts
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'game-screen' && mutation.target.classList.contains('active')) {
                    window.virtualJoystick.showJoystick();
                } else if (mutation.target.id === 'lobby-screen' && mutation.target.classList.contains('active')) {
                    window.virtualJoystick.hideJoystick();
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
    });
} else {
    window.virtualJoystick = new VirtualJoystick();
}


// ============================================
// MOBILE ACTION BUTTONS (Right Side) - SIMPLIFIED
// ============================================

class MobileActionButtons {
    constructor() {
        this.isMobile = this.detectMobile();
        
        if (this.isMobile) {
            this.init();
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
    }

    init() {
        console.log('🎮 Initializing mobile action buttons');
        this.createActionButtons();
        this.hideButtons();
    }

    createActionButtons() {
        const container = document.createElement('div');
        container.id = 'mobile-action-buttons';
        container.className = 'mobile-action-buttons';

        // Single unified button
        const actionBtn = document.createElement('button');
        actionBtn.className = 'action-btn action-btn-unified';
        actionBtn.innerHTML = '<i class="bi bi-hand-index"></i>';
        
        this.addButtonEvents(actionBtn);

        container.appendChild(actionBtn);
        document.body.appendChild(container);

        console.log('✅ Action button created');
    }

    addButtonEvents(button) {
        let holdTimer = null;
        let isHolding = false;
        let touchStartTime = 0;
        const holdThreshold = 250; // 250ms to trigger hold

        // Touch events
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchStartTime = Date.now();
            button.classList.add('active');
            
            // Start hold timer
            holdTimer = setTimeout(() => {
                isHolding = true;
                this.startHold(button);
            }, holdThreshold);
        }, { passive: false });

        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.classList.remove('active');
            
            const duration = Date.now() - touchStartTime;
            
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            
            if (isHolding) {
                this.endHold(button);
                isHolding = false;
            } else if (duration < holdThreshold) {
                this.tap(button);
            }
        }, { passive: false });

        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            button.classList.remove('active');
            
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            
            if (isHolding) {
                this.endHold(button);
                isHolding = false;
            }
        }, { passive: false });

        // Mouse events
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            touchStartTime = Date.now();
            button.classList.add('active');
            
            holdTimer = setTimeout(() => {
                isHolding = true;
                this.startHold(button);
            }, holdThreshold);
        });

        button.addEventListener('mouseup', (e) => {
            e.preventDefault();
            button.classList.remove('active');
            
            const duration = Date.now() - touchStartTime;
            
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            
            if (isHolding) {
                this.endHold(button);
                isHolding = false;
            } else if (duration < holdThreshold) {
                this.tap(button);
            }
        });
    }

    tap(button) {
        console.log('👆 TAP - Interact');
        
        // Change icon briefly
        button.innerHTML = '<i class="bi bi-check-circle"></i>';
        setTimeout(() => {
            button.innerHTML = '<i class="bi bi-hand-index"></i>';
        }, 200);
        
        // E key
        const keyDown = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE' });
        document.dispatchEvent(keyDown);
        
        setTimeout(() => {
            const keyUp = new KeyboardEvent('keyup', { key: 'e', code: 'KeyE' });
            document.dispatchEvent(keyUp);
        }, 50);
    }

    startHold(button) {
        console.log('✊ HOLD - Chop/Wash');
        
        // Change icon
        button.innerHTML = '<i class="bi bi-scissors"></i>';
        button.classList.add('holding');
        
        // Space key
        if (window.keys) {
            window.keys[' '] = true;
        }
        const keyDown = new KeyboardEvent('keydown', { 
            key: ' ', 
            code: 'Space',
            repeat: false 
        });
        document.dispatchEvent(keyDown);
    }

    endHold(button) {
        console.log('🖐️ RELEASE');
        
        // Reset icon
        button.innerHTML = '<i class="bi bi-hand-index"></i>';
        button.classList.remove('holding');
        
        // Space key release
        if (window.keys) {
            window.keys[' '] = false;
        }
        const keyUp = new KeyboardEvent('keyup', { key: ' ', code: 'Space' });
        document.dispatchEvent(keyUp);
    }

    showButtons() {
        const container = document.getElementById('mobile-action-buttons');
        if (container) {
            container.classList.add('active');
            console.log('🎮 Buttons visible');
        }
    }

    hideButtons() {
        const container = document.getElementById('mobile-action-buttons');
        if (container) {
            container.classList.remove('active');
            console.log('🎮 Buttons hidden');
        }
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mobileActionButtons = new MobileActionButtons();
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'game-screen' && mutation.target.classList.contains('active')) {
                    window.mobileActionButtons.showButtons();
                } else if (mutation.target.id === 'lobby-screen' && mutation.target.classList.contains('active')) {
                    window.mobileActionButtons.hideButtons();
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
    });
} else {
    window.mobileActionButtons = new MobileActionButtons();
}
