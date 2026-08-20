frappe.pages['section-detail'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '',
        single_column: true
    });

    // Load Tailwind CSS
    if (!document.getElementById('tailwind-cdn')) {
        let script = document.createElement('script');
        script.id = 'tailwind-cdn';
        script.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(script);
    }

    // Tambahkan CSS untuk rotate chevron
    if (!document.getElementById('section-detail-style')) {
        let style = document.createElement('style');
        style.id = 'section-detail-style';
        style.textContent = `
            .lesson-chevron {
                transition: transform 0.2s ease-in-out;
            }
            .lesson-chevron.rotate-180 {
                transform: rotate(180deg);
            }
            .lesson-card.border-indigo-200 {
                border-color: #c7d2fe !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Render page HTML
    $(page.body).html(getPageHTML());

    // ... rest of code
};

frappe.pages['section-detail'].on_page_show = function(wrapper) {
    initSectionPage();
};

function getPageHTML() {
    return `
        <div class="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
            <div class="max-w-7xl mx-auto space-y-6">

                <!-- Header / Breadcrumb -->
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center space-x-3 bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-100 w-fit">
                        <a href="javascript:history.back()" 
                           class="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                           title="Kembali">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                            </svg>
                        </a>
                        <div class="h-4 w-px bg-gray-200"></div>
                        <nav class="flex items-center space-x-2 text-sm font-medium">
                            <a href="/app/lms-dashboard" class="text-gray-500 hover:text-indigo-600 transition-colors">LMS Dashboard</a>
                            <span class="text-gray-300">/</span>
                            <a href="/app/courses" class="text-gray-500 hover:text-indigo-600 transition-colors">Courses</a>
                            <span class="text-gray-300">/</span>
                            <a href="javascript:history.back()" id="breadcrumb-course" class="text-gray-500 hover:text-indigo-600 transition-colors"></a>
                            <span class="text-gray-300">/</span>
                            <span id="breadcrumb-section" class="text-gray-900 font-bold">Detail Bab</span>
                        </nav>
                    </div>

                    <div id="action-buttons-wrapper" class="hidden flex items-center space-x-3">
                        <button id="btn-enable-edit" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                            <span>Edit Bab</span>
                        </button>

                        <div id="edit-mode-actions" class="hidden flex items-center space-x-2">
                            <button id="btn-cancel-edit" class="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
                                Batal
                            </button>
                            <button id="btn-save-section" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
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
                    <!-- Section Header -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
                        <h1 id="section-title" class="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight"></h1>
                        <p id="section-description" class="mt-2 text-gray-600"></p>
                        <div class="mt-4 flex items-center space-x-4 text-sm text-gray-500">
                            <span id="lesson-count" class="flex items-center space-x-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                </svg>
                                <span>0 Materi</span>
                            </span>
                        </div>
                    </div>

                    <!-- Lessons List -->
                    <div id="lessons-container" class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                        <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                            <h2 class="text-lg font-bold text-gray-900">Daftar Materi</h2>
                            <div id="edit-lesson-actions" class="hidden">
                                <button id="btn-add-lesson" class="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                                    </svg>
                                    <span>Tambah Materi</span>
                                </button>
                            </div>
                        </div>
                        <div id="lessons-list" class="space-y-3"></div>
                        <div id="empty-lessons-msg" class="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <p class="text-xs text-gray-500 font-medium">Belum ada materi yang ditambahkan pada bab ini.</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;
}

// ==================== Initialization ====================
function initSectionPage() {
    // Cara 1: Gunakan frappe.route_options
    let section_id = null;
    
    // Cek dari route_options (dari frappe.set_route dengan object)
    if (frappe.route_options && frappe.route_options.id) {
        section_id = frappe.route_options.id;
    }
    
    // Jika tidak ada di route_options, cek dari route array
    if (!section_id) {
        const route = frappe.get_route();
        // route bisa berupa ['section-detail', '123'] 
        // atau ['section-detail', {'id': '123'}]
        if (route.length > 1) {
            if (typeof route[1] === 'object' && route[1].id) {
                section_id = route[1].id;
            } else if (typeof route[1] === 'string' && route[1].match(/^\d+$/)) {
                section_id = route[1];
            }
        }
    }
    
    // Jika masih tidak ada, cek dari URL parameter
    if (!section_id) {
        const urlParams = new URLSearchParams(window.location.search);
        section_id = urlParams.get('id');
    }

    if (!section_id) {
        frappe.msgprint({
            title: __('ID Bab Tidak Ditemukan'),
            indicator: 'red',
            message: __('Parameter ID Bab tidak ditemukan di URL.')
        });
        frappe.set_route('courses');
        return;
    }

    // Load section data
    loadSectionDetail(section_id);
}

function loadSectionDetail(section_id) {
    $('#section-loading').removeClass('hidden');
    $('#section-content').addClass('hidden');
    $('#action-buttons-wrapper').addClass('hidden');

    frappe.call({
        method: 'bima_lms.api.section_details.get_section_detail',
        args: { section_id: section_id },
        callback: function(r) {
            $('#section-loading').addClass('hidden');

            if (r.message) {
                const data = r.message;
                renderSection(data);
                $('#section-content').removeClass('hidden');
                $('#action-buttons-wrapper').removeClass('hidden');
            }
        },
        error: function(err) {
            console.error('Error loading section:', err);
            $('#section-loading').addClass('hidden');
            frappe.msgprint({
                title: __('Gagal Memuat Data'),
                indicator: 'red',
                message: __('Gagal memuat detail bab. Silakan coba lagi.')
            });
        }
    });
}

function renderSection(data) {
    // Set breadcrumb
    if (data.course_title) {
        $('#breadcrumb-course').text(data.course_title);
        $('#breadcrumb-course').attr('href', `/app/course-detail?id=${data.course_id}`);
    }

    // Set section header
    $('#section-title').text(data.section_title);
    $('#section-description').text(data.description || 'Tidak ada deskripsi untuk bab ini.');
    $('#lesson-count span').text(`${data.lessons.length} Materi`);
    $('#breadcrumb-section').text(data.section_title);

    // Render lessons
    renderLessons(data.lessons);

    // Setup edit mode
    setupEditMode(data);
}

function renderLessons(lessons) {
    const $container = $('#lessons-list');
    $container.empty();

    if (lessons.length === 0) {
        $('#empty-lessons-msg').show();
        return;
    }

    $('#empty-lessons-msg').hide();

    lessons.forEach((lesson, index) => {
        const $lessonCard = $(`
            <div class="lesson-card border border-gray-200 rounded-lg overflow-hidden transition-all duration-200" data-lesson-id="${lesson.lesson_id}">
                <div class="lesson-header flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                    <div class="flex items-center space-x-3 flex-1">
                        <span class="lesson-number text-gray-400 font-bold text-sm min-w-[24px]">${index + 1}</span>
                        <div class="flex-1">
                            <h3 class="text-sm font-semibold text-gray-900 lesson-title">${escapeHtml(lesson.lesson_title)}</h3>
                            <div class="flex items-center space-x-2 mt-0.5">
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLessonTypeColor(lesson.lesson_type)}">
                                    ${getLessonTypeLabel(lesson.lesson_type)}
                                </span>
                                ${lesson.is_preview ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Preview</span>` : ''}
                                ${lesson.estimated_duration_minutes ? `<span class="text-xs text-gray-400">${lesson.estimated_duration_minutes} menit</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="btn-toggle-lesson p-1 text-gray-400 hover:text-gray-600 transition-colors">
                            <svg class="w-5 h-5 lesson-chevron transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        <div class="edit-lesson-actions hidden space-x-1">
                            <button class="btn-edit-lesson p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors" title="Edit">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                            </button>
                            <button class="btn-delete-lesson p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors" title="Hapus">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                            <button class="btn-move-lesson-up p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors" title="Naik">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                                </svg>
                            </button>
                            <button class="btn-move-lesson-down p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors" title="Turun">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="lesson-body hidden border-t border-gray-100 p-4 bg-gray-50">
                    ${renderLessonContent(lesson)}
                </div>
            </div>
        `);

        // Toggle accordion - PERBAIKAN: gunakan event handler yang lebih explicit
        $lessonCard.find('.btn-toggle-lesson').on('click', function(e) {
            e.stopPropagation();
            const $card = $(this).closest('.lesson-card');
            toggleLesson($card);
        });

        $lessonCard.find('.lesson-header').on('click', function(e) {
            // Jangan toggle jika klik pada tombol edit
            if ($(e.target).closest('.edit-lesson-actions, .btn-toggle-lesson').length) return;
            const $card = $(this).closest('.lesson-card');
            toggleLesson($card);
        });

        $container.append($lessonCard);
    });
}

function toggleLesson($card) {
    const $body = $card.find('.lesson-body');
    const $chevron = $card.find('.lesson-chevron');
    
    // Jika sedang disembunyikan (punya class hidden atau sedang tidak visible)
    if ($body.hasClass('hidden') || !$body.is(':visible')) {
        $body.removeClass('hidden').hide().slideDown(200);
        $chevron.addClass('rotate-180');
        $card.addClass('border-indigo-200');
    } else {
        $body.slideUp(200, function() {
            $body.addClass('hidden');
        });
        $chevron.removeClass('rotate-180');
        $card.removeClass('border-indigo-200');
    }
}

function renderLessonContent(lesson) {
    // Fungsi untuk mengkonversi URL video ke embed URL (JavaScript version)
    function getEmbedVideoUrl(url) {
        if (!url) return null;
        
        // YouTube - gunakan regex yang sama dengan Python
        const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch && youtubeMatch[1]) {
            return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        }
        
        // Vimeo
        const vimeoRegex = /vimeo\.com\/(\d+)/;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch && vimeoMatch[1]) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }
        
        return url;
    }

    // Gunakan embed_video_url dari backend jika tersedia, atau konversi di frontend
    const videoUrl = lesson.embed_video_url || getEmbedVideoUrl(lesson.video_url);

    switch (lesson.lesson_type) {
        case 'ARTICLE':
            return `
                <div class="prose prose-sm max-w-none">
                    ${lesson.article_content || '<p class="text-gray-500 italic">Tidak ada konten artikel.</p>'}
                </div>
            `;
        case 'PDF':
            return `
                <div class="space-y-3">
                    ${lesson.pdf_attachment_url ? `
                        <div class="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                            </svg>
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-900">Dokumen PDF</p>
                                <a href="${lesson.pdf_attachment_url}" target="_blank" class="text-sm text-indigo-600 hover:text-indigo-800 hover:underline">
                                    Buka PDF →
                                </a>
                            </div>
                        </div>
                    ` : '<p class="text-gray-500 italic">Tidak ada file PDF yang dilampirkan.</p>'}
                </div>
            `;
        case 'VIDEO':
            return `
                <div class="space-y-3">
                    ${videoUrl ? `
                        <div class="relative w-full overflow-hidden rounded-lg bg-black aspect-video shadow-inner">
                            <iframe class="w-full h-full" src="${videoUrl}" frameborder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen></iframe>
                        </div>
                        ${lesson.min_watch_percentage ? `
                            <p class="text-xs text-gray-500">Minimal tonton: ${lesson.min_watch_percentage}%</p>
                        ` : ''}
                    ` : '<p class="text-gray-500 italic">Tidak ada video yang dilampirkan.</p>'}
                </div>
            `;
        default:
            return '<p class="text-gray-500 italic">Tipe materi tidak dikenal.</p>';
    }
}

function getLessonTypeLabel(type) {
    const types = {
        'ARTICLE': 'Artikel',
        'PDF': 'PDF',
        'VIDEO': 'Video'
    };
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

function setupEditMode(data) {
    // Edit mode toggle
    $('#btn-enable-edit').off('click').on('click', function() {
        toggleEditMode(true, data);
    });

    $('#btn-cancel-edit').off('click').on('click', function() {
        toggleEditMode(false, data);
    });

    $('#btn-save-section').off('click').on('click', function() {
        handleSaveSection(data.section_id);
    });
}

function toggleEditMode(isEdit, data) {
    if (isEdit) {
        $('#btn-enable-edit').addClass('hidden');
        $('#edit-mode-actions').removeClass('hidden');
        $('#edit-lesson-actions').removeClass('hidden');
        $('.edit-lesson-actions').removeClass('hidden');
        $('.lesson-card').addClass('border-dashed');
    } else {
        $('#btn-enable-edit').removeClass('hidden');
        $('#edit-mode-actions').addClass('hidden');
        $('#edit-lesson-actions').addClass('hidden');
        $('.edit-lesson-actions').addClass('hidden');
        $('.lesson-card').removeClass('border-dashed');
        // Reload data
        const route = frappe.get_route();
        let section_id = null;
        if (route.length > 1) {
            if (typeof route[1] === 'object' && route[1].id) {
                section_id = route[1].id;
            } else {
                section_id = route[1];
            }
        }
        if (section_id) {
            loadSectionDetail(section_id);
        }
    }
}

function handleSaveSection(section_id) {
    frappe.msgprint({
        title: __('Coming Soon'),
        indicator: 'blue',
        message: __('Fitur simpan bab akan segera tersedia.')
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}