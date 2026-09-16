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
                                <span>•</span>
                                <span id="quiz-count">0 Quiz</span>
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
                                    Materi
                                </span>
                            </button>
                            <button type="button" id="tab-btn-assignments" class="tab-nav-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="assignments">
                                <span class="flex items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    Tugas
                                </span>
                            </button>
                            <button type="button" id="tab-btn-quizzes" class="tab-nav-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="quizzes">
                                <span class="flex items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-1 0a2 2 0 11-4 0m1 4h4m-4 4h4m-4 4h2"></path></svg>
                                    Quiz
                                </span>
                            </button>
                        </nav>
                    </div>

                    <!-- Tab Content: Lessons -->
                    <div id="tab-content-lessons" class="tab-pane space-y-4">
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                            <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                                <div>
                                    <h2 class="text-lg font-bold text-gray-900">Daftar Materi</h2>
                                    <p class="mt-1 text-sm text-gray-500">Pilih materi untuk melihat dan mempelajari konten.</p>
                                </div>
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
                                <div>
                                    <h2 class="text-lg font-bold text-gray-900">Daftar Tugas</h2>
                                    <p class="mt-1 text-sm text-gray-500">Pilih tugas untuk mengerjakan soal.</p>
                                </div>
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

                    <!-- Tab Content: Quizzes -->
                    <div id="tab-content-quizzes" class="tab-pane hidden space-y-4">
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                            <div class="border-b border-gray-100 pb-4">
                                <div class="flex items-center justify-between gap-4">
                                    <div>
                                        <h2 class="text-lg font-bold text-gray-900">Daftar Quiz</h2>
                                        <p class="text-sm text-gray-500 mt-1">Pilih quiz untuk melihat dan mengerjakan soal.</p>
                                    </div>
                                    <button id="btn-add-quiz" type="button" class="hidden inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-semibold rounded-lg transition-colors">
                                        <span>+ Tambah Quiz</span>
                                    </button>
                                </div>
                            </div>
                            <div id="quizzes-list" class="space-y-3"></div>
                            <div id="empty-quizzes-msg" class="hidden text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <p class="text-xs text-gray-500 font-medium">Belum ada quiz pada bab ini.</p>
                            </div>
                        </div>
                    </div>

                </div>

                <div id="quiz-modal" class="hidden fixed inset-0 z-[100] bg-gray-900/70 p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="quiz-modal-title">
                    <div class="mx-auto flex h-full max-w-5xl items-center justify-center">
                        <div class="flex h-[min(760px,calc(100vh-2rem))] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                            <div class="border-b border-gray-200 px-6 py-5">
                                <div class="flex items-center justify-between gap-4">
                                    <div class="min-w-0"><h2 id="quiz-modal-title" class="text-xl font-bold text-gray-900"></h2><p id="quiz-modal-meta" class="mt-1 text-sm text-gray-500"></p></div>
                                    <div class="flex flex-shrink-0 items-center gap-2">
                                        <span id="quiz-timer" class="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700"></span>
                                        <button id="btn-quiz-edit" type="button" class="hidden rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Edit</button>
                                        <button id="btn-quiz-cancel-edit" type="button" class="hidden rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                                        <button id="btn-quiz-save-edit" type="button" class="hidden rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">Simpan</button>
                                    </div>
                                </div>
                                <div class="mt-4 h-2 overflow-hidden rounded-full bg-gray-100"><div id="quiz-progress" class="h-full bg-indigo-600 transition-all"></div></div>
                            </div>
                            <div class="min-h-0 flex-1 grid grid-cols-1 gap-6 overflow-hidden px-6 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
                                <aside id="quiz-question-nav" class="order-2 h-full min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 lg:order-1">
                                    <h3 id="quiz-nav-title" class="text-sm font-bold text-gray-800">Navigasi Soal</h3>
                                    <div id="quiz-question-buttons" class="mt-3 grid grid-cols-5 gap-2 pr-1"></div>
                                </aside>
                                <div id="quiz-question-view" class="order-1 min-h-0 overflow-y-auto px-0 lg:order-2"></div>
                            </div>
                            <div class="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                                <div id="quiz-footer-left">
                                    <button id="btn-quiz-previous" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">Sebelumnya</button>
                                </div>
                                <div id="quiz-footer-right" class="flex items-center gap-2">
                                    <button id="btn-quiz-next" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Berikutnya</button>
                                    <button id="btn-quiz-submit" type="button" class="hidden rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Submit Quiz</button>
                                    <button id="btn-quiz-close" type="button" class="hidden rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Tutup</button>
                                </div>
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
let deletedQuizIds = [];
let activeQuiz = null;
let activeQuizQuestionIndex = 0;
let activeQuizAnswers = {};
let quizTimer = null;
let quizDeadline = null;
let quizCanAnswer = false;
let quizResultVisible = false;
let quizEditMode = false;
let quizEditDeletedQuestionIds = [];
let quizEditDeletedOptionIds = [];
let quizEditOriginalQuestions = [];
let quizDragQuestionIndex = null;

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
        navigateToCourseDetail();
    });

    $(document).off('click', '#breadcrumb-course').on('click', '#breadcrumb-course', function(e) {
        e.preventDefault();
        navigateToCourseDetail();
    });

    // Tab Switching Handler
    $(document).off('click', '.tab-nav-btn').on('click', '.tab-nav-btn', function(e) {
        e.preventDefault();
        const tab = $(this).data('tab');
        switchTab(tab);
    });

    $(document).off('click', '.btn-open-quiz').on('click', '.btn-open-quiz', function() {
        openQuiz(Number($(this).data('quiz-index')));
    });
    $(document).off('click', '#btn-quiz-edit').on('click', '#btn-quiz-edit', enterQuizEditMode);
    $(document).off('click', '#btn-quiz-save-edit').on('click', '#btn-quiz-save-edit', saveQuizEdit);
    $(document).off('click', '#btn-quiz-cancel-edit').on('click', '#btn-quiz-cancel-edit', cancelQuizEdit);
    $(document).off('click', '#btn-add-quiz-question').on('click', '#btn-add-quiz-question', addQuizQuestion);
    $(document).off('click', '.btn-delete-quiz-question').on('click', '.btn-delete-quiz-question', deleteQuizQuestion);
    $(document).off('click', '.btn-add-quiz-option').on('click', '.btn-add-quiz-option', function() {
        const question = activeQuiz.questions[Number($(this).closest('.quiz-edit-question-card').data('question-index'))];
        question.options.push({ option_id: null, option_text: 'Pilihan Baru', is_correct: false });
        renderQuizQuestion();
    });
    $(document).off('click', '.btn-delete-quiz-option').on('click', '.btn-delete-quiz-option', function() {
        const question = activeQuiz.questions[Number($(this).closest('.quiz-edit-question-card').data('question-index'))];
        const optionIndex = Number($(this).data('option-index'));
        const option = question.options[optionIndex];
        if (option.is_correct) {
            frappe.msgprint(__('Kunci jawaban tidak dapat dihapus. Ganti kunci jawaban terlebih dahulu.'));
            return;
        }
        if (option.option_id) quizEditDeletedOptionIds.push(option.option_id);
        question.options.splice(optionIndex, 1);
        renderQuizQuestion();
    });
    $(document).off('change', '.quiz-edit-correct-option').on('change', '.quiz-edit-correct-option', function() {
        const question = activeQuiz.questions[Number($(this).closest('.quiz-edit-question-card').data('question-index'))];
        question.options.forEach((option, index) => { option.is_correct = index === Number($(this).data('option-index')); });
        renderQuizQuestion();
    });
    $(document).off('input', '.quiz-edit-question-text').on('input', '.quiz-edit-question-text', function() {
        activeQuiz.questions[Number($(this).closest('.quiz-edit-question-card').data('question-index'))].question_text = $(this).val();
    });
    $(document).off('input', '.quiz-edit-points').on('input', '.quiz-edit-points', function() {
        const value = Math.max(1, Number($(this).val()) || 1);
        $(this).val(value);
        activeQuiz.questions[Number($(this).closest('.quiz-edit-question-card').data('question-index'))].points = value;
    });
    $(document).off('input', '.quiz-edit-option-text').on('input', '.quiz-edit-option-text', function() {
        const card = $(this).closest('.quiz-edit-question-card');
        activeQuiz.questions[Number(card.data('question-index'))].options[Number($(this).data('option-index'))].option_text = $(this).val();
    });
    $(document).off('dragstart', '.btn-quiz-question').on('dragstart', '.btn-quiz-question', function(event) {
        if (!quizEditMode) return;
        quizDragQuestionIndex = Number($(this).data('question-index'));
        event.originalEvent.dataTransfer.effectAllowed = 'move';
    });
    $(document).off('dragover', '.btn-quiz-question').on('dragover', '.btn-quiz-question', function(event) {
        if (quizEditMode) event.preventDefault();
    });
    $(document).off('drop', '.btn-quiz-question').on('drop', '.btn-quiz-question', function(event) {
        if (!quizEditMode) return;
        event.preventDefault();
        const targetIndex = Number($(this).data('question-index'));
        if (quizDragQuestionIndex === null || quizDragQuestionIndex === targetIndex) return;
        const moved = activeQuiz.questions.splice(quizDragQuestionIndex, 1)[0];
        activeQuiz.questions.splice(targetIndex, 0, moved);
        activeQuizQuestionIndex = targetIndex;
        quizDragQuestionIndex = null;
        renderQuizQuestion();
    });

    $(document).off('change', '.quiz-option-input').on('change', '.quiz-option-input', function() {
        activeQuizAnswers[activeQuizQuestionIndex] = Number($(this).val());
        renderQuizQuestion();
    });

    $(document).off('click', '#btn-quiz-previous').on('click', '#btn-quiz-previous', function() {
        if (activeQuizQuestionIndex > 0) {
            activeQuizQuestionIndex--;
            renderQuizQuestion();
        }
    });

    $(document).off('click', '#btn-quiz-next').on('click', '#btn-quiz-next', function() {
        if (activeQuizQuestionIndex < activeQuiz.questions.length - 1) {
            activeQuizQuestionIndex++;
            renderQuizQuestion();
        }
    });

    $(document).off('click', '#btn-quiz-submit').on('click', '#btn-quiz-submit', function() {
        frappe.confirm(__('Apakah Anda yakin ingin submit quiz ini? Setelah submit, jawaban tidak dapat diubah.'), function() {
            submitQuizLocally(false);
        });
    });
    $(document).off('click', '#btn-quiz-close').on('click', '#btn-quiz-close', closeQuizModal);
    $(document).off('click', '.btn-quiz-question').on('click', '.btn-quiz-question', function() {
        activeQuizQuestionIndex = Number($(this).data('question-index'));
        renderQuizQuestion();
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

    $(document).off('click', '.btn-move-quiz-up').on('click', '.btn-move-quiz-up', function() {
        const idx = Number($(this).closest('.quiz-edit-card').data('quiz-index'));
        if (idx > 0) {
            animateListSwap($(this).closest('.quiz-edit-card'), idx, idx - 1, '.quiz-edit-card', function() {
                swapArrayElements(currentSectionData.quizzes, idx, idx - 1);
                renderQuizzesList();
            });
        }
    });

    $(document).off('click', '.btn-move-quiz-down').on('click', '.btn-move-quiz-down', function() {
        const idx = Number($(this).closest('.quiz-edit-card').data('quiz-index'));
        if (idx < currentSectionData.quizzes.length - 1) {
            animateListSwap($(this).closest('.quiz-edit-card'), idx, idx + 1, '.quiz-edit-card', function() {
                swapArrayElements(currentSectionData.quizzes, idx, idx + 1);
                renderQuizzesList();
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

    $(document).off('click', '#btn-add-quiz').on('click', '#btn-add-quiz', function() {
        currentSectionData.quizzes = currentSectionData.quizzes || [];
        currentSectionData.quizzes.push({
            quiz_id: null,
            quiz_title: 'Quiz Baru',
            duration_minutes: 1,
            passing_grade: 1,
            max_attempts_allowed: 1,
            questions: [],
            attempt_count: 0
        });
        renderQuizzesList();
    });

    $(document).off('click', '.btn-delete-quiz').on('click', '.btn-delete-quiz', function() {
        const index = Number($(this).closest('.quiz-edit-card').data('quiz-index'));
        const quiz = currentSectionData.quizzes[index];
        frappe.confirm(__('Apakah Anda yakin ingin menghapus quiz "{0}"?', [quiz.quiz_title || __('Quiz ini')]), function() {
            if (quiz.quiz_id) deletedQuizIds.push(quiz.quiz_id);
            currentSectionData.quizzes.splice(index, 1);
            renderQuizzesList();
        });
    });

    $(document).off('input', '.input-quiz-title').on('input', '.input-quiz-title', function() {
        const quiz = currentSectionData.quizzes[Number($(this).closest('.quiz-edit-card').data('quiz-index'))];
        quiz.quiz_title = $(this).val();
    });
    $(document).off('input', '.input-quiz-duration').on('input', '.input-quiz-duration', function() {
        const quiz = currentSectionData.quizzes[Number($(this).closest('.quiz-edit-card').data('quiz-index'))];
        quiz.duration_minutes = Math.max(1, Number($(this).val()) || 1);
    });
    $(document).off('input', '.input-quiz-passing-grade').on('input', '.input-quiz-passing-grade', function() {
        const quiz = currentSectionData.quizzes[Number($(this).closest('.quiz-edit-card').data('quiz-index'))];
        quiz.passing_grade = Math.max(1, Number($(this).val()) || 1);
    });
    $(document).off('input', '.input-quiz-max-attempts').on('input', '.input-quiz-max-attempts', function() {
        const quiz = currentSectionData.quizzes[Number($(this).closest('.quiz-edit-card').data('quiz-index'))];
        quiz.max_attempts_allowed = Math.max(1, Number($(this).val()) || 1);
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

    $(document).off('click', '.btn-upload-assignment').on('click', '.btn-upload-assignment', function() {
        const assignmentId = $(this).data('assignment-id');
        const studentId = window.StudentSwitcher ? window.StudentSwitcher.getActiveStudentId() : null;
        if (!studentId) {
            frappe.msgprint(__('Silakan pilih akun anak terlebih dahulu.'));
            return;
        }

        new frappe.ui.FileUploader({
            restrictions: { allowed_file_types: ['.pdf'] },
            on_success: function(file) {
                frappe.call({
                    method: 'bima_lms.api.section_details.rename_uploaded_file',
                    args: { file_path: file.file_url },
                    callback: function(renameResponse) {
                        if (!renameResponse.message || !renameResponse.message.file_url) return;
                        frappe.call({
                            method: 'bima_lms.api.section_details.submit_assignment',
                            args: {
                                assignment_id: assignmentId,
                                student_id: studentId,
                                file_path: renameResponse.message.file_url
                            },
                            freeze: true,
                            freeze_message: __('Mengumpulkan jawaban...'),
                            callback: function(response) {
                                if (response.message && response.message.status === 'success') {
                                    frappe.show_alert({ message: __('Jawaban berhasil dikumpulkan'), indicator: 'green' });
                                    loadSectionDetail(currentSectionId);
                                } else if (response.message && response.message.status === 'already_submitted') {
                                    frappe.msgprint(__('Tugas ini sudah dikumpulkan sebelumnya.'));
                                    loadSectionDetail(currentSectionId);
                                }
                            }
                        });
                    }
                });
            }
        });
    });

    $(document).off('input', '.input-submission-score').on('input', '.input-submission-score', function() {
        updateGradeButton($(this).closest('.submission-grade-row'));
    });

    $(document).off('click', '.btn-edit-grade').on('click', '.btn-edit-grade', function() {
        const $row = $(this).closest('.submission-grade-row');
        $row.data('original-score', $row.find('.input-submission-score').val());
        $row.data('original-feedback', $row.find('.input-submission-feedback').val());
        $row.find('.input-submission-score, .input-submission-feedback').prop('disabled', false);
        $row.find('.btn-edit-grade').addClass('hidden');
        $row.find('.btn-cancel-grade, .btn-submit-grade').removeClass('hidden');
        updateGradeButton($row);
    });

    $(document).off('click', '.btn-cancel-grade').on('click', '.btn-cancel-grade', function() {
        const $row = $(this).closest('.submission-grade-row');
        $row.find('.input-submission-score').val($row.data('original-score'));
        $row.find('.input-submission-feedback').val($row.data('original-feedback'));
        $row.find('.input-submission-score, .input-submission-feedback').prop('disabled', true);
        $row.find('.btn-cancel-grade, .btn-submit-grade').addClass('hidden');
        $row.find('.btn-edit-grade').removeClass('hidden');
    });

    $(document).off('click', '.btn-submit-grade').on('click', '.btn-submit-grade', function() {
        const $row = $(this).closest('.submission-grade-row');
        const score = $row.find('.input-submission-score').val();
        if (!isValidSubmissionScore(score, Number($row.data('max-score')))) return;

        frappe.call({
            method: 'bima_lms.api.section_details.grade_assignment_submission',
            args: {
                submission_id: $row.data('submission-id'),
                score: score,
                feedback_notes: $row.find('.input-submission-feedback').val()
            },
            freeze: true,
            freeze_message: __('Menyimpan nilai...'),
            callback: function(response) {
                if (response.message && response.message.status === 'success') {
                    frappe.show_alert({ message: __('Nilai berhasil disimpan'), indicator: 'green' });
                    loadSectionDetail(currentSectionId);
                }
            }
        });
    });

    if (!window.__sectionQuizPopstateBound) {
        window.addEventListener('popstate', handleSectionPopState);
        window.addEventListener('beforeunload', function(event) {
            if (activeQuiz && !quizResultVisible) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
        window.__sectionQuizPopstateBound = true;
    }
}

function swapArrayElements(arr, i, j) {
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
}

function animateListSwap($card, index, targetIndex, cardSelector, onComplete) {
    const $list = $card.closest('#lessons-list, #assignments-list, #quizzes-list');
    const $cards = $list.find(cardSelector);
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

function renderQuizzesList() {
    const quizzes = currentSectionData.quizzes || [];
    const $container = $('#quizzes-list').empty();
    $('#empty-quizzes-msg').toggleClass('hidden', quizzes.length !== 0);

    quizzes.forEach((quiz, index) => {
        if (isEditMode) {
            $container.append(`
                <div class="quiz-edit-card border-2 border-indigo-200 bg-white rounded-xl p-5 space-y-4 shadow-sm" data-quiz-index="${index}">
                    <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                        <span class="bg-indigo-100 text-indigo-700 font-bold text-xs px-2.5 py-1 rounded-md">Quiz #${index + 1}</span>
                        <div class="flex items-center space-x-1">
                            <button type="button" class="btn-move-quiz-up p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors ${index === 0 ? 'hidden' : ''}" title="Pindah ke Atas">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                            </button>
                            <button type="button" class="btn-move-quiz-down p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors ${index === quizzes.length - 1 ? 'hidden' : ''}" title="Pindah ke Bawah">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 9l7 7 7-7"></path></svg>
                            </button>
                            <button type="button" class="btn-delete-quiz p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors ml-1" title="Hapus quiz">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 01-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div class="md:col-span-2">
                            <label class="block text-xs font-semibold text-gray-700 mb-1">Judul Quiz</label>
                            <input type="text" class="input-quiz-title w-full px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg" value="${escapeHtml(quiz.quiz_title || '')}" placeholder="Judul quiz...">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-700 mb-1">Durasi (menit)</label>
                            <input type="number" min="1" step="1" class="input-quiz-duration w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${Math.max(1, Number(quiz.duration_minutes) || 1)}">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-700 mb-1">Nilai Lulus</label>
                            <input type="number" min="1" step="0.01" class="input-quiz-passing-grade w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${Math.max(1, Number(quiz.passing_grade) || 1)}">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-700 mb-1">Maksimal Percobaan</label>
                            <input type="number" min="1" step="1" class="input-quiz-max-attempts w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${Math.max(1, Number(quiz.max_attempts_allowed) || 1)}">
                        </div>
                    </div>
                </div>`);
            return;
        }
        const attempts = Number(quiz.attempt_count || 0);
        const maxAttempts = Number(quiz.max_attempts_allowed || 0);
        const isParent = Boolean(currentSectionData.is_parent && currentSectionData.active_student_id);
        const attemptsExhausted = isParent && attempts >= maxAttempts;
        
        const lastAttempt = quiz.last_submitted_at ? `<p class="mt-1 text-xs text-gray-500"> Submit terakhir: ${formatSubmissionDate(quiz.last_submitted_at)}
            <br>
            Nilai: <span class="text-base font-bold text-gray-700">${quiz.last_total_score ?? '-'}</span>
            • ${escapeHtml(quiz.last_result_status || '-')} </p>` : '';

        const attemptInfo = isParent ? `<p class="mt-1 text-xs font-semibold ${attemptsExhausted ? 'text-red-600' : 'text-gray-600'}">${attempts}/${maxAttempts} percobaan</p>${lastAttempt}` : '';
        $container.append(`
        <div class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div>
                <div class="flex items-start gap-3">
                    <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-700">${index + 1}</span>
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">${escapeHtml(quiz.quiz_title)}</h3>
                        <p class="mt-1 text-sm text-gray-500">${quiz.questions.length} soal • ${quiz.duration_minutes ? `${quiz.duration_minutes} menit` : 'Tanpa batas waktu'} • Nilai lulus: ${quiz.passing_grade}</p>
                    </div>
                </div>
            </div>
            <div class="flex w-full flex-wrap items-center justify-end gap-4 sm:w-auto">
                ${isParent ? `<div class="text-right">${attemptInfo}</div>` : ''}
                <button type="button" class="btn-open-quiz rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50" data-quiz-index="${index}" ${attemptsExhausted ? 'disabled' : ''}>Buka Quiz</button>
            </div>
        </div>`);
    });
}

function openQuiz(index) {
    const quiz = (currentSectionData.quizzes || [])[index];
    const canEditQuiz = Boolean(currentSectionData.is_teacher);
    if (!quiz || (!quiz.questions.length && !canEditQuiz)) {
        frappe.msgprint(__('Quiz ini belum memiliki soal.'));
        return;
    }
    const attempts = Number(quiz.attempt_count || 0);
    const maxAttempts = Number(quiz.max_attempts_allowed || 0);
    if (currentSectionData.is_parent && attempts >= maxAttempts) {
        frappe.msgprint(__('Batas maksimal percobaan quiz sudah tercapai.'));
        return;
    }
    if (currentSectionData.is_parent && quiz.last_result_status === 'Lulus') {
        frappe.confirm(__('Anda sudah lulus quiz ini. Jika mengerjakan dan submit ulang, nilai terbaru akan menjadi nilai yang digunakan. Lanjutkan?'), function() {
            startQuiz(quiz);
        });
        return;
    }
    startQuiz(quiz);
}

function startQuiz(quiz) {
    activeQuiz = quiz;
    quizEditMode = false;
    quizEditDeletedQuestionIds = [];
    quizEditDeletedOptionIds = [];
    quizCanAnswer = Boolean(currentSectionData.is_parent && currentSectionData.active_student_id);
    quizResultVisible = false;
    activeQuizQuestionIndex = 0;
    activeQuizAnswers = {};
    quizDeadline = quizCanAnswer && quiz.duration_minutes ? Date.now() + quiz.duration_minutes * 60000 : null;
    $('#btn-quiz-previous, #btn-quiz-next').removeClass('hidden');
    $('#btn-quiz-submit, #btn-quiz-close, #btn-add-quiz-question, #btn-quiz-save-edit, #btn-quiz-cancel-edit').addClass('hidden');
    $('#btn-quiz-previous').prop('disabled', false).removeClass('opacity-50');
    $('#quiz-modal').removeClass('hidden');
    $('#quiz-question-nav').removeClass('hidden');
    history.pushState({ sectionQuiz: true }, '', window.location.href);
    if (quizTimer) clearInterval(quizTimer);
    quizTimer = quizDeadline ? setInterval(updateQuizTimer, 1000) : null;
    updateQuizTimer();
    renderQuizQuestion();
}

function renderQuizQuestion() {
    if (!activeQuiz) return;
    if (quizEditMode) {
        $('#quiz-nav-title').text('Navigasi Soal (Geser untuk Memindahkan)');
        renderQuizEditView();
        return;
    }
    $('#quiz-nav-title').text('Navigasi Soal');
    if (!activeQuiz.questions.length) {
        $('#quiz-modal-title').text(activeQuiz.quiz_title);
        $('#quiz-modal-meta').text('Quiz belum memiliki soal.');
        $('#quiz-question-nav').addClass('hidden');
        $('#quiz-question-view').addClass('h-full lg:col-span-2 flex items-center justify-center').html('<p class="text-sm text-gray-500">Belum ada soal pada quiz ini.</p>');
        $('#btn-quiz-edit').toggleClass('hidden', !currentSectionData.is_teacher);
        $('#btn-quiz-close').toggleClass('hidden', false);
        $('#btn-quiz-previous, #btn-quiz-next, #btn-quiz-submit').addClass('hidden');
        return;
    }
    const question = activeQuiz.questions[activeQuizQuestionIndex];
    const selected = activeQuizAnswers[activeQuizQuestionIndex];
    $('#quiz-question-view').removeClass('h-full lg:col-span-2 flex items-center justify-center');
    $('#quiz-modal-title').text(activeQuiz.quiz_title);
    $('#quiz-timer').removeClass('hidden');
    $('#quiz-modal-meta').text(`Soal ${activeQuizQuestionIndex + 1} dari ${activeQuiz.questions.length}`);
    $('#quiz-progress').css('width', `${((activeQuizQuestionIndex + 1) / activeQuiz.questions.length) * 100}%`);
    $('#quiz-question-view').html(`
        <h3 class="text-lg font-semibold leading-relaxed text-gray-900">${activeQuizQuestionIndex + 1}. ${escapeHtml(question.question_text)}</h3>
        <div class="mt-6 space-y-3">${question.options.map(option => `
            <label class="flex items-start gap-3 rounded-lg border p-4 ${quizCanAnswer ? 'cursor-pointer hover:border-indigo-400' : ''} ${!quizCanAnswer && option.is_correct ? 'border-emerald-300 bg-emerald-100' : selected === option.option_id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}">
                <input type="radio" class="quiz-option-input mt-1" name="quiz-option" value="${option.option_id}" ${selected === option.option_id ? 'checked' : ''} ${quizCanAnswer ? '' : 'disabled'}>
                <span class="text-sm ${!quizCanAnswer && option.is_correct ? 'font-semibold text-emerald-800' : 'text-gray-700'}">${escapeHtml(option.option_text)}</span>
            </label>`).join('')}</div>`);
        $('#quiz-question-buttons').html(activeQuiz.questions.map((item, index) => {
            const answered = activeQuizAnswers[index] !== undefined;
            const current = index === activeQuizQuestionIndex;
            return `<button type="button" class="btn-quiz-question rounded-lg border px-2 py-2 text-xs font-bold ${current ? 'border-indigo-600 bg-indigo-600 text-white' : answered ? 'border-orange-400 bg-orange-400 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'}" data-question-index="${index}" aria-label="Soal ${index + 1}">${index + 1}</button>`;
        }).join(''));
    $('#btn-quiz-close').toggleClass('hidden', quizCanAnswer);
    $('#btn-quiz-edit').toggleClass('hidden', !currentSectionData.is_teacher);
    $('#btn-add-quiz-question, #btn-quiz-save-edit, #btn-quiz-cancel-edit').addClass('hidden');
    $('#btn-quiz-previous').removeClass('hidden').prop('disabled', activeQuizQuestionIndex === 0).toggleClass('opacity-50', activeQuizQuestionIndex === 0);
    $('#btn-quiz-next').toggleClass('hidden', activeQuizQuestionIndex === activeQuiz.questions.length - 1);
    $('#btn-quiz-submit').toggleClass('hidden', !quizCanAnswer || activeQuizQuestionIndex !== activeQuiz.questions.length - 1);
}

function closeQuizModal(reloadAfterClose = false) {
    if (quizEditMode) {
        frappe.confirm(__('Buang semua perubahan isi quiz dan tutup modal?'), function() {
            quizEditMode = false;
            closeQuizModal(true);
        });
        return;
    }
    const shouldReload = reloadAfterClose || quizResultVisible;
    activeQuiz = null;
    quizCanAnswer = false;
    quizResultVisible = false;
    if (quizTimer) clearInterval(quizTimer);
    quizTimer = null;
    $('#quiz-modal').addClass('hidden');
    $('#btn-quiz-close').addClass('hidden');
    $('#btn-add-quiz-question, #btn-quiz-save-edit, #btn-quiz-cancel-edit').addClass('hidden');
    $('#quiz-question-buttons').empty();
    history.replaceState(null, '', window.location.href);
    if (shouldReload) loadSectionDetail(currentSectionId);
}

function updateQuizTimer() {
    if (!activeQuiz) return;
    if (!quizCanAnswer) {
        $('#quiz-timer').html(`<span class="inline-flex items-center gap-1.5"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${activeQuiz.duration_minutes ? `${activeQuiz.duration_minutes} menit` : 'Tanpa batas waktu'}</span>`);
        return;
    }
    if (!quizDeadline) {
        $('#quiz-timer').html(`<span class="inline-flex items-center gap-1.5"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Tanpa batas waktu</span>`);
        return;
    }
    const seconds = Math.max(0, Math.ceil((quizDeadline - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60);
    $('#quiz-timer').text(`${minutes}:${String(seconds % 60).padStart(2, '0')}`);
    if ([600, 300, 120].includes(seconds)) {
        frappe.show_alert({ message: __('Sisa waktu quiz: {0}', [`${Math.ceil(seconds / 60)} menit`]), indicator: 'orange' });
    }
    if (!seconds) {
        clearInterval(quizTimer);
        quizTimer = null;
        submitQuizLocally(true);
    }
}

function submitQuizLocally(timeExpired) {
    if (!activeQuiz) return;
    const answers = {};
    activeQuiz.questions.forEach((question, index) => {
        if (activeQuizAnswers[index] !== undefined) answers[question.question_id] = activeQuizAnswers[index];
    });
    const quizId = activeQuiz.quiz_id;
    const studentId = currentSectionData.active_student_id;
    frappe.call({
        method: 'bima_lms.api.section_details.submit_quiz_attempt',
        args: {
            quiz_id: quizId,
            student_id: studentId,
            answers: JSON.stringify(answers)
        },
        freeze: true,
        freeze_message: __('Menyimpan hasil quiz...'),
        callback: function(response) {
            if (!response.message || response.message.status !== 'success') return;
            renderQuizResult(response.message, timeExpired);
        }
    });
}

function renderQuizResult(result, timeExpired) {
    const score = Number(result.total_score || 0);
    const passed = result.result_status === 'Lulus';
    $('#quiz-question-view').addClass('lg:col-span-2 flex items-center justify-center');
    $('#quiz-question-view').html(`<div class="w-full max-w-xl text-center">
        <p class="text-sm font-bold text-gray-600">${timeExpired ? 'Waktu pengerjaan habis.' : 'Quiz selesai.'}</p>
        <p class="mt-3 text-5xl font-extrabold text-gray-900">${score.toFixed(2)}</p>
        <p class="mx-auto mt-5 w-fit rounded-lg px-5 py-3 text-lg font-extrabold text-white ${passed ? 'bg-emerald-600' : 'bg-red-600'}">${passed ? 'Lulus' : 'Belum lulus'}</p>
        <p class="mt-3 text-sm text-gray-700">Percobaan ke-${result.attempt_number} • Nilai lulus: ${activeQuiz.passing_grade}</p>
    </div>`);
    $('#quiz-modal-meta').text('Hasil kalkulasi lokal, belum disimpan ke server.');
    $('#quiz-question-nav').addClass('hidden');
    $('#btn-quiz-previous, #btn-quiz-next, #btn-quiz-submit').addClass('hidden');
    $('#btn-quiz-close').removeClass('hidden');
    quizResultVisible = true;
    if (quizTimer) clearInterval(quizTimer);
    quizTimer = null;
    history.replaceState(null, '', window.location.href);
}

function handleQuizForcedExit(event) {
    if (!activeQuiz || !quizCanAnswer || quizResultVisible) return;
    event.preventDefault();
    history.pushState({ sectionQuiz: true }, '', window.location.href);
    frappe.msgprint(__('Quiz belum disubmit. Jika keluar paksa, hasil quiz dianggap 0 dan tercatat sebagai keluar tanpa menyelesaikan quiz.'));
}

function loadSectionDetail(section_id) {
    console.log('[LMS Debug] Loading section detail for ID:', section_id);
    $('#section-loading').removeClass('hidden');
    $('#section-content').addClass('hidden');
    $('#section-action-buttons-wrapper').addClass('hidden');

        frappe.call({
            method: 'bima_lms.api.section_details.get_section_detail',
            args: {
                section_id: section_id,
                active_student_id: window.StudentSwitcher ? window.StudentSwitcher.getActiveStudentId() : null
            },
        callback: function(r) {
            console.log('[LMS Debug] API Response received', r.message);
            $('#section-loading').addClass('hidden');
            if (r.message) {
                currentSectionData = r.message;
                deletedLessonIds = [];
                deletedAssignmentIds = [];
                deletedQuizIds = [];
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
    $('#quiz-count').text(`${data.quizzes ? data.quizzes.length : 0} Quiz`);
    renderQuizzesList();
    $('#breadcrumb-section').text(data.section_title);

    if (isEditMode) {
        $('#btn-section-enable-edit').addClass('hidden');
        $('#section-edit-mode-actions').removeClass('hidden');
        $('#btn-add-lesson, #btn-add-assignment, #btn-add-quiz').removeClass('hidden');
        if (activeQuiz) {
            quizEditMode = false;
            closeQuizModal(true);
        }

        $('#section-info-view').addClass('hidden');
        $('#section-info-edit').removeClass('hidden');
        $('#input-section-title').val(data.section_title);
        $('#input-section-desc').val(data.description);
    } else {
        $('#quiz-timer').removeClass('hidden');
        $('#btn-section-enable-edit').toggleClass('hidden', Boolean(data.is_parent));
        $('#section-edit-mode-actions').addClass('hidden');
        $('#btn-add-lesson, #btn-add-assignment, #btn-add-quiz').addClass('hidden');

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
                            <span class="flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 font-bold text-xs rounded-lg flex-shrink-0">${index + 1}</span>
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
                        <span class="bg-blue-100 text-blue-700 font-bold text-xs px-2.5 py-1 rounded-md">Materi #${index + 1}</span>
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
                                
                                ${renderAssignmentSubmissionControl(assignment)}
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
        if (enableEdit && currentSectionData && currentSectionData.is_parent) return;
    isEditMode = enableEdit;
    if (!enableEdit) {
        loadSectionDetail(currentSectionId);
        return;
    }
    renderPage();
}

function handleSaveSection() {
    frappe.confirm(__('Simpan semua perubahan pada bab, materi, tugas, dan quiz ini?'), function() {
        frappe.call({
            method: 'bima_lms.api.section_details.batch_save_section_detail',
            args: {
                section_id: currentSectionId,
                section_title: currentSectionData.section_title,
                description: currentSectionData.description,
                lessons: JSON.stringify(currentSectionData.lessons || []),
                deleted_lesson_ids: JSON.stringify(deletedLessonIds),
                assignments: JSON.stringify(currentSectionData.assignments || []),
                deleted_assignment_ids: JSON.stringify(deletedAssignmentIds),
                quizzes: JSON.stringify(currentSectionData.quizzes || []),
                deleted_quiz_ids: JSON.stringify(deletedQuizIds)
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

function renderAssignmentSubmissionControl(assignment) {
    if (currentSectionData.is_teacher) {
        if (!assignment.submissions || !assignment.submissions.length) {
            return '<p class="border-t border-gray-100 pt-4 text-sm text-gray-500">Belum ada siswa yang mengumpulkan tugas.</p>';
        }
        return `<div class="border-t border-gray-100 pt-4 space-y-4">
            ${assignment.submissions.map(submission => renderSubmissionGradeRow(submission, assignment.max_score)).join('')}
        </div>`;
    }

    if (!currentSectionData.is_parent) return '';

    if (assignment.submitted_at) {
        const submittedFileUrl = assignment.submission_file_path ? escapeHtml(assignment.submission_file_path) : '';
        return `<div class="border-t border-gray-100 pt-4 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div class="space-y-1">
                    <span class="text-sm font-semibold text-emerald-700">Anda sudah mengumpulkan tugas </span> <span class="text-xs text-gray-500">pada ${formatSubmissionDate(assignment.submitted_at)}</span>
            ${submittedFileUrl ? `<a href="${submittedFileUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                <span>Lihat tugas Anda</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4-8h6m0 0v6m0-6L10 14"></path></svg>
            </a>` : ''}
                </div>
                <div class="sm:text-right text-sm">
                    <span class="text-gray-500">Nilai</span>
                    <p class="font-bold text-gray-900">${assignment.score === null || assignment.score === undefined ? '-' : assignment.score}</p>
                </div>
            </div>
            ${assignment.feedback_notes ? `<div class="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700 whitespace-pre-line">
                <span class="font-semibold text-gray-900">Catatan guru</span>
                <p class="mt-1">${escapeHtml(assignment.feedback_notes)}</p>
            </div>` : ''}
        </div>`;
    }

    return `<div class="border-t border-gray-100 pt-4 flex justify-end">
        <button type="button" class="btn-upload-assignment inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors" data-assignment-id="${assignment.assignment_id}">
            <span>Upload File Jawaban</span>
        </button>
    </div>`;
}

function renderSubmissionGradeRow(submission, maxScore) {
    const score = submission.score === null || submission.score === undefined ? '' : submission.score;
    const hasScore = score !== '';
    const fieldState = hasScore ? 'disabled' : '';
    const saveState = hasScore || !isValidSubmissionScore(score, maxScore) ? 'disabled' : '';
    return `<div class="submission-grade-row rounded-lg border border-gray-200 bg-gray-50 p-4" data-submission-id="${submission.submission_id}" data-max-score="${maxScore}">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <div class="space-y-1 text-sm">
            <p class="font-semibold text-gray-900">${escapeHtml(submission.student_name)}</p>
            <p class="text-gray-600">NISN: ${escapeHtml(submission.nisn)}</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="number" class="input-submission-score w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" min="0" max="${maxScore}" step="0.01" value="${score}" placeholder="Nilai (0-${maxScore})" ${fieldState}>
                <textarea rows="1" class="input-submission-feedback w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500" placeholder="Catatan (opsional)" ${fieldState}>${escapeHtml(submission.feedback_notes || '')}</textarea>
            </div>
        </div>
        <div class="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3 items-center border-t border-gray-200 pt-3">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span class="text-gray-600">Submit: ${formatSubmissionDate(submission.submitted_at)}</span>
                <a href="${escapeHtml(submission.file_path || '#')}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                    <span>Buka file jawaban</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10v-4m-4-8h6m0 0v6m0-6L10 14"></path></svg>
                </a>
            </div>
            <div class="flex flex-wrap justify-start lg:justify-end gap-2">
                <button type="button" class="btn-cancel-grade hidden px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100">Batalkan Perubahan</button>
                <button type="button" class="btn-edit-grade ${hasScore ? '' : 'hidden'} px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg">Edit Nilai</button>
                <button type="button" class="btn-submit-grade ${hasScore ? 'hidden' : ''} px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed" ${saveState}>Simpan Nilai</button>
            </div>
        </div>
    </div>`;
}

function isValidSubmissionScore(score, maxScore) {
    if (score === '' || score === null || score === undefined) return false;
    const numericScore = Number(score);
    return Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= maxScore;
}

function updateGradeButton($row) {
    const score = $row.find('.input-submission-score').val();
    $row.find('.btn-submit-grade').prop('disabled', !isValidSubmissionScore(score, Number($row.data('max-score'))));
}

function formatSubmissionDate(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const parts = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(date).reduce((values, part) => {
        values[part.type] = part.value;
        return values;
    }, {});
    return `${parts.day} ${parts.month} ${parts.year} pukul ${parts.hour}:${parts.minute}:${parts.second}`;
}

function renderQuizEditView() {
    const question = activeQuiz.questions[activeQuizQuestionIndex];
    $('#quiz-modal-title').html(`${escapeHtml(activeQuiz.quiz_title)} <span class="ml-2 rounded-lg bg-indigo-100 px-2.5 py-1 text-sm font-bold text-indigo-700">Mode Edit</span>`);
    $('#quiz-modal-meta').text(`${activeQuiz.questions.length} soal`);
    $('#quiz-timer').addClass('hidden');
    $('#quiz-progress').css('width', activeQuiz.questions.length ? `${((activeQuizQuestionIndex + 1) / activeQuiz.questions.length) * 100}%` : '0%');
    $('#quiz-question-nav').removeClass('hidden');
    $('#quiz-question-buttons').html(activeQuiz.questions.map((item, index) => `
        <button type="button" draggable="true" class="btn-quiz-question rounded-lg border px-2 py-2 text-xs font-bold ${index === activeQuizQuestionIndex ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'}" data-question-index="${index}" aria-label="Soal ${index + 1}">${index + 1}</button>`).join(''));
    $('#btn-quiz-edit').addClass('hidden');
    $('#btn-quiz-close').removeClass('hidden');
    $('#btn-quiz-previous, #btn-quiz-next, #btn-quiz-submit').addClass('hidden');
    $('#btn-add-quiz-question, #btn-quiz-save-edit, #btn-quiz-cancel-edit').removeClass('hidden');
    if (!question) {
        $('#quiz-question-view').addClass('h-full lg:col-span-2 flex items-center justify-center').html('<div class="text-center"><p class="text-sm text-gray-500">Tambahkan soal baru untuk mulai mengedit quiz.</p><button id="btn-add-quiz-question" type="button" class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Tambah Soal</button></div>');
        return;
    }
    $('#quiz-question-view').removeClass('h-full lg:col-span-2 flex items-center justify-center').html(`
        <div class="quiz-edit-question-card space-y-5" data-question-index="${activeQuizQuestionIndex}">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <h3 class="text-lg font-bold text-gray-900">Soal ${activeQuizQuestionIndex + 1}</h3>
                    <button type="button" class="btn-delete-quiz-question rounded-lg p-2 text-red-500 hover:bg-red-50" title="Hapus Soal" aria-label="Hapus Soal">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 01-1-1h-4a1 1 0 01-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
                <div class="flex items-center gap-2">
                    <button id="btn-add-quiz-question" type="button" class="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">+ Tambah Soal</button>
                </div>
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Pertanyaan</label>
                <textarea rows="5" class="quiz-edit-question-text w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">${escapeHtml(question.question_text || '')}</textarea>
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Bobot Nilai</label>
                <input type="number" min="1" step="0.01" class="quiz-edit-points w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value="${Math.max(1, Number(question.points) || 1)}">
            </div>
            <div class="space-y-3">
                <div class="flex items-center justify-between"><h4 class="text-sm font-bold text-gray-800">Pilihan Jawaban</h4><button type="button" class="btn-add-quiz-option rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">+ Tambah Pilihan</button></div>
                ${question.options.map((option, optionIndex) => `<div class="flex items-center gap-2 rounded-lg border ${option.is_correct ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'} p-3"><input type="radio" class="quiz-edit-correct-option" name="quiz-correct-option" data-option-index="${optionIndex}" ${option.is_correct ? 'checked' : ''} title="Jadikan kunci jawaban"><input type="text" class="quiz-edit-option-text min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" data-option-index="${optionIndex}" value="${escapeHtml(option.option_text || '')}"><button type="button" class="btn-delete-quiz-option rounded p-1.5 text-red-500 hover:bg-red-50" data-option-index="${optionIndex}" title="Hapus pilihan">&times;</button></div>`).join('')}
            </div>
        </div>`);
}

function enterQuizEditMode() {
    if (!activeQuiz || !currentSectionData.is_teacher) return;
    quizEditOriginalQuestions = JSON.parse(JSON.stringify(activeQuiz.questions || []));
    quizEditDeletedQuestionIds = [];
    quizEditDeletedOptionIds = [];
    quizEditMode = true;
    activeQuizQuestionIndex = 0;
    renderQuizQuestion();
}

function addQuizQuestion() {
    if (!quizEditMode) return;
    activeQuiz.questions.push({
        quiz_question_id: null,
        question_id: null,
        question_text: 'Pertanyaan Baru',
        question_type: 'multiple_choice',
        points: 5,
        options: [
            { option_id: null, option_text: 'Pilihan 1', is_correct: true },
            { option_id: null, option_text: 'Pilihan 2', is_correct: false }
        ]
    });
    activeQuizQuestionIndex = activeQuiz.questions.length - 1;
    renderQuizQuestion();
}

function deleteQuizQuestion() {
    if (!quizEditMode || !activeQuiz.questions.length) return;
    const question = activeQuiz.questions[activeQuizQuestionIndex];
    frappe.confirm(__('Hapus soal ini? Perubahan baru tersimpan setelah klik Simpan Perubahan.'), function() {
        if (question.question_id) quizEditDeletedQuestionIds.push(question.question_id);
        question.options.forEach(option => { if (option.option_id) quizEditDeletedOptionIds.push(option.option_id); });
        activeQuiz.questions.splice(activeQuizQuestionIndex, 1);
        activeQuizQuestionIndex = Math.max(0, activeQuizQuestionIndex - 1);
        renderQuizQuestion();
    });
}

function cancelQuizEdit() {
    frappe.confirm(__('Buang semua perubahan isi quiz?'), function() {
        activeQuiz.questions = JSON.parse(JSON.stringify(quizEditOriginalQuestions));
        quizEditMode = false;
        quizEditDeletedQuestionIds = [];
        quizEditDeletedOptionIds = [];
        renderQuizQuestion();
    });
}

function validateQuizEdit() {
    for (const question of activeQuiz.questions) {
        if (!question.question_text || question.question_text.trim() === '') {
            frappe.msgprint(__('Pertanyaan tidak boleh kosong.'));
            return false;
        }
        if (Number(question.points) < 1) {
            frappe.msgprint(__('Bobot setiap soal minimal 1.'));
            return false;
        }
        if (question.options.length < 2) {
            frappe.msgprint(__('Setiap soal minimal memiliki 2 pilihan jawaban.'));
            return false;
        }
        if (question.options.filter(option => option.is_correct).length !== 1) {
            frappe.msgprint(__('Setiap soal harus memiliki tepat 1 kunci jawaban.'));
            return false;
        }
        if (question.options.some(option => !option.option_text || option.option_text.trim() === '')) {
            frappe.msgprint(__('Teks pilihan jawaban tidak boleh kosong.'));
            return false;
        }
    }
    return true;
}

function saveQuizEdit() {
    if (!activeQuiz || !validateQuizEdit()) return;
    frappe.call({
        method: 'bima_lms.api.section_details.save_quiz_questions',
        args: {
            quiz_id: activeQuiz.quiz_id,
            questions: JSON.stringify(activeQuiz.questions),
            deleted_question_ids: JSON.stringify(quizEditDeletedQuestionIds),
            deleted_option_ids: JSON.stringify(quizEditDeletedOptionIds)
        },
        freeze: true,
        freeze_message: __('Menyimpan perubahan soal quiz...'),
        callback: function(response) {
            if (!response.message || response.message.status !== 'success') return;
            frappe.show_alert({ message: __('Perubahan soal quiz berhasil disimpan'), indicator: 'green' });
            quizEditMode = false;
            quizEditDeletedQuestionIds = [];
            quizEditDeletedOptionIds = [];
            activeQuiz.questions = response.message.questions;
            quizEditOriginalQuestions = JSON.parse(JSON.stringify(activeQuiz.questions));
            renderQuizQuestion();
        }
    });
}

function navigateToCourseDetail() {
    if (currentSectionData && currentSectionData.course_id) {
        frappe.set_route('course-detail', { id: currentSectionData.course_id });
    } else {
        frappe.set_route('courses');
    }
}

function handleSectionPopState(event) {
    if (activeQuiz && quizCanAnswer && !quizResultVisible) {
        handleQuizForcedExit(event);
        return;
    }

    if (!currentSectionData || !currentSectionData.course_id) return;

    setTimeout(function() {
        const route = frappe.get_route();
        const routeCourseId = route[1] && typeof route[1] === 'object' ? route[1].id : route[1];
        if (route[0] !== 'course-detail' || String(routeCourseId) !== String(currentSectionData.course_id)) {
            navigateToCourseDetail();
        }
    }, 0);
}