/**
 * Data Management Module
 * إدارة البيانات - Firestore (مشاركة بين المتصفحات) أو LocalStorage (احتياطي)
 */

const STORAGE_KEY = 'digitalServicesProjects';
const FIRESTORE_COLLECTION = 'projects';

let projectsCache = [];
let useFirestore = false;
let firestoreUnsubscribe = null;

/**
 * Initialize Firestore listener (call when firebaseReady)
 * تهيئة Firestore واستماع التحديثات
 */
async function initFirestoreData() {
    if (!window.firebaseDb) return;
    try {
        var mod = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
        var colRef = mod.collection(window.firebaseDb, FIRESTORE_COLLECTION);
        firestoreUnsubscribe = mod.onSnapshot(colRef, function (snapshot) {
            var list = snapshot.docs.map(function (doc) {
                var d = doc.data();
                d.id = doc.id;
                return d;
            });
            list.sort(function (a, b) { return (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)); });
            projectsCache = list;
            if (snapshot.empty && !localStorage.getItem('firestore_migrated')) {
                var local = _getFromStorage();
                if (local.length > 0) {
                    local.forEach(function (p) {
                        var data = _toFirestoreData(p);
                        mod.addDoc(mod.collection(window.firebaseDb, FIRESTORE_COLLECTION), data).catch(function () {});
                    });
                    localStorage.setItem('firestore_migrated', '1');
                }
            }
            window.dispatchEvent(new CustomEvent('projectsUpdated'));
        }, function (err) {
            console.warn('Firestore error, using LocalStorage:', err);
            projectsCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        });
        useFirestore = true;
    } catch (e) {
        console.warn('Firestore init failed:', e);
        projectsCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    }
}

// Listen for Firebase ready (async init)
if (typeof window !== 'undefined') {
    window.addEventListener('firebaseReady', function () { initFirestoreData(); });
    if (window.firebaseDb) initFirestoreData();
}

function _getFromStorage() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) { return []; }
}

function _saveToStorage(projects) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        return true;
    } catch (e) { return false; }
}

/**
 * Get all projects
 */
function getAllProjects() {
    if (useFirestore) return projectsCache.slice();
    return _getFromStorage();
}

/**
 * Get active projects only
 */
function getActiveProjects() {
    return getAllProjects().filter(function (p) { return p.isActive === true; });
}

/**
 * Get project by ID
 */
function getProjectById(id) {
    return getAllProjects().find(function (p) { return p.id === id; });
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Project data for Firestore (serializable)
 */
function _toFirestoreData(projectData) {
    var p = {
        name: projectData.name,
        description: projectData.description,
        url: projectData.url,
        displayType: projectData.displayType || 'preview',
        isActive: projectData.isActive !== undefined ? projectData.isActive : true,
        projectType: projectData.projectType || 'url',
        createdAt: projectData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    if (projectData.projectType === 'file') {
        p.fileName = projectData.fileName;
        p.fileContent = projectData.fileContent;
        if (projectData.files) p.files = projectData.files;
    }
    return p;
}

/**
 * Add new project
 * @param {Object} projectData
 * @param {string} [customId] - معرف مخصص (للربط مع Storage)
 */
function addProject(projectData, customId) {
    var newProject = {
        id: customId || generateId(),
        name: projectData.name,
        description: projectData.description,
        url: projectData.url,
        displayType: projectData.displayType || 'preview',
        isActive: projectData.isActive !== undefined ? projectData.isActive : true,
        projectType: projectData.projectType || 'url',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    if (projectData.projectType === 'file') {
        newProject.fileName = projectData.fileName;
        newProject.fileContent = projectData.fileContent;
        if (projectData.files) newProject.files = projectData.files;
    }

    if (useFirestore && window.firebaseDb) {
        return (async function () {
            try {
                var mod = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
                var data = _toFirestoreData(newProject);
                if (customId) {
                    await mod.setDoc(mod.doc(window.firebaseDb, FIRESTORE_COLLECTION, customId), data);
                } else {
                    var ref = await mod.addDoc(mod.collection(window.firebaseDb, FIRESTORE_COLLECTION), data);
                    newProject.id = ref.id;
                }
                return newProject;
            } catch (e) {
                console.error('Firestore add error:', e);
                var projects = _getFromStorage();
                projects.push(newProject);
                _saveToStorage(projects);
                return newProject;
            }
        })();
    }

    var projects = _getFromStorage();
    projects.push(newProject);
    _saveToStorage(projects);
    return Promise.resolve(newProject);
}

/**
 * Update project
 */
function updateProject(id, projectData) {
    var projects = getAllProjects();
    var idx = projects.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return Promise.resolve(false);

    var updated = {
        ...projects[idx],
        ...projectData,
        id: id,
        updatedAt: new Date().toISOString()
    };

    if (useFirestore && window.firebaseDb) {
        return (async function () {
            try {
                var mod = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
                await mod.updateDoc(mod.doc(window.firebaseDb, FIRESTORE_COLLECTION, id), _toFirestoreData(updated));
                return true;
            } catch (e) {
                console.error('Firestore update error:', e);
                projects[idx] = updated;
                _saveToStorage(projects);
                return true;
            }
        })();
    }

    projects[idx] = updated;
    _saveToStorage(projects);
    return Promise.resolve(true);
}

/**
 * Delete project
 */
function deleteProject(id) {
    var projects = getAllProjects();
    var filtered = projects.filter(function (p) { return p.id !== id; });
    if (projects.length === filtered.length) return Promise.resolve(false);

    if (useFirestore && window.firebaseDb) {
        return (async function () {
            try {
                var mod = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
                await mod.deleteDoc(mod.doc(window.firebaseDb, FIRESTORE_COLLECTION, id));
                return true;
            } catch (e) {
                console.error('Firestore delete error:', e);
                _saveToStorage(filtered);
                return true;
            }
        })();
    }

    _saveToStorage(filtered);
    return Promise.resolve(true);
}

/**
 * Toggle project active status
 */
function toggleProjectStatus(id) {
    var project = getProjectById(id);
    if (!project) return Promise.resolve(false);
    return updateProject(id, { isActive: !project.isActive });
}
