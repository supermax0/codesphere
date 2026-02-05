/**
 * Dashboard Management Module
 * إدارة لوحة التحكم
 */

const AI_REQUESTS_STORAGE_KEY = 'aiRequests';

/**
 * Get AI requests from localStorage (same key as chat.js)
 * الحصول على طلبات AI من التخزين
 */
function getAIRequests() {
    try {
        return JSON.parse(localStorage.getItem(AI_REQUESTS_STORAGE_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

/**
 * Update AI request status in localStorage
 * تحديث حالة طلب AI
 */
function setAIRequestStatus(requestId, status) {
    const requests = getAIRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx === -1) return false;
    requests[idx].status = status;
    requests[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(AI_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
    return true;
}

/**
 * Delete AI request from localStorage
 * حذف طلب AI
 */
function deleteAIRequest(requestId) {
    const requests = getAIRequests().filter(r => r.id !== requestId);
    localStorage.setItem(AI_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
    return true;
}

/**
 * Load and display AI requests list
 * تحميل وعرض قائمة طلبات AI
 */
function loadRequestsList() {
    const container = document.getElementById('requestsList');
    if (!container) return;

    const requests = getAIRequests();
    container.innerHTML = '';

    if (requests.length === 0) {
        container.innerHTML = '<p class="no-projects">لا توجد طلبات حالياً.</p>';
        updateRequestsBadge();
        return;
    }

    const sorted = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sorted.forEach(req => {
        const card = document.createElement('div');
        card.className = 'project-item request-item';
        const statusLabel = req.status === 'approved' ? 'موافق عليه' : req.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار';
        const statusClass = req.status === 'approved' ? 'active' : req.status === 'rejected' ? 'inactive' : 'pending';
        const dateStr = req.createdAt ? formatDate(req.createdAt) : '—';
        const ci = req.customerInfo || {};
        const hasCustomer = ci.clientName || ci.companyName || ci.phone || ci.email || ci.hasLogo;
        const customerBlock = hasCustomer ? `
            <div class="request-customer-info">
                <h4>📋 بيانات العميل</h4>
                ${ci.clientName ? `<p><strong>الاسم:</strong> ${escapeHtml(ci.clientName)}</p>` : ''}
                ${ci.companyName ? `<p><strong>الشركة:</strong> ${escapeHtml(ci.companyName)}</p>` : ''}
                ${ci.phone ? `<p><strong>الهاتف:</strong> ${escapeHtml(ci.phone)}</p>` : ''}
                ${ci.email ? `<p><strong>البريد:</strong> ${escapeHtml(ci.email)}</p>` : ''}
                ${ci.hasLogo ? `<p><strong>شعار/لوجو:</strong> ${escapeHtml(ci.hasLogo)}</p>` : ''}
            </div>
        ` : '';
        const optionsBlock = req.selectedOptions ? `<div class="request-options"><strong>خيارات التطوير:</strong> ${escapeHtml(req.selectedOptions)}</div>` : '';
        card.innerHTML = `
            <div class="project-item-header">
                <div class="project-item-info">
                    <h3 class="project-item-title">${escapeHtml(req.type || 'طلب عام')}</h3>
                    ${optionsBlock}
                    <div class="project-item-description">${escapeHtml(req.description || '')}</div>
                </div>
                <span class="project-item-status ${statusClass}">${statusLabel}</span>
            </div>
            <div class="project-item-meta">
                <span>🛠 ${escapeHtml(req.service || '—')}</span>
                <span>💰 ${escapeHtml(req.estimatedPrice || '—')}</span>
                <span>⏱ ${escapeHtml(req.estimatedTime || '—')}</span>
                <span>📅 ${dateStr}</span>
            </div>
            ${customerBlock}
            <div class="project-item-actions">
                ${req.status === 'pending' ? `
                    <button class="btn btn-primary" onclick="approveAIRequest('${req.id}')">موافق</button>
                    <button class="btn btn-outline" onclick="rejectAIRequest('${req.id}')">رفض</button>
                ` : ''}
                <button class="btn btn-danger" onclick="confirmDeleteAIRequest('${req.id}')">حذف</button>
            </div>
        `;
        container.appendChild(card);
    });
    updateRequestsBadge();
}

/**
 * Update requests badge count (pending only)
 * تحديث عداد طلبات الانتظار
 */
function updateRequestsBadge() {
    const badge = document.getElementById('requestsBadge');
    if (!badge) return;
    const requests = getAIRequests();
    const pending = requests.filter(r => r.status === 'pending').length;
    badge.textContent = pending;
    badge.style.display = pending > 0 ? '' : 'none';
}

function approveAIRequest(id) {
    if (setAIRequestStatus(id, 'approved')) {
        loadRequestsList();
    }
}

function rejectAIRequest(id) {
    if (setAIRequestStatus(id, 'rejected')) {
        loadRequestsList();
    }
}

function confirmDeleteAIRequest(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    if (deleteAIRequest(id)) {
        loadRequestsList();
    }
}

// Expose for onclick
window.approveAIRequest = approveAIRequest;
window.rejectAIRequest = rejectAIRequest;
window.confirmDeleteAIRequest = confirmDeleteAIRequest;

/**
 * Initialize Dashboard
 * تهيئة لوحة التحكم
 */
function initDashboard() {
    // Sidebar navigation
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-section]');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            switchSection(section);
            
            // Update active state
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Project type toggle handlers
    setupProjectTypeToggle();
    
    // File upload handlers
    setupFileUpload();
    
    // Form handlers
    const addForm = document.getElementById('addProjectForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddProject);
    }
    
    const editForm = document.getElementById('editProjectForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditProject);
    }
    
    // Modal close handlers
    const editModalClose = document.getElementById('editModalClose');
    const cancelEdit = document.getElementById('cancelEdit');
    
    if (editModalClose) {
        editModalClose.addEventListener('click', closeEditModal);
    }
    
    if (cancelEdit) {
        cancelEdit.addEventListener('click', closeEditModal);
    }
    
    // Load projects list
    loadProjectsList();
    
    // Load requests list
    loadRequestsList();
    
    // Update requests badge
    updateRequestsBadge();
    
    // Load API Key if in settings
    if (document.getElementById('settingsSection') && document.getElementById('settingsSection').classList.contains('active')) {
        loadApiKey();
    }
}

/**
 * Setup project type toggle (file/url)
 * إعداد التبديل بين نوع المشروع
 */
function setupProjectTypeToggle() {
    // Add form toggle
    const addTypeRadios = document.querySelectorAll('input[name="projectType"]');
    addTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const fileGroup = document.getElementById('fileUploadGroup');
            const urlGroup = document.getElementById('urlInputGroup');
            const fileInput = document.getElementById('projectFile');
            const urlInput = document.getElementById('projectUrl');
            
            if (this.value === 'file') {
                fileGroup.style.display = 'block';
                urlGroup.style.display = 'none';
                fileInput.required = true;
                urlInput.required = false;
                urlInput.value = '';
            } else {
                fileGroup.style.display = 'none';
                urlGroup.style.display = 'block';
                fileInput.required = false;
                urlInput.required = true;
                fileInput.value = '';
                document.getElementById('fileName').style.display = 'none';
            }
        });
    });
    
    // Edit form toggle
    const editTypeRadios = document.querySelectorAll('input[name="editProjectType"]');
    editTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const fileGroup = document.getElementById('editFileUploadGroup');
            const urlGroup = document.getElementById('editUrlInputGroup');
            const fileInput = document.getElementById('editProjectFile');
            const urlInput = document.getElementById('editProjectUrl');
            
            if (this.value === 'file') {
                fileGroup.style.display = 'block';
                urlGroup.style.display = 'none';
                fileInput.required = true;
                urlInput.required = false;
                urlInput.value = '';
            } else {
                fileGroup.style.display = 'none';
                urlGroup.style.display = 'block';
                fileInput.required = false;
                urlInput.required = true;
                fileInput.value = '';
                document.getElementById('editFileName').style.display = 'none';
                document.getElementById('editFileInfo').style.display = 'none';
            }
        });
    });
}

/**
 * Setup file upload handlers
 * إعداد معالجات رفع الملفات
 */
function setupFileUpload() {
    // Add form file upload
    const addFileInput = document.getElementById('projectFile');
    const addUploadArea = document.getElementById('fileUploadArea');
    const addFileName = document.getElementById('fileName');
    
    const addFileList = document.getElementById('fileUploadList');
    if (addFileInput && addUploadArea && addFileList) {
        addUploadArea.addEventListener('click', () => addFileInput.click());
        
        addFileInput.addEventListener('change', function(e) {
            handleFileSelect(e.target.files, addFileList, addUploadArea);
        });
        
        // Drag and drop
        addUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            addUploadArea.classList.add('dragover');
        });
        
        addUploadArea.addEventListener('dragleave', () => {
            addUploadArea.classList.remove('dragover');
        });
        
        addUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            addUploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            const allowedExtensions = ['.html', '.htm', '.css', '.js', '.py'];
            const validFiles = files.filter(file => {
                const fileName = file.name.toLowerCase();
                return allowedExtensions.some(ext => fileName.endsWith(ext));
            });
            
            if (validFiles.length > 0) {
                // Create a new FileList-like object
                const dataTransfer = new DataTransfer();
                validFiles.forEach(file => dataTransfer.items.add(file));
                addFileInput.files = dataTransfer.files;
                handleFileSelect(addFileInput.files, addFileList, addUploadArea);
            } else {
                alert('يرجى رفع ملفات بصيغة: HTML, CSS, JS, أو PY');
            }
        });
    }
    
    // Edit form file upload
    const editFileInput = document.getElementById('editProjectFile');
    const editUploadArea = document.getElementById('editFileUploadArea');
    const editFileList = document.getElementById('editFileUploadList');
    
    if (editFileInput && editUploadArea && editFileList) {
        editUploadArea.addEventListener('click', () => editFileInput.click());
        
        editFileInput.addEventListener('change', function(e) {
            handleFileSelect(e.target.files, editFileList, editUploadArea);
        });
        
        // Drag and drop
        editUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            editUploadArea.classList.add('dragover');
        });
        
        editUploadArea.addEventListener('dragleave', () => {
            editUploadArea.classList.remove('dragover');
        });
        
        editUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            editUploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            const allowedExtensions = ['.html', '.htm', '.css', '.js', '.py'];
            const validFiles = files.filter(file => {
                const fileName = file.name.toLowerCase();
                return allowedExtensions.some(ext => fileName.endsWith(ext));
            });
            
            if (validFiles.length > 0) {
                // Create a new FileList-like object
                const dataTransfer = new DataTransfer();
                validFiles.forEach(file => dataTransfer.items.add(file));
                editFileInput.files = dataTransfer.files;
                handleFileSelect(editFileInput.files, editFileList, editUploadArea);
            } else {
                alert('يرجى رفع ملفات بصيغة: HTML, CSS, JS, أو PY');
            }
        });
    }
}

/**
 * Handle file selection (multiple files)
 * معالجة اختيار الملفات (عدة ملفات)
 */
function handleFileSelect(files, fileListElement, uploadArea) {
    if (!files || files.length === 0) return;
    
    const allowedExtensions = ['.html', '.htm', '.css', '.js', '.py'];
    const validFiles = Array.from(files).filter(file => {
        const fileName = file.name.toLowerCase();
        return allowedExtensions.some(ext => fileName.endsWith(ext));
    });
    
    if (validFiles.length === 0) {
        alert('يرجى رفع ملفات بصيغة: HTML, CSS, JS, أو PY');
        return;
    }
    
    // Check if HTML file exists
    const hasHtmlFile = validFiles.some(file => {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith('.html') || fileName.endsWith('.htm');
    });
    
    if (!hasHtmlFile) {
        alert('يجب أن يحتوي المشروع على ملف HTML على الأقل');
        return;
    }
    
    // Clear previous list
    fileListElement.innerHTML = '';
    
    // Display file list
    validFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-item-icon">${getFileIcon(file.name)}</span>
            <span class="file-item-name">${file.name}</span>
            <span class="file-item-size">${formatFileSize(file.size)}</span>
        `;
        fileListElement.appendChild(fileItem);
    });
    
    fileListElement.style.display = 'block';
    uploadArea.querySelector('.file-upload-text').style.display = 'none';
}

/**
 * Get file icon based on extension
 * الحصول على أيقونة الملف حسب الامتداد
 */
function getFileIcon(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const icons = {
        'html': '🌐',
        'htm': '🌐',
        'css': '🎨',
        'js': '⚡',
        'py': '🐍'
    };
    return icons[ext] || '📄';
}

/**
 * Format file size
 * تنسيق حجم الملف
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Read file as base64
 * قراءة الملف كـ base64
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Get file type based on extension
 * الحصول على نوع الملف حسب الامتداد
 */
function getFileType(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const types = {
        'html': 'text/html',
        'htm': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'py': 'text/x-python'
    };
    return types[ext] || 'text/plain';
}

/**
 * Switch between dashboard sections
 * التبديل بين أقسام لوحة التحكم
 */
function switchSection(section) {
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(sec => {
        sec.classList.remove('active');
    });
    
    const targetSection = document.getElementById(section + 'Section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Reload requests if switching to requests section
    if (section === 'requests') {
        loadRequestsList();
    }
}

/**
 * Handle add project form submission
 * التعامل مع إرسال نموذج إضافة مشروع
 */
async function handleAddProject(e) {
    e.preventDefault();
    
    const projectType = document.querySelector('input[name="projectType"]:checked').value;
    const formData = {
        name: document.getElementById('projectName').value.trim(),
        description: document.getElementById('projectDescription').value.trim(),
        displayType: document.querySelector('input[name="displayType"]:checked').value,
        isActive: document.querySelector('input[name="isActive"]').checked,
        projectType: projectType
    };
    
    // Validation
    if (!formData.name || !formData.description) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    // Handle file or URL
    if (projectType === 'file') {
        const fileInput = document.getElementById('projectFile');
        if (!fileInput.files || fileInput.files.length === 0) {
            alert('يرجى اختيار ملفات المشروع');
            return;
        }
        
        try {
            const files = Array.from(fileInput.files);
            const filesData = {};
            let mainHtmlFile = null;
            
            // Read all files
            for (const file of files) {
                const fileContent = await readFileAsBase64(file);
                filesData[file.name] = {
                    name: file.name,
                    content: fileContent,
                    type: file.type || getFileType(file.name),
                    size: file.size
                };
                
                // Find main HTML file
                const fileName = file.name.toLowerCase();
                if ((fileName.endsWith('.html') || fileName.endsWith('.htm')) && !mainHtmlFile) {
                    mainHtmlFile = file.name;
                }
            }
            
            if (!mainHtmlFile) {
                alert('يجب أن يحتوي المشروع على ملف HTML على الأقل');
                return;
            }
            
            formData.url = `projects/${mainHtmlFile}`;
            formData.fileName = mainHtmlFile;
            formData.files = filesData; // Store all files
            formData.fileContent = filesData[mainHtmlFile].content; // Keep for backward compatibility
        } catch (error) {
            alert('حدث خطأ أثناء قراءة الملفات');
            console.error(error);
            return;
        }
    } else {
        const url = document.getElementById('projectUrl').value.trim();
        if (!url) {
            alert('يرجى إدخال رابط المشروع');
            return;
        }
        
        // Validate URL
        try {
            new URL(url);
            formData.url = url;
        } catch (error) {
            alert('يرجى إدخال رابط صحيح');
            return;
        }
    }
    
    // Add project
    const newProject = addProject(formData);
    
    if (newProject) {
        alert('تم إضافة المشروع بنجاح!');
        e.target.reset();
        document.getElementById('fileUploadList').innerHTML = '';
        document.getElementById('fileUploadList').style.display = 'none';
        document.getElementById('fileUploadArea').querySelector('.file-upload-text').style.display = 'block';
        
        // Reload projects list if on manage section
        const manageSection = document.getElementById('manageSection');
        if (manageSection && manageSection.classList.contains('active')) {
            loadProjectsList();
        }
    } else {
        alert('حدث خطأ أثناء إضافة المشروع');
    }
}

/**
 * Handle edit project form submission
 * التعامل مع إرسال نموذج تعديل مشروع
 */
async function handleEditProject(e) {
    e.preventDefault();
    
    const projectId = document.getElementById('editProjectId').value;
    const projectType = document.querySelector('input[name="editProjectType"]:checked').value;
    const formData = {
        name: document.getElementById('editProjectName').value.trim(),
        description: document.getElementById('editProjectDescription').value.trim(),
        displayType: document.querySelector('input[name="editDisplayType"]:checked').value,
        isActive: document.getElementById('editIsActive').checked,
        projectType: projectType
    };
    
    // Validation
    if (!formData.name || !formData.description) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    // Handle file or URL
    if (projectType === 'file') {
        const fileInput = document.getElementById('editProjectFile');
        if (fileInput.files && fileInput.files.length > 0) {
            // New files uploaded
            try {
                const files = Array.from(fileInput.files);
                const filesData = {};
                let mainHtmlFile = null;
                
                // Read all files
                for (const file of files) {
                    const fileContent = await readFileAsBase64(file);
                    filesData[file.name] = {
                        name: file.name,
                        content: fileContent,
                        type: file.type || getFileType(file.name),
                        size: file.size
                    };
                    
                    // Find main HTML file
                    const fileName = file.name.toLowerCase();
                    if ((fileName.endsWith('.html') || fileName.endsWith('.htm')) && !mainHtmlFile) {
                        mainHtmlFile = file.name;
                    }
                }
                
                if (!mainHtmlFile) {
                    alert('يجب أن يحتوي المشروع على ملف HTML على الأقل');
                    return;
                }
                
                formData.url = `projects/${mainHtmlFile}`;
                formData.fileName = mainHtmlFile;
                formData.files = filesData;
                formData.fileContent = filesData[mainHtmlFile].content; // Keep for backward compatibility
            } catch (error) {
                alert('حدث خطأ أثناء قراءة الملفات');
                console.error(error);
                return;
            }
        } else {
            // Keep existing files
            const project = getProjectById(projectId);
            if (project) {
                formData.url = project.url;
                formData.fileName = project.fileName;
                formData.fileContent = project.fileContent;
                if (project.files) {
                    formData.files = project.files;
                }
            }
        }
    } else {
        const url = document.getElementById('editProjectUrl').value.trim();
        if (!url) {
            alert('يرجى إدخال رابط المشروع');
            return;
        }
        
        // Validate URL
        try {
            new URL(url);
            formData.url = url;
        } catch (error) {
            alert('يرجى إدخال رابط صحيح');
            return;
        }
    }
    
    // Update project
    const updated = updateProject(projectId, formData);
    
    if (updated) {
        alert('تم تحديث المشروع بنجاح!');
        closeEditModal();
        loadProjectsList();
    } else {
        alert('حدث خطأ أثناء تحديث المشروع');
    }
}

/**
 * Load and display projects list
 * تحميل وعرض قائمة المشاريع
 */
function loadProjectsList() {
    const container = document.getElementById('projectsList');
    if (!container) return;
    
    const projects = getAllProjects();
    
    // Clear container
    container.innerHTML = '';
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="no-projects">لا توجد مشاريع حالياً.</p>';
        return;
    }
    
    // Sort by creation date (newest first)
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Create project items
    projects.forEach(project => {
        const item = createProjectListItem(project);
        container.appendChild(item);
    });
}

/**
 * Create project list item HTML
 * إنشاء HTML لعنصر قائمة المشروع
 */
function createProjectListItem(project) {
    const item = document.createElement('div');
    item.className = 'project-item';
    
    const statusClass = project.isActive ? 'active' : 'inactive';
    const statusText = project.isActive ? 'مفعل' : 'معطل';
    const displayTypeText = project.displayType === 'preview' ? 'معاينة داخل الموقع' : 'فتح بصفحة جديدة';
    const projectTypeText = project.projectType === 'file' ? '📁 ملف محلي' : '🌐 رابط خارجي';
    const urlDisplay = project.projectType === 'file' ? (project.fileName || project.url.split('/').pop()) : project.url;
    
    item.innerHTML = `
        <div class="project-item-header">
            <div class="project-item-info">
                <h3 class="project-item-title">${escapeHtml(project.name)}</h3>
                <div class="project-item-description markdown-content">${renderMarkdown(project.description)}</div>
            </div>
            <span class="project-item-status ${statusClass}">${statusText}</span>
        </div>
        <div class="project-item-meta">
            <span>📅 ${formatDate(project.createdAt)}</span>
            <span>🔗 ${displayTypeText}</span>
            <span>${projectTypeText}</span>
            <span>📍 ${escapeHtml(urlDisplay)}</span>
        </div>
        <div class="project-item-actions">
            <button class="btn btn-primary" onclick="openEditModal('${project.id}')">
                تعديل
            </button>
            <button class="btn ${project.isActive ? 'btn-outline' : 'btn-success'}" onclick="toggleProject('${project.id}')">
                ${project.isActive ? 'إخفاء' : 'تفعيل'}
            </button>
            <button class="btn btn-danger" onclick="confirmDeleteProject('${project.id}')">
                حذف
            </button>
        </div>
    `;
    
    return item;
}

/**
 * Open edit modal
 * فتح نافذة التعديل
 */
function openEditModal(projectId) {
    const project = getProjectById(projectId);
    if (!project) {
        alert('المشروع غير موجود');
        return;
    }
    
    // Fill form with project data
    document.getElementById('editProjectId').value = project.id;
    document.getElementById('editProjectName').value = project.name;
    document.getElementById('editProjectDescription').value = project.description;
    document.getElementById('editIsActive').checked = project.isActive;
    document.querySelector(`input[name="editDisplayType"][value="${project.displayType}"]`).checked = true;
    
    // Determine project type
    const isFileProject = project.projectType === 'file' || (project.url && project.url.startsWith('projects/'));
    const projectType = isFileProject ? 'file' : 'url';
    
    // Set project type
    document.querySelector(`input[name="editProjectType"][value="${projectType}"]`).checked = true;
    
    // Trigger change event to show/hide appropriate fields
    const typeRadio = document.querySelector(`input[name="editProjectType"][value="${projectType}"]`);
    if (typeRadio) {
        typeRadio.dispatchEvent(new Event('change'));
    }
    
    if (projectType === 'file') {
        // Show files info
        const fileList = document.getElementById('editFileUploadList');
        const editFileInfo = document.getElementById('editFileInfo');
        
        if (project.files && Object.keys(project.files).length > 0) {
            // Display all files
            fileList.innerHTML = '';
            Object.values(project.files).forEach(fileData => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span class="file-item-icon">${getFileIcon(fileData.name)}</span>
                    <span class="file-item-name">${fileData.name}</span>
                    <span class="file-item-size">${formatFileSize(fileData.size || 0)}</span>
                `;
                fileList.appendChild(fileItem);
            });
            fileList.style.display = 'block';
            document.getElementById('editFileUploadArea').querySelector('.file-upload-text').style.display = 'none';
            
            const fileCount = Object.keys(project.files).length;
            editFileInfo.textContent = `الملفات الحالية: ${fileCount} ملف`;
            editFileInfo.style.display = 'block';
        } else {
            // Backward compatibility - single file
            const fileName = project.fileName || project.url.split('/').pop();
            fileList.innerHTML = '';
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-item-icon">${getFileIcon(fileName)}</span>
                <span class="file-item-name">${fileName}</span>
            `;
            fileList.appendChild(fileItem);
            fileList.style.display = 'block';
            document.getElementById('editFileUploadArea').querySelector('.file-upload-text').style.display = 'none';
            editFileInfo.textContent = `الملف الحالي: ${fileName}`;
            editFileInfo.style.display = 'block';
        }
    } else {
        document.getElementById('editProjectUrl').value = project.url;
    }
    
    // Show modal
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Close edit modal
 * إغلاق نافذة التعديل
 */
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Toggle project status
 * تفعيل/إلغاء تفعيل مشروع
 */
function toggleProject(projectId) {
    const toggled = toggleProjectStatus(projectId);
    if (toggled) {
        loadProjectsList();
    } else {
        alert('حدث خطأ أثناء تغيير حالة المشروع');
    }
}

/**
 * Confirm and delete project
 * تأكيد وحذف مشروع
 */
function confirmDeleteProject(projectId) {
    const project = getProjectById(projectId);
    if (!project) {
        alert('المشروع غير موجود');
        return;
    }
    
    if (confirm(`هل أنت متأكد من حذف المشروع "${project.name}"؟`)) {
        const deleted = deleteProject(projectId);
        if (deleted) {
            alert('تم حذف المشروع بنجاح');
            loadProjectsList();
        } else {
            alert('حدث خطأ أثناء حذف المشروع');
        }
    }
}

/**
 * Format date
 * تنسيق التاريخ
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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

// Make functions available globally
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.toggleProject = toggleProject;
window.confirmDeleteProject = confirmDeleteProject;

/**
 * Save API Key
 * حفظ API Key
 */
function saveApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    if (!apiKeyInput) return;
    
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('يرجى إدخال API Key');
        return;
    }
    
    try {
        localStorage.setItem('openaiApiKey', apiKey);
        alert('تم حفظ API Key بنجاح!');
        apiKeyInput.value = '';
        apiKeyInput.type = 'password';
    } catch (error) {
        alert('حدث خطأ أثناء حفظ API Key');
        console.error(error);
    }
}

/**
 * Load API Key
 * تحميل API Key
 */
function loadApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
        const apiKey = localStorage.getItem('openaiApiKey') || '';
        if (apiKey) {
            apiKeyInput.value = '••••••••••••••••';
            apiKeyInput.type = 'password';
        }
    }
}

/**
 * Test API Key
 * اختبار API Key
 */
async function testApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : localStorage.getItem('openaiApiKey') || '';
    
    if (!apiKey) {
        alert('يرجى إدخال API Key أولاً');
        return;
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (response.ok) {
            alert('✅ API Key صحيح! الاتصال يعمل بشكل جيد.');
        } else {
            alert('❌ API Key غير صحيح أو غير صالح');
        }
    } catch (error) {
        alert('❌ حدث خطأ أثناء الاتصال. تأكد من اتصالك بالإنترنت.');
        console.error(error);
    }
}

// Make functions available globally
window.saveApiKey = saveApiKey;
window.testApiKey = testApiKey;

// Load API Key when settings section is opened
const originalSwitchSection = switchSection;
switchSection = function(section) {
    originalSwitchSection(section);
    if (section === 'settings') {
        loadApiKey();
    }
};

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initDashboard();
    loadApiKey();
});
