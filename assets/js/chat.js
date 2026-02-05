/**
 * Chat with AI Module
 * نظام المراسلة مع AI
 */

const CHAT_STORAGE_KEY = 'chatMessages';
const REQUESTS_STORAGE_KEY = 'aiRequests';
const API_KEY_STORAGE_KEY = 'openaiApiKey';
const CHAT_HISTORY_STORAGE_KEY = 'chatHistory';
const REQUEST_DRAFT_KEY = 'chatRequestDraft';

/**
 * Initialize Chat
 * تهيئة المحادثة
 */
function initChat() {
    loadChatHistory();
    setupEventListeners();
    setupFloatingChat();
}

/**
 * Setup floating chat button
 * إعداد زر الدردشة العائم
 */
function setupFloatingChat() {
    const floatingBtn = document.getElementById('floatingChatBtn');
    const chatModal = document.getElementById('chatModal');
    const chatModalClose = document.getElementById('chatModalClose');
    
    if (floatingBtn && chatModal) {
        floatingBtn.addEventListener('click', function() {
            chatModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Focus on input
            setTimeout(() => {
                const input = document.getElementById('chatInput');
                if (input) input.focus();
            }, 100);
        });
    }
    
    if (chatModalClose) {
        chatModalClose.addEventListener('click', function() {
            chatModal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    if (chatModal) {
        chatModal.addEventListener('click', function(e) {
            if (e.target === chatModal) {
                chatModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && chatModal && chatModal.classList.contains('active')) {
            chatModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Update badge
    updateChatBadge();
}

/**
 * Setup event listeners
 * إعداد مستمعي الأحداث
 */
function setupEventListeners() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearChat');
    const suggestions = document.querySelectorAll('.suggestion-btn');

    // Send message on button click
    sendBtn.addEventListener('click', sendMessage);

    // Send message on Enter (Shift+Enter for new line)
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Clear chat (if button exists)
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('هل أنت متأكد من مسح المحادثة؟')) {
                clearChat();
            }
        });
    }

    // Suggestion buttons
    suggestions.forEach(btn => {
        btn.addEventListener('click', function() {
            const suggestion = this.getAttribute('data-suggestion');
            chatInput.value = suggestion;
            chatInput.focus();
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });
    });
}

/**
 * Send message
 * إرسال رسالة
 */
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    // Add user message
    addMessage('user', message);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Disable input
    chatInput.disabled = true;
    document.getElementById('sendBtn').disabled = true;

    // Show typing indicator
    showTypingIndicator();

    // Get AI response
    try {
        const aiResponse = await getAIResponse(message);
        removeTypingIndicator();
        addMessage('ai', aiResponse.text);

        // If AI returned options widget (checkboxes), render it after DOM update
        if (aiResponse.optionsWidget) {
            setTimeout(function () { renderOptionsWidget(aiResponse.optionsWidget); }, 50);
        }

        // If AI created a request, show it
        if (aiResponse.request) {
            showRequestSummary(aiResponse.request);
            saveRequest(aiResponse.request);
            updateChatBadge();
        }
    } catch (error) {
        removeTypingIndicator();
        addMessage('ai', 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.');
        console.error('AI Error:', error);
    }

    // Enable input
    chatInput.disabled = false;
    document.getElementById('sendBtn').disabled = false;
    chatInput.focus();
}

/**
 * Get API Key
 * الحصول على API Key
 */
function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

/**
 * Get AI response (using OpenAI API or simulated)
 * الحصول على رد AI (استخدام OpenAI API أو محاكاة)
 */
async function getAIResponse(userMessage) {
    const apiKey = getApiKey();
    const conversationHistory = getConversationHistory();
    let result;

    if (apiKey && apiKey.trim() !== '') {
        try {
            result = await getOpenAIResponse(userMessage, conversationHistory, apiKey);
        } catch (error) {
            console.error('OpenAI API Error:', error);
            result = await getSimulatedAIResponse(userMessage, conversationHistory);
        }
    } else {
        result = await getSimulatedAIResponse(userMessage, conversationHistory);
    }

    // إظهار ويدجت الخيارات عند طلب نوع مشروع (حتى مع رد OpenAI)
    if (!result.optionsWidget) {
        const project = detectProjectType(userMessage);
        const lower = userMessage.toLowerCase().trim();
        const isWeb = project && (lower.includes('موقع') || lower.includes('ويب') || lower.includes('website') || lower.includes('متجر'));
        const isApp = project && (lower.includes('تطبيق') || lower.includes('app') || lower.includes('موبايل') || lower.includes('اندرويد') || lower.includes('ايفون'));
        const isSys = project && (lower.includes('نظام') || lower.includes('إدارة') || lower.includes('crm'));
        const isDes = project && (lower.includes('تصميم') || lower.includes('جرافيك') || lower.includes('شعار') || lower.includes('لوغو') || lower.includes('هوية'));
        if (project && (isWeb || isApp || isSys || isDes)) {
            const options = getProjectOptions(project.type);
            if (options && options.length > 0) {
                setRequestDraft({ step: 'options', project: project, description: userMessage });
                result.optionsWidget = { options: options, project: project, description: userMessage };
                result.text = 'ممتاز! أفهم أنك تريد **' + project.type + '**. ضع ✓ أمام كل ما تريده في الموقع:\n\n';
            }
        }
    }
    return result;
}

/**
 * Get OpenAI API response
 * الحصول على رد من OpenAI API
 */
async function getOpenAIResponse(userMessage, conversationHistory, apiKey) {
    const systemPrompt = `أنت مساعد AI احترافي من شركة codespher المتخصصة في تطوير المواقع والتطبيقات والأنظمة والتصميم.

مهامك:
1. عند طلب العميل لموقع أو تطبيق أو نظام أو تصميم: اعرض خيارات التطوير حسب النوع (مثلاً للموقع: تعريفي، متجر إلكتروني، مدونة، حجز مواعيد) واطلب منه اختيار ما يريد.
2. بعد اختيار الخيارات: اطلب من العميل بيانات الاتصال: اسمه (أو اسم العميل)، اسم الشركة إن وجدت، رقم الهاتف، البريد الإلكتروني إن وجد، وهل لديه شعار أو لوجو نستخدمه (نعم/لا).
3. الردود بالعربية، واضحة ومنظمة (نقاط أو قوائم).
4. عند وجود تفاصيل كافية بما فيها بيانات الاتصال، قدّم تقدير تكلفة ووقت واذكر أن الطلب سيُرسل للداشبورد.

أنواع المشاريع: موقع ويب، متجر إلكتروني، تطبيق موبايل، نظام إدارة، تصميم (شعار، هوية بصرية).`;
    const messages = [
        {
            role: 'system',
            content: systemPrompt
        },
        ...conversationHistory,
        {
            role: 'user',
            content: userMessage
        }
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        })
    });
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiText = data.choices[0].message.content;
    
    // Save to conversation history
    saveToConversationHistory(userMessage, aiText);
    
    // Check if we should create a request
    const request = analyzeAndCreateRequest(userMessage, aiText);
    
    return { text: aiText, request };
}

/**
 * Get simulated AI response (fallback)
 * الحصول على رد AI محاكي (بديل)
 */
async function getSimulatedAIResponse(userMessage, conversationHistory) {
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 700));
    
    const lowerMessage = userMessage.toLowerCase().trim();
    let response = '';
    let request = null;
    const draft = getRequestDraft();
    const budgetTime = extractBudgetAndTime(userMessage);
    const lastUserInHistory = conversationHistory.filter(m => m.role === 'user').pop()?.content || '';

    function buildRequest(project, desc, opts, customerInfo, forcePrice, forceTime) {
        if (!project) return null;
        const price = forcePrice || budgetTime.price || project.price;
        const time = forceTime || budgetTime.time || project.time;
        return createRequest({
            type: project.type,
            description: desc,
            service: project.service,
            estimatedPrice: price,
            estimatedTime: time,
            selectedOptions: opts || null,
            customerInfo: customerInfo || {}
        });
    }

    // Step: جمع بيانات العميل (المستخدم يرسل الاسم، الشركة، الهاتف، البريد، الشعار)
    if (draft && draft.step === 'customer') {
        const customerInfo = extractCustomerInfo(userMessage);
        const hasAny = customerInfo.clientName || customerInfo.companyName || customerInfo.phone || customerInfo.email;
        const project = draft.project || detectProjectType(draft.description || userMessage);
        const desc = (draft.selectedOptions ? draft.selectedOptions + ' | ' : '') + (draft.description || userMessage);
        if (project && hasAny) {
            request = buildRequest(project, desc, draft.selectedOptions, customerInfo);
            clearRequestDraft();
            response = `تم استلام بياناتك بنجاح. ✅\n\n`;
            response += `**ملخص الطلب:**\n`;
            response += `- النوع: ${request.type}\n`;
            if (request.selectedOptions) response += `- الخيارات: ${request.selectedOptions}\n`;
            response += `- التكلفة المتوقعة: ${request.estimatedPrice}\n`;
            response += `- المدة المتوقعة: ${request.estimatedTime}\n\n`;
            if (customerInfo.clientName) response += `- **اسم العميل:** ${customerInfo.clientName}\n`;
            if (customerInfo.companyName) response += `- **اسم الشركة:** ${customerInfo.companyName}\n`;
            if (customerInfo.phone) response += `- **رقم الهاتف:** ${customerInfo.phone}\n`;
            if (customerInfo.email) response += `- **البريد الإلكتروني:** ${customerInfo.email}\n`;
            if (customerInfo.hasLogo) response += `- **شعار/لوجو:** ${customerInfo.hasLogo}\n`;
            response += `\n✅ **تم إرسال الطلب للداشبورد** وسنتواصل معك قريباً.`;
        } else {
            response = `لم أستطع استخراج بيانات كافية. يرجى إرسال:\n\n`;
            response += `- **اسمك** (أو اسم العميل)\n`;
            response += `- **اسم الشركة** (إن وجد)\n`;
            response += `- **رقم الهاتف**\n`;
            response += `- **البريد الإلكتروني** (إن وجد)\n`;
            response += `- **هل لديكم شعار أو لوجو نستخدمه؟** (نعم/لا)\n\n`;
            response += `يمكنك كتابتها في رسالة واحدة، مثال:\nاسمي أحمد، شركة النور، هاتف 07701234567، بريد ahmed@company.com، لا يوجد شعار.`;
        }
        saveToConversationHistory(userMessage, response);
        return { text: response, request };
    }

    // Step: المستخدم اختار خيارات التطوير → نطلب منه بيانات العميل
    if (draft && draft.step === 'options') {
        const project = draft.project;
        const selectedOptions = userMessage.trim();
        setRequestDraft({
            step: 'customer',
            project: project,
            selectedOptions: selectedOptions,
            description: draft.description || selectedOptions
        });
        response = `ممتاز! اخترت: **${selectedOptions}**\n\n`;
        response += `لإكمال الطلب وإرساله للداشبورد، أحتاج منك:\n\n`;
        response += `- **اسمك** (أو اسم العميل)\n`;
        response += `- **اسم الشركة** (إن وجد)\n`;
        response += `- **رقم الهاتف**\n`;
        response += `- **البريد الإلكتروني** (إن وجد)\n`;
        response += `- **هل لديكم شعار أو لوجو نستخدمه في الموقع؟** (نعم/لا)\n\n`;
        response += `أرسل البيانات في رسالة واحدة وسأجهز الطلب.`;
        saveToConversationHistory(userMessage, response);
        return { text: response, request: null };
    }

    // بداية: المستخدم يطلب نوع مشروع (موقع، تطبيق، نظام، تصميم) → نعرض الخيارات
    const project = detectProjectType(userMessage);
    const isWebsite = project && (lowerMessage.includes('موقع') || lowerMessage.includes('ويب') || lowerMessage.includes('website') || lowerMessage.includes('متجر'));
    const isApp = project && (lowerMessage.includes('تطبيق') || lowerMessage.includes('app') || lowerMessage.includes('موبايل') || lowerMessage.includes('اندرويد') || lowerMessage.includes('ايفون'));
    const isSystem = project && (lowerMessage.includes('نظام') || lowerMessage.includes('إدارة') || lowerMessage.includes('crm'));
    const isDesign = project && (lowerMessage.includes('تصميم') || lowerMessage.includes('جرافيك') || lowerMessage.includes('شعار') || lowerMessage.includes('لوغو') || lowerMessage.includes('هوية'));

    if (project && (isWebsite || isApp || isSystem || isDesign)) {
        const options = getProjectOptions(project.type);
        if (options.length > 0) {
            response = `ممتاز! أفهم أنك تريد **${project.type}**. ضع ✓ أمام كل ما تريده في الموقع:\n\n`;
            setRequestDraft({ step: 'options', project: project, description: userMessage });
            saveToConversationHistory(userMessage, response);
            return { text: response, request: null, optionsWidget: { options: options, project: project, description: userMessage } };
        }
    }

    // تدفق قديم: متابعة مع ميزانية/وقت أو رسالة طويلة بدون مسودة
    const combinedDescription = lastUserInHistory && lastUserInHistory.length > 10 ? (lastUserInHistory + ' | ' + userMessage) : userMessage;
    const projectFromContext = detectProjectType(combinedDescription) || detectProjectType(lastUserInHistory) || project;
    const budgetTimeFromContext = extractBudgetAndTime(lastUserInHistory);

    if (conversationHistory.length >= 2 && projectFromContext && (budgetTime.price || budgetTime.time || userMessage.length > 20)) {
        const customerInfo = extractCustomerInfo(combinedDescription + ' ' + userMessage);
        const desc = lastUserInHistory ? combinedDescription : userMessage;
        request = buildRequest(projectFromContext, desc, null, customerInfo, budgetTimeFromContext.price || budgetTime.price, budgetTimeFromContext.time || budgetTime.time);
        if (request) {
            response = `تم تحديث الطلب. ✅\n\n**ملخص:** ${request.type} | ${request.estimatedPrice} | ${request.estimatedTime}\n`;
            if (Object.keys(request.customerInfo || {}).some(k => request.customerInfo[k])) {
                response += `\n**بيانات العميل:**\n`;
                if (request.customerInfo.clientName) response += `- الاسم: ${request.customerInfo.clientName}\n`;
                if (request.customerInfo.companyName) response += `- الشركة: ${request.customerInfo.companyName}\n`;
                if (request.customerInfo.phone) response += `- الهاتف: ${request.customerInfo.phone}\n`;
                if (request.customerInfo.email) response += `- البريد: ${request.customerInfo.email}\n`;
                if (request.customerInfo.hasLogo) response += `- شعار: ${request.customerInfo.hasLogo}\n`;
            }
            response += `\n✅ **تم إرسال الطلب للداشبورد.**`;
            saveToConversationHistory(userMessage, response);
            return { text: response, request };
        }
    }

    // طلب تصميم أو برمجة عام بدون خيارات مسودة
    if (project && (lowerMessage.includes('برمجة') || lowerMessage.includes('تطوير') || lowerMessage.includes('برمج'))) {
        response = `فهمت أنك تبحث عن تطوير برمجي. يمكننا مساعدتك في مواقع، تطبيقات، وأنظمة إدارة.\n\n`;
        response += `صف لي المشروع (نوع، مميزات، ميزانية إن وجدت)، أو اختر "موقع ويب" أو "تطبيق موبايل" من البداية لأعرض لك الخيارات وأخذ بياناتك.`;
        saveToConversationHistory(userMessage, response);
        return { text: response, request: null };
    }

    // رد عام
    const fallbackProject = detectProjectType(userMessage);
    response = `شكراً لرسالتك! لأخدمك بشكل أفضل:\n\n`;
    response += `- اذكر **نوع المشروع**: موقع ويب، متجر إلكتروني، تطبيق موبايل، نظام إدارة، أو تصميم (شعار/هوية).\n`;
    response += `- سأعرض لك **خيارات التطوير** حسب النوع لتختار ما تريد.\n`;
    response += `- ثم سأطلب **اسمك، اسم الشركة، رقم الهاتف، البريد الإلكتروني، وهل لديكم شعار** لإكمال الطلب. 😊`;
    if (userMessage.length > 30 && fallbackProject) {
        const customerInfo = extractCustomerInfo(userMessage);
        request = buildRequest(fallbackProject, userMessage, null, customerInfo);
        if (request) response += `\n\n✅ **تم إنشاء طلب مبدئي!** سيتم إرساله للداشبورد. إن أردت نأخذ بياناتك بالتفصيل، ابدأ من جديد بذكر نوع المشروع.`;
    }
    saveToConversationHistory(userMessage, response);
    return { text: response, request };
}

/**
 * Request draft (guided flow: options → customer info)
 * مسودة الطلب للتوجيه: خيارات ثم بيانات العميل
 */
function getRequestDraft() {
    try {
        const raw = sessionStorage.getItem(REQUEST_DRAFT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}
function setRequestDraft(draft) {
    try {
        sessionStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) { console.error(e); }
}
function clearRequestDraft() {
    try { sessionStorage.removeItem(REQUEST_DRAFT_KEY); } catch (e) {}
}

/**
 * Options per project type (for user to choose)
 * خيارات التطوير حسب نوع المشروع
 */
function getProjectOptions(projectType) {
    const options = {
        'موقع ويب': [
            'موقع تعريفي (Portfolio)',
            'متجر إلكتروني (E-commerce)',
            'موقع إخباري أو مدونة',
            'موقع حجز مواعيد',
            'موقع شركة / خدمات'
        ],
        'تطبيق موبايل': [
            'تطبيق iOS',
            'تطبيق Android',
            'تطبيق متعدد المنصات (Flutter/React Native)',
            'واجهة حديثة + قاعدة بيانات',
            'إشعارات Push وتحديثات'
        ],
        'نظام إدارة': [
            'نظام إدارة العملاء (CRM)',
            'نظام إدارة المخزون',
            'نظام إدارة الموظفين',
            'نظام إدارة المبيعات',
            'لوحة تحكم + تقارير'
        ],
        'تصميم جرافيكي': [
            'تصميم شعار (Logo)',
            'هوية بصرية كاملة',
            'تصميم واجهات (UI/UX)',
            'إعلانات ومواد تسويقية'
        ]
    };
    return options[projectType] || [];
}

/**
 * Extract customer info from message (name, company, phone, email, logo)
 * استخراج بيانات العميل من الرسالة
 */
function extractCustomerInfo(text) {
    const info = { clientName: '', companyName: '', phone: '', email: '', hasLogo: '' };
    const t = text.trim();
    // اسم: أو اسمي أو اسم العميل
    const nameMatch = t.match(/(?:اسم(?:ي| العميل)?|الاسم)\s*[:\-]?\s*([^\n،,\d]+)/i);
    if (nameMatch) info.clientName = nameMatch[1].trim();
    // شركة أو اسم الشركة
    const companyMatch = t.match(/(?:اسم الشركة|الشركة|شركة)\s*[:\-]?\s*([^\n،,]+)/i);
    if (companyMatch) info.companyName = companyMatch[1].trim();
    // هاتف، جوال، رقم (بدون g لاستخراج المجموعة)
    const phoneLabelMatch = t.match(/(?:هاتف|جوال|رقم|موبايل|تلفون)\s*[:\-]?\s*([0-9\u0660-\u0669\s\-+]{8,})/i);
    if (phoneLabelMatch) info.phone = phoneLabelMatch[1].replace(/\s/g, '').trim();
    if (!info.phone) {
        const anyPhone = t.match(/(?:07\d{8,9}|\+9647\d{8,9}|0\d{9,11})/);
        if (anyPhone) info.phone = anyPhone[0];
    }
    // بريد، ايميل
    const emailLabelMatch = t.match(/(?:بريد|ايميل|إيميل|email)\s*[:\-]?\s*([^\s،,\n]+@[^\s،,\n]+)/i);
    if (emailLabelMatch) info.email = emailLabelMatch[1].trim();
    if (!info.email) {
        const anyEmail = t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (anyEmail) info.email = anyEmail[0];
    }
    // شعار، لوجو
    if (/\b(نعم|لدينا|موجود|عندي|لدي|يوجد)\b.*\b(شعار|لوجو|logo)\b/i.test(t) || /\b(شعار|لوجو).*(نعم|لدينا|موجود)/i.test(t)) info.hasLogo = 'نعم';
    else if (/\b(لا|ليس|لا يوجد|ما عندي|بدون)\b.*\b(شعار|لوجو)\b/i.test(t) || /\b(شعار|لوجو).*(لا|بدون)/i.test(t)) info.hasLogo = 'لا';
    return info;
}

/**
 * Detect project type from text (extended keywords)
 * اكتشاف نوع المشروع من النص
 */
function detectProjectType(text) {
    const t = text.toLowerCase();
    if (/\b(موقع|ويب|website|web|متجر|متجر إلكتروني|e-?commerce|متجر أونلاين)\b/.test(t)) return { type: 'موقع ويب', service: 'Web Development', price: '500-2000 دولار', time: '2-4 أسابيع' };
    if (/\b(تطبيق|app|موبايل|اندرويد|android|ايفون|iphone|ios|فلتر|flutter|رياكت نيتيف)\b/.test(t)) return { type: 'تطبيق موبايل', service: 'Mobile App Development', price: '1000-5000 دولار', time: '4-8 أسابيع' };
    if (/\b(نظام|إدارة|crm|مخزون|موظفين|مبيعات|system)\b/.test(t)) return { type: 'نظام إدارة', service: 'Management System', price: '800-3000 دولار', time: '3-6 أسابيع' };
    if (/\b(تصميم|جرافيك|شعار|لوغو|logo|هوية بصرية|ui|ux|اعلان|ماركتينغ|تسويق)\b/.test(t)) return { type: 'تصميم جرافيكي', service: 'Graphic Design', price: '200-1000 دولار', time: '1-2 أسابيع' };
    if (/\b(برمجة|تطوير|برمج)\b/.test(t)) return { type: 'تطوير برمجي', service: 'Software Development', price: 'يحدد لاحقاً', time: 'يحدد لاحقاً' };
    return null;
}

/**
 * Extract budget and time from message
 * استخراج الميزانية والوقت من الرسالة
 */
function extractBudgetAndTime(text) {
    const result = { price: null, time: null };
    const numMatch = text.match(/(\d+)\s*(?:,\d+)?\s*(دولار|ريال|درهم|د\.ع)/i);
    if (numMatch) result.price = numMatch[0].trim();
    const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)\s*(دولار|ريال)/i);
    if (rangeMatch) result.price = rangeMatch[1] + '-' + rangeMatch[2] + ' ' + rangeMatch[3];
    const weekMatch = text.match(/(\d+)\s*أسبوع|اسبوع|week/i);
    const monthMatch = text.match(/(\d+)\s*شهر/i);
    if (weekMatch) result.time = weekMatch[1] + ' أسابيع';
    else if (monthMatch) result.time = monthMatch[1] + ' أشهر';
    return result;
}

/**
 * Generate contextual response based on history (smarter: create request when user adds details)
 * إنشاء رد سياقي وطلب عند إكمال المستخدم للتفاصيل
 */
function generateContextualResponse(userMessage, history) {
    if (history.length < 2) return null;
    const lastUser = history[history.length - 1]?.content || '';
    const lastAi = history[history.length - 2]?.content || '';
    const combined = (lastUser + '\n' + userMessage).trim();
    const project = detectProjectType(combined) || detectProjectType(lastUser);
    const extra = extractBudgetAndTime(userMessage);
    const hasEnoughDetail = combined.length > 25 || (project && (extra.price || extra.time));
    if (!hasEnoughDetail || !project) return null;
    return null; // Let main flow build response and request
}

/**
 * Generate default response
 * إنشاء رد افتراضي
 */
function generateDefaultResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('موقع') || lowerMessage.includes('website')) {
        return `ممتاز! أفهم أنك تريد موقع ويب. دعني أساعدك في تحديد المتطلبات:\n\n**نوع الموقع:**\n- موقع تعريفي (Portfolio)\n- موقع تجاري (E-commerce)\n- موقع إخباري أو مدونة\n- موقع حجز مواعيد\n\n**المميزات المطلوبة:**\n- تصميم متجاوب (Responsive)\n- لوحة تحكم\n- نظام دفع (إذا لزم الأمر)\n\nهل يمكنك إخباري بالمزيد من التفاصيل عن مشروعك؟`;
    } else if (lowerMessage.includes('تطبيق') || lowerMessage.includes('app') || lowerMessage.includes('موبايل')) {
        return `رائع! تريد تطبيق موبايل. دعني أفهم متطلباتك:\n\n**نوع التطبيق:**\n- تطبيق iOS\n- تطبيق Android\n- تطبيق متعدد المنصات\n\n**المميزات:**\n- واجهة مستخدم حديثة\n- ربط مع قاعدة بيانات\n- إشعارات Push\n\nأخبرني بالمزيد عن فكرة التطبيق؟`;
    } else {
        return `شكراً لرسالتك! أفهم أنك تريد: "${userMessage}"\n\nدعني أساعدك بشكل أفضل. يمكنك أن تخبرني:\n- نوع المشروع (موقع، تطبيق، نظام، تصميم)\n- الميزانية المتوقعة\n- الوقت المطلوب\n- المميزات الأساسية المطلوبة\n\nكلما زادت التفاصيل، كلما استطعت مساعدتك بشكل أفضل! 😊`;
    }
}

/**
 * Analyze and create request (for OpenAI response - use same smart detection)
 * تحليل وإنشاء طلب من رسالة المستخدم ورد AI (يتضمن بيانات العميل إن وجدت)
 */
function analyzeAndCreateRequest(userMessage, aiResponse) {
    if (userMessage.length < 20) return null;
    const project = detectProjectType(userMessage);
    const extra = extractBudgetAndTime(userMessage);
    const customerInfo = extractCustomerInfo(userMessage);
    const type = project ? project.type : 'طلب عام';
    const service = project ? project.service : 'General Service';
    const estimatedPrice = extra.price || (project ? project.price : 'يحدد لاحقاً');
    const estimatedTime = extra.time || (project ? project.time : 'يحدد لاحقاً');
    return createRequest({
        type,
        description: userMessage,
        service,
        estimatedPrice,
        estimatedTime,
        customerInfo: customerInfo
    });
}

/**
 * Get conversation history
 * الحصول على تاريخ المحادثة
 */
function getConversationHistory() {
    try {
        const history = JSON.parse(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY) || '[]');
        // Convert to OpenAI format
        return history.map(msg => ({
            role: msg.role,
            content: msg.content
        })).slice(-10); // Keep last 10 messages for context
    } catch (error) {
        console.error('Error loading conversation history:', error);
        return [];
    }
}

/**
 * Save to conversation history
 * حفظ في تاريخ المحادثة
 */
function saveToConversationHistory(userMessage, aiResponse) {
    try {
        const history = JSON.parse(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY) || '[]');
        
        // Add user message
        history.push({
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        });
        
        // Add AI response if available
        if (aiResponse) {
            history.push({
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date().toISOString()
            });
        }
        
        // Keep only last 50 messages
        const trimmedHistory = history.slice(-50);
        localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
        console.error('Error saving conversation history:', error);
    }
}

/**
 * Update chat badge
 * تحديث شارة المحادثة
 */
function updateChatBadge() {
    const badge = document.getElementById('chatBadge');
    if (badge) {
        const requests = getAllRequests();
        const pendingCount = requests.filter(r => r.status === 'pending').length;
        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * Create request object
 * إنشاء كائن طلب
 */
function createRequest(details) {
    return {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: details.type,
        description: details.description,
        service: details.service,
        estimatedPrice: details.estimatedPrice,
        estimatedTime: details.estimatedTime,
        status: 'pending',
        createdAt: new Date().toISOString(),
        selectedOptions: details.selectedOptions || null,
        customerInfo: details.customerInfo || {}
    };
}

/**
 * Save request to storage
 * حفظ الطلب في التخزين
 */
function saveRequest(request) {
    try {
        const requests = JSON.parse(localStorage.getItem(REQUESTS_STORAGE_KEY) || '[]');
        requests.push(request);
        localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
        return true;
    } catch (error) {
        console.error('Error saving request:', error);
        return false;
    }
}

/**
 * Add message to chat
 * إضافة رسالة للمحادثة
 */
function addMessage(sender, text) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const time = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${sender === 'user' ? 
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/></svg>' :
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>'
            }
        </div>
        <div class="message-content">
            ${formatMessage(text)}
            <div class="message-time">${time}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Save to history
    saveChatHistory();
}

/**
 * Format message text (support markdown-like formatting)
 * تنسيق نص الرسالة
 */
function formatMessage(text) {
    // Convert **text** to <strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert newlines to <br>
    text = text.replace(/\n/g, '<br>');
    
    // Convert lists
    text = text.replace(/^\- (.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    return `<p>${text}</p>`;
}

/**
 * Get customer info prompt text (when user confirmed options)
 * نص طلب بيانات العميل بعد تأكيد الاختيار
 */
function getCustomerInfoPrompt(selectedOptionsText) {
    let text = `ممتاز! اخترت: **${selectedOptionsText}**\n\n`;
    text += `لإكمال الطلب وإرساله للداشبورد، أحتاج منك:\n\n`;
    text += `- **اسمك** (أو اسم العميل)\n`;
    text += `- **اسم الشركة** (إن وجد)\n`;
    text += `- **رقم الهاتف**\n`;
    text += `- **البريد الإلكتروني** (إن وجد)\n`;
    text += `- **هل لديكم شعار أو لوجو نستخدمه في الموقع؟** (نعم/لا)\n\n`;
    text += `أرسل البيانات في رسالة واحدة وسأجهز الطلب.`;
    return text;
}

/**
 * Render options widget with checkboxes (user ticks what they want)
 * عرض ويدجت الخيارات مع صناديق اختيار
 */
function renderOptionsWidget(data) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    var options = data.options;
    if (!options || !options.length) {
        if (data.project && data.project.type) options = getProjectOptions(data.project.type);
        if (!options || !options.length) return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'chat-options-widget';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'خيارات التطوير');

    const list = document.createElement('div');
    list.className = 'chat-options-list';
    options.forEach(function (opt) {
        const label = document.createElement('label');
        label.className = 'chat-option-item';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('data-option', opt);
        const span = document.createElement('span');
        span.textContent = opt;
        label.appendChild(input);
        label.appendChild(document.createTextNode(' '));
        label.appendChild(span);
        list.appendChild(label);
    });

    const btnWrap = document.createElement('div');
    btnWrap.className = 'chat-options-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary chat-options-confirm';
    btn.textContent = 'تأكيد الاختيار';
    btnWrap.appendChild(btn);

    wrap.appendChild(list);
    wrap.appendChild(btnWrap);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;

    btn.addEventListener('click', function () {
        const checked = list.querySelectorAll('input:checked');
        const selected = Array.from(checked).map(function (c) { return c.closest('label').querySelector('span').textContent; });
        const selectedText = selected.length ? selected.join('، ') : '';

        if (!selectedText) {
            if (typeof alert !== 'undefined') alert('يرجى اختيار خيار واحد على الأقل.');
            return;
        }

        setRequestDraft({
            step: 'customer',
            project: data.project,
            selectedOptions: selectedText,
            description: data.description
        });
        addMessage('user', selectedText);
        addMessage('ai', getCustomerInfoPrompt(selectedText));
        wrap.remove();
        container.scrollTop = container.scrollHeight;
    });
}

/**
 * Show typing indicator
 * عرض مؤشر الكتابة
 */
function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
            </svg>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Remove typing indicator
 * إزالة مؤشر الكتابة
 */
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

/**
 * Show request summary
 * عرض ملخص الطلب
 */
function showRequestSummary(request) {
    const messagesContainer = document.getElementById('chatMessages');
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'message ai-message';
    summaryDiv.innerHTML = `
        <div class="message-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
            </svg>
        </div>
        <div class="message-content">
            <div class="request-summary">
                <h4>📋 ملخص الطلب</h4>
                <p><strong>النوع:</strong> ${request.type}</p>
                <p><strong>الخدمة:</strong> ${request.service}</p>
                <p><strong>التكلفة المتوقعة:</strong> ${request.estimatedPrice}</p>
                <p><strong>الوقت المتوقع:</strong> ${request.estimatedTime}</p>
                <p><strong>الوصف:</strong> ${request.description}</p>
            </div>
        </div>
    `;
    messagesContainer.appendChild(summaryDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Save chat history
 * حفظ تاريخ المحادثة
 */
function saveChatHistory() {
    try {
        const messages = Array.from(document.querySelectorAll('.message')).map(msg => {
            const sender = msg.classList.contains('user-message') ? 'user' : 'ai';
            const content = msg.querySelector('.message-content').textContent.trim();
            return { sender, content };
        });
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

/**
 * Load chat history
 * تحميل تاريخ المحادثة
 */
function loadChatHistory() {
    try {
        const messages = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
        const messagesContainer = document.getElementById('chatMessages');
        
        // Keep only the initial AI message
        messagesContainer.innerHTML = messagesContainer.querySelector('.ai-message').outerHTML;
        
        // Load saved messages (skip first AI message)
        messages.slice(1).forEach(msg => {
            addMessage(msg.sender, msg.content);
        });
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

/**
 * Clear chat
 * مسح المحادثة
 */
function clearChat() {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = `
        <div class="message ai-message">
            <div class="message-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                </svg>
            </div>
            <div class="message-content">
                <p>مرحباً! 👋 أنا مساعد AI الذكي من codespher. يمكنني مساعدتك في:</p>
                <ul>
                    <li>فهم متطلبات مشروعك</li>
                    <li>تحديد نوع الخدمة المناسبة</li>
                    <li>تقدير التكلفة والوقت</li>
                    <li>إنشاء طلب مشروع مخصص</li>
                </ul>
                <p>أخبرني عن مشروعك أو احتياجاتك وسأقوم بإنشاء طلب مفصل لك! 🚀</p>
            </div>
        </div>
    `;
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
}

/**
 * Get all requests
 * الحصول على جميع الطلبات
 */
function getAllRequests() {
    try {
        return JSON.parse(localStorage.getItem(REQUESTS_STORAGE_KEY) || '[]');
    } catch (error) {
        console.error('Error getting requests:', error);
        return [];
    }
}

/**
 * Update request status
 * تحديث حالة الطلب
 */
function updateRequestStatus(requestId, status) {
    try {
        const requests = getAllRequests();
        const index = requests.findIndex(r => r.id === requestId);
        if (index !== -1) {
            requests[index].status = status;
            requests[index].updatedAt = new Date().toISOString();
            localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error updating request:', error);
        return false;
    }
}

/**
 * Delete request
 * حذف طلب
 */
function deleteRequest(requestId) {
    try {
        const requests = getAllRequests();
        const filtered = requests.filter(r => r.id !== requestId);
        localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error deleting request:', error);
        return false;
    }
}

// Make functions available globally
window.getAllRequests = getAllRequests;
window.updateRequestStatus = updateRequestStatus;
window.deleteRequest = deleteRequest;
window.updateChatBadge = updateChatBadge;

// Initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if chat elements exist (for modal or page)
    const chatInput = document.getElementById('chatInput');
    const floatingBtn = document.getElementById('floatingChatBtn');
    
    if (chatInput || floatingBtn) {
        initChat();
    }
    
    // Update badge on page load
    updateChatBadge();
});
