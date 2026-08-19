frappe.pages['courses'].on_page_load = function(wrapper) {
    // CLEANUP: Hapus data jika user Guest
    if (frappe.session && frappe.session.user === 'Guest') {
        localStorage.removeItem('active_student_id');
        localStorage.removeItem('active_student_name');
        sessionStorage.removeItem('active_student_id');
        sessionStorage.removeItem('active_student_name');
    }

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

    if (!document.getElementById('filter-modal-style')) {
        let style = document.createElement('style');
        style.id = 'filter-modal-style';
        style.textContent = `
            /* Custom style untuk checkbox di modal */
            .filter-modal-checkbox:checked + span {
                color: #4f46e5;
            }
            .filter-modal-checkbox:checked ~ .checkmark {
                background-color: #4f46e5;
                border-color: #4f46e5;
            }
        `;
        document.head.appendChild(style);
    }

    $(page.body).html(`
        <div class="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
            <div class="max-w-7xl mx-auto space-y-6">

                <!-- Compact Navigation & Breadcrumb + Student Switcher Container -->
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center space-x-3 bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-100 w-fit">
                        <a href="/app/lms-dashboard" 
                           class="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                           title="Kembali ke LMS Dashboard">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                            </svg>
                        </a>
                        <div class="h-4 w-px bg-gray-200"></div>
                        <nav class="flex items-center space-x-2 text-sm font-medium">
                            <a href="/app/lms-dashboard" class="text-gray-500 hover:text-indigo-600 transition-colors">LMS Dashboard</a>
                            <span class="text-gray-300">/</span>
                            <span class="text-gray-900 font-bold">Courses</span>
                        </nav>
                    </div>

                    <!-- Container Badge Switcher Akun Anak -->
                    <div id="student-switcher-container"></div>
                </div>

                <!-- Loading Indicator -->
                <div id="courses-loading" class="flex items-center justify-center py-16">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    <span class="ml-3 text-gray-600 font-medium text-sm">Memuat data mata pelajaran...</span>
                </div>

                <!-- Dashboard Content -->
                <div id="courses-content" class="hidden space-y-6">
                    <!-- Stats Row with Filter Button -->
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
                                <div class="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-500">Total Mata Pelajaran</p>
                                    <h3 id="stat-total-courses" class="text-2xl font-bold text-gray-800">0</h3>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Filter Button -->
                        <div id="filter-button-container" class="hidden">
                            <button id="btn-filter-rombels" 
                                    class="inline-flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 text-sm font-medium rounded-lg shadow-sm transition-all duration-200">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                                </svg>
                                <span>Filter Courses</span>
                                <span id="filter-badge" class="hidden bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">0</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <h2 class="text-lg font-bold text-gray-800 mb-4">Daftar Mata Pelajaran</h2>
                        <div id="courses-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                    </div>
                </div>

            </div>
        </div>
    `);

    // Inisialisasi awal dengan memuat script student_switcher.js terlebih dahulu
    frappe.require('/assets/bima_lms/js/student_switcher.js', function() {
        initCoursesPage();
    });
};

frappe.pages['courses'].on_page_show = function(wrapper) {
    if (window.StudentSwitcher) {
        initCoursesPage();
    }
};



// Variabel global
let currentStudentId = null;
let availableRombels = [];
let availableCategories = [];
let selectedRombelIds = [];
let selectedCategoryIds = [];
let filterDialog = null;
let isParentUser = false;
let isAdminUser = false; // Tambahkan flag untuk admin

function initCoursesPage() {
    window.StudentSwitcher.init(function(activeStudentId) {
        currentStudentId = activeStudentId;
        
        // Cek role user
        const userRoles = window.StudentSwitcher ? window.StudentSwitcher.getUserRoles() : [];
        isParentUser = userRoles.includes('LMS Parent');
        isAdminUser = userRoles.includes('Administrator') || 
                      userRoles.includes('System Manager') ||
                      userRoles.includes('Admin');
        
        // Render Badge Header
        window.StudentSwitcher.renderWidget('#student-switcher-container', function(newStudentId) {
            currentStudentId = newStudentId;
            selectedRombelIds = [];
            selectedCategoryIds = [];
            loadAllData(newStudentId);
        });

        loadAllData(activeStudentId);
    });
}

function loadAllData(studentId) {
    // Load categories (selalu dibutuhkan)
    loadCategories(function() {
        // Jika parent dan ada studentId, load rombels
        if (isParentUser && studentId) {
            loadStudentRombels(studentId);
        } else {
            // Untuk non-parent atau tidak ada studentId
            availableRombels = [];
            
            // Tampilkan tombol filter untuk semua user (kecuali Guest)
            // Kecuali jika user adalah Admin dan tidak ada data (tapi tetap tampilkan)
            if (frappe.session && frappe.session.user !== 'Guest') {
                $('#filter-button-container').removeClass('hidden');
            }
            
            load_courses_data(studentId, [], selectedCategoryIds);
        }
    });
}

function loadCategories(callback) {
    frappe.call({
        method: 'bima_lms.api.courses.get_course_categories',
        callback: function(r) {
            if (r.message) {
                availableCategories = r.message;
            } else {
                availableCategories = [];
            }
            if (callback) callback();
        },
        error: function(err) {
            console.error('Error loading categories:', err);
            availableCategories = [];
            if (callback) callback();
        }
    });
}

function loadStudentRombels(studentId) {
    if (!isParentUser || !studentId) {
        // Tampilkan tombol filter untuk semua user
        if (frappe.session && frappe.session.user !== 'Guest') {
            $('#filter-button-container').removeClass('hidden');
        }
        load_courses_data(studentId, [], selectedCategoryIds);
        return;
    }

    frappe.call({
        method: 'bima_lms.api.courses.get_student_rombels',
        args: {
            student_id: studentId
        },
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                availableRombels = r.message;
            } else {
                availableRombels = [];
            }
            
            // Tampilkan tombol filter untuk semua user
            if (frappe.session && frappe.session.user !== 'Guest') {
                $('#filter-button-container').removeClass('hidden');
            }
            
            load_courses_data(studentId, [], selectedCategoryIds);
        },
        error: function(err) {
            console.error('Error loading rombels:', err);
            availableRombels = [];
            
            // Tampilkan tombol filter untuk semua user
            if (frappe.session && frappe.session.user !== 'Guest') {
                $('#filter-button-container').removeClass('hidden');
            }
            
            load_courses_data(studentId, [], selectedCategoryIds);
        }
    });
}

function openFilterModal() {
    // Jika dialog sudah ada, destroy dulu
    if (filterDialog) {
        filterDialog.hide();
        filterDialog = null;
    }

    // Cek apakah user adalah parent dengan rombel
    const hasRombels = isParentUser && availableRombels.length > 0;
    
    // Log untuk debugging
    console.log('Opening filter modal:', {
        isParentUser: isParentUser,
        isAdminUser: isAdminUser,
        hasRombels: hasRombels,
        categoriesCount: availableCategories.length,
        rombelsCount: availableRombels.length
    });

    // Buat HTML untuk modal
    let html = `
        <div class="space-y-4">
            <p class="text-sm text-gray-600">Pilih filter untuk menampilkan mata pelajaran yang sesuai.</p>
            
            <!-- Filter Kategori -->
            <div>
                <label class="text-sm font-semibold text-gray-700 block mb-2">📂 Kategori</label>
                <div class="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
    `;

    // Tambahkan opsi "Semua Kategori"
    const isAllCategorySelected = selectedCategoryIds.length === 0;
    html += `
        <div class="category-filter-option flex items-center space-x-3 p-2.5 rounded-lg border ${isAllCategorySelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'} cursor-pointer transition-all" data-value="all">
            <input type="radio" name="category_filter" value="all" ${isAllCategorySelected ? 'checked' : ''} class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
            <span class="font-medium text-gray-700">📚 Semua Kategori</span>
        </div>
    `;

    if (availableCategories.length === 0) {
        html += `
            <div class="text-center text-gray-500 text-sm py-2">
                Tidak ada kategori tersedia
            </div>
        `;
    } else {
        availableCategories.forEach(category => {
            const isSelected = selectedCategoryIds.includes(String(category.category_id));
            html += `
                <div class="category-filter-option flex items-center space-x-3 p-2.5 rounded-lg border ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'} cursor-pointer transition-all" data-value="${category.category_id}">
                    <input type="checkbox" name="category_filter_checkbox" value="${category.category_id}" ${isSelected ? 'checked' : ''} class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded">
                    <span class="font-medium text-gray-700">${escapeHtml(category.category_name)}</span>
                </div>
            `;
        });
    }

    html += `
                </div>
            </div>
    `;

    // Filter Rombel (hanya untuk parent yang memiliki rombel)
    if (hasRombels) {
        html += `
            <div>
                <label class="text-sm font-semibold text-gray-700 block mb-2">🏫 Rombel</label>
                <div class="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
        `;

        // Tambahkan opsi "Semua Rombel"
        const isAllRombelSelected = selectedRombelIds.length === 0;
        html += `
            <div class="rombel-filter-option flex items-center space-x-3 p-2.5 rounded-lg border ${isAllRombelSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'} cursor-pointer transition-all" data-value="all">
                <input type="radio" name="rombel_filter" value="all" ${isAllRombelSelected ? 'checked' : ''} class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
                <span class="font-medium text-gray-700">📚 Semua Rombel</span>
            </div>
        `;

        availableRombels.forEach(rombel => {
            const isSelected = selectedRombelIds.includes(String(rombel.rombel_id));
            html += `
                <div class="rombel-filter-option flex items-center space-x-3 p-2.5 rounded-lg border ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'} cursor-pointer transition-all" data-value="${rombel.rombel_id}">
                    <input type="checkbox" name="rombel_filter_checkbox" value="${rombel.rombel_id}" ${isSelected ? 'checked' : ''} class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded">
                    <span class="font-medium text-gray-700">${escapeHtml(rombel.rombel_name)} ${rombel.grade_level ? ' - ' + escapeHtml(rombel.grade_level) : ''}</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    html += `</div>`;

    // Buat dialog
    filterDialog = new frappe.ui.Dialog({
        title: 'Filter Mata Pelajaran',
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'filter_content',
                options: html
            }
        ],
        primary_action_label: 'Terapkan Filter',
        primary_action: function() {
            const $dialog = filterDialog.$wrapper;
            
            // Ambil nilai kategori yang dipilih
            const $categoryChecked = $dialog.find('input[name="category_filter_checkbox"]:checked');
            const $categoryRadioAll = $dialog.find('input[name="category_filter"]:checked');
            
            if ($categoryRadioAll.length > 0 && $categoryRadioAll.val() === 'all') {
                selectedCategoryIds = [];
            } else {
                selectedCategoryIds = $categoryChecked.map(function() {
                    return $(this).val();
                }).get();
            }
            
            // Ambil nilai rombel yang dipilih (jika ada)
            if (hasRombels) {
                const $rombelChecked = $dialog.find('input[name="rombel_filter_checkbox"]:checked');
                const $rombelRadioAll = $dialog.find('input[name="rombel_filter"]:checked');
                
                if ($rombelRadioAll.length > 0 && $rombelRadioAll.val() === 'all') {
                    selectedRombelIds = [];
                } else {
                    selectedRombelIds = $rombelChecked.map(function() {
                        return $(this).val();
                    }).get();
                }
            }
            
            filterDialog.hide();
            updateFilterBadge();
            load_courses_data(currentStudentId, selectedRombelIds, selectedCategoryIds);
        },
        secondary_action_label: 'Reset Filter',
        secondary_action: function() {
            selectedRombelIds = [];
            selectedCategoryIds = [];
            
            const $dialog = filterDialog.$wrapper;
            
            // Reset kategori
            $dialog.find('input[name="category_filter_checkbox"]').prop('checked', false);
            $dialog.find('input[name="category_filter"]').prop('checked', true);
            $dialog.find('.category-filter-option').removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
            $dialog.find('.category-filter-option[data-value="all"]').addClass('border-indigo-500 bg-indigo-50').removeClass('border-gray-200');
            
            // Reset rombel (jika ada)
            if (hasRombels) {
                $dialog.find('input[name="rombel_filter_checkbox"]').prop('checked', false);
                $dialog.find('input[name="rombel_filter"]').prop('checked', true);
                $dialog.find('.rombel-filter-option').removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
                $dialog.find('.rombel-filter-option[data-value="all"]').addClass('border-indigo-500 bg-indigo-50').removeClass('border-gray-200');
            }
            
            updateFilterBadge();
            filterDialog.hide();
            load_courses_data(currentStudentId, [], []);
        }
    });

    // Bind event handler untuk kategori
    filterDialog.$wrapper.on('click', '.category-filter-option', function(e) {
        if ($(e.target).is('input')) return;
        
        const $option = $(this);
        const $radio = $option.find('input[name="category_filter"]');
        const $checkbox = $option.find('input[name="category_filter_checkbox"]');
        
        if ($radio.length > 0) {
            $radio.prop('checked', true);
            filterDialog.$wrapper.find('input[name="category_filter_checkbox"]').prop('checked', false);
            filterDialog.$wrapper.find('.category-filter-option').removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
            $option.removeClass('border-gray-200').addClass('border-indigo-500 bg-indigo-50');
            return;
        }
        
        if ($checkbox.length > 0) {
            const isChecked = !$checkbox.prop('checked');
            $checkbox.prop('checked', isChecked);
            
            if (isChecked) {
                $option.removeClass('border-gray-200').addClass('border-indigo-500 bg-indigo-50');
            } else {
                $option.removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
            }
            
            const $checkedCheckboxes = filterDialog.$wrapper.find('input[name="category_filter_checkbox"]:checked');
            const $radioAll = filterDialog.$wrapper.find('input[name="category_filter"][value="all"]');
            
            if ($checkedCheckboxes.length > 0) {
                $radioAll.prop('checked', false);
                filterDialog.$wrapper.find('.category-filter-option[data-value="all"]')
                    .removeClass('border-indigo-500 bg-indigo-50')
                    .addClass('border-gray-200');
            } else {
                $radioAll.prop('checked', true);
                filterDialog.$wrapper.find('.category-filter-option[data-value="all"]')
                    .removeClass('border-gray-200')
                    .addClass('border-indigo-500 bg-indigo-50');
            }
        }
    });

    // Bind event handler untuk rombel (jika ada)
    if (hasRombels) {
        filterDialog.$wrapper.on('click', '.rombel-filter-option', function(e) {
            if ($(e.target).is('input')) return;
            
            const $option = $(this);
            const $radio = $option.find('input[name="rombel_filter"]');
            const $checkbox = $option.find('input[name="rombel_filter_checkbox"]');
            
            if ($radio.length > 0) {
                $radio.prop('checked', true);
                filterDialog.$wrapper.find('input[name="rombel_filter_checkbox"]').prop('checked', false);
                filterDialog.$wrapper.find('.rombel-filter-option').removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
                $option.removeClass('border-gray-200').addClass('border-indigo-500 bg-indigo-50');
                return;
            }
            
            if ($checkbox.length > 0) {
                const isChecked = !$checkbox.prop('checked');
                $checkbox.prop('checked', isChecked);
                
                if (isChecked) {
                    $option.removeClass('border-gray-200').addClass('border-indigo-500 bg-indigo-50');
                } else {
                    $option.removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
                }
                
                const $checkedCheckboxes = filterDialog.$wrapper.find('input[name="rombel_filter_checkbox"]:checked');
                const $radioAll = filterDialog.$wrapper.find('input[name="rombel_filter"][value="all"]');
                
                if ($checkedCheckboxes.length > 0) {
                    $radioAll.prop('checked', false);
                    filterDialog.$wrapper.find('.rombel-filter-option[data-value="all"]')
                        .removeClass('border-gray-200')
                        .addClass('border-indigo-500 bg-indigo-50');
                } else {
                    $radioAll.prop('checked', true);
                    filterDialog.$wrapper.find('.rombel-filter-option[data-value="all"]')
                        .removeClass('border-gray-200')
                        .addClass('border-indigo-500 bg-indigo-50');
                }
            }
        });

        // Event handler untuk radio/checkbox rombel
        filterDialog.$wrapper.on('change', 'input[name="rombel_filter"]', function() {
            if ($(this).val() === 'all' && $(this).is(':checked')) {
                filterDialog.$wrapper.find('input[name="rombel_filter_checkbox"]').prop('checked', false);
                filterDialog.$wrapper.find('.rombel-filter-option').removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
                filterDialog.$wrapper.find('.rombel-filter-option[data-value="all"]')
                    .removeClass('border-gray-200')
                    .addClass('border-indigo-500 bg-indigo-50');
            }
        });

        filterDialog.$wrapper.on('change', 'input[name="rombel_filter_checkbox"]', function() {
            const $checkbox = $(this);
            const $option = $checkbox.closest('.rombel-filter-option');
            const isChecked = $checkbox.is(':checked');
            
            if (isChecked) {
                $option.removeClass('border-gray-200').addClass('border-indigo-500 bg-indigo-50');
            } else {
                $option.removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
            }
            
            const $checkedCheckboxes = filterDialog.$wrapper.find('input[name="rombel_filter_checkbox"]:checked');
            const $radioAll = filterDialog.$wrapper.find('input[name="rombel_filter"][value="all"]');
            
            if ($checkedCheckboxes.length > 0) {
                $radioAll.prop('checked', false);
                filterDialog.$wrapper.find('.rombel-filter-option[data-value="all"]')
                    .removeClass('border-gray-200')
                    .addClass('border-indigo-500 bg-indigo-50');
            } else {
                $radioAll.prop('checked', true);
                filterDialog.$wrapper.find('.rombel-filter-option[data-value="all"]')
                    .removeClass('border-gray-200')
                    .addClass('border-indigo-500 bg-indigo-50');
            }
        });
    }

    // Event handler untuk radio/checkbox kategori
    filterDialog.$wrapper.on('change', 'input[name="category_filter"]', function() {
        if ($(this).val() === 'all' && $(this).is(':checked')) {
            filterDialog.$wrapper.find('input[name="category_filter_checkbox"]').prop('checked', false);
            filterDialog.$wrapper.find('.category-filter-option').removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
            filterDialog.$wrapper.find('.category-filter-option[data-value="all"]')
                .removeClass('border-gray-200')
                .addClass('border-indigo-500 bg-indigo-50');
        }
    });

    filterDialog.$wrapper.on('change', 'input[name="category_filter_checkbox"]', function() {
        const $checkbox = $(this);
        const $option = $checkbox.closest('.category-filter-option');
        const isChecked = $checkbox.is(':checked');
        
        if (isChecked) {
            $option.removeClass('border-gray-200').addClass('border-indigo-500 bg-indigo-50');
        } else {
            $option.removeClass('border-indigo-500 bg-indigo-50').addClass('border-gray-200');
        }
        
        const $checkedCheckboxes = filterDialog.$wrapper.find('input[name="category_filter_checkbox"]:checked');
        const $radioAll = filterDialog.$wrapper.find('input[name="category_filter"][value="all"]');
        
        if ($checkedCheckboxes.length > 0) {
            $radioAll.prop('checked', false);
            filterDialog.$wrapper.find('.category-filter-option[data-value="all"]')
                .removeClass('border-gray-200')
                .addClass('border-indigo-500 bg-indigo-50');
        } else {
            $radioAll.prop('checked', true);
            filterDialog.$wrapper.find('.category-filter-option[data-value="all"]')
                .removeClass('border-gray-200')
                .addClass('border-indigo-500 bg-indigo-50');
        }
    });

    filterDialog.show();
}

function updateFilterBadge() {
    const $badge = $('#filter-badge');
    const totalFilters = selectedRombelIds.length + selectedCategoryIds.length;
    if (totalFilters > 0) {
        $badge.text(totalFilters).removeClass('hidden');
    } else {
        $badge.addClass('hidden');
    }
}

function load_courses_data(studentId, rombelIds, categoryIds) {
    $('#courses-loading').removeClass('hidden');
    $('#courses-content').addClass('hidden');

    console.log('Loading courses for student_id:', studentId, 'rombels:', rombelIds, 'categories:', categoryIds);

    frappe.call({
        method: 'bima_lms.api.courses.get_user_courses',
        args: {
            student_id: studentId || (window.StudentSwitcher ? window.StudentSwitcher.getActiveStudentId() : null),
            rombel_ids: rombelIds && rombelIds.length > 0 ? JSON.stringify(rombelIds) : null,
            category_ids: categoryIds && categoryIds.length > 0 ? JSON.stringify(categoryIds) : null
        },
        callback: function(r) {
            $('#courses-loading').addClass('hidden');
            $('#courses-content').removeClass('hidden');

            if (r.message) {
                const data = r.message;
                console.log('Courses data:', data);
                $('#stat-total-courses').text(data.stats.total_courses);

                const $grid = $('#courses-grid');
                $grid.empty();

                if (data.courses.length === 0) {
                    let message = 'Tidak ada mata pelajaran yang ditemukan.';
                    if (selectedCategoryIds.length > 0 && selectedRombelIds.length > 0) {
                        message = 'Tidak ada mata pelajaran untuk kategori dan rombel yang dipilih.';
                    } else if (selectedCategoryIds.length > 0) {
                        message = 'Tidak ada mata pelajaran untuk kategori yang dipilih.';
                    } else if (selectedRombelIds.length > 0) {
                        message = 'Tidak ada mata pelajaran untuk rombel yang dipilih.';
                    }
                    $grid.html(`
                        <div class="col-span-full bg-white rounded-xl p-8 text-center border border-gray-100">
                            <p class="text-gray-500 font-medium">${message}</p>
                        </div>
                    `);
                    return;
                }

                data.courses.forEach(course => {
                    // Tampilkan badge rombel
                    let rombelBadges = '';
                    if (course.rombel_names && course.rombel_names.length > 0) {
                        rombelBadges = course.rombel_names.slice(0, 2).map(name => 
                            `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 mr-1">${escapeHtml(name)}</span>`
                        ).join('');
                        if (course.rombel_names.length > 2) {
                            rombelBadges += `<span class="text-[10px] text-gray-400">+${course.rombel_names.length - 2}</span>`;
                        }
                    }

                    const $card = $(`
                        <div class="course-card bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer" data-id="${course.course_id}">
                            <div class="p-6 space-y-3">
                                <div class="flex items-center justify-between">
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                                        ${escapeHtml(course.category_name)}
                                    </span>
                                    <div class="flex flex-wrap gap-1">
                                        ${rombelBadges}
                                    </div>
                                </div>
                                <h3 class="text-lg font-bold text-gray-900 line-clamp-1 hover:text-indigo-600 transition-colors">
                                    ${escapeHtml(course.course_title)}
                                </h3>
                                <p class="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                    ${escapeHtml(course.short_description)}
                                </p>
                            </div>
                            <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                <span class="flex items-center space-x-1.5">
                                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                    <span class="font-medium text-gray-700">${escapeHtml(course.instructor_name)}</span>
                                </span>
                                <span class="text-indigo-600 font-medium flex items-center">
                                    Lihat Detail &rarr;
                                </span>
                            </div>
                        </div>
                    `);

                    $card.on('click', function() {
                        const id = $(this).data('id');
                        frappe.set_route('course-detail', { id: id });
                    });

                    $grid.append($card);
                });
            }
        },
        error: function(err) {
            console.error('Error loading courses:', err);
            $('#courses-loading').addClass('hidden');
            $('#courses-content').removeClass('hidden');
            $('#courses-grid').html(`
                <div class="col-span-full bg-white rounded-xl p-8 text-center border border-gray-100">
                    <p class="text-red-500 font-medium">Gagal memuat data mata pelajaran. Silakan coba lagi.</p>
                </div>
            `);
        }
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

// Bind event untuk tombol filter setelah DOM siap
$(document).on('click', '#btn-filter-rombels', function() {
    openFilterModal();
});