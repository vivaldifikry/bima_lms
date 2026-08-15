frappe.pages['courses'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '', 
        single_column: true
    });

    // Inject Tailwind CSS jika belum ada
    if (!document.getElementById('tailwind-cdn')) {
        let script = document.createElement('script');
        script.id = 'tailwind-cdn';
        script.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(script);
    }

    // Render Container Utama dengan Top Navigation Bar Minimalis
    $(page.body).html(`
        <div class="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
            <div class="max-w-7xl mx-auto space-y-6">
                
                <!-- Compact Navigation & Breadcrumb -->
                <div class="flex items-center space-x-3 bg-white px-4 py-3 w-fit">
                    <a href="/app/lms-dashboard" 
                       class="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus:outline-none"
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

                <!-- Loading Indicator -->
                <div id="courses-loading" class="flex items-center justify-center py-16">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    <span class="ml-3 text-gray-600 font-medium text-sm">Memuat data mata pelajaran...</span>
                </div>

                <!-- Dashboard Content (Hidden initially) -->
                <div id="courses-content" class="hidden space-y-6">
                    <!-- Stat Card Header -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                    <!-- Section Title & Grid Cards -->
                    <div>
                        <h2 class="text-lg font-bold text-gray-800 mb-4">Daftar Mata Pelajaran</h2>
                        <div id="courses-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <!-- Cards di-inject via JS -->
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `);

    // Fetch Data
    load_courses_data();
};

function load_courses_data() {
    frappe.call({
        method: 'bima_lms.api.courses.get_user_courses',
        callback: function(r) {
            $('#courses-loading').addClass('hidden');
            $('#courses-content').removeClass('hidden');

            if (r.message) {
                const data = r.message;
                $('#stat-total-courses').text(data.stats.total_courses);

                const $grid = $('#courses-grid');
                $grid.empty();

                if (data.courses.length === 0) {
                    $grid.html(`
                        <div class="col-span-full bg-white rounded-xl p-8 text-center border border-gray-100">
                            <p class="text-gray-500 font-medium">Belum ada mata pelajaran yang diampu.</p>
                        </div>
                    `);
                    return;
                }

                data.courses.forEach(course => {
                    const cardHtml = `
                        <div class="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer"
                             onclick="frappe.msgprint('Akan mengarah ke detail course ID: ${course.course_id}')">
                            <div class="p-6 space-y-3">
                                <div class="flex items-center justify-between">
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                                        ${escapeHtml(course.category_name)}
                                    </span>
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
                    `;
                    $grid.append(cardHtml);
                });
            }
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