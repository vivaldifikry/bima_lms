frappe.pages['course-detail'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '',
        single_column: true
    });

    if (!document.getElementById('tailwind-cdn')) {
        let script = document.createElement('script');
        script.id = 'tailwind-cdn';
        script.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(script);
    }

    $(page.body).html(`
        <div class="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
            <div class="max-w-7xl mx-auto space-y-6">

                <!-- Navigation & Edit Action Bar -->
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
                            <span id="breadcrumb-title" class="text-gray-900 font-bold">Detail Course</span>
                        </nav>
                    </div>

                    <!-- Action Buttons -->
                    <div id="action-buttons-wrapper" class="hidden flex items-center space-x-3">
                        <!-- View Mode Button -->
                        <button id="btn-enable-edit" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                            <span>Edit Course</span>
                        </button>

                        <!-- Edit Mode Buttons -->
                        <div id="edit-mode-actions" class="hidden flex items-center space-x-2">
                            <button id="btn-cancel-edit" class="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
                                Batal
                            </button>
                            <button id="btn-save-course" class="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                <span>Simpan Perubahan</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Loading State -->
                <div id="detail-loading" class="flex items-center justify-center py-20">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    <span class="ml-3 text-gray-600 font-medium text-sm">Memuat detail mata pelajaran...</span>
                </div>

                <!-- Main Content Layout (Grid 2 Kolom) -->
                <div id="detail-content" class="hidden grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    <!-- Kolom Kiri: Header, Deskripsi, & Section (8 Columns) -->
                    <div class="lg:col-span-8 space-y-6">
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6">
                            
                            <!-- Category & Instructor Row -->
                            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                                <div>
                                    <!-- View Mode Badge -->
                                    <span id="view-category" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700"></span>
                                    
                                    <!-- Edit Mode Select -->
                                    <div id="edit-category-wrapper" class="hidden space-y-1.5">
                                        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Kategori <span class="text-red-500">*</span>
                                        </label>
                                        <div class="relative min-w-[240px]">
                                            <select id="edit-category-id" 
                                                    class="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3.5 py-2 pr-10 text-sm font-medium text-gray-800 shadow-sm transition duration-150 ease-in-out hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer">
                                            </select>
                                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex items-center space-x-2 text-sm text-gray-600">
                                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                    <span>Pengampu: <strong id="detail-instructor" class="text-gray-900 font-semibold"></strong></span>
                                </div>
                            </div>

                            <!-- Title & Short Description -->
                            <div class="space-y-4">
                                <!-- View Mode Title & Short Desc -->
                                <div id="view-title-group" class="space-y-2">
                                    <h1 id="view-title" class="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight"></h1>
                                    <p id="view-short-desc" class="text-base text-gray-600 font-normal leading-relaxed"></p>
                                </div>

                                <!-- Edit Mode Inputs -->
                                <div id="edit-title-group" class="hidden space-y-4">
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Judul Course <span class="text-red-500">*</span></label>
                                        <input type="text" id="edit-title" class="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-lg font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Masukkan judul course...">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Deskripsi Singkat</label>
                                        <textarea id="edit-short-desc" rows="2" class="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ringkasan singkat course..."></textarea>
                                    </div>
                                </div>
                            </div>

                            <!-- Full Description Section -->
                            <div class="pt-5 border-t border-gray-100 space-y-3">
                                <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center space-x-1.5">
                                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
                                    </svg>
                                    <span>Deskripsi Lengkap</span>
                                </h2>
                                
                                <!-- View Mode -->
                                <div id="view-full-desc-wrapper" class="bg-gray-50/70 rounded-lg p-4 border border-gray-100">
                                    <div id="view-full-desc" class="text-gray-700 text-sm sm:text-base leading-relaxed space-y-2"></div>
                                </div>

                                <!-- Edit Mode -->
                                <div id="edit-full-desc-wrapper" class="hidden">
                                    <textarea id="edit-full-desc" rows="6" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Tuliskan materi atau penjelasan lengkap..."></textarea>
                                </div>
                            </div>

                        </div>

                        <!-- Bab / Sections List Container -->
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-4">
                            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                                <h2 class="text-lg font-bold text-gray-900 flex items-center space-x-2">
                                    <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                    </svg>
                                    <span>Materi / Bab Pembelajaran</span>
                                </h2>
                                <span id="sections-count" class="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">0 Bab</span>
                            </div>

                            <!-- Loading Sections -->
                            <div id="sections-loading" class="flex items-center justify-center py-8">
                                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                <span class="ml-2 text-xs text-gray-500 font-medium">Memuat materi bab...</span>
                            </div>

                            <!-- Sections List Grid/Accordion -->
                            <div id="sections-list" class="hidden space-y-3"></div>
                        </div>

                    </div>

                    <!-- Kolom Kanan: Video Intro (4 Columns) -->
                    <div class="lg:col-span-4 sticky top-6 space-y-4">
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
                            <h3 class="text-sm font-bold text-gray-800 flex items-center space-x-2">
                                <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>Video Intro</span>
                            </h3>

                            <!-- View Mode Video Player -->
                            <div id="video-frame-wrapper" class="hidden relative w-full overflow-hidden rounded-lg bg-black aspect-video shadow-inner">
                                <iframe id="video-frame" class="w-full h-full" src="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                            </div>

                            <div id="video-placeholder" class="flex flex-col items-center justify-center p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-center space-y-2 aspect-video">
                                <div class="p-3 bg-gray-100 rounded-full text-gray-400">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                    </svg>
                                </div>
                                <p class="text-xs font-semibold text-gray-500">Video Intro Tidak Tersedia</p>
                            </div>

                            <!-- Edit Mode Input Video Link -->
                            <div id="edit-video-wrapper" class="hidden pt-2 border-t border-gray-100 space-y-1">
                                <label class="block text-xs font-semibold text-gray-500">URL Video</label>
                                <input type="url" id="edit-video-url" class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="https://www.youtube.com/embed/...">
                                <span class="text-[11px] text-gray-400 block">Gunakan URL Embed (Contoh: https://www.youtube.com/watch?v=xyz)</span>
                            </div>

                        </div>
                    </div>

                </div>

            </div>
        </div>
    `);

    // Register Event Listeners
    $('#btn-enable-edit').on('click', toggleEditMode);
    $('#btn-cancel-edit').on('click', toggleViewMode);
    $('#btn-save-course').on('click', handleSaveCourse);
};

// Global State
let currentCourseData = null;
let categoryListCache = null;

frappe.pages['course-detail'].refresh = function(wrapper) {
    const route = frappe.get_route();
    const params = frappe.route_options || {};
    const course_id = params.id || route[1];

    if (!course_id) {
        frappe.msgprint("ID Course tidak ditemukan.");
        frappe.set_route('courses');
        return;
    }

    load_course_detail(course_id);
    load_course_sections(course_id);
};

function load_course_detail(course_id) {
    $('#detail-loading').removeClass('hidden');
    $('#detail-content').addClass('hidden');
    $('#action-buttons-wrapper').addClass('hidden');

    frappe.call({
        method: 'bima_lms.api.courses.get_course_detail',
        args: { course_id: course_id },
        callback: function(r) {
            $('#detail-loading').addClass('hidden');

            if (r.message) {
                currentCourseData = r.message;
                renderViewMode();
                $('#detail-content').removeClass('hidden');
                $('#action-buttons-wrapper').removeClass('hidden');
            }
        }
    });
}

function load_course_sections(course_id) {
    $('#sections-loading').removeClass('hidden');
    $('#sections-list').addClass('hidden');

    frappe.call({
        method: 'bima_lms.api.course_sections.get_course_sections',
        args: { course_id: course_id },
        callback: function(r) {
            $('#sections-loading').addClass('hidden');
            const $list = $('#sections-list');
            $list.empty().removeClass('hidden');

            if (r.message && r.message.length > 0) {
                const sections = r.message;
                $('#sections-count').text(`${sections.length} Bab`);

                sections.forEach((sec, idx) => {
                    const descHtml = escapeHtml(sec.description || '').replace(/\n/g, '<br>');
                    const item = $(`
                        <div class="border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-indigo-200 transition-colors">
                            <div class="section-header p-4 flex items-center justify-between cursor-pointer select-none bg-gray-50/50 hover:bg-gray-50">
                                <div class="flex items-center space-x-3">
                                    <span class="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                                        ${idx + 1}
                                    </span>
                                    <h3 class="text-sm font-bold text-gray-800">${escapeHtml(sec.section_title)}</h3>
                                </div>
                                <svg class="chevron-icon w-4 h-4 text-gray-400 transform transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </div>
                            <div class="section-body hidden p-4 border-t border-gray-100 bg-white text-xs sm:text-sm text-gray-600 leading-relaxed">
                                ${descHtml || '<em class="text-gray-400">Tidak ada deskripsi pada bab ini.</em>'}
                            </div>
                        </div>
                    `);

                    // Toggle Expand/Collapse Bab
                    item.find('.section-header').on('click', function() {
                        const body = item.find('.section-body');
                        const icon = item.find('.chevron-icon');
                        
                        body.toggleClass('hidden');
                        icon.toggleClass('rotate-180');
                    });

                    $list.append(item);
                });
            } else {
                $('#sections-count').text('0 Bab');
                $list.html(`
                    <div class="p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-500 text-xs">
                        Belum ada bab/materi yang ditambahkan pada mata pelajaran ini.
                    </div>
                `);
            }
        }
    });
}

function renderViewMode() {
    const data = currentCourseData;
    $('#breadcrumb-title').text(data.course_title);
    $('#view-title').text(data.course_title);
    $('#view-category').text(data.category_name);
    $('#detail-instructor').text(data.instructor_name);
    $('#view-short-desc').text(data.short_description);
    
    const formattedDesc = escapeHtml(data.full_description || '').replace(/\n/g, '<br>');
    $('#view-full-desc').html(formattedDesc || '<em class="text-gray-400">Belum ada deskripsi lengkap.</em>');

    if (data.embed_video_url) {
        $('#video-frame').attr('src', data.embed_video_url);
        $('#video-frame-wrapper').removeClass('hidden');
        $('#video-placeholder').addClass('hidden');
    } else {
        $('#video-frame-wrapper').addClass('hidden');
        $('#video-placeholder').removeClass('hidden');
        $('#video-frame').attr('src', '');
    }

    toggleViewMode();
}

function toggleEditMode() {
    loadCategoriesDropdown(currentCourseData.category_id);

    $('#edit-title').val(currentCourseData.course_title);
    $('#edit-short-desc').val(currentCourseData.short_description);
    $('#edit-full-desc').val(currentCourseData.full_description);
    $('#edit-video-url').val(currentCourseData.embed_video_url);

    $('#btn-enable-edit').addClass('hidden');
    $('#edit-mode-actions').removeClass('hidden');

    $('#view-category').addClass('hidden');
    $('#edit-category-wrapper').removeClass('hidden');

    $('#view-title-group').addClass('hidden');
    $('#edit-title-group').removeClass('hidden');

    $('#view-full-desc-wrapper').addClass('hidden');
    $('#edit-full-desc-wrapper').removeClass('hidden');

    $('#edit-video-wrapper').removeClass('hidden');
}

function toggleViewMode() {
    $('#btn-enable-edit').removeClass('hidden');
    $('#edit-mode-actions').addClass('hidden');

    $('#view-category').removeClass('hidden');
    $('#edit-category-wrapper').addClass('hidden');

    $('#view-title-group').removeClass('hidden');
    $('#edit-title-group').addClass('hidden');

    $('#view-full-desc-wrapper').removeClass('hidden');
    $('#edit-full-desc-wrapper').addClass('hidden');

    $('#edit-video-wrapper').addClass('hidden');
}

function loadCategoriesDropdown(selectedCategoryId) {
    const $select = $('#edit-category-id');
    $select.empty();

    if (categoryListCache) {
        populateSelectOptions($select, categoryListCache, selectedCategoryId);
        return;
    }

    frappe.call({
        method: 'bima_lms.api.courses.get_course_categories',
        callback: function(r) {
            if (r.message) {
                categoryListCache = r.message;
                populateSelectOptions($select, categoryListCache, selectedCategoryId);
            }
        }
    });
}

function populateSelectOptions($select, categories, selectedId) {
    $select.empty();
    $select.append('<option value="" disabled class="text-gray-400">-- Pilih Kategori --</option>');

    categories.forEach(cat => {
        const isSelected = String(cat.category_id) === String(selectedId) ? 'selected' : '';
        $select.append(`
            <option value="${cat.category_id}" ${isSelected} class="py-2 text-gray-800 bg-white">
                ${escapeHtml(cat.category_name)}
            </option>
        `);
    });
}

function handleSaveCourse() {
    const title = $('#edit-title').val().trim();
    const category_id = $('#edit-category-id').val();
    const short_desc = $('#edit-short-desc').val().trim();
    const full_desc = $('#edit-full-desc').val().trim();
    const video_url = $('#edit-video-url').val().trim();

    if (!title) {
        frappe.msgprint({
            title: __('Validasi Gagal'),
            indicator: 'red',
            message: __('Judul Course tidak boleh kosong.')
        });
        return;
    }

    if (!category_id) {
        frappe.msgprint({
            title: __('Validasi Gagal'),
            indicator: 'red',
            message: __('Kategori Course wajib dipilih.')
        });
        return;
    }

    frappe.confirm(
        'Apakah Anda yakin ingin menyimpan perubahan data course ini?',
        function() {
            frappe.call({
                method: 'bima_lms.api.courses.update_course_detail',
                args: {
                    course_id: currentCourseData.course_id,
                    course_title: title,
                    category_id: category_id,
                    short_description: short_desc,
                    full_description: full_desc,
                    embed_video_url: video_url
                },
                freeze: true,
                freeze_message: __('Menyimpan perubahan...'),
                callback: function(r) {
                    if (r.message && r.message.status === 'success') {
                        frappe.show_alert({
                            message: __('Course berhasil diperbarui'),
                            indicator: 'green'
                        });
                        
                        load_course_detail(currentCourseData.course_id);
                    }
                }
            });
        }
    );
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