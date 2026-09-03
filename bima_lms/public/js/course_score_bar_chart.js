window.CourseScoreBarChart = (function() {
    console.log('CourseScoreBarChart initializing...');
    
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
        const currentUser = frappe.session && frappe.session.user ? String(frappe.session.user) : '';
        
        // ADMIN: selalu bisa lihat
        if (currentUser === 'Administrator') {
            console.log('User is Administrator, returning true');
            return true;
        }
        
        // Cek apakah user punya role Admin atau Guru
        const hasAdminRole = roles.some(r => ['Administrator', 'Admin', 'LMS Admin', 'System Manager'].includes(r));
        const hasTeacherRole = roles.some(r => r === 'LMS Teacher');
        const hasParentRole = roles.some(r => r === 'LMS Parent');
        
        // Logika:
        // 1. Jika user punya Admin role -> true (meskipun juga Parent)
        // 2. Jika user punya Teacher role -> true
        // 3. Jika user punya Parent role -> true (bisa lihat chart anak)
        // 4. Selain itu -> false
        
        let result = false;
        if (hasAdminRole) {
            result = true;
            console.log('User has Admin role, returning true');
        } else if (hasTeacherRole) {
            result = true;
            console.log('User has Teacher role, returning true');
        } else if (hasParentRole) {
            // Parent bisa lihat chart (akan di-filter di backend berdasarkan student_id)
            result = true;
            console.log('User has Parent role, returning true');
        } else {
            console.log('User does not have required roles, returning false');
            result = false;
        }
        
        console.log('shouldRender result:', result);
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
    function renderLegend($legend, datasets) {
        if (!datasets || datasets.length === 0) {
            $legend.empty().html('<span class="text-gray-400 text-sm">Tidak ada tugas</span>');
            return;
        }
        
        const palette = buildPalette(datasets.length);
        $legend.empty();

        // Group by course
        const courseGroups = {};
        datasets.forEach((dataset, index) => {
            const courseTitle = dataset.course_title || 'Unknown';
            if (!courseGroups[courseTitle]) {
                courseGroups[courseTitle] = [];
            }
            courseGroups[courseTitle].push({...dataset, index});
        });

        // Dapatkan warna kontras untuk setiap course
        const courseNames = Object.keys(courseGroups);
        const courseColors = getCourseColors(courseNames.length);
        const courseColorMap = {};
        courseNames.forEach((name, idx) => {
            courseColorMap[name] = courseColors[idx % courseColors.length];
        });

        // Render legend per course dengan background
        Object.entries(courseGroups).forEach(([courseTitle, items]) => {
            const color = courseColorMap[courseTitle] || '#4F46E5';
            $legend.append(`
                <div style="display:flex;align-items:center;gap:4px;padding:2px 10px 2px 6px;border-radius:6px;background:${color}08;border:1px solid ${color}30;">
                    <span style="font-weight:600;font-size:10px;color:${color};margin-right:4px;">${safeText(courseTitle)}</span>
                    ${items.map(item => `
                        <span class="score-chart-legend-item" data-assignment-id="${item.assignment_id}" style="background:transparent;border:none;padding:2px 4px;">
                            <span class="score-chart-legend-swatch" style="background:${item.color || color};width:8px;height:8px;border-radius:2px;"></span>
                            <span style="font-size:9px;color:#475569;">${safeText(item.name.split('(')[0].trim() || item.name)}</span>
                        </span>
                    `).join('')}
                </div>
            `);
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
            const score = $bar.data('score');
            const maxScore = $bar.data('maxscore') || 100;
            const status = $bar.data('status');
            
            // Parse assignment name dan course dari dataset
            let assignmentName = assignment;
            let courseName = '';
            
            // Cari di chartData
            if (chartData && chartData.datasets) {
                for (const ds of chartData.datasets) {
                    if (ds.name === assignment) {
                        courseName = ds.course_title || '';
                        // Ambil nama tugas tanpa course
                        assignmentName = ds.name.split('(')[0].trim() || ds.name;
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
            
            if (status === 'not_enrolled') {
                html += `<div style="color:#94a3b8;font-style:italic;margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;">
                            Siswa tidak terdaftar di course ini
                        </div>`;
            } else if (status === 'not_submitted') {
                html += `<div style="color:#f59e0b;font-weight:500;margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;">
                            ⚠️ Belum mengerjakan tugas
                        </div>`;
                // Tampilkan deadline
                if (chartData && chartData.assignments_info) {
                    for (const [id, info] of Object.entries(chartData.assignments_info)) {
                        if (info.title === assignmentName) {
                            if (info.deadline) {
                                html += `<div style="color:#94a3b8;font-size:11px;margin-top:2px;">
                                            📅 Deadline: ${formatDate(info.deadline)}
                                        </div>`;
                            }
                            break;
                        }
                    }
                }
            } else if (status === 'submitted') {
                const percentage = ((score / maxScore) * 100).toFixed(0);
                html += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;">
                            <span style="font-weight:500;">Nilai:</span> 
                            <span style="color:#4F46E5;font-weight:700;font-size:14px;">${score}</span>
                            <span style="color:#94a3b8;"> / ${maxScore}</span>
                            <span style="color:#10B981;font-weight:600;margin-left:6px;">(${percentage}%)</span>
                        </div>`;
                
                // Cari data tambahan dari chartData
                if (chartData && chartData.students_data) {
                    for (const [studentName, studentData] of Object.entries(chartData.students_data)) {
                        if (studentName === student) {
                            for (const [courseId, courseData] of Object.entries(studentData.courses || {})) {
                                for (const [assignmentId, assignmentData] of Object.entries(courseData.assignments || {})) {
                                    if (assignmentData.title === assignmentName) {
                                        if (assignmentData.submitted_at) {
                                            html += `<div style="color:#64748b;font-size:11px;margin-top:2px;">
                                                        📅 ${formatDate(assignmentData.submitted_at)}
                                                    </div>`;
                                        }
                                        if (assignmentData.is_late) {
                                            html += `<div style="color:#ef4444;font-weight:600;font-size:11px;margin-top:2px;">
                                                        ⚠️ Terlambat
                                                    </div>`;
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
        
        const labels = chartData.labels;
        const datasets = chartData.datasets;
        const palette = buildPalette(datasets.length);
        
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
        const ASSIGNMENT_WIDTH = 140; // Lebih lebar
        
        const calculatedWidth = assignmentCount * ASSIGNMENT_WIDTH + 350;
        const calculatedHeight = studentCount * STUDENT_HEIGHT + 250;
        
        const chartWidth = Math.max(1100, calculatedWidth);
        const chartHeight = Math.max(500, calculatedHeight);
        
        const padding = { 
            top: 70,
            right: 130,
            bottom: 200, // Tambah bottom untuk label lebih besar
            left: 200
        };
        
        const innerWidth = chartWidth - padding.left - padding.right;
        const innerHeight = chartHeight - padding.top - padding.bottom;
        const rowHeight = innerHeight / studentCount;
        const barMaxWidth = Math.min(75, innerWidth / assignmentCount * 0.6);

        renderLegend($legend, datasets);

        let svgContent = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}">
                <defs>
                    <style>
                        .course-group-bg { opacity: 0.1; }
                        .course-group-border { stroke-dasharray: 4 4; stroke-width: 1.5; }
                        .assignment-label { font-weight: 500; cursor: help; font-size: 10px; }
                        .course-label { font-weight: 600; text-anchor: middle; letter-spacing: 0.5px; font-size: 13px; }
                        .chart-title { font-weight: 700; text-anchor: middle; }
                        .chart-subtitle { text-anchor: middle; }
                        .chart-bar.submitted { cursor: pointer; }
                        .chart-bar.not-submitted { cursor: pointer; }
                        .chart-bar.not-enrolled { cursor: not-allowed; }
                    </style>
                </defs>
                <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" rx="12" />
        `;

        const titleX = padding.left + innerWidth / 2;
        svgContent += `
            <text x="${titleX}" y="30" class="chart-title" font-size="17" fill="#1e293b">
                ${safeText(chartData.title || 'Perbandingan Nilai Siswa per Tugas')}
            </text>
            <text x="${titleX}" y="52" class="chart-subtitle" font-size="13" fill="#64748b">
                ${safeText(chartData.subtitle || '')}
            </text>
        `;

        const groupWidth = innerWidth / assignmentCount;
        Object.entries(courseGroups).forEach(([courseTitle, group]) => {
            const startX = padding.left + group.startIndex * groupWidth;
            const endX = padding.left + (group.endIndex + 1) * groupWidth;
            const color = courseColorMap[courseTitle] || '#4F46E5';
            
            svgContent += `
                <rect x="${startX}" y="${padding.top}" 
                    width="${endX - startX}" height="${innerHeight}" 
                    fill="${color}" opacity="0.08" rx="4" />
                <line x1="${startX}" y1="${padding.top}" 
                    x2="${startX}" y2="${padding.top + innerHeight}" 
                    stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4" />
                <line x1="${endX}" y1="${padding.top}" 
                    x2="${endX}" y2="${padding.top + innerHeight}" 
                    stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4" />
            `;
        });

        // Grid lines - tanpa angka
        for (let pct = 0; pct <= 100; pct += 20) {
            const x = padding.left + (pct / 100) * innerWidth;
            svgContent += `
                <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${padding.top + innerHeight}" 
                    stroke="#e2e8f0" stroke-dasharray="4 4" stroke-width="0.5" />
            `;
        }

        svgContent += `
            <line x1="${padding.left}" y1="${padding.top}" 
                x2="${padding.left}" y2="${padding.top + innerHeight}" 
                stroke="#94a3b8" stroke-width="1.2" />
            <line x1="${padding.left}" y1="${padding.top + innerHeight}" 
                x2="${padding.left + innerWidth}" y2="${padding.top + innerHeight}" 
                stroke="#94a3b8" stroke-width="1.2" />
        `;

        // X-axis labels - font lebih besar
        datasets.forEach((dataset, index) => {
            const x = padding.left + (index / assignmentCount) * innerWidth + (innerWidth / assignmentCount / 2);
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

        // Course names - font lebih besar
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
                    stroke="${color}" stroke-width="2.5" opacity="0.7" />
                <text x="${midX}" y="${courseLabelY + 16}" 
                    class="course-label" font-size="13" fill="${color}" font-weight="700">
                    ${safeText(courseTitle)}
                </text>
            `;
        });

        // Bars (sama seperti sebelumnya, tapi dengan font lebih besar)
        labels.forEach((studentName, studentIndex) => {
            const y = padding.top + studentIndex * rowHeight + rowHeight / 2;
            
            const displayName = studentName.length > 20 ? studentName.substring(0, 18) + '...' : studentName;
            svgContent += `
                <text x="${padding.left - 14}" y="${y + 5}" 
                    text-anchor="end" fill="#1e293b" font-size="12" font-weight="500">
                    ${safeText(displayName)}
                </text>
            `;

            datasets.forEach((dataset, assignmentIndex) => {
                const value = dataset.values[studentIndex] || 0;
                const status = dataset.statuses ? dataset.statuses[studentIndex] : 'not_enrolled';
                const maxScore = dataset.max_score || 100;
                
                const percentage = status === 'submitted' ? Math.min(100, (value / maxScore) * 100) : 0;
                const barWidth = (percentage / 100) * barMaxWidth;
                const barHeight = Math.max(12, Math.min(18, rowHeight * 0.5));
                const barX = padding.left + (assignmentIndex / assignmentCount) * innerWidth + (innerWidth / assignmentCount * 0.15);
                
                let color = '#e2e8f0';
                let opacity = 0.3;
                let barClass = 'chart-bar';
                let dataAttrs = `data-student="${safeText(studentName)}" data-assignment="${safeText(dataset.name)}" data-status="${status}"`;
                
                if (status === 'not_enrolled') {
                    color = '#e2e8f0';
                    opacity = 0.2;
                    barClass += ' not-enrolled';
                    dataAttrs += ` data-score="0" data-maxscore="${maxScore}"`;
                } else if (status === 'not_submitted') {
                    color = '#e2e8f0';
                    opacity = 0.4;
                    barClass += ' not-submitted';
                    dataAttrs += ` data-score="0" data-maxscore="${maxScore}"`;
                } else if (status === 'submitted') {
                    color = dataset.color || '#4F46E5';
                    opacity = 0.85;
                    barClass += ' submitted';
                    dataAttrs += ` data-score="${value}" data-maxscore="${maxScore}"`;
                }
                
                svgContent += `
                    <rect x="${barX}" y="${y - barHeight/2}" 
                        width="${barMaxWidth}" height="${barHeight}" 
                        rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5" />
                `;
                
                if (barWidth > 2) {
                    svgContent += `
                        <rect x="${barX + 1}" y="${y - barHeight/2 + 1}" 
                            width="${barWidth - 2}" height="${barHeight - 2}" 
                            rx="3" fill="${color}" opacity="${opacity}"
                            ${dataAttrs} class="${barClass}" />
                    `;
                }
                
                if (status === 'not_enrolled') {
                    const crossX1 = barX + 2;
                    const crossX2 = barX + barMaxWidth - 2;
                    const crossY1 = y - barHeight/2 + 2;
                    const crossY2 = y + barHeight/2 - 2;
                    svgContent += `
                        <line x1="${crossX1}" y1="${crossY1}" x2="${crossX2}" y2="${crossY2}" 
                            stroke="#94a3b8" stroke-width="0.8" opacity="0.4" />
                        <line x1="${crossX2}" y1="${crossY1}" x2="${crossX1}" y2="${crossY2}" 
                            stroke="#94a3b8" stroke-width="0.8" opacity="0.4" />
                    `;
                }
                
                if (status === 'submitted' && value > 0) {
                    const labelX = barX + barWidth + 4;
                    if (labelX + 30 < padding.left + innerWidth) {
                        svgContent += `
                            <text x="${labelX}" y="${y + 5}" 
                                font-size="10" fill="#475569" font-weight="600">
                                ${Math.round(value)}
                            </text>
                        `;
                    } else {
                        svgContent += `
                            <text x="${barX + barWidth - 4}" y="${y - barHeight/2 - 6}" 
                                font-size="9" fill="#475569" font-weight="600" text-anchor="end">
                                ${Math.round(value)}
                            </text>
                        `;
                    }
                } else if (status === 'not_submitted') {
                    svgContent += `
                        <text x="${barX + 4}" y="${y + 5}" 
                            font-size="10" fill="#94a3b8" font-weight="400">
                            -
                        </text>
                    `;
                }
            });
        });

        svgContent += `</svg>`;

        $section.removeClass('hidden');
        $svg.removeAttr('viewBox');
        $svg.html(svgContent);
        
        setupTooltip($svg, chartData);
        setupScroll($section, chartWidth, chartHeight);
        
        console.log('Horizontal chart render complete!');
    }

    // fungsi utama untuk merender chart
    function renderChart(response) {
        console.log('=== renderChart called ===');
        console.log('Raw response:', response);
        
        let chartData = response;
        if (response && response.data) {
            chartData = response.data;
            console.log('Using response.data');
        } else if (response && response.message) {
            chartData = response.message;
            console.log('Using response.message');
        }
        
        const $section = $('#score-chart-section');
        const $legend = $('#score-chart-legend');
        const $svg = $('#custom-score-chart');

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
        console.log('CourseScoreBarChart.load() called with args:', args);
        
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
            method: 'bima_lms.api.courses.get_course_score_chart_data',
            args: args || {},
            callback: function(r) {
                console.log('Chart API response:', r);
                if (r && r.message) {
                    console.log('Chart data received, rendering...');
                    renderChart(r.message);
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
        const labels = chartData.labels;
        const datasets = chartData.datasets;
        const palette = buildPalette(datasets.length);
        
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
        
        // UKURAN VERTICAL CHART - Tambah padding top untuk nilai
        const ASSIGNMENT_WIDTH = 110; // Lebih lebar sedikit
        const CHART_PADDING = 80;
        
        const calculatedWidth = assignmentCount * ASSIGNMENT_WIDTH + CHART_PADDING * 2 + 100;
        const chartWidth = Math.max(900, calculatedWidth); // Lebih besar
        const chartHeight = 550; // Lebih tinggi untuk padding nilai
        
        const padding = {
            top: 90, // Tambah padding top untuk nilai di atas bar
            right: 40,
            bottom: 180, // Tambah bottom untuk label
            left: 70
        };
        
        const innerWidth = chartWidth - padding.left - padding.right;
        const innerHeight = chartHeight - padding.top - padding.bottom;
        const barWidth = Math.min(65, innerWidth / assignmentCount * 0.6);
        const maxScore = 100;

        console.log('Vertical chart dimensions:', {chartWidth, chartHeight, innerWidth, innerHeight, barWidth});

        // Render legend
        renderLegend($legend, datasets);

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
            const value = dataset.values[studentIndex] || 0;
            const status = dataset.statuses ? dataset.statuses[studentIndex] : 'not_enrolled';
            const maxScoreVal = dataset.max_score || 100;
            
            const percentage = status === 'submitted' ? Math.min(100, (value / maxScoreVal) * 100) : 0;
            const barHeight = (percentage / 100) * innerHeight;
            const barX = padding.left + (assignmentIndex / assignmentCount) * innerWidth + (innerWidth / assignmentCount * 0.2);
            const barWidthVal = Math.min(55, innerWidth / assignmentCount * 0.5);
            const barY = padding.top + innerHeight - barHeight;
            
            let color = '#e2e8f0';
            let opacity = 0.3;
            let barClass = 'chart-bar';
            let dataAttrs = `data-student="${safeText(studentNameLabel)}" data-assignment="${safeText(dataset.name)}" data-status="${status}"`;
            
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
                color = dataset.color || '#4F46E5';
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
            
            // Actual bar
            if (barHeight > 2) {
                svgContent += `
                    <rect x="${barX + 1}" y="${barY + 1}" 
                        width="${barWidthVal - 2}" height="${Math.max(2, barHeight - 2)}" 
                        rx="3" fill="${color}" opacity="${opacity}"
                        ${dataAttrs} class="${barClass}" />
                `;
            }
            
            // Cross untuk not_enrolled
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
            
            // Score label di atas bar - dengan padding agar tidak terpotong
            if (status === 'submitted' && value > 0) {
                // Hitung posisi label dengan padding 8px dari atas bar
                const labelY = barY - 8;
                // Jika label terlalu dekat dengan top padding, taruh di dalam bar bagian atas
                if (labelY < padding.top + 12) {
                    // Taruh di dalam bar bagian atas
                    svgContent += `
                        <text x="${barX + barWidthVal/2}" y="${padding.top + 16}" 
                            text-anchor="middle" font-size="11" fill="#ffffff" font-weight="700"
                            class="score-label">
                            ${Math.round(value)}
                        </text>
                    `;
                } else {
                    svgContent += `
                        <text x="${barX + barWidthVal/2}" y="${labelY}" 
                            text-anchor="middle" font-size="11" fill="#475569" font-weight="700"
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
            
            // X-axis label (assignment name) - dengan ukuran font lebih besar
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
            
            const lineHeight = 14; // Lebih besar
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