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
                        <!-- Tombol Back Dinamis -->
                        <a href="javascript:void(0)" id="btn-back-to-course" class="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Kembali ke Detail Course">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </a>
                        <div class="h-4 w-px bg-gray-200"></div>
                        <nav class="flex items-center space-x-2 text-sm font-medium">
                            <a href="/app/lms-dashboard" class="text-gray-500 hover:text-indigo-600 transition-colors">LMS Dashboard</a>
                            <span class="text-gray-300">/</span>
                            <a href="/app/courses" class="text-gray-500 hover:text-indigo-600 transition-colors">Courses</a>
                            <span class="text-gray-300">/</span>
                            <!-- Ubah href agar tidak memicu redirect langsung ke /app/courses -->
                            <a href="javascript:void(0)" id="breadcrumb-course" class="text-gray-500 hover:text-indigo-600 transition-colors">Course</a>
                            <span class="text-gray-300">/</span>
                            <span id="breadcrumb-section" class="text-gray-900 font-bold">Detail Bab</span>
                        </nav>
                    </div>

                    <div id="section-action-buttons-wrapper" class="hidden flex items-center space-x-3">
                        <button id="btn-section-enable-edit" type="button" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            <span>Edit Bab</span>
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
                        <!-- View Mode Bab Info -->
                        <div id="section-info-view">
                            <h1 id="section-title" class="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight"></h1>
                            <p id="section-description" class="mt-2 text-gray-600"></p>
                            <div class="mt-4 flex items-center space-x-4 text-sm text-gray-500">
                                <span id="lesson-count">0 Materi</span>
                            </div>
                        </div>

                        <!-- Edit Mode Bab Info -->
                        <div id="section-info-edit" class="hidden space-y-4">
                            <div>
                                <label for="input-section-title" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Judul Bab</label>
                                <input type="text" id="input-section-title" name="input-section-title" class="w-full px-3 py-2 text-base font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Masukkan judul bab...">
                            </div>
                            <div>
                                <label for="input-section-desc" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Deskripsi Bab</label>
                                <textarea id="input-section-desc" name="input-section-desc" rows="3" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Masukkan deskripsi bab..."></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Lessons List -->
                    <div id="lessons-container" class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                        <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                            <h2 class="text-lg font-bold text-gray-900">Daftar Materi</h2>
                        </div>
                        <div id="lessons-list" class="space-y-4"></div>
                        <div id="empty-lessons-msg" class="hidden text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <p class="text-xs text-gray-500 font-medium">Belum ada materi pada bab ini.</p>
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
let quillInstances = {};
let deletedLessonIds = [];

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

    // Handler untuk Tombol Kembali (Back Arrow)
    $(document).off('click', '#btn-back-to-course').on('click', '#btn-back-to-course', function(e) {
        e.preventDefault();
        if (currentSectionData && currentSectionData.course_id) {
            frappe.set_route('course-detail', { id: currentSectionData.course_id });
        } else {
            frappe.set_route('courses');
        }
    });

    // Handler untuk Breadcrumb Link Course
    $(document).off('click', '#breadcrumb-course').on('click', '#breadcrumb-course', function(e) {
        e.preventDefault();
        if (currentSectionData && currentSectionData.course_id) {
            frappe.set_route('course-detail', { id: currentSectionData.course_id });
        } else {
            frappe.set_route('courses');
        }
    });

    $(document).off('click', '#btn-section-enable-edit').on('click', '#btn-section-enable-edit', function(e) {
        e.preventDefault();
        console.log('[LMS Debug] Klik Tombol Edit Bab');
        toggleEditMode(true);
    });

    $(document).off('click', '#btn-section-cancel-edit').on('click', '#btn-section-cancel-edit', function(e) {
        e.preventDefault();
        console.log('[LMS Debug] Klik Tombol Batal Edit');
        toggleEditMode(false);
    });

    $(document).off('click', '#btn-section-save').on('click', '#btn-section-save', function(e) {
        e.preventDefault();
        console.log('[LMS Debug] Klik Tombol Simpan');
        handleSaveSection();
    });

    $(document).off('input', '#input-section-title').on('input', '#input-section-title', function() {
        if (currentSectionData) currentSectionData.section_title = $(this).val();
    });

    $(document).off('input', '#input-section-desc').on('input', '#input-section-desc', function() {
        if (currentSectionData) currentSectionData.description = $(this).val();
    });

    $(document).off('click', '#breadcrumb-course').on('click', '#breadcrumb-course', function(e) {
        e.preventDefault();
        if (currentSectionData && currentSectionData.course_id) {
            frappe.set_route('course-detail', { id: currentSectionData.course_id });
        }
    });

    $(document).off('click', '.lesson-accordion-toggle').on('click', '.lesson-accordion-toggle', function() {
        const $toggle = $(this);
        const expanded = $toggle.attr('aria-expanded') === 'true';
        $toggle.attr('aria-expanded', String(!expanded));
        $toggle.next('.lesson-accordion-content').toggleClass('grid-rows-[0fr]', expanded).toggleClass('grid-rows-[1fr]', !expanded);
        $toggle.find('.lesson-accordion-icon').toggleClass('rotate-180', !expanded);
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

    $(document).off('click', '.btn-lesson-move-up').on('click', '.btn-lesson-move-up', function() {
        moveLesson(Number($(this).closest('.lesson-edit-card').data('lesson-index')), -1);
    });

    $(document).off('click', '.btn-lesson-move-down').on('click', '.btn-lesson-move-down', function() {
        moveLesson(Number($(this).closest('.lesson-edit-card').data('lesson-index')), 1);
    });
}

function moveLesson(index, offset) {
    const targetIndex = index + offset;
    const lessons = currentSectionData.lessons;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const $cards = $('#lessons-list .lesson-edit-card');
    const $card = $cards.eq(index);
    const $targetCard = $cards.eq(targetIndex);
    const offset1 = $card.offset().top;
    const offset2 = $targetCard.offset().top;
    const distance = Math.abs(offset2 - offset1);
    const moveDistance = offset > 0 ? distance : -distance;

    $card.add($targetCard).css({
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        zIndex: 10
    });
    $card.css('transform', `translateY(${moveDistance}px)`);
    $targetCard.css('transform', `translateY(${-moveDistance}px)`);

    setTimeout(() => {
        const movedLesson = lessons.splice(index, 1)[0];
        lessons.splice(targetIndex, 0, movedLesson);
        renderLessonsList();
    }, 300);
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
            console.log('[LMS Debug] API Response received');
            $('#section-loading').addClass('hidden');
            if (r.message) {
                currentSectionData = r.message;
                deletedLessonIds = [];
                isEditMode = false;
                renderPage();
                $('#section-content').removeClass('hidden');
                $('#section-action-buttons-wrapper').removeClass('hidden');
            }
        }
    });
}

function renderPage() {
    console.log('[LMS Debug] Rendering Page. EditMode =', isEditMode);
    const data = currentSectionData;
    if (!data) return;

    if (data.course_title) {
        $('#breadcrumb-course').text(data.course_title);
    }
    $('#section-title').text(data.section_title);
    $('#section-description').text(data.description || 'Tidak ada deskripsi.');
    $('#lesson-count').text(`${data.lessons ? data.lessons.length : 0} Materi`);
    $('#breadcrumb-section').text(data.section_title);

    if (isEditMode) {
        $('#btn-section-enable-edit').addClass('hidden');
        $('#section-edit-mode-actions').removeClass('hidden');
        
        $('#section-info-view').addClass('hidden');
        $('#section-info-edit').removeClass('hidden');
        
        $('#input-section-title').val(data.section_title);
        $('#input-section-desc').val(data.description);
    } else {
        $('#btn-section-enable-edit').removeClass('hidden');
        $('#section-edit-mode-actions').addClass('hidden');

        $('#section-info-view').removeClass('hidden');
        $('#section-info-edit').addClass('hidden');
    }

    renderLessonsList();
}

function renderLessonsList() {
    const $container = $('#lessons-list').empty();
    quillInstances = {};
    const lessons = currentSectionData.lessons || [];
    console.log(`[LMS Debug] Rendering ${lessons.length} lessons. EditMode = ${isEditMode}`);

    $('#empty-lessons-msg').toggleClass('hidden', lessons.length !== 0);
    if (!lessons.length) return;

    lessons.forEach((lesson, index) => {
        const types = getLessonTypes(lesson.lesson_type);
        const typeBadges = types.map(type => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLessonTypeColor(type)}">${getLessonTypeLabel(type)}</span>`).join(' ');

        if (!isEditMode) {
            $container.append(`
                <div class="lesson-accordion border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden" data-lesson-index="${index}">
                    <button type="button" class="lesson-accordion-toggle w-full flex items-center justify-between py-3 px-5 text-left hover:bg-gray-50 transition-colors" aria-expanded="false">
                        <span class="flex items-center gap-3 min-w-0">
                            <span class="flex items-center justify-center w-7 h-7 bg-gray-100 text-gray-700 font-bold text-xs rounded-lg flex-shrink-0">${index + 1}</span>
                            <span class="min-w-0"><strong class="block text-base text-gray-900 truncate">${escapeHtml(lesson.lesson_title)}</strong><span class="flex flex-wrap gap-1 mt-1">${typeBadges}</span></span>
                        </span>
                        <svg class="lesson-accordion-icon w-5 h-5 text-gray-400 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div class="lesson-accordion-content grid transition-[grid-template-rows] duration-300 ease-out grid-rows-[0fr]">
                        <div class="overflow-hidden"><div class="lesson-body p-5 pt-0">${renderViewBody(lesson)}</div></div>
                    </div>
                </div>
            `);
            return;
        }

        const inputIdTitle = `lesson_title_${index}`;
        const inputIds = { inputIdArticle: `article_editor_${index}`, inputIdPdf: `pdf_url_${index}`, inputIdVideo: `video_url_${index}` };
        $container.append(`
            <div class="lesson-edit-card border-2 border-indigo-200 bg-white rounded-xl p-5 space-y-4 shadow-sm" data-lesson-index="${index}">
                <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span class="bg-indigo-100 text-indigo-700 font-bold text-xs px-2.5 py-1 rounded-md">Materi #${index + 1}</span>
                    <div class="flex items-center gap-1">
                        <button type="button" class="btn-lesson-move-up p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors ${index === 0 ? 'hidden' : ''}" title="Naikkan">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                        </button>
                        <button type="button" class="btn-lesson-move-down p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors ${index === lessons.length - 1 ? 'hidden' : ''}" title="Turunkan">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <button type="button" class="btn-delete-lesson p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Hapus materi">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-3 text-xs text-gray-700">
                    ${['ARTICLE', 'PDF', 'VIDEO'].map(type => `<label class="inline-flex items-center gap-1.5"><input type="checkbox" class="lesson-type-checkbox" value="${type}" ${types.includes(type) ? 'checked' : ''}>${getLessonTypeLabel(type)}</label>`).join('')}
                </div>
                <div>
                    <label for="${inputIdTitle}" class="block text-xs font-semibold text-gray-700 mb-1">Judul Materi</label>
                    <input type="text" id="${inputIdTitle}" name="${inputIdTitle}" class="w-full px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg" value="${escapeHtml(lesson.lesson_title)}" placeholder="Masukkan judul materi...">
                </div>
                <div class="lesson-edit-fields">${renderEditBody(lesson, index, inputIds)}</div>
            </div>
        `);
        bindLessonEditInputs(index, inputIds);
    });
}

function bindLessonEditInputs(index, inputIds) {
    const $card = $(`.lesson-edit-card[data-lesson-index="${index}"]`);
    const lesson = currentSectionData.lessons[index];
    $card.find(`#lesson_title_${index}`).on('input', function() { lesson.lesson_title = $(this).val(); });
    $card.find('.lesson-type-checkbox').on('change', function() {
        const selected = $card.find('.lesson-type-checkbox:checked').map(function() { return this.value; }).get();
        if (!selected.length) {
            this.checked = true;
            frappe.msgprint(__('Pilih minimal satu tipe materi.'));
            return;
        }
        lesson.lesson_type = selected.join(', ');
        $card.find('.lesson-edit-fields').html(renderEditBody(lesson, index, inputIds));
        bindLessonEditInputs(index, inputIds);
    });
    $card.find(`#${inputIds.inputIdArticle}`).on('input', function() { lesson.article_content = $(this).val(); });
    $card.find(`#${inputIds.inputIdPdf}`).on('input', function() { lesson.pdf_attachment_url = $(this).val(); });
    $card.find(`#${inputIds.inputIdVideo}`).on('input', function() { lesson.video_url = $(this).val(); });
    if (getLessonTypes(lesson.lesson_type).includes('ARTICLE') && window.Quill) initRichTextEditor(inputIds.inputIdArticle, index);
}

function initRichTextEditor(editorId, index) {
    setTimeout(() => {
        try {
            if (window.Quill && document.getElementById(editorId)) {
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
                    currentSectionData.lessons[index].article_content = quill.root.innerHTML;
                });

                quillInstances[index] = quill;
            }
        } catch (err) {
            console.error('[LMS Debug] Error initializing Quill Editor:', err);
        }
    }, 100);
}

function renderViewBody(lesson) {
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

function renderEditBody(lesson, index, ids) {
    const types = getLessonTypes(lesson.lesson_type);
    const fields = [];
    if (types.includes('ARTICLE')) fields.push(window.Quill ? `
        <div class="space-y-2"><label for="${ids.inputIdArticle}" class="text-xs font-semibold text-gray-700">Konten Artikel (Rich Text)</label>
        <div id="${ids.inputIdArticle}" class="bg-white rounded-lg min-h-[180px]">${lesson.article_content || ''}</div></div>` : `
        <div class="space-y-2"><label for="${ids.inputIdArticle}" class="text-xs font-semibold text-gray-700">Konten Artikel</label>
        <textarea id="${ids.inputIdArticle}" name="${ids.inputIdArticle}" rows="6" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Tulis artikel...">${escapeHtml(lesson.article_content || '')}</textarea></div>`);
    if (types.includes('PDF')) fields.push(`<div class="space-y-2"><label for="${ids.inputIdPdf}" class="text-xs font-semibold text-gray-700">URL PDF Attachment</label>
        <input type="url" id="${ids.inputIdPdf}" name="${ids.inputIdPdf}" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${escapeHtml(lesson.pdf_attachment_url || '')}" placeholder="https://example.com/file.pdf"></div>`);
    if (types.includes('VIDEO')) fields.push(`<div class="space-y-2"><label for="${ids.inputIdVideo}" class="text-xs font-semibold text-gray-700">URL Video (YouTube / Vimeo)</label>
        <input type="url" id="${ids.inputIdVideo}" name="${ids.inputIdVideo}" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" value="${escapeHtml(lesson.video_url || '')}" placeholder="https://www.youtube.com/watch?v=..."></div>`);
    return fields.join('');
}

function getLessonTypes(value) {
    const types = String(value || 'ARTICLE').split(',').map(type => type.trim().toUpperCase());
    return ['ARTICLE', 'PDF', 'VIDEO'].filter(type => types.includes(type));
}

function toggleEditMode(enableEdit) {
    console.log('[LMS Debug] toggleEditMode called with:', enableEdit);
    isEditMode = enableEdit;
    
    if (!enableEdit) {
        console.log('[LMS Debug] Reloading backend data on cancel');
        loadSectionDetail(currentSectionId);
        return;
    }
    
    renderPage();
}

function handleSaveSection() {
    frappe.confirm(__('Simpan semua perubahan pada bab dan materi ini?'), function() {
        console.log('[LMS Debug] Saving data:', currentSectionData);
        frappe.call({
            method: 'bima_lms.api.section_details.batch_save_lessons',
            args: {
                section_id: currentSectionId,
                section_title: currentSectionData.section_title,
                description: currentSectionData.description,
                lessons: JSON.stringify(currentSectionData.lessons),
                deleted_lesson_ids: JSON.stringify(deletedLessonIds)
            },
            freeze: true,
            freeze_message: __('Menyimpan perubahan...'),
            callback: function(r) {
                console.log('[LMS Debug] Save response:', r);
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