window.StudentSwitcher = {
    STORAGE_KEY_ID: 'active_student_id',
    STORAGE_KEY_NAME: 'active_student_name',

    getActiveStudentId: function() {
        return localStorage.getItem(this.STORAGE_KEY_ID);
    },

    getActiveStudentName: function() {
        return localStorage.getItem(this.STORAGE_KEY_NAME) || 'Anak';
    },

    clearActiveStudent: function() {
        console.log('Clearing student switcher data...');
        localStorage.removeItem(this.STORAGE_KEY_ID);
        localStorage.removeItem(this.STORAGE_KEY_NAME);
    },

    clearActiveStudentWithRetry: function() {
        console.log('Clearing student switcher data with retry...');
        localStorage.removeItem(this.STORAGE_KEY_ID);
        localStorage.removeItem(this.STORAGE_KEY_NAME);
        sessionStorage.removeItem(this.STORAGE_KEY_ID);
        sessionStorage.removeItem(this.STORAGE_KEY_NAME);
        
        document.cookie = this.STORAGE_KEY_ID + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = this.STORAGE_KEY_NAME + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = this.STORAGE_KEY_ID + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/app;';
        document.cookie = this.STORAGE_KEY_NAME + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/app;';
        
        setTimeout(() => {
            const checkId = localStorage.getItem(this.STORAGE_KEY_ID);
            const checkName = localStorage.getItem(this.STORAGE_KEY_NAME);
            if (checkId || checkName) {
                localStorage.setItem(this.STORAGE_KEY_ID, '');
                localStorage.setItem(this.STORAGE_KEY_NAME, '');
                localStorage.removeItem(this.STORAGE_KEY_ID);
                localStorage.removeItem(this.STORAGE_KEY_NAME);
            }
        }, 100);
    },

    getUserRoles: function() {
        if (Array.isArray(frappe.user_roles)) {
            return frappe.user_roles;
        }
        if (frappe.boot && frappe.boot.user && Array.isArray(frappe.boot.user.roles)) {
            return frappe.boot.user.roles;
        }
        return [];
    },

    // Cek apakah user adalah Administrator atau System Manager
    isAdminOrSystemManager: function() {
        const roles = this.getUserRoles();
        return roles.includes('Administrator') || 
               roles.includes('System Manager') ||
               roles.includes('Admin');
    },

    bindLogoutListener: function() {
        const self = this;
        if (frappe.logout && !frappe.logout._switcher_patched) {
            const originalLogout = frappe.logout;
            frappe.logout = function() {
                self.clearActiveStudentWithRetry();
                return originalLogout.apply(this, arguments);
            };
            frappe.logout._switcher_patched = true;
        }

        $(document).ajaxComplete(function(event, xhr, settings) {
            if (settings.url && (
                settings.url.includes('cmd=logout') || 
                settings.url.includes('/api/method/logout') ||
                settings.url.includes('/logout')
            )) {
                self.clearActiveStudentWithRetry();
            }
        });

        $(window).on('beforeunload', function() {
            if (frappe.session && frappe.session.user === 'Guest') {
                self.clearActiveStudentWithRetry();
            }
        });
    },

    bindNavbarLogoutListener: function() {
        const self = this;
        $(document).off('click', '.logout-link, .dropdown-item-logout, a[href*="cmd=logout"], a[href*="/logout"], .logout-btn');
        $(document).off('click', '.dropdown-menu a, .navbar .dropdown-item');
        
        $(document).on('click', '.logout-link, .dropdown-item-logout, a[href*="cmd=logout"], a[href*="/logout"], .logout-btn', function() {
            self.clearActiveStudentWithRetry();
        });

        $(document).on('click', '.dropdown-menu a, .navbar .dropdown-item', function() {
            const href = $(this).attr('href') || '';
            const text = $(this).text().toLowerCase();
            const dataAction = $(this).data('action') || '';
            
            if (href.includes('logout') || href.includes('cmd=logout') || text.includes('logout') || dataAction.includes('logout')) {
                self.clearActiveStudentWithRetry();
            }
        });

        $(document).on('click', '[data-action="logout"], [data-event="logout"], .logout-item', function() {
            self.clearActiveStudentWithRetry();
        });

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    $(mutation.addedNodes).each(function() {
                        const $node = $(this);
                        const logoutElements = $node.find('.dropdown-item-logout, a[href*="logout"], a[href*="cmd=logout"], .logout-btn, [data-action="logout"]');
                        if ($node.is('.dropdown-item-logout, a[href*="logout"], a[href*="cmd=logout"], .logout-btn, [data-action="logout"]')) {
                            logoutElements.add($node);
                        }
                        logoutElements.each(function() {
                            if (!$(this).data('logout-listener')) {
                                $(this).data('logout-listener', true);
                                $(this).on('click', function() {
                                    self.clearActiveStudentWithRetry();
                                });
                            }
                        });
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    },

    startPeriodicCheck: function() {
        const self = this;
        setInterval(() => {
            if (frappe.session && frappe.session.user === 'Guest') {
                const id = localStorage.getItem(self.STORAGE_KEY_ID);
                const name = localStorage.getItem(self.STORAGE_KEY_NAME);
                if (id || name) {
                    self.clearActiveStudentWithRetry();
                }
            }
        }, 5000);
    },

    init: function(onContextReady) {
        this.bindLogoutListener();
        this.bindNavbarLogoutListener();
        this.startPeriodicCheck();

        const userRoles = this.getUserRoles();
        const isParent = userRoles.includes('LMS Parent');
        const isAdmin = this.isAdminOrSystemManager();

        // Jika user adalah Admin atau System Manager, tidak perlu pilih anak
        if (isAdmin) {
            // Hapus data student jika ada (karena admin tidak perlu)
            this.clearActiveStudent();
            // Sembunyikan widget switcher
            $('#student-switcher-container').empty();
            if (typeof onContextReady === 'function') onContextReady(null);
            return;
        }

        // Jika bukan Parent, tidak perlu pilih anak
        if (!isParent) {
            if (typeof onContextReady === 'function') onContextReady(null);
            return;
        }

        const activeStudentId = this.getActiveStudentId();

        if (!activeStudentId) {
            // isMandatory = true karena belum ada anak terpilih
            this.openModal(true, onContextReady);
        } else {
            if (typeof onContextReady === 'function') onContextReady(activeStudentId);
        }
    },

    openModal: function(isMandatory, onSelectCallback) {
        const self = this;

        frappe.call({
            method: 'bima_lms.api.parent.get_my_students',
            freeze: true,
            freeze_message: __('Memuat data anak...'),
            callback: function(r) {
                if (r.message && r.message.length > 0) {
                    const students = r.message;
                    let selectedStudentId = self.getActiveStudentId() || String(students[0].student_id);

                    let cardsHtml = `<div class="space-y-2.5 my-2 max-h-60 overflow-y-auto pr-1">`;
                    students.forEach(s => {
                        const isSelected = String(s.student_id) === String(selectedStudentId);
                        const initial = s.student_name ? s.student_name.charAt(0).toUpperCase() : 'A';
                        
                        cardsHtml += `
                            <div class="student-select-card cursor-pointer p-3.5 rounded-xl border-2 transition-all flex items-center justify-between ${isSelected ? 'border-indigo-600 bg-indigo-50/60 shadow-sm' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}" data-id="${s.student_id}">
                                <div class="flex items-center space-x-3">
                                    <div class="w-9 h-9 rounded-full ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'} flex items-center justify-center font-bold text-sm">
                                        ${initial}
                                    </div>
                                    <div>
                                        <h4 class="text-sm font-bold text-gray-900 leading-tight">${self.escapeHtml(s.student_name)}</h4>
                                        <p class="text-xs text-gray-500 mt-0.5">
                                            ${s.nisn ? 'NISN: ' + self.escapeHtml(s.nisn) : ''} 
                                            ${s.nisn && s.nis ? '•' : ''} 
                                            ${s.nis ? 'NIS: ' + self.escapeHtml(s.nis) : ''}
                                        </p>
                                    </div>
                                </div>
                                <div class="check-icon ${isSelected ? 'block' : 'hidden'} text-indigo-600">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                    </svg>
                                </div>
                            </div>
                        `;
                    });
                    cardsHtml += `</div>`;

                    const dialog = new frappe.ui.Dialog({
                        title: __('Pilih Akun Anak'),
                        fields: [
                            {
                                fieldtype: 'HTML',
                                fieldname: 'student_cards_html',
                                options: cardsHtml
                            }
                        ],
                        primary_action_label: __('Gunakan Akun Ini'),
                        primary_action() {
                            const selectedObj = students.find(s => String(s.student_id) === String(selectedStudentId));

                            localStorage.setItem(self.STORAGE_KEY_ID, selectedStudentId);
                            localStorage.setItem(self.STORAGE_KEY_NAME, selectedObj ? selectedObj.student_name : 'Anak');

                            dialog.hide();

                            frappe.show_alert({
                                message: __('Berhasil memilih anak: ') + (selectedObj ? selectedObj.student_name : ''),
                                indicator: 'green'
                            });

                            if (!window._student_reloading) {
                                window._student_reloading = true;
                                setTimeout(() => {
                                    window._student_reloading = false;
                                    window.location.reload();
                                }, 300);
                            }
                        }
                    });

                    if (isMandatory) {
                        dialog.no_cancel();

                        dialog.$wrapper.off('click');
                        dialog.$wrapper.on('click', function(e) {
                            if ($(e.target).hasClass('modal') || $(e.target).hasClass('modal-backdrop')) {
                                e.stopImmediatePropagation();
                                e.preventDefault();
                            }
                        });

                        dialog.$wrapper.find('.modal-header .close, .modal-header .btn-modal-close').hide();

                        $(document).off('keydown.modal_mandatory').on('keydown.modal_mandatory', function(e) {
                            if (e.which === 27) {
                                e.stopImmediatePropagation();
                                e.preventDefault();
                            }
                        });
                    }

                    dialog.show();

                    dialog.$wrapper.find('.student-select-card').on('click', function() {
                        dialog.$wrapper.find('.student-select-card').removeClass('border-indigo-600 bg-indigo-50/60 shadow-sm').addClass('border-gray-200');
                        dialog.$wrapper.find('.student-select-card .w-9').removeClass('bg-indigo-600 text-white').addClass('bg-gray-200 text-gray-700');
                        dialog.$wrapper.find('.check-icon').addClass('hidden');

                        $(this).addClass('border-indigo-600 bg-indigo-50/60 shadow-sm').removeClass('border-gray-200');
                        $(this).find('.w-9').addClass('bg-indigo-600 text-white').removeClass('bg-gray-200 text-gray-700');
                        $(this).find('.check-icon').removeClass('hidden');

                        selectedStudentId = String($(this).data('id'));
                    });
                } else {
                    // Jika tidak ada data anak, hapus storage dan refresh
                    self.clearActiveStudent();
                    frappe.msgprint({
                        title: __('Data Tidak Ditemukan'),
                        indicator: 'orange',
                        message: __('Tidak ada data anak yang terhubung dengan akun Orang Tua Anda.')
                    });
                    // Jika modal mandatory dan tidak ada data, arahkan ke dashboard
                    if (isMandatory) {
                        setTimeout(() => {
                            frappe.set_route('lms-dashboard');
                        }, 2000);
                    }
                }
            }
        });
    },

    renderWidget: function(containerSelector, onSwitchSuccess) {
        const self = this;
        const userRoles = self.getUserRoles();
        const isAdmin = this.isAdminOrSystemManager();

        // Jika Admin atau System Manager, sembunyikan widget
        if (isAdmin) {
            $(containerSelector).empty();
            return;
        }

        if (!userRoles.includes('LMS Parent')) {
            $(containerSelector).empty();
            return;
        }

        const studentName = self.getActiveStudentName();

        const widgetHtml = `
            <div id="parent-student-switcher-badge" class="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-900 shadow-sm">
                <span class="flex items-center space-x-1.5">
                    <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    <span>Melihat sebagai: <strong class="font-bold text-indigo-950">${self.escapeHtml(studentName)}</strong></span>
                </span>
                <button type="button" id="btn-trigger-switch-student" class="p-1 rounded-md text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/80 transition-colors focus:outline-none ml-1" title="Ganti Anak">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                    </svg>
                </button>
            </div>
        `;

        $(containerSelector).html(widgetHtml);

        $('#btn-trigger-switch-student').off('click').on('click', function() {
            self.openModal(false, function() {
                if (!window._student_reloading) {
                    window._student_reloading = true;
                    setTimeout(() => {
                        window._student_reloading = false;
                        window.location.reload();
                    }, 300);
                }
            });
        });
    },

    escapeHtml: function(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};