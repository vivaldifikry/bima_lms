frappe.pages['section-detail'].on_page_load = function(wrapper) {
    console.log('[LMS Debug] Page Load Triggered');
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '',
        single_column: true
    });

    loadExternalLibraries();
    $(page.body).html(getPageHTML());
};

frappe.pages['section-detail'].on_page_show = function(wrapper) {
    console.log('[LMS Debug] Page Show Triggered');
    initSectionPage();
};

let isQuillLoaded = false;

function loadExternalLibraries() {
    if (!document.getElementById('tailwind-cdn')) {
        let script = document.createElement('script');
        script.id = 'tailwind-cdn';
        script.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(script);
    }

    if (!document.getElementById('quill-css')) {
        let link = document.createElement('link');
        link.id = 'quill-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css';
        document.head.appendChild(link);
    }

    if (!document.getElementById('quill-js')) {
        let script = document.createElement('script');
        script.id = 'quill-js';
        script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js';
        script.onload = function() {
            console.log('[LMS Debug] Quill JS loaded successfully');
            isQuillLoaded = true;
        };
        document.head.appendChild(script);
    } else {
        isQuillLoaded = true;
    }
}

function getPageHTML() {
    return `
        <div class="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
            <div class="max-w-7xl mx-auto space-y-6">

                <!-- Header / Breadcrumb -->
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center space-x-3 bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-100 w-fit">
                        <a href="javascript:void(0)" id="btn-back-to-course" class="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Kembali ke Detail Course">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </a>
                        <div class="h-4 w-px bg-gray-200"></div>
                        <nav class="flex items-center space-x-2 text-sm font-medium">
                            <a href="/app/lms-dashboard" class="text-gray-500 hover:text-indigo-600 transition-colors">LMS Dashboard</a>
                            <span class="text-gray-300">/</span>
                            <a href="/app/courses" class="text-gray-500 hover:text-indigo-600 transition-colors">Courses</a>
                            <span class="text-gray-300">/</span>
                            <a href="javascript:void(0)" id="breadcrumb-course" class="text-gray-500 hover:text-indigo-600 transition-colors">Course</a>
                            <span class="text-gray-300">/</span>
                            <span id="breadcrumb-section" class="text-gray-900 font-bold">Detail Bab</span>
                        </nav>
                    </div>

                    <div id="section-action-buttons-wrapper" class="hidden flex items-center space-x-3">
                        <button id="btn-section-enable-edit" type="button" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            <span>Edit</span>
                        </button>

                        <div id="section-edit-mode-actions" class="hidden flex items-center space-x-2">
                            <button id="btn-section-cancel-edit" type="button" class="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
                                Batal
                            </button>
                            <button id="btn-section-save" type="button" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                <span>Simpan Perubahan</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Loading State -->
                <div id="section-loading" class="flex items-center justify-center py-20">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    <span class="ml-3 text-gray-600 font-medium text-sm">Memuat detail bab...</span>
                </div>

                <!-- Section Content -->
                <div id="section-content" class="hidden space-y-6">
                    <!-- Section Header Info -->
                    <div id="section-info-card" class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
                        <div id="section-info-view">
                            <h1 id="section-title" class="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight"></h1>
                            <p id="section-description" class="mt-2 text-gray-600"></p>
                            <div class="mt-4 flex items-center space-x-4 text-sm text-gray-500">
                                <span id="lesson-count">0 Materi</span>
                                <span>•</span>
                                <span id="assignment-count">0 Tugas</span>
                            </div>
                        </div>

                        <div id="section-info-edit" class="hidden space-y-4">
                            <div>
                                <label for="input-section-title" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Judul Bab</label>
                                <input type="text" id="input-section-title" class="w-full px-3 py-2 text-base font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Masukkan judul bab...">
                            </div>
                            <div>
                                <label for="input-section-desc" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Deskripsi Bab</label>
                                <textarea id="input-section-desc" rows="3" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Masukkan deskripsi bab..."></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Navigation Tabs -->
                    <div class="border-b border-gray-200 bg-white rounded-xl shadow-sm px-4 pt-2">
                        <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                            <button type="button" id="tab-btn-lessons" class="tab-nav-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors border-indigo-600 text-indigo-600" data-tab="lessons">
                                <span class="flex items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                                    Daftar Materi
                                </span>
                            </button>
                            <button type="button" id="tab-btn-assignments" class="tab-nav-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="assignments">
                                <span class="flex items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    Tugas
                                </span>
                            </button>
                        </nav>
                    </div>

                    <!-- Tab Content: Lessons -->
                    <div id="tab-content-lessons" class="tab-pane space-y-4">
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                            <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                                <h2 class="text-lg font-bold text-gray-900">Daftar Materi</h2>
                                <button id="btn-add-lesson" type="button" class="hidden inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-semibold rounded-lg transition-colors">
                                    <span>+ Tambah Materi</span>
                                </button>
                            </div>
                            <div id="lessons-list" class="space-y-4"></div>
                            <div id="empty-lessons-msg" class="hidden text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <p class="text-xs text-gray-500 font-medium">Belum ada materi pada bab ini.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Tab Content: Assignments -->
                    <div id="tab-content-assignments" class="tab-pane hidden space-y-4">
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                            <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                                <h2 class="text-lg font-bold text-gray-900">Daftar Tugas</h2>
                                <button id="btn-add-assignment" type="button" class="hidden inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-semibold rounded-lg transition-colors">
                                    <span>+ Tambah Tugas</span>
                                </button>
                            </div>
                            <div id="assignments-list" class="space-y-4"></div>
                            <div id="empty-assignments-msg" class="hidden text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <p class="text-xs text-gray-500 font-medium">Belum ada tugas pada bab ini.</p>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    `;
}

// Global State
let currentSectionId = null;
let currentSectionData = null;
let isEditMode = false;
let activeTab = 'lessons';
let quillInstances = {};
let deletedLessonIds = [];
let deletedAssignmentIds = [];

function initSectionPage() {
    console.log('[LMS Debug] initSectionPage called');
    currentSectionId = null;
    
    if (frappe.route_options && frappe.route_options.id) {
        currentSectionId = frappe.route_options.id;
    }
    
    if (!currentSectionId) {
        const route = frappe.get_route();
        if (route.length > 1) {
            currentSectionId = (typeof route[1] === 'object') ? route[1].id : route[1];
        }
    }
    
    if (!currentSectionId) {
        const urlParams = new URLSearchParams(window.location.search);
        currentSectionId = urlParams.get('id');
    }

    if (!currentSectionId) {
        frappe.msgprint(__('ID Bab tidak ditemukan di URL.'));
        frappe.set_route('courses');
        return;
    }

    bindGlobalEvents();
    loadSectionDetail(currentSectionId);
}

function bindGlobalEvents() {
    console.log('[LMS Debug] Binding global events');

    // Navigation & Back Handlers
    $(document).off('click', '#btn-back-to-course').on('click', '#btn-back-to-course', function(e) {
        e.preventDefault();
        if (currentSectionData && currentSectionData.course_id) {
            frappe.set_route('course-detail', { id: currentSectionData.course_id });
        } else {
            frappe.set_route('courses');
        }
    });

    $(document).off('click', '#breadcrumb-course').on('click', '#breadcrumb-course', function(e) {
        e.preventDefault();
        if (currentSectionData && currentSectionData.course_id) {
            frappe.set_route('course-detail', { id: currentSectionData.course_id });
        } else {
            frappe.set_route('courses');
        }
    });

    // Tab Switching Handler
    $(document).off('click', '.tab-nav-btn').on('click', '.tab-nav-btn', function(e) {
        e.preventDefault();
        const tab = $(this).data('tab');
        switchTab(tab);
    });

    // Edit Mode Action Handlers
    $(document).off('click', '#btn-section-enable-edit').on('click', '#btn-section-enable-edit', function(e) {
        e.preventDefault();
        toggleEditMode(true);
    });

    $(document).off('click', '#btn-section-cancel-edit').on('click', '#btn-section-cancel-edit', function(e) {
        e.preventDefault();
        toggleEditMode(false);
    });

    $(document).off('click', '#btn-section-save').on('click', '#btn-section-save', function(e) {
        e.preventDefault();
        handleSaveSection();
    });

    $(document).off('input', '#input-section-title').on('input', '#input-section-title', function() {
        if (currentSectionData) currentSectionData.section_title = $(this).val();
    });

    $(document).off('input', '#input-section-desc').on('input', '#input-section-desc', function() {
        if (currentSectionData) currentSectionData.description = $(this).val();
    });

    // Accordion Toggle Handler (Universal for Lessons & Assignments)
    $(document).off('click', '.section-accordion-toggle').on('click', '.section-accordion-toggle', function() {
        const $toggle = $(this);
        const expanded = $toggle.attr('aria-expanded') === 'true';
        $toggle.attr('aria-expanded', String(!expanded));
        $toggle.next('.section-accordion-content').toggleClass('grid-rows-[0fr]', expanded).toggleClass('grid-rows-[1fr]', !expanded);
        $toggle.find('.section-accordion-icon').toggleClass('rotate-180', !expanded);
    });

    // Swap Order Handlers - Lessons
    $(document).off('click', '.btn-move-lesson-up').on('click', '.btn-move-lesson-up', function() {
        const idx = Number($(this).closest('.lesson-edit-card').data('lesson-index'));
        if (idx > 0) {
            animateListSwap($(this).closest('.lesson-edit-card'), idx, idx - 1, '.lesson-edit-card', function() {
                swapArrayElements(currentSectionData.lessons, idx, idx - 1);
                renderLessonsList();
            });
        }
    });

    $(document).off('click', '.btn-move-lesson-down').on('click', '.btn-move-lesson-down', function() {
        const idx = Number($(this).closest('.lesson-edit-card').data('lesson-index'));
        if (idx < currentSectionData.lessons.length - 1) {
            animateListSwap($(this).closest('.lesson-edit-card'), idx, idx + 1, '.lesson-edit-card', function() {
                swapArrayElements(currentSectionData.lessons, idx, idx + 1);
                renderLessonsList();
            });
        }
    });

    // Swap Order Handlers - Assignments
    $(document).off('click', '.btn-move-assignment-up').on('click', '.btn-move-assignment-up', function() {
        const idx = Number($(this).closest('.assignment-edit-card').data('assignment-index'));
        if (idx > 0) {
            animateListSwap($(this).closest('.assignment-edit-card'), idx, idx - 1, '.assignment-edit-card', function() {
                swapArrayElements(currentSectionData.assignments, idx, idx - 1);
                renderAssignmentsList();
            });
        }
    });

    $(document).off('click', '.btn-move-assignment-down').on('click', '.btn-move-assignment-down', function() {
        const idx = Number($(this).closest('.assignment-edit-card').data('assignment-index'));
        if (idx < currentSectionData.assignments.length - 1) {
            animateListSwap($(this).closest('.assignment-edit-card'), idx, idx + 1, '.assignment-edit-card', function() {
                swapArrayElements(currentSectionData.assignments, idx, idx + 1);
                renderAssignmentsList();
            });
        }
    });

    // Lesson Edit Controls
    $(document).off('click', '#btn-add-lesson').on('click', '#btn-add-lesson', function() {
        currentSectionData.lessons = currentSectionData.lessons || [];
        currentSectionData.lessons.push({
            lesson_id: null,
            lesson_title: 'Materi Baru',
            lesson_type: 'ARTICLE',
            article_content: '',
            pdf_attachment_url: '',
            video_url: ''
        });
        renderLessonsList();
    });

    $(document).off('click', '.btn-delete-lesson').on('click', '.btn-delete-lesson', function() {
        const index = Number($(this).closest('.lesson-edit-card').data('lesson-index'));
        const lesson = currentSectionData.lessons[index];
        frappe.confirm(__('Apakah Anda yakin ingin menghapus materi "{0}"?', [lesson.lesson_title || __('Materi ini')]), function() {
            if (lesson.lesson_id) deletedLessonIds.push(lesson.lesson_id);
            currentSectionData.lessons.splice(index, 1);
            renderLessonsList();
        });
    });

    // Assignment Edit Controls
    $(document).off('click', '#btn-add-assignment').on('click', '#btn-add-assignment', function() {
        currentSectionData.assignments = currentSectionData.assignments || [];
        currentSectionData.assignments.push({
            assignment_id: null,
            title: 'Tugas Baru',
            instructions: '',
            attachment_url: '',
            deadline: '',
            max_score: 100
        });
        renderAssignmentsList();
    });

    $(document).off('click', '.btn-delete-assignment').on('click', '.btn-delete-assignment', function() {
        const index = Number($(this).closest('.assignment-edit-card').data('assignment-index'));
        const assignment = currentSectionData.assignments[index];
        frappe.confirm(__('Apakah Anda yakin ingin menghapus tugas "{0}"?', [assignment.title || __('Tugas ini')]), function() {
            if (assignment.assignment_id) deletedAssignmentIds.push(assignment.assignment_id);
            currentSectionData.assignments.splice(index, 1);
            renderAssignmentsList();
        });
    });

    // Submit Assignment Handler
    $(document).off('submit', '.form-submit-assignment').on('submit', '.form-submit-assignment', function(e) {
        e.preventDefault();
        const $input = $(this).find('.input-assignment-response');
        const value = $input.val().trim();
        if (!value) {
            frappe.msgprint(__('Silahkan masukkan jawaban/link terlebih dahulu.'));
            return;
        }
        frappe.show_alert({ message: __('Jawaban berhasil dikirim'), indicator: 'green' });
        $input.val('');
    });
}

function swapArrayElements(arr, i, j) {
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
}

function animateListSwap($card, index, targetIndex, cardSelector, onComplete) {
    const $cards = $(`#lessons-list ${cardSelector}, #assignments-list ${cardSelector}`);
    const $targetCard = $cards.eq(targetIndex);
    if (!$card.length || !$targetCard.length || $card.is(':animated')) return;

    const distance = Math.abs($targetCard.offset().top - $card.offset().top);
    const direction = targetIndex > index ? 1 : -1;
    const duration = 300;

    $card.add($targetCard).css({
        position: 'relative',
        zIndex: 10,
        transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
    });
    $card.css('transform', `translateY(${direction * distance}px)`);
    $targetCard.css('transform', `translateY(${-direction * distance}px)`);

    setTimeout(function() {
        $card.add($targetCard).css({
            transition: 'none',
            transform: '',
            position: '',
            zIndex: ''
        });
        onComplete();
    }, duration);
}

function switchTab(tabName) {
    activeTab = tabName;
    $('.tab-nav-btn').removeClass('border-indigo-600 text-indigo-600').addClass('border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300');
    $(`.tab-nav-btn[data-tab="${tabName}"]`).removeClass('border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300').addClass('border-indigo-600 text-indigo-600');

    $('.tab-pane').addClass('hidden');
    $(`#tab-content-${tabName}`).removeClass('hidden');
}

function loadSectionDetail(section_id) {
    console.log('[LMS Debug] Loading section detail for ID:', section_id);
    $('#section-loading').removeClass('hidden');
    $('#section-content').addClass('hidden');
    $('#section-action-buttons-wrapper').addClass('hidden');

    frappe.call({
        method: 'bima_lms.api.section_details.get_section_detail',
        args: { section_id: section_id },
        callback: function(r) {
            console.log('[LMS Debug] API Response received', r.message);
            $('#section-loading').addClass('hidden');
            if (r.message) {
                currentSectionData = r.message;
                deletedLessonIds = [];
                deletedAssignmentIds = [];
                isEditMode = false;
                renderPage();
                $('#section-content').removeClass('hidden');
                $('#section-action-buttons-wrapper').removeClass('hidden');
            }
        }
    });
}

function renderPage() {
    const data = currentSectionData;
    if (!data) return;

    if (data.course_title) $('#breadcrumb-course').text(data.course_title);
    $('#section-title').text(data.section_title);
    $('#section-description').text(data.description || 'Tidak ada deskripsi.');
    $('#lesson-count').text(`${data.lessons ? data.lessons.length : 0} Materi`);
    $('#assignment-count').text(`${data.assignments ? data.assignments.length : 0} Tugas`);
    $('#breadcrumb-section').text(data.section_title);

    if (isEditMode) {
        $('#btn-section-enable-edit').addClass('hidden');
        $('#section-edit-mode-actions').removeClass('hidden');
        $('#btn-add-lesson, #btn-add-assignment').removeClass('hidden');
        
        $('#section-info-view').addClass('hidden');
        $('#section-info-edit').removeClass('hidden');
        
        $('#input-section-title').val(data.section_title);
        $('#input-section-desc').val(data.description);
    } else {
        $('#btn-section-enable-edit').removeClass('hidden');
        $('#section-edit-mode-actions').addClass('hidden');
        $('#btn-add-lesson, #btn-add-assignment').addClass('hidden');

        $('#section-info-view').removeClass('hidden');
        $('#section-info-edit').addClass('hidden');
    }

    renderLessonsList();
    renderAssignmentsList();
}

function renderLessonsList() {
    const $container = $('#lessons-list').empty();
    
    // Cleanup instance Quill lama
    Object.keys(quillInstances).forEach(key => {
        delete quillInstances[key];
    });

    const lessons = currentSectionData.lessons || [];
    $('#empty-lessons-msg').toggleClass('hidden', lessons.length !== 0);
    if (!lessons.length) return;

    lessons.forEach((lesson, index) => {
        const types = getLessonTypes(lesson.lesson_type);
        const typeBadges = types.map(type => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLessonTypeColor(type)}">${getLessonTypeLabel(type)}</span>`).join(' ');

        // MODE VIEW
        if (!isEditMode) {
            $container.append(`
                <div class="lesson-accordion border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
                    <button type="button" class="section-accordion-toggle w-full flex items-center justify-between py-3 px-5 text-left hover:bg-gray-50 transition-colors" aria-expanded="false">
                        <span class="flex items-center gap-3 min-w-0">
                            <span class="flex items-center justify-center w-7 h-7 bg-gray-100 text-gray-700 font-bold text-xs rounded-lg flex-shrink-0">${index + 1}</span>
                            <span class="min-w-0"><strong class="block text-base text-gray-900 truncate">${escapeHtml(lesson.lesson_title)}</strong><span class="flex flex-wrap gap-1 mt-1">${typeBadges}</span></span>
                        </span>
                        <svg class="section-accordion-icon w-5 h-5 text-gray-400 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div class="section-accordion-content grid transition-[grid-template-rows] duration-300 ease-out grid-rows-[0fr]">
                        <div class="overflow-hidden"><div class="p-5 pt-0">${renderLessonViewBody(lesson)}</div></div>
                    </div>
                </div>
            `);
        } else {
            // MODE EDIT (Termasuk Tombol Swap Up/Down)
            const inputIdTitle = `lesson_title_${index}`;
            const inputIds = { inputIdArticle: `article_editor_${index}`, inputIdPdf: `pdf_url_${index}`, inputIdVideo: `video_url_${index}` };
            
            $container.append(`
                <div class="lesson-edit-card border-2 border-indigo-200 bg-white rounded-xl p-5 space-y-4 shadow-sm" data-lesson-index="${index}">
                    <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                        <span class="bg-indigo-100 text-indigo-700 font-bold text-xs px-2.5 py-1 rounded-md">Materi #${index + 1}</span>
                        <div class="flex items-center space-x-1">
                            <button type="button" class="btn-move-lesson-up p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors ${index === 0 ? 'hidden' : ''}" title="Pindah ke Atas">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                            </button>
                            <button type="button" class="btn-move-lesson-down p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors ${index === lessons.length - 1 ? 'hidden' : ''}" title="Pindah ke Bawah">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <button type="button" class="btn-delete-lesson p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors ml-1" title="Hapus materi">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-3 text-xs text-gray-700">
                        ${['ARTICLE', 'PDF', 'VIDEO'].map(type => `<label class="inline-flex items-center gap-1.5"><input type="checkbox" class="lesson-type-checkbox" value="${type}" ${types.includes(type) ? 'checked' : ''}>${getLessonTypeLabel(type)}</label>`).join('')}
                    </div>
                    <div>
                        <label for="${inputIdTitle}" class="block text-xs font-semibold text-gray-700 mb-1">Judul Materi</label>
                        <input type="text" id="${inputIdTitle}" class="w-full px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg" value="${escapeHtml(lesson.lesson_title)}" placeholder="Masukkan judul materi...">
                    </div>
                    <div class="lesson-edit-fields">${renderLessonEditBody(lesson, index, inputIds)}</div>
                </div>
            `);
            bindLessonEditInputs(index, inputIds);
        }
    });
}

function renderAssignmentsList() {
    const $container = $('#assignments-list').empty();
    const assignments = currentSectionData.assignments || [];

    $('#empty-assignments-msg').toggleClass('hidden', assignments.length !== 0);
    if (!assignments.length) return;

    assignments.forEach((assignment, index) => {
        // MODE VIEW
        if (!isEditMode) {
            $container.append(`
                <div class="assignment-accordion border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
                    <button type="button" class="section-accordion-toggle w-full flex items-center justify-between py-3 px-5 text-left hover:bg-gray-50 transition-colors" aria-expanded="false">
                        <span class="flex items-center gap-3 min-w-0">
                            <span class="flex items-center justify-center w-7 h-7 bg-amber-100 text-amber-800 font-bold text-xs rounded-lg flex-shrink-0">${index + 1}</span>
                            <span class="min-w-0">
                                <strong class="block text-base text-gray-900 truncate">${escapeHtml(assignment.title)}</strong>
                                <span class="text-xs text-gray-500">Deadline: ${assignment.deadline ? formatDate(assignment.deadline) : 'Tidak ada deadline'} • Nilai Maks: ${assignment.max_score || 100}</span>
                            </span>
                        </span>
                        <svg class="section-accordion-icon w-5 h-5 text-gray-400 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div class="section-accordion-content grid transition-[grid-template-rows] duration-300 ease-out grid-rows-[0fr]">
                        <div class="overflow-hidden">
                            <div class="p-5 pt-0 space-y-4">
                                <div class="prose prose-sm max-w-none text-gray-700">
                                    <p class="whitespace-pre-line">${escapeHtml(assignment.instructions) || '<span class="italic text-gray-400">Tidak ada instruksi khusus.</span>'}</p>
                                </div>
                                ${assignment.attachment_url ? `
                                    <div>
                                        <a href="${escapeHtml(assignment.attachment_url)}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                                            Lampiran Tugas
                                        </a>
                                    </div>
                                ` : ''}
                                
                                <form class="form-submit-assignment border-t border-gray-100 pt-4 space-y-3">
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">Jawaban / Link Tugas Anda</label>
                                    <div class="flex gap-2">
                                        <input type="text" class="input-assignment-response flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Masukkan teks jawaban atau link Google Drive/Github...">
                                        <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0">
                                            Kirim Tugas
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        } else {
            // MODE EDIT (Termasuk Tombol Swap Up/Down)
            $container.append(`
                <div class="assignment-edit-card border-2 border-amber-200 bg-white rounded-xl p-5 space-y-4 shadow-sm" data-assignment-index="${index}">
                    <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                        <span class="bg-amber-100 text-amber-800 font-bold text-xs px-2.5 py-1 rounded-md">Tugas #${index + 1}</span>
                        <div class="flex items-center space-x-1">
                            <button type="button" class="btn-move-assignment-up p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors ${index === 0 ? 'hidden' : ''}" title="Pindah ke Atas">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                            </button>
                            <button type="button" class="btn-move-assignment-down p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors ${index === assignments.length - 1 ? 'hidden' : ''}" title="Pindah ke Bawah">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <button type="button" class="btn-delete-assignment p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors ml-1" title="Hapus tugas">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="block text-xs font-semibold text-gray-700 mb-1">Judul Tugas</label>
                            <input type="text" class="input-assignment-title w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${escapeHtml(assignment.title)}" placeholder="Judul tugas...">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-xs font-semibold text-gray-700 mb-1">Instruksi Tugas</label>
                            <textarea rows="3" class="input-assignment-instructions w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Instruksi pengerjaan tugas...">${escapeHtml(assignment.instructions || '')}</textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-700 mb-1">URL Lampiran (Opsional)</label>
                            <input type="url" class="input-assignment-attachment w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${escapeHtml(assignment.attachment_url || '')}" placeholder="https://...">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1">Deadline</label>
                                <input type="datetime-local" class="input-assignment-deadline w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${formatDatetimeInput(assignment.deadline)}">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1">Nilai Maksimal</label>
                                <input type="number" class="input-assignment-max-score w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${assignment.max_score || 100}">
                            </div>
                        </div>
                    </div>
                </div>
            `);
            bindAssignmentEditInputs(index);
        }
    });
}

function bindLessonEditInputs(index, inputIds) {
    const $card = $(`.lesson-edit-card[data-lesson-index="${index}"]`);
    const lesson = currentSectionData.lessons[index];
    $card.find(`#lesson_title_${index}`).on('input', function() { lesson.lesson_title = $(this).val(); });
    
    $card.find('.lesson-type-checkbox').off('change').on('change', function() {
        const selected = $card.find('.lesson-type-checkbox:checked').map(function() { return this.value; }).get();
        if (!selected.length) {
            this.checked = true;
            frappe.msgprint(__('Pilih minimal satu tipe materi.'));
            return;
        }

        // Clean up previous Quill instance to prevent UI duplicates
        if (quillInstances[index]) {
            delete quillInstances[index];
        }

        lesson.lesson_type = selected.join(', ');
        $card.find('.lesson-edit-fields').html(renderLessonEditBody(lesson, index, inputIds));
        bindLessonEditInputs(index, inputIds);
    });

    $card.find(`#${inputIds.inputIdArticle}`).on('input', function() { lesson.article_content = $(this).val(); });
    $card.find(`#${inputIds.inputIdPdf}`).on('input', function() { lesson.pdf_attachment_url = $(this).val(); });
    $card.find(`#${inputIds.inputIdVideo}`).on('input', function() { lesson.video_url = $(this).val(); });
    if (getLessonTypes(lesson.lesson_type).includes('ARTICLE') && window.Quill) initRichTextEditor(inputIds.inputIdArticle, index);
}

function bindAssignmentEditInputs(index) {
    const $card = $(`.assignment-edit-card[data-assignment-index="${index}"]`);
    const assignment = currentSectionData.assignments[index];
    
    $card.find('.input-assignment-title').on('input', function() { assignment.title = $(this).val(); });
    $card.find('.input-assignment-instructions').on('input', function() { assignment.instructions = $(this).val(); });
    $card.find('.input-assignment-attachment').on('input', function() { assignment.attachment_url = $(this).val(); });
    $card.find('.input-assignment-deadline').on('change', function() { assignment.deadline = $(this).val(); });
    $card.find('.input-assignment-max-score').on('input', function() { assignment.max_score = $(this).val(); });
}

function initRichTextEditor(editorId, index) {
    setTimeout(() => {
        try {
            const $el = $(`#${editorId}`);
            if (window.Quill && $el.length) {
                // Remove existing toolbar element if present before re-initializing
                $el.siblings('.ql-toolbar').remove();

                const quill = new Quill(`#${editorId}`, {
                    theme: 'snow',
                    placeholder: 'Tulis konten artikel di sini...',
                    modules: {
                        toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link', 'clean']
                        ]
                    }
                });

                quill.on('text-change', function() {
                    if (currentSectionData.lessons[index]) {
                        currentSectionData.lessons[index].article_content = quill.root.innerHTML;
                    }
                });

                quillInstances[index] = quill;
            }
        } catch (err) {
            console.error('[LMS Debug] Error initializing Quill Editor:', err);
        }
    }, 100);
}

function renderLessonViewBody(lesson) {
    const types = getLessonTypes(lesson.lesson_type);
    return types.map(type => {
        if (type === 'ARTICLE') return `<div class="prose prose-sm max-w-none text-gray-700 mb-4">${lesson.article_content || '<p class="text-gray-400 italic">Belum ada konten artikel.</p>'}</div>`;
        if (type === 'PDF') return lesson.pdf_attachment_url
            ? `<a href="${escapeHtml(lesson.pdf_attachment_url)}" target="_blank" class="inline-flex items-center text-sm text-indigo-600 hover:underline font-medium mb-4">Buka PDF</a>`
            : `<p class="text-gray-400 italic mb-4">Belum ada URL PDF.</p>`;
        const embedUrl = lesson.embed_video_url || lesson.video_url;
        return embedUrl
            ? `<div class="aspect-video w-full"><iframe class="w-full h-full rounded-lg shadow-sm" src="${escapeHtml(embedUrl)}" frameborder="0" allowfullscreen></iframe></div>`
            : `<p class="text-gray-400 italic">Belum ada URL Video.</p>`;
    }).join('');
}

function renderLessonEditBody(lesson, index, ids) {
    const types = getLessonTypes(lesson.lesson_type);
    const fields = [];
    if (types.includes('ARTICLE')) fields.push(window.Quill ? `
        <div class="space-y-2"><label for="${ids.inputIdArticle}" class="text-xs font-semibold text-gray-700">Konten Artikel (Rich Text)</label>
        <div id="${ids.inputIdArticle}" class="bg-white rounded-lg min-h-[180px]">${lesson.article_content || ''}</div></div>` : `
        <div class="space-y-2"><label for="${ids.inputIdArticle}" class="text-xs font-semibold text-gray-700">Konten Artikel</label>
        <textarea id="${ids.inputIdArticle}" rows="6" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Tulis artikel...">${escapeHtml(lesson.article_content || '')}</textarea></div>`);
    if (types.includes('PDF')) fields.push(`<div class="space-y-2"><label for="${ids.inputIdPdf}" class="text-xs font-semibold text-gray-700">URL PDF Attachment</label>
        <input type="url" id="${ids.inputIdPdf}" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${escapeHtml(lesson.pdf_attachment_url || '')}" placeholder="https://example.com/file.pdf"></div>`);
    if (types.includes('VIDEO')) fields.push(`<div class="space-y-2"><label for="${ids.inputIdVideo}" class="text-xs font-semibold text-gray-700">URL Video (YouTube / Vimeo)</label>
        <input type="url" id="${ids.inputIdVideo}" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${escapeHtml(lesson.video_url || '')}" placeholder="https://www.youtube.com/watch?v=..."></div>`);
    return fields.join('');
}

function getLessonTypes(value) {
    const types = String(value || 'ARTICLE').split(',').map(type => type.trim().toUpperCase());
    return ['ARTICLE', 'PDF', 'VIDEO'].filter(type => types.includes(type));
}

function toggleEditMode(enableEdit) {
    isEditMode = enableEdit;
    if (!enableEdit) {
        loadSectionDetail(currentSectionId);
        return;
    }
    renderPage();
}

function handleSaveSection() {
    frappe.confirm(__('Simpan semua perubahan pada bab, materi, dan tugas ini?'), function() {
        frappe.call({
            method: 'bima_lms.api.section_details.batch_save_section_detail',
            args: {
                section_id: currentSectionId,
                section_title: currentSectionData.section_title,
                description: currentSectionData.description,
                lessons: JSON.stringify(currentSectionData.lessons || []),
                deleted_lesson_ids: JSON.stringify(deletedLessonIds),
                assignments: JSON.stringify(currentSectionData.assignments || []),
                deleted_assignment_ids: JSON.stringify(deletedAssignmentIds)
            },
            freeze: true,
            freeze_message: __('Menyimpan perubahan...'),
            callback: function(r) {
                if (r.message && r.message.status === 'success') {
                    frappe.show_alert({ message: __('Perubahan berhasil disimpan'), indicator: 'green' });
                    loadSectionDetail(currentSectionId);
                }
            }
        });
    });
}

function getLessonTypeLabel(type) {
    const types = { 'ARTICLE': 'Artikel', 'PDF': 'PDF', 'VIDEO': 'Video' };
    return types[type] || type;
}

function getLessonTypeColor(type) {
    const colors = {
        'ARTICLE': 'bg-blue-100 text-blue-700',
        'PDF': 'bg-red-100 text-red-700',
        'VIDEO': 'bg-purple-100 text-purple-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDatetimeInput(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 16);
}