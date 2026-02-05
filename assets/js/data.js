/**
 * Data Management Module
 * إدارة البيانات باستخدام LocalStorage
 */

// Storage Key
const STORAGE_KEY = 'digitalServicesProjects';

/**
 * Get all projects from LocalStorage
 * الحصول على جميع المشاريع من LocalStorage
 */
function getAllProjects() {
    try {
        const projects = localStorage.getItem(STORAGE_KEY);
        return projects ? JSON.parse(projects) : [];
    } catch (error) {
        console.error('Error reading projects from localStorage:', error);
        return [];
    }
}

/**
 * Save projects to LocalStorage
 * حفظ المشاريع في LocalStorage
 */
function saveProjects(projects) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        return true;
    } catch (error) {
        console.error('Error saving projects to localStorage:', error);
        return false;
    }
}

/**
 * Get active projects only
 * الحصول على المشاريع المفعلة فقط
 */
function getActiveProjects() {
    const allProjects = getAllProjects();
    return allProjects.filter(project => project.isActive === true);
}

/**
 * Get project by ID
 * الحصول على مشروع بواسطة المعرف
 */
function getProjectById(id) {
    const projects = getAllProjects();
    return projects.find(project => project.id === id);
}

/**
 * Generate unique ID
 * إنشاء معرف فريد
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Add new project
 * إضافة مشروع جديد
 */
function addProject(projectData) {
    const projects = getAllProjects();
    const newProject = {
        id: generateId(),
        name: projectData.name,
        description: projectData.description,
        url: projectData.url,
        displayType: projectData.displayType || 'preview',
        isActive: projectData.isActive !== undefined ? projectData.isActive : true,
        projectType: projectData.projectType || 'url',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Add file-specific fields if it's a file project
    if (projectData.projectType === 'file') {
        newProject.fileName = projectData.fileName;
        newProject.fileContent = projectData.fileContent; // Base64 encoded (for backward compatibility)
        if (projectData.files) {
            newProject.files = projectData.files; // All files object
        }
    }
    
    projects.push(newProject);
    saveProjects(projects);
    return newProject;
}

/**
 * Update project
 * تحديث مشروع
 */
function updateProject(id, projectData) {
    const projects = getAllProjects();
    const index = projects.findIndex(project => project.id === id);
    
    if (index === -1) {
        return false;
    }
    
    projects[index] = {
        ...projects[index],
        ...projectData,
        id: id,
        updatedAt: new Date().toISOString()
    };
    
    saveProjects(projects);
    return true;
}

/**
 * Delete project
 * حذف مشروع
 */
function deleteProject(id) {
    const projects = getAllProjects();
    const filteredProjects = projects.filter(project => project.id !== id);
    saveProjects(filteredProjects);
    return projects.length !== filteredProjects.length;
}

/**
 * Toggle project active status
 * تفعيل/إلغاء تفعيل مشروع
 */
function toggleProjectStatus(id) {
    const project = getProjectById(id);
    if (!project) {
        return false;
    }
    
    return updateProject(id, {
        isActive: !project.isActive
    });
}
