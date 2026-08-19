window.InformationCourseComponent = (function () {
    let isPublishedState = false;

    function render(containerId, data) {
        if (!containerId || !data) return;

        isPublishedState = (data.status || '').toUpperCase() === 'PUBLISHED';

        const html = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
                <h3 class="text-sm font-bold text-gray-800 pb-2 border-b border-gray-100 flex items-center space-x-2">
                    <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>Informasi Course</span>
                </h3>

                <div class="space-y-3.5 text-xs text-gray-600">
                    <div id="info-view-status-row" class="flex items-center justify-between">
                        <span class="text-gray-500 font-medium">Status</span>
                        <span id="info-status-badge" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold"></span>
                    </div>

                    <div id="info-edit-status-row" class="hidden flex items-center justify-between py-2 px-3 bg-gray-50/80 rounded-lg border border-gray-200">
                        <div class="flex flex-col">
                            <span class="text-xs font-semibold text-gray-700">Status Course</span>
                            <span id="info-toggle-label" class="text-[11px] font-bold">DRAFT</span>
                        </div>

                        <div id="info-toggle-track" class="relative inline-flex items-center h-6 rounded-full w-11 cursor-pointer transition-colors duration-200 ease-in-out p-0.5 bg-gray-300">
                            <span id="info-toggle-thumb" class="inline-block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out translate-x-0"></span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2 pt-1 pb-1">
                        <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-center space-y-0.5">
                            <span class="text-[10px] uppercase font-semibold text-gray-400">Total Lesson</span>
                            <p class="text-base font-extrabold text-gray-800">${data.total_lessons || 0}</p>
                        </div>
                        <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-center space-y-0.5">
                            <span class="text-[10px] uppercase font-semibold text-gray-400">Total Enrollment</span>
                            <p class="text-base font-extrabold text-gray-800">${data.total_enrollments || 0}</p>
                        </div>
                    </div>

                    <div class="space-y-2.5 pt-2 border-t border-gray-100">
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500">Dibuat Pada</span>
                            <span class="font-medium text-gray-800">${formatTimestamp(data.created_on)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500">Terakhir Diubah Pada</span>
                            <span class="font-medium text-gray-800">${formatTimestamp(data.last_modified_on)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500">Dipublikasi Pada</span>
                            <span class="font-medium text-gray-800">${formatDateOnly(data.published_on)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $(containerId).html(html);
        updateBadgeUI(data.status);

        $(document).off('click', '#info-toggle-track').on('click', '#info-toggle-track', function () {
            isPublishedState = !isPublishedState;
            updateToggleUI(isPublishedState);
        });
    }

    function updateBadgeUI(status) {
        const $badge = $('#info-status-badge');
        if (!$badge.length) return;

        const st = (status || '').toLowerCase();
        $badge.removeClass();

        if (st === 'published' || st === 'active') {
            $badge.addClass('px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800').text(status);
        } else if (st === 'draft') {
            $badge.addClass('px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800').text(status);
        } else {
            $badge.addClass('px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700').text(status || 'Draft');
        }
    }

    function updateToggleUI(isPublished) {
        const $track = $('#info-toggle-track');
        const $thumb = $('#info-toggle-thumb');
        const $label = $('#info-toggle-label');
        if (!$track.length || !$thumb.length || !$label.length) return;

        if (isPublished) {
            $track.removeClass('bg-gray-300').addClass('bg-emerald-600');
            $thumb.removeClass('translate-x-0').addClass('translate-x-5');
            $label.text('PUBLISHED').removeClass('text-amber-600').addClass('text-emerald-600');
        } else {
            $track.removeClass('bg-emerald-600').addClass('bg-gray-300');
            $thumb.removeClass('translate-x-5').addClass('translate-x-0');
            $label.text('DRAFT').removeClass('text-emerald-600').addClass('text-amber-600');
        }
    }

    function setEditMode(isEdit, currentStatus) {
        if (isEdit) {
            isPublishedState = (currentStatus || '').toUpperCase() === 'PUBLISHED';
            updateToggleUI(isPublishedState);
            $('#info-view-status-row').addClass('hidden');
            $('#info-edit-status-row').removeClass('hidden');
        } else {
            isPublishedState = (currentStatus || '').toUpperCase() === 'PUBLISHED';
            updateToggleUI(isPublishedState);
            $('#info-view-status-row').removeClass('hidden');
            $('#info-edit-status-row').addClass('hidden');
        }
    }

    function getSelectedStatus() {
        return isPublishedState ? 'PUBLISHED' : 'DRAFT';
    }

    function formatTimestamp(tsString) {
        if (!tsString || tsString === '-') return '-';
        try {
            const d = new Date(tsString);
            if (isNaN(d.getTime())) return tsString;
            return d.toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) { return tsString; }
    }

    function formatDateOnly(dateString) {
        if (!dateString || dateString === '-') return '-';
        try {
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return dateString;
            return d.toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch (e) { return dateString; }
    }

    return {
        render: render,
        setEditMode: setEditMode,
        getSelectedStatus: getSelectedStatus
    };
})();
