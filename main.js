/**
 * Royal Enfield Premium Landing Page
 * Core JavaScript Logic
 * 
 * Includes:
 * 1. Lenis Smooth Scrolling
 * 2. 240 Frame Sequential Preloading (now inside /images/)
 * 3. Robust ResizeObserver Canvas Scaling (supports high-DPI/Retina screens)
 * 4. GSAP & ScrollTrigger Timeline Setup
 * 5. Luxury Micro-Interactions (Linear-style card gradients)
 */

window.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. Lenis Smooth Scrolling Initialization
    // -------------------------------------------------------------
    const lenis = new Lenis({
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        smoothTouch: false, // Maintain native touch mechanics for consistent mobile scrolling
        touchMultiplier: 1.5
    });

    // Connect Lenis to the requestAnimationFrame loop
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Update ScrollTrigger on Lenis scroll
    lenis.on('scroll', ScrollTrigger.update);

    // Integrate Lenis scroll with GSAP ticker
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // -------------------------------------------------------------
    // 2. Global Variables and DOM Elements
    // -------------------------------------------------------------
    const totalFrames = 240;
    const images = [];
    let loadedImagesCount = 0;

    const canvas = document.getElementById('motorcycle-canvas');
    const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha channel for faster rendering
    const canvasContainer = document.getElementById('canvas-container');

    const loaderPercentage = document.getElementById('loader-percentage');
    const loaderBar = document.getElementById('loader-bar');
    const preloader = document.getElementById('preloader');

    // -------------------------------------------------------------
    // 3. Preloading Image Frames
    // -------------------------------------------------------------
    // Image filenames are stored in: ./images/ezgif-frame-001.jpg to ./images/ezgif-frame-240.jpg
    function getFramePath(index) {
        const paddedIndex = String(index).padStart(3, '0');
        return `./images/ezgif-frame-${paddedIndex}.jpg`;
    }

    function preloadImages() {
        return new Promise((resolve) => {
            for (let i = 1; i <= totalFrames; i++) {
                const img = new Image();
                img.src = getFramePath(i);
                
                img.onload = () => {
                    loadedImagesCount++;
                    updateLoaderProgress();
                    if (loadedImagesCount === totalFrames) {
                        finishLoading().then(resolve);
                    }
                };

                img.onerror = () => {
                    // Fallback to avoid preloading hangs if a frame fails to load
                    loadedImagesCount++;
                    updateLoaderProgress();
                    if (loadedImagesCount === totalFrames) {
                        finishLoading().then(resolve);
                    }
                };

                images.push(img);
            }
        });
    }

    function updateLoaderProgress() {
        const percent = Math.round((loadedImagesCount / totalFrames) * 100);
        loaderPercentage.innerText = `${String(percent).padStart(2, '0')} %`;
        loaderBar.style.width = `${percent}%`;
    }

    function finishLoading() {
        return new Promise((resolve) => {
            // Elegant delay so user experiences 100% loaded state
            setTimeout(() => {
                gsap.to(preloader, {
                    opacity: 0,
                    duration: 0.8,
                    ease: "power2.inOut",
                    onComplete: () => {
                        preloader.style.display = 'none';
                        document.body.classList.remove('loading');
                        resolve();
                    }
                });
            }, 600);
        });
    }

    // -------------------------------------------------------------
    // 4. High Performance Canvas Renderer
    // -------------------------------------------------------------
    const renderState = {
        currentFrameIndex: 0,
        lastRenderedFrameIndex: -1
    };

    function drawCanvasImage(frameIndex) {
        const img = images[frameIndex];
        if (!img) return;

        // Retrieve current logical resolution of the canvas (CSS pixels)
        const logicalWidth = canvas.width / (window.devicePixelRatio || 1);
        const logicalHeight = canvas.height / (window.devicePixelRatio || 1);

        // Image native bounds (1280x720 aspect ratio)
        const imgWidth = img.width || 1280;
        const imgHeight = img.height || 720;

        // Maintain optimal sizing for the device
        const containerRatio = logicalWidth / logicalHeight;
        const imgRatio = imgWidth / imgHeight;
        const isMobile = window.innerWidth <= 768;

        let scale;
        if (isMobile) {
            // On mobile, contain the width so the entire bike is visible without chopping
            scale = (logicalWidth / imgWidth) * 1.1; 
        } else {
            if (containerRatio > imgRatio) {
                // Screen is wider than the image ratio, scale by width to cover
                scale = logicalWidth / imgWidth;
            } else {
                // Screen is taller than the image ratio, scale by height to cover
                scale = logicalHeight / imgHeight;
            }
        }

        const w = imgWidth * scale;
        const h = imgHeight * scale;

        // Center coordinates
        const x = (logicalWidth - w) / 2;
        const y = (logicalHeight - h) / 2;

        ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        // Draw image frame
        ctx.drawImage(img, x, y, w, h);

        // Fill top/bottom gaps on mobile devices by stretching the top/bottom 1-pixel edge of the image
        // This creates a perfectly seamless background without triggering CORS file:/// restrictions!
        if (y > 0) {
            // Stretch top edge upwards
            ctx.drawImage(img, 0, 0, imgWidth, 1, 0, 0, logicalWidth, Math.ceil(y) + 1);
        }
        if (y + h < logicalHeight) {
            // Stretch bottom edge downwards
            ctx.drawImage(img, 0, imgHeight - 1, imgWidth, 1, 0, Math.floor(y + h) - 1, logicalWidth, logicalHeight - (y + h) + 2);
        }

        renderState.lastRenderedFrameIndex = frameIndex;
    }

    let isRenderPending = false;
    function requestCanvasRender(frameIndex) {
        renderState.currentFrameIndex = frameIndex;
        if (!isRenderPending) {
            isRenderPending = true;
            // Draw decoupled via requestAnimationFrame for butter smooth transitions
            requestAnimationFrame(() => {
                drawCanvasImage(renderState.currentFrameIndex);
                isRenderPending = false;
            });
        }
    }

    // Handles viewport resizing dynamically via ResizeObserver
    function resizeCanvas(width, height) {
        const dpr = window.devicePixelRatio || 1;
        
        // Update physical drawing buffer
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        // Reset scale transform and scale context to DPR
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        
        // Configure image smoothing parameters for crisp upscaling/interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Render current state
        drawCanvasImage(renderState.currentFrameIndex);
    }

    // Modern ResizeObserver triggers canvas sizing changes correctly, even inside GSAP Pin spacers
    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                resizeCanvas(width, height);
            }
        }
    });

    // -------------------------------------------------------------
    // 5. GSAP ScrollTrigger Sequence Setup
    // -------------------------------------------------------------
    function initScrollAnimations() {
        gsap.registerPlugin(ScrollTrigger);

        const canvasState = { frame: 0 };
        
        // Define timeline representing the scroll journey inside the pinned area
        const mainTimeline = gsap.timeline({
            scrollTrigger: {
                trigger: "#scroll-trigger-area",
                start: "top top",
                end: "+=380%", // Pins the viewport for ~380vh scroll length
                scrub: 0.8,    // Scroll interpolation damping
                pin: true,
                anticipatePin: 1
            }
        });

        // Step A: Frame Assembly Scrubbing (Starts scrubbing from start of section)
        mainTimeline.to(canvasState, {
            frame: totalFrames - 1,
            ease: "none",
            duration: 8.0, // Length on timeline
            onUpdate: () => {
                requestCanvasRender(Math.round(canvasState.frame));
            }
        }, 0);

        // Step B: Cinematic Text Overlays
        // Overlay 1: Anatomy of Motion
        mainTimeline.to("#step-1", {
            opacity: 1,
            y: -20,
            duration: 1.2,
            ease: "power2.out"
        }, 1.0);
        mainTimeline.to("#step-1", {
            opacity: 0,
            y: -50,
            duration: 1.2,
            ease: "power2.in"
        }, 2.8);

        // Overlay 2: Sculpted Integrity
        mainTimeline.to("#step-2", {
            opacity: 1,
            y: -20,
            duration: 1.2,
            ease: "power2.out"
        }, 3.5);
        mainTimeline.to("#step-2", {
            opacity: 0,
            y: -50,
            duration: 1.2,
            ease: "power2.in"
        }, 5.3);

        // Overlay 3: The Completed Legend
        mainTimeline.to("#step-3", {
            opacity: 1,
            y: -20,
            duration: 1.2,
            ease: "power2.out"
        }, 6.0);
        mainTimeline.to("#step-3", {
            opacity: 0,
            y: -50,
            duration: 1.2,
            ease: "power2.in"
        }, 7.8);

        // Start observing resize actions on container
        resizeObserver.observe(canvasContainer);
        
        // Run initial sizing calculation
        resizeCanvas(canvasContainer.clientWidth, canvasContainer.clientHeight);
    }

    // -------------------------------------------------------------
    // 6. Interactive Card Mouse Effects (Linear style)
    // -------------------------------------------------------------
    function initSpecCardsHover() {
        const cards = document.querySelectorAll('.spec-card');
        
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                card.style.setProperty('--x', `${x}px`);
                card.style.setProperty('--y', `${y}px`);
            });
        });
    }

    // -------------------------------------------------------------
    // 7. Kickoff System Loading
    // -------------------------------------------------------------
    preloadImages().then(() => {
        initScrollAnimations();
        initSpecCardsHover();
    });
});
