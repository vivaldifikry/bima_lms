window.CourseScoreBarChart = (function() {
    console.log('CourseScoreBarChart initializing...');

    const chartState = {
        lastResponse: null,
        currentLayout: null,
        activeCourseFilter: {
            assignment: 'all',
            quiz: 'all'
        }
    };
    
    // fungsi untuk menormalisasi roles menjadi array string
    function normalizeRoles(rawRoles) {
        if (!rawRoles) return [];
        if (Array.isArray(rawRoles)) return rawRoles.map(String);
        if (typeof rawRoles === 'string') return [rawRoles];
        return [];
    }

    // fungsi untuk mendapatkan roles user dari berbagai sumber
    function getUserRoles() {
        console.log('getUserRoles called');
        const roles = normalizeRoles(frappe.user_roles);
        if (roles.length) {
            console.log('Roles from frappe.user_roles:', roles);
            return roles;
        }
        if (frappe.boot && frappe.boot.user && Array.isArray(frappe.boot.user.roles)) {
            console.log('Roles from frappe.boot.user.roles:', frappe.boot.user.roles);
            return frappe.boot.user.roles.map(String);
        }
        if (window.StudentSwitcher && typeof window.StudentSwitcher.getUserRoles === 'function') {
            console.log('Roles from StudentSwitcher:', window.StudentSwitcher.getUserRoles());
            return window.StudentSwitcher.getUserRoles();
        }
        console.log('No roles found');
        return [];
    }

    // fungsi untuk menentukan apakah chart harus dirender berdasarkan roles user
    function shouldRender() {
        console.log('shouldRender called');
        const roles = getUserRoles();
        const sessionUser = frappe.session && frappe.session.user ? String(frappe.session.user) : '';
        const bootUser = frappe.boot && frappe.boot.user ? String(frappe.boot.user.name || frappe.boot.user.full_name || '') : '';
        const knownUsers = [sessionUser, bootUser].filter(Boolean);

        const isBuiltInAdmin = knownUsers.some((value) => value === 'Administrator' || /administrator/i.test(value));
        const hasAdminRole = roles.some((role) => {
            const normalized = String(role || '').trim();
            return ['Administrator', 'Admin', 'LMS Admin', 'System Manager'].includes(normalized)
                || /admin/i.test(normalized)
                || normalized.toLowerCase().includes('administrator');
        });
        const hasTeacherRole = roles.some((role) => String(role || '').trim() === 'LMS Teacher' || /teacher/i.test(String(role || '')));
        const hasParentRole = roles.some((role) => String(role || '').trim() === 'LMS Parent' || /parent/i.test(String(role || '')));

        const result = isBuiltInAdmin || hasAdminRole || hasTeacherRole || hasParentRole;
        console.log('shouldRender result:', result, { isBuiltInAdmin, hasAdminRole, hasTeacherRole, hasParentRole, roles, sessionUser, bootUser });
        return result;
    }

    // fungsi untuk mendapatkan warna kontras untuk setiap course
    function getCourseColors(count) {
        // Warna-warna yang kontras dan mudah dibedakan
        const coursePalette = [
            '#4F46E5', // Indigo
            '#F97316', // Orange
            '#10B981', // Emerald
            '#F59E0B', // Amber
            '#8B5CF6', // Violet
            '#EF4444', // Red
            '#06B6D4', // Cyan
            '#EC4899', // Pink
            '#6366F1', // Royal Blue
            '#14B8A6', // Teal
            '#A855F7', // Purple
            '#34D399', // Mint
            '#F472B6', // Light Pink
            '#FBBF24', // Yellow
            '#3B82F6'  // Blue
        ];
        
        if (count <= coursePalette.length) {
            return coursePalette.slice(0, count);
        }
        
        // Jika lebih dari palette, generate warna HSL
        const colors = [...coursePalette];
        for (let i = colors.length; i < count; i++) {
            const hue = (i * 137.5 + 30) % 360;
            colors.push(`hsl(${hue} 75% 55%)`);
        }
        return colors;
    }

    // fungsi untuk membangun palet warna untuk dataset
    function buildPalette(count) {
        const baseColors = [
            '#4F46E5', '#7C3AED', '#EC4899', '#EF4444', '#F59E0B',
            '#10B981', '#3B82F6', '#8B5CF6', '#F472B6', '#F97316',
            '#14B8A6', '#6366F1', '#A855F7', '#06B6D4', '#22D3EE',
            '#34D399', '#60A5FA', '#A78BFA', '#FB923C', '#2DD4BF'
        ];
        
        if (count <= baseColors.length) return baseColors.slice(0, count);
        
        const colors = [...baseColors];
        for (let i = colors.length; i < count; i++) {
            const hue = (i * 137.5) % 360;
            colors.push(`hsl(${hue} 72% 58%)`);
        }
        return colors;
    }

    // fungsi untuk mengamankan teks dari karakter HTML
    function safeText(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, function(ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch] || ch;
        });
    }

    function splitLabelLines(label, maxCharsPerLine) {
        if (!label) return [''];
        const text = String(label).trim();
        if (text.length <= maxCharsPerLine) return [text];

        const words = text.split(/\s+/);
        const lines = [];
        let current = '';

        words.forEach((word) => {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length <= maxCharsPerLine) {
                current = candidate;
            } else {
                if (current) lines.push(current);
                current = word;
            }
        });

        if (current) lines.push(current);
        return lines.length ? lines : [text];
    }

    function renderCourseFilterButtons($legend, datasets, chartType) {
        const courseNames = [...new Set((datasets || []).map((dataset) => dataset.course_title || 'Unknown'))];
        const activeFilter = chartState.activeCourseFilter[chartType] || 'all';

        const buttons = [`
            <button type="button" class="course-filter-btn ${activeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'} px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-200" data-course="all">
                Semua Course
            </button>
        `];

        courseNames.forEach((courseTitle) => {
            const isActive = activeFilter === courseTitle;
            buttons.push(`
                <button type="button" class="course-filter-btn ${isActive ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'} px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-200" data-course="${safeText(courseTitle)}">
                    ${safeText(courseTitle)}
                </button>
            `);
        });

        const $filterWrap = $('<div class="mb-3 flex flex-wrap gap-2"></div>');
        $filterWrap.append(buttons.join(''));
        $legend.append($filterWrap);

        $legend.off('click', '.course-filter-btn').on('click', '.course-filter-btn', function() {
            const selectedCourse = $(this).data('course');
            const nextType = String(chartType || 'assignment').toLowerCase() === 'quiz' ? 'quiz' : 'assignment';
            chartState.activeCourseFilter[nextType] = selectedCourse === 'all' ? 'all' : String(selectedCourse);

            if (chartState.lastResponse) {
                const rerender = { ...chartState.lastResponse, chart_type: nextType };
                renderChart(rerender);
            }
        });
    }

    function applyCourseFilter(chartData) {
        if (!chartData || !chartData.datasets) return chartData;

        const chartType = String(chartData.chart_type || 'assignment').toLowerCase() === 'quiz' ? 'quiz' : 'assignment';
        const activeFilter = chartState.activeCourseFilter[chartType] || 'all';
        const datasets = activeFilter === 'all'
            ? (chartData.datasets || [])
            : (chartData.datasets || []).filter((dataset) => (dataset.course_title || 'Unknown') === activeFilter);

        return {
            ...chartData,
            datasets,
            filtered_course: activeFilter,
            labels: chartData.labels || []
        };
    }

    // fungsi untuk memformat tanggal menjadi format lokal Indonesia
    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '-';
        }
    }
    
    // fungsi untuk merender legend chart
    function renderLegend($legend, datasets, chartType) {
        if (!datasets || datasets.length === 0) {
            $legend.empty().html('<span class="text-gray-400 text-sm">Tidak ada tugas</span>');
            return;
        }

        $legend.empty();

        const courseGroups = {};
        datasets.forEach((dataset, index) => {
            const courseTitle = dataset.course_title || 'Unknown';
            if (!courseGroups[courseTitle]) {
                courseGroups[courseTitle] = [];
            }
            courseGroups[courseTitle].push({ ...dataset, index });
        });

        const courseNames = Object.keys(courseGroups);
        const courseColors = getCourseColors(courseNames.length);
        const courseColorMap = {};
        courseNames.forEach((name, idx) => {
            courseColorMap[name] = courseColors[idx % courseColors.length];
        });

        const activeFilter = chartState.activeCourseFilter[chartType || 'assignment'] || 'all';
        const filterButtons = [];
        filterButtons.push(`
            <button type="button" class="course-filter-btn ${activeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'} px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-200" data-course="all">
                Semua Course
            </button>
        `);

        courseNames.forEach((courseTitle) => {
            const isActive = activeFilter === courseTitle;
            filterButtons.push(`
                <button type="button" class="course-toggle-btn ${isActive ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'} px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-200" data-course="${safeText(courseTitle)}">
                    ${safeText(courseTitle)}
                </button>
            `);
        });

        $legend.append(`<div class="score-chart-filter-row mb-3">${filterButtons.join('')}</div>`);

        const itemGroups = [];
        Object.entries(courseGroups).forEach(([courseTitle, items]) => {
            const color = courseColorMap[courseTitle] || '#4F46E5';
            const isActive = activeFilter === 'all' || activeFilter === courseTitle;
            const itemButtons = items.map((item) => {
                const rawName = String(item.name || '').replace(/\s*\(.*?\)\s*$/, '').trim() || item.name || 'Item';
                return `
                    <button type="button" class="score-chart-legend-item inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-left transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50" data-column-index="${item.index}" data-course-title="${safeText(courseTitle)}" style="max-width:100%;">
                        <span class="score-chart-legend-swatch" style="background:${item.color || color};width:10px;height:10px;border-radius:4px;display:inline-block;flex-shrink:0;"></span>
                        <span style="font-size:11px;font-weight:600;color:#334155;white-space:normal;word-break:break-word;line-height:1.2;display:inline-block;max-width:180px;">${safeText(rawName)}</span>
                    </button>
                `;
            }).join('');

            itemGroups.push(`
                <div class="score-chart-legend-group ${isActive ? 'is-active' : ''}">
                    <button type="button" class="course-toggle-btn inline-flex items-center gap-2 rounded-full border border-transparent px-2 py-1 text-left transition-all duration-200 ${isActive ? 'bg-white text-indigo-700 shadow-sm' : 'bg-transparent text-slate-600'}" data-course="${safeText(courseTitle)}" style="font-size:11px;font-weight:800;">
                        ${safeText(courseTitle)}
                    </button>
                    ${itemButtons}
                </div>
            `);
        });

        $legend.append(`<div class="flex flex-wrap gap-2">${itemGroups.join('')}</div>`);

        $legend.off('click', '.course-toggle-btn').on('click', '.course-toggle-btn', function() {
            const selectedCourse = $(this).data('course');
            const nextType = String(chartType || 'assignment').toLowerCase() === 'quiz' ? 'quiz' : 'assignment';
            const currentActive = chartState.activeCourseFilter[nextType] || 'all';
            chartState.activeCourseFilter[nextType] = currentActive === String(selectedCourse) ? 'all' : String(selectedCourse);

            if (chartState.lastResponse) {
                const rerender = { ...chartState.lastResponse, chart_type: nextType };
                renderChart(rerender);
            }
        });

        $legend.off('click', '.course-filter-btn[data-course="all"]').on('click', '.course-filter-btn[data-course="all"]', function() {
            const nextType = String(chartType || 'assignment').toLowerCase() === 'quiz' ? 'quiz' : 'assignment';
            chartState.activeCourseFilter[nextType] = 'all';
            if (chartState.lastResponse) {
                const rerender = { ...chartState.lastResponse, chart_type: nextType };
                renderChart(rerender);
            }
        });

        $legend.off('mouseenter', '.score-chart-legend-item').on('mouseenter', '.score-chart-legend-item', function() {
            const columnIndex = Number($(this).data('column-index'));
            if (!Number.isFinite(columnIndex) || !chartState.currentLayout) return;

            const { padding, innerWidth, columnWidth, chartWidth } = chartState.currentLayout;
            const $svg = $('#custom-score-chart');
            const $scroll = $('.score-chart-scroll');
            const targetX = padding.left + (columnIndex + 0.5) * columnWidth - (columnWidth * 0.45);
            const smoothGoal = Math.max(0, Math.min(targetX, Math.max(0, chartWidth - $scroll.width())));
            if ($scroll.length && $scroll[0]) {
                $scroll[0].scrollTo({ left: smoothGoal, behavior: 'smooth' });
            }

            $svg.find('.column-highlight').remove();
            const highlightWidth = Math.max(40, columnWidth * 0.9);
            const highlightHeight = Math.max(60, chartState.currentLayout.chartHeight - padding.top - 30);
            const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            highlight.setAttribute('x', String(padding.left + columnIndex * columnWidth + (columnWidth - highlightWidth) / 2));
            highlight.setAttribute('y', String(padding.top));
            highlight.setAttribute('width', String(highlightWidth));
            highlight.setAttribute('height', String(highlightHeight));
            highlight.setAttribute('rx', '8');
            highlight.setAttribute('class', 'column-highlight');
            highlight.setAttribute('fill', 'rgba(79,70,229,0.1)');
            highlight.setAttribute('stroke', 'rgba(79,70,229,0.45)');
            highlight.setAttribute('stroke-width', '1');
            $svg[0].appendChild(highlight);
        });

        $legend.off('mouseleave', '.score-chart-legend-item').on('mouseleave', '.score-chart-legend-item', function() {
            $('#custom-score-chart').find('.column-highlight').remove();
        });
    }

    // fungsi untuk menyiapkan tooltip chart
    function setupTooltip($svg, chartData) {
        $('#chart-tooltip').remove();

        const tooltip = $(`
            <div id="chart-tooltip"
                 style="display:none; position:fixed; background:white;
                        border:1px solid #e2e8f0; border-radius:10px;
                        padding:14px 18px; box-shadow:0 10px 30px rgba(0,0,0,0.15);
                        z-index:10000; max-width:320px; pointer-events:none;
                        font-size:12px; line-height:1.6;">
            </div>
        `).appendTo('body');

        let hideTimeout;

        $svg.on('mouseenter', '.chart-bar', function(e) {
            clearTimeout(hideTimeout);
            const $bar = $(this);
            const student = $bar.data('student');
            const assignment = $bar.data('assignment');
            const score = Number($bar.data('score') || 0);
            const maxScore = Number($bar.data('maxscore') || 100);
            const status = $bar.data('status');
            const resultStatus = $bar.data('result-status') || 'Belum Mengerjakan';
            const submittedAt = $bar.data('submitted-at') || null;

            let assignmentName = assignment;
            let courseName = '';

            if (chartData && chartData.datasets) {
                for (const ds of chartData.datasets) {
                    if (ds.name === assignment) {
                        courseName = ds.course_title || '';
                        assignmentName = (String(ds.name || '').split('(')[0] || ds.name || '').trim();
                        break;
                    }
                }
            }

            let html = `
                <div style="font-weight:600;color:#1e293b;margin-bottom:4px;font-size:13px;">${safeText(student)}</div>
                <div style="color:#64748b;font-size:11px;margin-bottom:6px;">
                    <span style="font-weight:500;">Course:</span> ${safeText(courseName)}
                </div>
                <div style="color:#475569;margin-bottom:4px;">
                    <span style="font-weight:500;">Tugas:</span> ${safeText(assignmentName)}
                </div>
            `;

            if (chartData && chartData.chart_type === 'quiz') {
                if (status === 'not_enrolled') {
                    html = buildQuizTooltipHtml(chartData, student, assignmentName, 0, maxScore, 'not_enrolled', 'Tidak Terdaftar', submittedAt);
                } else if (status === 'not_submitted') {
                    html = buildQuizTooltipHtml(chartData, student, assignmentName, 0, maxScore, 'not_submitted', 'Belum Mengerjakan', submittedAt);
                } else {
                    html = buildQuizTooltipHtml(chartData, student, assignmentName, score, maxScore, 'submitted', resultStatus, submittedAt);
                }
            } else if (status === 'not_enrolled') {
                html += `<div style="color:#94a3b8;font-style:italic;margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;">Siswa tidak terdaftar di course ini</div>`;
            } else if (status === 'not_submitted') {
                html += `<div style="color:#f59e0b;font-weight:500;margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;">⚠️ Belum mengerjakan tugas</div>`;
                if (chartData && chartData.assignments_info) {
                    for (const info of Object.values(chartData.assignments_info)) {
                        if (info.title === assignmentName && info.deadline) {
                            html += `<div style="color:#94a3b8;font-size:11px;margin-top:2px;">📅 Deadline: ${formatDate(info.deadline)}</div>`;
                            break;
                        }
                    }
                }
            } else if (status === 'submitted') {
                const percentage = ((score / Math.max(maxScore, 1)) * 100).toFixed(0);
                html += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;">
                            <span style="font-weight:500;">Nilai:</span>
                            <span style="color:#4F46E5;font-weight:700;font-size:14px;">${score}</span>
                            <span style="color:#94a3b8;"> / ${maxScore}</span>
                            <span style="color:#10B981;font-weight:600;margin-left:6px;">(${percentage}%)</span>
                        </div>`;

                if (chartData && chartData.students_data) {
                    for (const [studentName, studentData] of Object.entries(chartData.students_data)) {
                        if (studentName === student) {
                            for (const courseData of Object.values(studentData.courses || {})) {
                                for (const assignmentData of Object.values(courseData.assignments || {})) {
                                    if (assignmentData.title === assignmentName) {
                                        if (assignmentData.submitted_at) {
                                            html += `<div style="color:#64748b;font-size:11px;margin-top:2px;">📅 ${formatDate(assignmentData.submitted_at)}</div>`;
                                        }
                                        if (assignmentData.is_late) {
                                            html += `<div style="color:#ef4444;font-weight:600;font-size:11px;margin-top:2px;">⚠️ Terlambat</div>`;
                                        }
                                        break;
                                    }
                                }
                            }
                            break;
                        }
                    }
                }
            }

            tooltip.html(html);
            tooltip.show();
            positionTooltip(tooltip, e);
        });

        $svg.on('mousemove', '.chart-bar', function(e) {
            positionTooltip(tooltip, e);
        });

        $svg.on('mouseleave', '.chart-bar', function() {
            hideTimeout = setTimeout(function() {
                tooltip.hide();
            }, 100);
        });
    }

    // fungsi untuk memposisikan tooltip agar tidak keluar dari viewport
    function positionTooltip(tooltip, e) {
        const tooltipWidth = tooltip.outerWidth();
        const tooltipHeight = tooltip.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();

        let left = e.clientX + 15;
        let top = e.clientY + 15;

        if (left + tooltipWidth > windowWidth) {
            left = e.clientX - tooltipWidth - 15;
        }
        if (top + tooltipHeight > windowHeight) {
            top = e.clientY - tooltipHeight - 15;
        }

        tooltip.css({ left: left + 'px', top: top + 'px' });
    }

    function buildQuizTooltipHtml(chartData, student, itemName, score, maxScore, status, resultStatus, submittedAt) {
        const safeResult = resultStatus || 'Belum Mengerjakan';
        const normalizedMax = Number(maxScore || 100);
        let html = `
            <div style="font-weight:600;color:#1e293b;margin-bottom:4px;font-size:13px;">${safeText(student)}</div>
            <div style="color:#475569;margin-bottom:4px;">
                <span style="font-weight:600;">Quiz:</span> ${safeText(itemName)}
            </div>
        `;

        if (status === 'submitted') {
            html += `
                <div style="color:#475569;margin-bottom:4px;">
                    <span style="font-weight:600;">Nilai:</span> <span style="color:${safeResult === 'Tidak Lulus' ? '#ef4444' : '#4F46E5'};font-weight:700;">${score}</span>
                    <span style="color:#94a3b8;"> / ${normalizedMax}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${safeResult === 'Lulus' ? '#10B981' : '#ef4444'};"></span>
                    <span style="font-weight:600;color:${safeResult === 'Lulus' ? '#10B981' : '#ef4444'};">${safeResult}</span>
                </div>
                ${submittedAt ? `<div style="color:#64748b;font-size:11px;margin-top:4px;">🕒 Submit: ${safeText(formatDate(submittedAt))}</div>` : ''}
            `;
        } else if (status === 'not_submitted') {
            html += `
                <div style="color:#f59e0b;font-weight:600;margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;">Belum mengerjakan quiz</div>
            `;
        } else {
            html += `
                <div style="color:#94a3b8;font-style:italic;margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;">Tidak terdaftar di kursus ini</div>
            `;
        }

        return html;
    }

    // fungsi untuk menyiapkan scroll container untuk chart
    function setupScroll($section, maxWidth, maxHeight) {
        const container = $section.find('.score-chart-scroll');
        if (container.length) {
            // Set container untuk scroll
            container.css({
                'overflow': 'auto',
                'max-height': '550px',
                'width': '100%',
                'position': 'relative',
                'border': '1px solid #e2e8f0',
                'border-radius': '8px',
                'background': '#ffffff'
            });
            
            const svg = container.find('svg');
            if (svg.length) {
                // Set ukuran SVG ABSOLUT
                svg.css({
                    'display': 'block',
                    'width': maxWidth + 'px',
                    'height': maxHeight + 'px',
                    'max-width': 'none',
                    'max-height': 'none',
                    'min-width': maxWidth + 'px',
                    'min-height': maxHeight + 'px'
                });
            }
        }
    }

    // fungsi utama untuk merender chart batang horizontal
    function renderHorizontalBarChart($section, $legend, $svg, chartData) {
        console.log('=== renderHorizontalBarChart called ===');

        const filteredChartData = applyCourseFilter(chartData);
        const labels = filteredChartData.labels || [];
        const datasets = filteredChartData.datasets || [];
        const palette = buildPalette(datasets.length);

        const courseGroups = {};
        datasets.forEach((dataset, index) => {
            dataset.color = dataset.color || palette[index % palette.length] || '#4F46E5';
            const courseTitle = dataset.course_title || 'Unknown';
            if (!courseGroups[courseTitle]) {
                courseGroups[courseTitle] = { startIndex: index, endIndex: index, assignments: [] };
            }
            courseGroups[courseTitle].endIndex = index;
            courseGroups[courseTitle].assignments.push(index);
        });

        const courseNames = Object.keys(courseGroups);
        const courseColors = getCourseColors(courseNames.length);
        const courseColorMap = {};
        courseNames.forEach((name, idx) => {
            courseColorMap[name] = courseColors[idx % courseColors.length];
        });

        datasets.forEach((dataset) => {
            const courseTitle = dataset.course_title || 'Unknown';
            dataset.courseColor = courseColorMap[courseTitle] || '#4F46E5';
        });

        const studentCount = labels.length;
        const assignmentCount = datasets.length;
        const STUDENT_HEIGHT = 40;
        const ASSIGNMENT_WIDTH = 140;
        const calculatedWidth = assignmentCount * ASSIGNMENT_WIDTH + 350;
        const calculatedHeight = studentCount * STUDENT_HEIGHT + 270;
        const chartWidth = Math.max(1100, calculatedWidth);
        const chartHeight = Math.max(500, calculatedHeight);
        const padding = { top: 70, right: 130, bottom: 210, left: 200 };
        const innerWidth = chartWidth - padding.left - padding.right;
        const innerHeight = chartHeight - padding.top - padding.bottom;
        const rowHeight = innerHeight / (studentCount || 1);
        const columnWidth = innerWidth / Math.max(assignmentCount, 1);
        const barMaxWidth = Math.min(90, columnWidth * 0.72);
        const chartType = String(filteredChartData.chart_type || 'assignment').toLowerCase() === 'quiz' ? 'quiz' : 'assignment';
        chartState.currentLayout = { padding, innerWidth, columnWidth, chartWidth, chartHeight, chartType };

        renderLegend($legend, datasets, chartType);

        let svgContent = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}">
                <defs>
                    <style>
                        .course-group-bg { opacity: 0.1; }
                        .course-group-border { stroke-dasharray: 4 4; stroke-width: 1.5; }
                        .assignment-label { font-weight: 600; cursor: pointer; font-size: 11px; }
                        .course-label { font-weight: 700; text-anchor: middle; letter-spacing: 0.5px; font-size: 13px; }
                        .chart-title { font-weight: 700; text-anchor: middle; }
                        .chart-subtitle { text-anchor: middle; }
                        .chart-bar.submitted { cursor: pointer; }
                        .chart-bar.not-submitted { cursor: pointer; }
                        .chart-bar.not-enrolled { cursor: not-allowed; }
                        .column-highlight { fill: rgba(79,70,229,0.08); stroke: rgba(79,70,229,0.45); stroke-width: 1; }
                    </style>
                </defs>
                <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" rx="12" />
        `;

        const titleX = padding.left + innerWidth / 2;
        svgContent += `
            <text x="${titleX}" y="30" class="chart-title" font-size="17" fill="#1e293b">
                ${safeText(filteredChartData.title || 'Perbandingan Nilai Siswa')}
            </text>
            <text x="${titleX}" y="52" class="chart-subtitle" font-size="13" fill="#64748b">
                ${safeText(filteredChartData.subtitle || '')}
            </text>
        `;

        const groupWidth = innerWidth / (assignmentCount || 1);
        Object.entries(courseGroups).forEach(([courseTitle, group]) => {
            const startX = padding.left + group.startIndex * groupWidth;
            const endX = padding.left + (group.endIndex + 1) * groupWidth;
            const color = courseColorMap[courseTitle] || '#4F46E5';

            svgContent += `
                <rect x="${startX}" y="${padding.top}" width="${endX - startX}" height="${innerHeight}" fill="${color}" opacity="0.08" rx="4" />
                <line x1="${startX}" y1="${padding.top}" x2="${startX}" y2="${padding.top + innerHeight}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4" />
                <line x1="${endX}" y1="${padding.top}" x2="${endX}" y2="${padding.top + innerHeight}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4" />
            `;
        });

        for (let pct = 0; pct <= 100; pct += 20) {
            const x = padding.left + (pct / 100) * innerWidth;
            svgContent += `
                <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${padding.top + innerHeight}" stroke="#e2e8f0" stroke-dasharray="4 4" stroke-width="0.5" />
            `;
        }

        svgContent += `
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + innerHeight}" stroke="#94a3b8" stroke-width="1.2" />
            <line x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${padding.left + innerWidth}" y2="${padding.top + innerHeight}" stroke="#94a3b8" stroke-width="1.2" />
        `;

        datasets.forEach((dataset, index) => {
            const columnCenterX = padding.left + ((index + 0.5) * innerWidth) / (assignmentCount || 1);
            const labelY = padding.top + innerHeight + 52;
            const labelText = String(dataset.name || '').replace(/\s*\(.*?\)\s*$/, '').trim() || dataset.name || 'Item';
            const lines = splitLabelLines(labelText, 18);
            const lineHeight = 13;
            const startY = labelY - ((lines.length - 1) * lineHeight / 2);

            svgContent += `
                <rect class="column-hitbox" data-column-index="${index}" data-column-center-x="${columnCenterX}" x="${Math.max(padding.left, columnCenterX - (innerWidth / (assignmentCount || 1)) * 0.5)}" y="${padding.top}" width="${Math.max(24, innerWidth / (assignmentCount || 1))}" height="${innerHeight}" fill="transparent" stroke="transparent" />
            `;

            lines.forEach((line, lineIndex) => {
                svgContent += `
                    <text x="${columnCenterX}" y="${startY + lineIndex * lineHeight}" text-anchor="middle" font-size="11" fill="#475569" class="assignment-label" data-column-index="${index}" data-column-center-x="${columnCenterX}">
                        ${safeText(line)}
                    </text>
                `;
            });
        });

        const labelRows = datasets.reduce((max, d) => {
            const labelText = String(d.name || '').replace(/\s*\(.*?\)\s*$/, '').trim() || d.name || 'Item';
            return Math.max(max, splitLabelLines(labelText, 18).length);
        }, 1);
        const courseLabelY = padding.top + innerHeight + 52 + (labelRows * 12) + 12;

        Object.entries(courseGroups).forEach(([courseTitle, group]) => {
            const startX = padding.left + group.startIndex * groupWidth;
            const endX = padding.left + (group.endIndex + 1) * groupWidth;
            const midX = (startX + endX) / 2;
            const color = courseColorMap[courseTitle] || '#4F46E5';

            svgContent += `
                <line x1="${startX + 4}" y1="${courseLabelY - 6}" x2="${endX - 4}" y2="${courseLabelY - 6}" stroke="${color}" stroke-width="2.5" opacity="0.7" />
                <text x="${midX}" y="${courseLabelY + 16}" class="course-label" font-size="13" fill="${color}" font-weight="700">
                    ${safeText(courseTitle)}
                </text>
            `;
        });

        labels.forEach((studentName, studentIndex) => {
            const y = padding.top + studentIndex * rowHeight + rowHeight / 2;
            const displayName = studentName.length > 20 ? studentName.substring(0, 18) + '...' : studentName;
            svgContent += `
                <text x="${padding.left - 14}" y="${y + 5}" text-anchor="end" fill="#1e293b" font-size="12" font-weight="500">
                    ${safeText(displayName)}
                </text>
            `;

            datasets.forEach((dataset, assignmentIndex) => {
                const value = Number(dataset.values?.[studentIndex] || 0);
                const status = dataset.statuses ? dataset.statuses[studentIndex] : 'not_enrolled';
                const maxScore = Number(dataset.max_score || dataset.passing_grade || 100);
                const resultStatus = (chartType === 'quiz' && dataset.result_statuses && dataset.result_statuses[studentIndex]) ? dataset.result_statuses[studentIndex] : null;
                const submittedAtValue = chartType === 'quiz' ? (Array.isArray(dataset.submitted_at) ? dataset.submitted_at[studentIndex] : dataset.submitted_at) : null;
                const percentage = status === 'submitted' ? Math.min(100, (value / (maxScore || 100)) * 100) : 0;
                const barWidth = (percentage / 100) * barMaxWidth;
                const barHeight = Math.max(12, Math.min(18, rowHeight * 0.5));
                const columnWidth = innerWidth / (assignmentCount || 1);
                const barX = padding.left + assignmentIndex * columnWidth + (columnWidth - barMaxWidth) / 2;
                const isFailed = chartType === 'quiz' && resultStatus === 'Tidak Lulus';
                let color = '#e2e8f0';
                let opacity = 0.2;
                let barClass = 'chart-bar';
                let dataAttrs = `data-student="${safeText(studentName)}" data-assignment="${safeText(dataset.name)}" data-status="${status}" data-column-index="${assignmentIndex}" data-column-center-x="${padding.left + ((assignmentIndex + 0.5) * innerWidth) / (assignmentCount || 1)}" data-submitted-at="${safeText(submittedAtValue || '')}" data-score="${value}" data-maxscore="${maxScore}" data-result-status="${safeText(resultStatus || (status === 'not_submitted' ? 'Belum Mengerjakan' : status === 'not_enrolled' ? 'Tidak Terdaftar' : 'Lulus'))}"`;

                if (status === 'not_enrolled') {
                    color = '#e2e8f0';
                    opacity = 0.2;
                    barClass += ' not-enrolled';
                    dataAttrs += ` data-score="0" data-maxscore="${maxScore}" data-result-status="${safeText(resultStatus || 'Tidak Terdaftar')}"`;
                } else if (status === 'not_submitted') {
                    color = '#e2e8f0';
                    opacity = 0.4;
                    barClass += ' not-submitted';
                    dataAttrs += ` data-score="0" data-maxscore="${maxScore}" data-result-status="Belum Mengerjakan"`;
                } else if (status === 'submitted') {
                    color = dataset.color || '#4F46E5';
                    opacity = 0.85;
                    barClass += ' submitted';
                    dataAttrs += ` data-score="${value}" data-maxscore="${maxScore}" data-result-status="${safeText(resultStatus || 'Lulus')}"`;
                }

                svgContent += `
                    <rect x="${barX}" y="${y - barHeight/2}" width="${barMaxWidth}" height="${barHeight}" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5" />
                `;

                if (barWidth > 2) {
                    svgContent += `
                        <rect x="${barX + 1}" y="${y - barHeight/2 + 1}" width="${Math.max(0, barWidth - 2)}" height="${Math.max(0, barHeight - 2)}" rx="3" fill="${color}" opacity="${opacity}" ${dataAttrs} class="${barClass}" stroke="${isFailed ? '#ef4444' : 'transparent'}" stroke-width="${isFailed ? 1.2 : 0}" />
                    `;
                }

                if (status === 'submitted' && value > 0) {
                    const labelX = barX + barWidth + 4;
                    const valueTextColor = isFailed ? '#ef4444' : '#475569';
                    const valueTextWeight = isFailed ? 700 : 600;

                    if (labelX + 30 < padding.left + innerWidth) {
                        svgContent += `
                            <text x="${labelX}" y="${y + 5}" font-size="10" fill="${valueTextColor}" font-weight="${valueTextWeight}">
                                ${Math.round(value)}
                            </text>
                        `;
                    } else {
                        svgContent += `
                            <text x="${barX + barWidth - 4}" y="${y - barHeight/2 - 6}" font-size="9" fill="${valueTextColor}" font-weight="${valueTextWeight}" text-anchor="end">
                                ${Math.round(value)}
                            </text>
                        `;
                    }
                } else if (status === 'not_submitted') {
                    svgContent += `
                        <text x="${barX + 4}" y="${y + 5}" font-size="10" fill="#94a3b8" font-weight="400">-</text>
                    `;
                }
            });
        });

        svgContent += `</svg>`;

        $section.removeClass('hidden');
        $svg.removeAttr('viewBox');
        $svg.html(svgContent);
        setupTooltip($svg, filteredChartData);
        setupScroll($section, chartWidth, chartHeight);

        console.log('Horizontal chart render complete!');
    }

    // fungsi utama untuk merender chart
    function renderChart(response) {
        console.log('=== renderChart called ===');
        console.log('Raw response:', response);
        
        let chartData = response;
        if (response && typeof response === 'object' && response.data && typeof response.data === 'object') {
            chartData = response.data;
            console.log('Using response.data');
        } else if (response && typeof response === 'object' && response.message && typeof response.message === 'object') {
            chartData = response.message;
            console.log('Using response.message');
        } else if (response && typeof response === 'string') {
            chartData = { visible: false, message: response, labels: [], datasets: [] };
            console.log('Using string response as message');
        }
        
        const $section = $('#score-chart-section');
        const $legend = $('#score-chart-legend');
        const $svg = $('#custom-score-chart');

        if (chartData && typeof chartData.chart_type === 'undefined') {
            chartData.chart_type = 'assignment';
        }

        console.log('chartData after extraction:', chartData);
        console.log('chartData.visible:', chartData?.visible);
        console.log('chartData.labels:', chartData?.labels);
        console.log('chartData.datasets:', chartData?.datasets);

        // Validasi data - PERBAIKAN: cek visible dengan benar
        if (!chartData) {
            console.log('No chartData, hiding chart');
            $section.addClass('hidden');
            $legend.empty();
            $svg.empty();
            return;
        }

        // Jika visible false dan ada pesan error, tampilkan pesan
        if (chartData.visible === false) {
            console.log('Chart not visible:', chartData.message || 'No message');
            $section.addClass('hidden');
            $legend.empty();
            $svg.empty();
            // Tampilkan pesan error di UI jika perlu
            if (chartData.message) {
                $section.html(`<div class="text-center py-8 text-gray-500">${safeText(chartData.message)}</div>`);
            }
            return;
        }

        // Cek labels dan datasets
        if (!chartData.labels || chartData.labels.length === 0) {
            console.log('No labels, hiding chart');
            $section.addClass('hidden');
            $legend.empty();
            $svg.empty();
            return;
        }

        if (!chartData.datasets || chartData.datasets.length === 0) {
            console.log('No datasets, hiding chart');
            $section.addClass('hidden');
            $legend.empty();
            $svg.empty();
            return;
        }

        // Pastikan visible true jika tidak ada visible property
        if (chartData.visible === undefined) {
            chartData.visible = true;
        }

        const isSingleStudent = chartData.is_single_student === true;
        console.log('isSingleStudent:', isSingleStudent);
        console.log('labels:', chartData.labels);
        console.log('datasets count:', chartData.datasets?.length);

        chartState.lastResponse = chartData;

        // Tampilkan section
        $section.removeClass('hidden');

        if (isSingleStudent) {
            console.log('Rendering vertical bar chart for single student');
            renderVerticalBarChart($section, $legend, $svg, chartData);
        } else {
            console.log('Rendering horizontal bar chart for multiple students');
            renderHorizontalBarChart($section, $legend, $svg, chartData);
        }
    }

    // fungsi untuk memuat data chart dari server
    function load(args) {
        const normalizedArgs = args || {};
        const chartType = String(normalizedArgs.chart_type || 'assignment').toLowerCase() === 'quiz' ? 'quiz' : 'assignment';
        const apiMethod = chartType === 'quiz'
            ? 'bima_lms.api.courses.get_course_quiz_chart_data'
            : 'bima_lms.api.courses.get_course_score_chart_data';

        console.log('CourseScoreBarChart.load() called with args:', normalizedArgs, 'using API:', apiMethod);

        if (!shouldRender()) {
            console.log('User not authorized, hiding chart');
            $('#score-chart-section').addClass('hidden');
            $('#score-chart-legend').empty();
            $('#custom-score-chart').empty();
            return;
        }

        console.log('Loading chart data...');
        $('#score-chart-section').removeClass('hidden');
        $('#custom-score-chart').html(`
            <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" rx="12">
                <text x="50%" y="50%" text-anchor="middle" fill="#94a3b8" font-size="14">
                    Memuat data chart...
                </text>
            </rect>
        `);

        frappe.call({
            method: apiMethod,
            args: normalizedArgs,
            callback: function(r) {
                console.log('Chart API response:', r);
                if (r && r.message) {
                    const response = r.message;
                    response.chart_type = chartType;
                    console.log('Chart data received, rendering...');
                    renderChart(response);
                } else {
                    console.warn('No data received from chart API');
                    $('#score-chart-section').addClass('hidden');
                }
            },
            error: function(err) {
                console.error('Error loading score bar chart:', err);
                $('#score-chart-section').addClass('hidden');
            }
        });
    }

    // fungsi untuk merender chart batang vertikal (untuk single student)
    function renderVerticalBarChart($section, $legend, $svg, chartData) {
        const palette = buildPalette((chartData.datasets || []).length);

        const filteredChartData = applyCourseFilter(chartData);
        const labels = filteredChartData.labels || [];
        const datasets = filteredChartData.datasets || [];
        const chartType = String(filteredChartData.chart_type || 'assignment').toLowerCase() === 'quiz' ? 'quiz' : 'assignment';
        const studentName = labels[0] || 'Siswa';

        // Group by course
        const courseGroups = {};
        datasets.forEach((dataset, index) => {
            dataset.color = dataset.color || palette[index % palette.length] || '#4F46E5';
            const courseTitle = dataset.course_title || 'Unknown';
            if (!courseGroups[courseTitle]) {
                courseGroups[courseTitle] = {
                    startIndex: index,
                    endIndex: index,
                    assignments: []
                };
            }
            courseGroups[courseTitle].endIndex = index;
            courseGroups[courseTitle].assignments.push(index);
        });

        // Warna kontras untuk course
        const courseNames = Object.keys(courseGroups);
        const courseColors = getCourseColors(courseNames.length);
        const courseColorMap = {};
        courseNames.forEach((name, idx) => {
            courseColorMap[name] = courseColors[idx % courseColors.length];
        });

        datasets.forEach((dataset) => {
            const courseTitle = dataset.course_title || 'Unknown';
            dataset.courseColor = courseColorMap[courseTitle] || '#4F46E5';
        });

        const assignmentCount = datasets.length;

        const ASSIGNMENT_WIDTH = 110;
        const CHART_PADDING = 80;

        const calculatedWidth = assignmentCount * ASSIGNMENT_WIDTH + CHART_PADDING * 2 + 100;
        const chartWidth = Math.max(900, calculatedWidth);
        const chartHeight = 550;

        const padding = {
            top: 90,
            right: 40,
            bottom: 180,
            left: 70
        };

        const innerWidth = chartWidth - padding.left - padding.right;
        const innerHeight = chartHeight - padding.top - padding.bottom;
        const columnWidth = innerWidth / Math.max(assignmentCount, 1);
        const barWidth = Math.min(65, columnWidth * 0.58);
        const maxScore = 100;
        chartState.currentLayout = { padding, innerWidth, columnWidth, chartWidth, chartHeight, chartType: chartData.chart_type || 'assignment' };

        console.log('Vertical chart dimensions:', {chartWidth, chartHeight, innerWidth, innerHeight, barWidth});

        renderLegend($legend, datasets, chartType);

        // BUILD VERTICAL CHART
        let svgContent = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}">
                <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" rx="12" />
                <defs>
                    <style>
                        .assignment-label { font-weight: 500; cursor: help; font-size: 10px; }
                        .course-label { font-weight: 600; text-anchor: middle; letter-spacing: 0.5px; font-size: 12px; }
                        .chart-bar.submitted { cursor: pointer; }
                        .chart-bar.not-submitted { cursor: pointer; }
                        .chart-bar.not-enrolled { cursor: not-allowed; }
                        .score-label { font-size: 11px; font-weight: 600; }
                    </style>
                </defs>
        `;

        // Title - dengan subtitle yang lebih baik untuk parent
        const titleX = padding.left + innerWidth / 2;
        const isParentMode = chartData.is_single_student === true;
        
        // Hitung jumlah mata pelajaran unik
        const uniqueCourses = new Set(datasets.map(d => d.course_title || 'Unknown'));
        const courseCount = uniqueCourses.size;
        
        let subtitleText = `${datasets.length} tugas`;
        if (isParentMode) {
            subtitleText = `${courseCount} Mata Pelajaran · ${datasets.length} Tugas`;
        } else {
            subtitleText = chartData.subtitle || `${studentName} · ${datasets.length} tugas`;
        }
        
        svgContent += `
            <text x="${titleX}" y="35" class="chart-title" font-size="17" font-weight="700" text-anchor="middle" fill="#1e293b">
                ${safeText(chartData.title || 'Nilai Siswa per Tugas')}
            </text>
            <text x="${titleX}" y="58" class="chart-subtitle" font-size="13" text-anchor="middle" fill="#64748b">
                ${safeText(subtitleText)}
            </text>
        `;

        // Y-axis grid (0-100)
        for (let pct = 0; pct <= 100; pct += 20) {
            const y = padding.top + innerHeight - (pct / 100) * innerHeight;
            svgContent += `
                <line x1="${padding.left}" y1="${y}" x2="${padding.left + innerWidth}" y2="${y}" 
                    stroke="#e2e8f0" stroke-dasharray="4 4" stroke-width="0.5" />
                <text x="${padding.left - 10}" y="${y + 4}" 
                    text-anchor="end" font-size="10" fill="#94a3b8">${pct}</text>
            `;
        }

        // Axis lines
        svgContent += `
            <line x1="${padding.left}" y1="${padding.top}" 
                x2="${padding.left}" y2="${padding.top + innerHeight}" 
                stroke="#94a3b8" stroke-width="1.2" />
            <line x1="${padding.left}" y1="${padding.top + innerHeight}" 
                x2="${padding.left + innerWidth}" y2="${padding.top + innerHeight}" 
                stroke="#94a3b8" stroke-width="1.2" />
        `;

        // Course group background
        const groupWidth = innerWidth / assignmentCount;
        Object.entries(courseGroups).forEach(([courseTitle, group]) => {
            const startX = padding.left + group.startIndex * groupWidth;
            const endX = padding.left + (group.endIndex + 1) * groupWidth;
            const color = courseColorMap[courseTitle] || '#4F46E5';
            
            svgContent += `
                <rect x="${startX}" y="${padding.top}" 
                    width="${endX - startX}" height="${innerHeight}" 
                    fill="${color}" opacity="0.06" rx="4" />
                <line x1="${startX}" y1="${padding.top}" 
                    x2="${startX}" y2="${padding.top + innerHeight}" 
                    stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4" />
                <line x1="${endX}" y1="${padding.top}" 
                    x2="${endX}" y2="${padding.top + innerHeight}" 
                    stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4" />
            `;
        });

        // Bars
        const studentIndex = 0;
        const studentNameLabel = labels[studentIndex] || 'Siswa';

        datasets.forEach((dataset, assignmentIndex) => {
            const value = Number(dataset.values?.[studentIndex] || 0);
            const status = dataset.statuses ? dataset.statuses[studentIndex] : 'not_enrolled';
            const maxScoreVal = Number(dataset.max_score || dataset.passing_grade || 100);
            const resultStatus = (chartType === 'quiz' && dataset.result_statuses && dataset.result_statuses[studentIndex]) ? dataset.result_statuses[studentIndex] : null;
            const submittedAtValue = chartType === 'quiz' ? (Array.isArray(dataset.submitted_at) ? dataset.submitted_at[studentIndex] : dataset.submitted_at) : null;
            const isFailed = chartType === 'quiz' && resultStatus === 'Tidak Lulus';

            const percentage = status === 'submitted' ? Math.min(100, (value / Math.max(maxScoreVal, 1)) * 100) : 0;
            const barHeight = (percentage / 100) * innerHeight;
            const barX = padding.left + assignmentIndex * columnWidth + (columnWidth - barWidth) / 2;
            const barWidthVal = Math.min(55, columnWidth * 0.5);
            const barY = padding.top + innerHeight - barHeight;

            let color = '#e2e8f0';
            let opacity = 0.3;
            let barClass = 'chart-bar';
            let dataAttrs = `data-student="${safeText(studentNameLabel)}" data-assignment="${safeText(dataset.name)}" data-status="${status}" data-result-status="${safeText(resultStatus || (status === 'not_submitted' ? 'Belum Mengerjakan' : status === 'not_enrolled' ? 'Tidak Terdaftar' : 'Lulus'))}" data-submitted-at="${safeText(submittedAtValue || '')}"`;

            if (status === 'not_enrolled') {
                color = '#e2e8f0';
                opacity = 0.2;
                barClass += ' not-enrolled';
                dataAttrs += ` data-score="0" data-maxscore="${maxScoreVal}"`;
            } else if (status === 'not_submitted') {
                color = '#e2e8f0';
                opacity = 0.4;
                barClass += ' not-submitted';
                dataAttrs += ` data-score="0" data-maxscore="${maxScoreVal}"`;
            } else if (status === 'submitted') {
                color = (dataset.color || '#4F46E5');
                opacity = 0.85;
                barClass += ' submitted';
                dataAttrs += ` data-score="${value}" data-maxscore="${maxScoreVal}"`;
            }

            // Background bar
            svgContent += `
                <rect x="${barX}" y="${padding.top}" 
                    width="${barWidthVal}" height="${innerHeight}" 
                    rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5" />
            `;

            if (barHeight > 2) {
                svgContent += `
                    <rect x="${barX + 1}" y="${barY + 1}" 
                        width="${barWidthVal - 2}" height="${Math.max(2, barHeight - 2)}" 
                        rx="3" fill="${color}" opacity="${opacity}"
                        ${dataAttrs} class="${barClass}" stroke="${isFailed ? '#ef4444' : 'transparent'}" stroke-width="${isFailed ? 1.2 : 0}" />
                `;
            }

            if (status === 'not_enrolled') {
                const crossY1 = padding.top + 4;
                const crossY2 = padding.top + innerHeight - 4;
                svgContent += `
                    <line x1="${barX + 4}" y1="${crossY1}" x2="${barX + barWidthVal - 4}" y2="${crossY2}" 
                        stroke="#94a3b8" stroke-width="0.8" opacity="0.4" />
                    <line x1="${barX + barWidthVal - 4}" y1="${crossY1}" x2="${barX + 4}" y2="${crossY2}" 
                        stroke="#94a3b8" stroke-width="0.8" opacity="0.4" />
                `;
            }

            if (status === 'submitted' && value > 0) {
                const labelY = barY - 8;
                const valueTextColor = isFailed ? '#ef4444' : '#475569';
                const valueTextWeight = isFailed ? 700 : 600;

                if (labelY < padding.top + 12) {
                    svgContent += `
                        <text x="${barX + barWidthVal/2}" y="${padding.top + 16}" 
                            text-anchor="middle" font-size="11" fill="${valueTextColor}" font-weight="${valueTextWeight}"
                            class="score-label">
                            ${Math.round(value)}
                        </text>
                    `;
                } else {
                    svgContent += `
                        <text x="${barX + barWidthVal/2}" y="${labelY}" 
                            text-anchor="middle" font-size="11" fill="${valueTextColor}" font-weight="${valueTextWeight}"
                            class="score-label">
                            ${Math.round(value)}
                        </text>
                    `;
                }
            } else if (status === 'not_submitted') {
                svgContent += `
                    <text x="${barX + barWidthVal/2}" y="${padding.top + innerHeight + 22}" 
                        text-anchor="middle" font-size="10" fill="#94a3b8">
                        -
                    </text>
                `;
            }

            const x = padding.left + (assignmentIndex / assignmentCount) * innerWidth + (innerWidth / assignmentCount / 2);
            const labelY = padding.top + innerHeight + 40;
            const assignmentName = dataset.name.split('(')[0].trim() || dataset.name;

            const maxCharsPerLine = 14;
            let lines = [];
            if (assignmentName.length > maxCharsPerLine) {
                const words = assignmentName.split(' ');
                let currentLine = '';
                words.forEach(word => {
                    if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
                        currentLine += (currentLine ? ' ' : '') + word;
                    } else {
                        if (currentLine) lines.push(currentLine);
                        currentLine = word;
                    }
                });
                if (currentLine) lines.push(currentLine);
            } else {
                lines = [assignmentName];
            }

            const lineHeight = 14;
            const startY = labelY - ((lines.length - 1) * lineHeight / 2);
            lines.forEach((line, lineIndex) => {
                svgContent += `
                    <text x="${x}" y="${startY + lineIndex * lineHeight}" 
                        text-anchor="middle" font-size="10" fill="#475569" class="assignment-label">
                        ${safeText(line)}
                    </text>
                `;
            });
        });

        // Course names di bawah label - dengan ukuran font lebih besar
        const maxLabelLines = datasets.reduce((max, d) => {
            const name = d.name.split('(')[0].trim() || d.name;
            return Math.max(max, Math.ceil(name.length / 14));
        }, 1);
        const courseLabelY = padding.top + innerHeight + 40 + (maxLabelLines * 14) + 20;

        Object.entries(courseGroups).forEach(([courseTitle, group]) => {
            const startX = padding.left + group.startIndex * groupWidth;
            const endX = padding.left + (group.endIndex + 1) * groupWidth;
            const midX = (startX + endX) / 2;
            const color = courseColorMap[courseTitle] || '#4F46E5';
            
            svgContent += `
                <line x1="${startX + 4}" y1="${courseLabelY - 6}" 
                    x2="${endX - 4}" y2="${courseLabelY - 6}" 
                    stroke="${color}" stroke-width="2.5" opacity="0.6" />
                <text x="${midX}" y="${courseLabelY + 16}" 
                    font-size="12" fill="${color}" font-weight="700" text-anchor="middle" class="course-label">
                    ${safeText(courseTitle)}
                </text>
            `;
        });

        svgContent += `</svg>`;

        $section.removeClass('hidden');
        $svg.removeAttr('viewBox');
        $svg.html(svgContent);
        
        setupTooltip($svg, chartData);
        setupScroll($section, chartWidth, chartHeight);
        
        console.log('Vertical chart render complete!');
    }

    console.log('CourseScoreBarChart initialized, exposing public methods');
    return {
        shouldRender: shouldRender,
        render: renderChart,  // <- Pastikan ini ada
        load: load,
        getUserRoles: getUserRoles,
        debug: function() {
            console.log('Chart debug info:', {
                shouldRender: shouldRender(),
                roles: getUserRoles(),
                user: frappe.session?.user,
                boot: frappe.boot?.user?.roles
            });
        }
    };
})();

console.log('CourseScoreBarChart loaded successfully');