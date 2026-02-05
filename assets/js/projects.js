/**
 * Projects Display Module
 * عرض المشاريع في الصفحات
 */

/**
 * Open preview modal with iframe
 * فتح نافذة المعاينة مع iframe
 */
function openPreview(url, project) {
    const modal = document.getElementById('previewModal');
    const iframe = document.getElementById('previewFrame');
    
    if (modal && iframe) {
        // Check if it's a local file project
        if (project && project.projectType === 'file') {
            // Merge all files (HTML, CSS, JS) into complete HTML
            const mergedHTML = mergeProjectFiles(project);
            
            if (mergedHTML) {
                // Create blob with merged HTML content and proper encoding
                const blob = new Blob([mergedHTML], { type: 'text/html; charset=utf-8' });
                const blobUrl = URL.createObjectURL(blob);
                iframe.src = blobUrl;
                
                // Clean up blob URL when modal closes
                modal.addEventListener('close', function cleanup() {
                    URL.revokeObjectURL(blobUrl);
                    modal.removeEventListener('close', cleanup);
                }, { once: true });
            } else {
                iframe.src = url;
            }
        } else {
            iframe.src = url;
        }
        
        modal.classList.add('active');
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closePreview();
            }
        });
    }
}

/**
 * Convert base64 to Blob
 * تحويل base64 إلى Blob
 */
function base64ToBlob(base64) {
    const parts = base64.split(',');
    const contentType = parts[0].match(/:(.*?);/)[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
}

/**
 * Extract text content from base64 data URL
 * استخراج المحتوى النصي من base64
 */
function base64ToText(base64) {
    try {
        const parts = base64.split(',');
        const base64Data = parts[1];
        
        // Decode base64 to binary string
        const binaryString = window.atob(base64Data);
        
        // Convert binary string to UTF-8
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Use TextDecoder to properly handle UTF-8 encoding
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
    } catch (error) {
        console.error('Error decoding base64:', error);
        // Fallback to simple atob
        const parts = base64.split(',');
        return window.atob(parts[1]);
    }
}

/**
 * Merge all project files into a complete HTML document
 * دمج جميع ملفات المشروع في مستند HTML كامل
 */
function mergeProjectFiles(project) {
    if (!project.files || Object.keys(project.files).length === 0) {
        // Fallback to old format
        if (project.fileContent) {
            return base64ToText(project.fileContent);
        }
        return null;
    }
    
    const files = project.files;
    let htmlContent = '';
    let cssContent = '';
    let jsContent = '';
    let pyContent = '';
    
    // Find HTML file
    const htmlFile = Object.values(files).find(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.html') || name.endsWith('.htm');
    });
    
    if (!htmlFile) {
        return null;
    }
    
    htmlContent = base64ToText(htmlFile.content);
    
    // Extract CSS files
    Object.values(files).forEach(file => {
        const name = file.name.toLowerCase();
        if (name.endsWith('.css')) {
            const cssText = base64ToText(file.content);
            cssContent += `/* ${file.name} */\n${cssText}\n\n`;
        }
    });
    
    // Extract JS files
    Object.values(files).forEach(file => {
        const name = file.name.toLowerCase();
        if (name.endsWith('.js')) {
            const jsText = base64ToText(file.content);
            jsContent += `/* ${file.name} */\n${jsText}\n\n`;
        }
    });
    
    // Extract Python files (for display purposes)
    Object.values(files).forEach(file => {
        const name = file.name.toLowerCase();
        if (name.endsWith('.py')) {
            const pyText = base64ToText(file.content);
            pyContent += `# ${file.name}\n${pyText}\n\n`;
        }
    });
    
    // Parse HTML and inject CSS and JS
    let mergedHTML = htmlContent;
    
    // Ensure HTML has proper charset declaration
    if (!mergedHTML.includes('charset') && !mergedHTML.includes('charset')) {
        // Check if HTML has <head> tag
        if (mergedHTML.includes('<head>')) {
            // Add charset meta tag if not exists
            if (!mergedHTML.includes('<meta charset')) {
                mergedHTML = mergedHTML.replace('<head>', '<head>\n<meta charset="UTF-8">');
            }
            // Inject CSS before </head>
            if (cssContent) {
                mergedHTML = mergedHTML.replace('</head>', `<style>\n${cssContent}</style>\n</head>`);
            }
        } else {
            // Create head tag if it doesn't exist
            if (mergedHTML.includes('<html>')) {
                mergedHTML = mergedHTML.replace('<html>', `<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n${cssContent ? `<style>\n${cssContent}</style>\n` : ''}</head>`);
            } else {
                // No HTML structure, wrap it
                mergedHTML = `<!DOCTYPE html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n${cssContent ? `<style>\n${cssContent}</style>\n` : ''}</head>\n<body>\n${mergedHTML}\n</body>\n</html>`;
            }
        }
    } else {
        // HTML already has charset, just inject CSS
        if (mergedHTML.includes('<head>') && cssContent) {
            mergedHTML = mergedHTML.replace('</head>', `<style>\n${cssContent}</style>\n</head>`);
        }
    }
    
    // Inject JS before </body> or at the end
    if (jsContent) {
        if (mergedHTML.includes('</body>')) {
            mergedHTML = mergedHTML.replace('</body>', `<script>\n${jsContent}</script>\n</body>`);
        } else if (mergedHTML.includes('</html>')) {
            mergedHTML = mergedHTML.replace('</html>', `<script>\n${jsContent}</script>\n</html>`);
        } else {
            mergedHTML += `\n<script>\n${jsContent}</script>`;
        }
    }
    
    // Add Python files as comments or in a special section (for reference)
    if (pyContent && mergedHTML.includes('</body>')) {
        const pyComment = `\n<!-- Python Files (for reference):\n${pyContent.replace(/-->/g, '--&gt;')}\n-->`;
        mergedHTML = mergedHTML.replace('</body>', `${pyComment}\n</body>`);
    }
    
    return mergedHTML;
}

/**
 * Close preview modal
 * إغلاق نافذة المعاينة
 */
function closePreview() {
    const modal = document.getElementById('previewModal');
    const iframe = document.getElementById('previewFrame');
    
    if (modal && iframe) {
        // Trigger close event to clean up blob URLs
        modal.dispatchEvent(new Event('close'));
        modal.classList.remove('active');
        iframe.src = '';
    }
}

/**
 * Open description modal
 * فتح نافذة الوصف
 */
function openDescriptionModal(projectName, description) {
    const modal = document.getElementById('descriptionModal');
    const modalTitle = document.getElementById('descriptionTitle');
    const modalContent = document.getElementById('descriptionContent');
    
    if (modal && modalTitle && modalContent) {
        modalTitle.textContent = projectName;
        modalContent.innerHTML = renderMarkdown(description);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close description modal
 * إغلاق نافذة الوصف
 */
function closeDescriptionModal() {
    const modal = document.getElementById('descriptionModal');
    
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Render Markdown to HTML
 * تحويل Markdown إلى HTML
 */
function renderMarkdown(text) {
    if (!text) return '';
    
    // Escape HTML first
    let html = escapeHtml(text);
    
    // Headers (##, ###, etc.)
    html = html.replace(/^### (.*$)/gim, '<h3 class="markdown-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="markdown-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="markdown-h1">$1</h1>');
    
    // Bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="markdown-bold">$1</strong>');
    
    // Italic (*text*)
    html = html.replace(/\*(.*?)\*/gim, '<em class="markdown-italic">$1</em>');
    
    // Unordered lists (- item or * item)
    html = html.replace(/^[\-\*] (.+)$/gim, '<li class="markdown-li">$1</li>');
    
    // Wrap consecutive list items in <ul>
    html = html.replace(/(<li class="markdown-li">.*?<\/li>\n?)+/gim, function(match) {
        return '<ul class="markdown-ul">' + match + '</ul>';
    });
    
    // Ordered lists (1. item)
    html = html.replace(/^\d+\. (.+)$/gim, '<li class="markdown-li-ordered">$1</li>');
    
    // Wrap consecutive ordered list items in <ol>
    html = html.replace(/(<li class="markdown-li-ordered">.*?<\/li>\n?)+/gim, function(match) {
        return '<ol class="markdown-ol">' + match + '</ol>';
    });
    
    // Code blocks (```code```)
    html = html.replace(/```([\s\S]*?)```/gim, '<pre class="markdown-code-block"><code>$1</code></pre>');
    
    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/gim, '<code class="markdown-inline-code">$1</code>');
    
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="markdown-link" target="_blank" rel="noopener">$1</a>');
    
    // Line breaks (double newline = paragraph)
    html = html.split('\n\n').map(para => {
        para = para.trim();
        if (!para) return '';
        // Don't wrap if it's already a block element
        if (/^<(h[1-6]|ul|ol|pre|p)/.test(para)) {
            return para;
        }
        return '<p class="markdown-p">' + para + '</p>';
    }).join('\n');
    
    // Single line breaks
    html = html.replace(/\n/gim, '<br class="markdown-br">');
    
    return html;
}

/**
 * Handle project preview/open
 * التعامل مع معاينة/فتح المشروع
 */
function handleProjectAction(project) {
    if (project.displayType === 'preview') {
        openPreview(project.url, project);
    } else {
        // For file projects, create blob URL
        if (project.projectType === 'file') {
            // Merge all files (HTML, CSS, JS) into complete HTML
            const mergedHTML = mergeProjectFiles(project);
            
            if (mergedHTML) {
                const blob = new Blob([mergedHTML], { type: 'text/html; charset=utf-8' });
                const blobUrl = URL.createObjectURL(blob);
                const newWindow = window.open(blobUrl, '_blank');
                // Clean up blob URL after a delay
                setTimeout(() => {
                    if (newWindow) {
                        newWindow.addEventListener('beforeunload', () => {
                            URL.revokeObjectURL(blobUrl);
                        });
                    } else {
                        URL.revokeObjectURL(blobUrl);
                    }
                }, 100);
            } else {
                window.open(project.url, '_blank');
            }
        } else {
            window.open(project.url, '_blank');
        }
    }
}

/**
 * Create project card HTML
 * إنشاء HTML لبطاقة المشروع
 */
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    const projectId = project.id;
    const projectUrl = escapeHtml(project.url);
    const displayType = project.displayType;
    
    // Create preview URL
    let previewUrl = project.url;
    let blobUrl = null;
    if (project.projectType === 'file') {
        // Merge all files (HTML, CSS, JS) into complete HTML
        const mergedHTML = mergeProjectFiles(project);
        
        if (mergedHTML) {
            const blob = new Blob([mergedHTML], { type: 'text/html; charset=utf-8' });
            blobUrl = URL.createObjectURL(blob);
            previewUrl = blobUrl;
            // Store blob URL for cleanup
            card.dataset.blobUrl = blobUrl;
        }
    }
    
    card.innerHTML = `
        <div class="project-card-header">
            <h3>${escapeHtml(project.name)}</h3>
        </div>
        <div class="project-card-preview">
            <iframe class="project-preview-iframe" src="${previewUrl}" frameborder="0" loading="lazy"></iframe>
            <div class="project-preview-overlay">
                <button class="btn btn-primary project-preview-btn" data-project-id="${projectId}">
                    معاينة كاملة
                </button>
            </div>
        </div>
        <div class="project-card-body">
            <div class="project-card-actions">
                <button class="btn btn-secondary project-description-btn" data-project-id="${projectId}" data-description="${escapeHtml(project.description)}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="margin-left: 0.5rem;">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
                    </svg>
                    عرض الوصف
                </button>
                <button class="btn btn-primary project-action-btn" data-project-id="${projectId}" data-display-type="${displayType}" data-url="${projectUrl}">
                    ${displayType === 'preview' ? 'معاينة كاملة' : 'فتح المشروع'}
                </button>
                ${displayType === 'preview' ? `
                    <button class="btn btn-outline project-open-btn" data-project-id="${projectId}">
                        فتح بصفحة جديدة
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Add event listeners
    const descriptionBtn = card.querySelector('.project-description-btn');
    if (descriptionBtn) {
        descriptionBtn.addEventListener('click', function() {
            const description = this.getAttribute('data-description');
            openDescriptionModal(project.name, description);
        });
    }
    
    const actionBtn = card.querySelector('.project-action-btn');
    if (actionBtn) {
        actionBtn.addEventListener('click', function() {
            handleProjectAction(project);
        });
    }
    
    const openBtn = card.querySelector('.project-open-btn');
    if (openBtn) {
        openBtn.addEventListener('click', function() {
            // For file projects, create blob URL
            if (project.projectType === 'file') {
                // Merge all files (HTML, CSS, JS) into complete HTML
                const mergedHTML = mergeProjectFiles(project);
                
                if (mergedHTML) {
                    const blob = new Blob([mergedHTML], { type: 'text/html; charset=utf-8' });
                    const blobUrl = URL.createObjectURL(blob);
                    const newWindow = window.open(blobUrl, '_blank');
                    // Clean up blob URL after a delay
                    setTimeout(() => {
                        if (newWindow) {
                            newWindow.addEventListener('beforeunload', () => {
                                URL.revokeObjectURL(blobUrl);
                            });
                        } else {
                            URL.revokeObjectURL(blobUrl);
                        }
                    }, 100);
                } else {
                    window.open(project.url, '_blank');
                }
            } else {
                window.open(project.url, '_blank');
            }
        });
    }
    
    // Add overlay button event listener
    const overlayBtn = card.querySelector('.project-preview-overlay .project-preview-btn');
    if (overlayBtn) {
        overlayBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            handleProjectAction(project);
        });
    }
    
    // Make overlay clickable to open preview
    const previewOverlay = card.querySelector('.project-preview-overlay');
    if (previewOverlay) {
        previewOverlay.addEventListener('click', function(e) {
            if (e.target === previewOverlay || e.target.classList.contains('project-preview-overlay')) {
                handleProjectAction(project);
            }
        });
    }
    
    // Clean up blob URL when card is removed
    if (card.dataset.blobUrl) {
        // Store cleanup function
        card.addEventListener('remove', function() {
            URL.revokeObjectURL(card.dataset.blobUrl);
        });
    }
    
    return card;
}

/**
 * Escape HTML to prevent XSS
 * حماية من XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Load and display all projects
 * تحميل وعرض جميع المشاريع
 */
function loadAllProjects() {
    const container = document.getElementById('projectsGrid');
    if (!container) return;
    
    const projects = getActiveProjects();
    
    // Clear container
    container.innerHTML = '';
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="no-projects">لا توجد مشاريع حالياً. أضف مشاريع من <a href="dashboard.html">لوحة التحكم</a>.</p>';
        return;
    }
    
    // Create cards for each project
    projects.forEach(project => {
        const card = createProjectCard(project);
        container.appendChild(card);
    });
}

/**
 * Load latest projects (for homepage)
 * تحميل آخر المشاريع (للصفحة الرئيسية)
 */
function loadLatestProjects() {
    const container = document.getElementById('latestProjects');
    if (!container) return;
    
    const projects = getActiveProjects().slice(0, 6); // Show only 6 latest
    
    // Clear container
    container.innerHTML = '';
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="no-projects">لا توجد مشاريع حالياً. أضف مشاريع من لوحة التحكم.</p>';
        return;
    }
    
    // Create cards for each project
    projects.forEach(project => {
        const card = createProjectCard(project);
        container.appendChild(card);
    });
}

// Close modal handlers + Firestore updates
document.addEventListener('DOMContentLoaded', function() {
    const modalClose = document.getElementById('modalClose');
    const previewModalClose = document.getElementById('previewModalClose');
    
    if (modalClose) {
        modalClose.addEventListener('click', closePreview);
    }
    
    if (previewModalClose) {
        previewModalClose.addEventListener('click', closePreview);
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePreview();
        }
    });
    
    // Reload projects when Firestore updates
    window.addEventListener('projectsUpdated', function() {
        loadAllProjects();
        loadLatestProjects();
    });
});

// Make functions available globally
window.openPreview = openPreview;
window.closePreview = closePreview;
window.openDescriptionModal = openDescriptionModal;
window.closeDescriptionModal = closeDescriptionModal;
window.handleProjectAction = handleProjectAction;
window.loadAllProjects = loadAllProjects;
window.loadLatestProjects = loadLatestProjects;
