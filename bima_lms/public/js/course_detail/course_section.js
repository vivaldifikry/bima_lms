window.CourseSectionComponent = (function() {
    let currentCourseId = null;
    let sectionsData = [];
    let deletedSectionIds = []; // Mencatat ID section yang dihapus sementara di UI
    let isEditMode = false;
    let containerSelector = null;

    function loadSections(selector, course_id) {
        containerSelector = selector;
        currentCourseId = course_id;
        deletedSectionIds = [];

        frappe.call({
            method: 'bima_lms.api.course_sections.get_course_sections',
            args: { course_id: course_id },
            callback: function(r) {
                sectionsData = r.message || [];
                render();
            }
        });
    }

    function setEditMode(flag) {
        if (isEditMode && !flag) {
            // Jika batal/keluar dari edit mode tanpa simpan, reset state dari server
            isEditMode = false;
            loadSections(containerSelector, currentCourseId);
            return;
        }
        isEditMode = flag;
        render();
    }

    function render() {
        if (!containerSelector) return;
        const $container = $(containerSelector);

        let html = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div class="flex items-center space-x-2">
                        <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                        <h2 class="text-lg font-bold text-gray-900">Kurikulum / Bab Pelajaran</h2>
                        <span id="section-count-badge" class="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            ${sectionsData.length} Bab
                        </span>
                    </div>

                    ${isEditMode ? `
                        <button id="btn-add-section-inline" class="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                            <span>Tambah Bab</span>
                        </button>
                    ` : ''}
                </div>

                <div id="section-list-wrapper" class="space-y-3 relative">
                    ${sectionsData.length === 0 ? `
                        <div id="empty-sections-msg" class="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <p class="text-xs text-gray-500 font-medium">Belum ada bab/section yang ditambahkan pada course ini.</p>
                        </div>
                    ` : sectionsData.map((sec, index) => renderSectionItem(sec, index)).join('')}
                </div>
            </div>
        `;

        $container.html(html);

        if (isEditMode) {
            updateSectionNumbers();
            bindEvents();
        }

        // Bind click event untuk section (view mode)
        $container.find('.section-clickable').off('click').on('click', function() {
            const sectionId = $(this).data('section-id');
            if (sectionId) {
                // Gunakan route_options dengan id
                frappe.set_route('section-detail', { id: sectionId });
            }
        });
    }

    function renderSectionItem(sec, index) {
        if (isEditMode) {
            return `
                <div class="section-card border border-gray-200 rounded-lg p-4 bg-white shadow-sm space-y-3 transition-all duration-300" data-section-id="${sec.section_id}">
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center space-x-2 flex-grow">
                            <span class="section-number text-gray-400 font-bold text-sm min-w-[24px]">#${index + 1}</span>
                            <input type="text" class="input-section-title w-full px-3 py-1.5 text-sm font-semibold text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                   value="${escapeHtml(sec.section_title)}" placeholder="Nama Bab / Section...">
                        </div>
                        
                        <div class="flex items-center space-x-1 flex-shrink-0">
                            <button class="btn-move-up p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors" title="Naikkan">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                            </button>
                            <button class="btn-move-down p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors" title="Turunkan">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <button class="btn-delete-section p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors ml-1" title="Hapus Bab">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="pl-8">
                        <textarea class="input-section-desc w-full px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                  rows="2" placeholder="Deskripsi singkat bab ini...">${escapeHtml(sec.description)}</textarea>
                    </div>
                </div>
            `;
        }

        return `
            <div class="border border-gray-100 rounded-lg p-4 bg-white space-y-2 cursor-pointer hover:shadow-md transition-shadow section-clickable" 
                data-section-id="${sec.section_id}" data-course-id="${sec.course_id}">
                <div class="flex items-start space-x-3">
                    <span class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex-shrink-0 mt-0.5">
                        ${index + 1}
                    </span>
                    <div class="space-y-1 flex-1">
                        <h3 class="text-sm font-bold text-gray-900 leading-snug hover:text-indigo-600 transition-colors">
                            ${escapeHtml(sec.section_title)}
                        </h3>
                        ${sec.description ? `<p class="text-xs text-gray-600 leading-relaxed">${escapeHtml(sec.description)}</p>` : '<p class="text-xs text-gray-400 italic">Tidak ada deskripsi bab.</p>'}
                    </div>
                    <div class="flex items-center space-x-1 text-gray-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    }

    function bindEvents() {
        if (!isEditMode) return;

        // Tambah Bab Inline
        $('#btn-add-section-inline').off('click').on('click', function() {
            $('#empty-sections-msg').remove();
            
            const tempId = 'temp_' + Date.now();
            const newIndex = $('#section-list-wrapper .section-card').length;
            const newSec = { section_id: tempId, section_title: '', description: '' };
            
            const $newCard = $(renderSectionItem(newSec, newIndex));
            $('#section-list-wrapper').append($newCard);
            
            updateSectionNumbers();
            $newCard.find('.input-section-title').focus();
        });

        // Hapus Bab
        $('#section-list-wrapper').off('click', '.btn-delete-section').on('click', '.btn-delete-section', function() {
            const $card = $(this).closest('.section-card');
            const secId = $card.data('section-id');
            const sectionTitle = $card.find('.input-section-title').val() || __('Bab ini');

            frappe.confirm(
                __('Apakah Anda yakin ingin menghapus "{0}"?', [sectionTitle]),
                function() {
                    if (secId && !String(secId).startsWith('temp_')) {
                        if (!deletedSectionIds.includes(secId)) {
                            deletedSectionIds.push(secId);
                        }
                    }

                    $card.remove();
                    updateSectionNumbers();
                }
            );
        });

        // Move Up
        $('#section-list-wrapper').off('click', '.btn-move-up').on('click', '.btn-move-up', function() {
            const $card = $(this).closest('.section-card');
            const $prevCard = $card.prev('.section-card');
            if ($prevCard.length > 0) {
                animateSwap($card, $prevCard, 'up');
            }
        });

        // Move Down
        $('#section-list-wrapper').off('click', '.btn-move-down').on('click', '.btn-move-down', function() {
            const $card = $(this).closest('.section-card');
            const $nextCard = $card.next('.section-card');
            if ($nextCard.length > 0) {
                animateSwap($card, $nextCard, 'down');
            }
        });
    }

    function animateSwap($card1, $card2, direction) {
        // Dapatkan posisi awal kedua elemen
        const offset1 = $card1.offset().top;
        const offset2 = $card2.offset().top;
        const distance = offset2 - offset1;
        
        // Hitung jarak perpindahan yang tepat
        const moveDistance = direction === 'up' ? -Math.abs(distance) : Math.abs(distance);
        
        // Siapkan transisi
        $card1.css({
            'transition': 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            'transform': `translateY(${moveDistance}px)`,
            'position': 'relative',
            'z-index': '10'
        });
        
        $card2.css({
            'transition': 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            'transform': `translateY(${-moveDistance}px)`,
            'position': 'relative',
            'z-index': '10'
        });

        // Tunggu animasi selesai
        setTimeout(() => {
            // Reset semua style
            $card1.css({
                'transition': 'none',
                'transform': '',
                'position': '',
                'z-index': ''
            });
            $card2.css({
                'transition': 'none',
                'transform': '',
                'position': '',
                'z-index': ''
            });

            // Tukar posisi di DOM
            if (direction === 'up') {
                $card1.insertBefore($card2);
            } else {
                $card1.insertAfter($card2);
            }

            // Force reflow untuk reset state
            $card1[0].offsetHeight;
            $card2[0].offsetHeight;

            // Perbarui penomoran
            updateSectionNumbers();
        }, 300);
    }

    function updateSectionNumbers() {
        const $cards = $('#section-list-wrapper .section-card');
        const totalCards = $cards.length;

        $cards.each(function(index) {
            $(this).find('.section-number').text(`#${index + 1}`);

            const $btnUp = $(this).find('.btn-move-up');
            const $btnDown = $(this).find('.btn-move-down');

            // Kontrol tombol Up
            if (index === 0) {
                $btnUp.addClass('hidden').hide();
            } else {
                $btnUp.removeClass('hidden').show();
            }

            // Kontrol tombol Down
            if (index === totalCards - 1) {
                $btnDown.addClass('hidden').hide();
            } else {
                $btnDown.removeClass('hidden').show();
            }
        });
    }

    function getSectionsPayload() {
        const payload = [];
        $('#section-list-wrapper .section-card').each(function() {
            const $card = $(this);
            payload.push({
                section_id: $card.data('section-id'),
                section_title: $card.find('.input-section-title').val().trim(),
                description: $card.find('.input-section-desc').val().trim()
            });
        });
        return payload;
    }

    function getDeletedSectionIds() {
        return deletedSectionIds;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    return {
        loadSections: loadSections,
        setEditMode: setEditMode,
        getSectionsPayload: getSectionsPayload,
        getDeletedSectionIds: getDeletedSectionIds
    };
})();