// Intersection Observer for scroll animations
document.addEventListener("DOMContentLoaded", () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: Stop observing once visible
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const elementsToAnimate = document.querySelectorAll('.animate-on-scroll');
    elementsToAnimate.forEach(el => observer.observe(el));

    // Update active state in sidebar based on scroll position
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.sidebar-section a');

    window.addEventListener('scroll', () => {
        let current = '';
        const scrollY = window.scrollY;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            // Adjust offset for fixed header
            if (scrollY >= (sectionTop - 150)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
});

// Copy to Clipboard Function
function copyCode(btnElement, codeElement) {
    const textToCopy = codeElement.innerText;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalIcon = btnElement.innerHTML;
        btnElement.innerHTML = '<i data-lucide="check" style="color: #10b981;"></i>';
        lucide.createIcons();
        
        setTimeout(() => {
            btnElement.innerHTML = originalIcon;
            lucide.createIcons();
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Mock Download Trigger -> Redirect to Google Drive
function triggerDownload() {
    const btn = document.querySelector('.download-btn');
    const originalContent = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader" class="spin"></i><span>Redirecting...</span>';
    lucide.createIcons();
    
    // Thêm animation quay cho loader
    if (!document.getElementById('spin-style')) {
        const style = document.createElement('style');
        style.id = 'spin-style';
        style.innerHTML = `
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .spin { animation: spin 2s linear infinite; }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        // Chuyển hướng sang Google Drive
        window.open('https://drive.google.com/file/d/1-Nx8iCEq20XdOMJkjyP4a9TWDQR1P9uw/view?usp=sharing', '_blank');
        
        btn.innerHTML = '<i data-lucide="check"></i><span>Opened Drive</span>';
        btn.style.background = 'var(--success)';
        btn.style.color = '#fff';
        lucide.createIcons();
        
        // Trả lại trạng thái cũ sau 3 giây
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.background = 'var(--accent)';
            btn.style.color = '#000';
            lucide.createIcons();
        }, 3000);
    }, 800);
}
