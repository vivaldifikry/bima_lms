frappe.dashboards.chart_sources["Assignment Scores Source"] = {
    method: "bima_lms.bima_lms.dashboard_chart_source.assignment_scores_source.assignment_scores_source.get_data",
    filters: [],
    
    on_render: function(chart) {
        if (!chart || !chart.parent) return;
        
        // Debug
        console.log('Chart data:', chart.data);
        console.log('Chart object:', chart);
        
        setTimeout(() => {
            try {
                const container = chart.parent;
                
                // 1. Setup container untuk scroll
                container.style.cssText = `
                    overflow-x: auto !important;
                    overflow-y: visible !important;
                    width: 100% !important;
                    position: relative !important;
                `;
                
                // 2. Cari wrapper chart
                let chartWrapper = container.querySelector('.chart-wrapper');
                if (!chartWrapper) {
                    chartWrapper = container.querySelector('.chart-container');
                }
                if (!chartWrapper) {
                    chartWrapper = container;
                }
                
                // 3. Set lebar berdasarkan jumlah data
                const labelCount = chart.data && chart.data.labels ? chart.data.labels.length : 10;
                const minWidth = Math.max(800, labelCount * 60);
                chartWrapper.style.cssText = `
                    min-width: ${minWidth}px !important;
                    width: 100% !important;
                    overflow-x: auto !important;
                `;
                
                // 4. Styling canvas
                const canvas = container.querySelector('canvas');
                if (canvas) {
                    canvas.style.cssText = `
                        width: 100% !important;
                        height: auto !important;
                        max-height: 400px !important;
                    `;
                }
                
                // 5. Update chart configuration untuk horizontal bar
                if (chart.chart_obj && chart.chart_obj.config) {
                    const config = chart.chart_obj.config;
                    
                    // Set horizontal bar
                    config.options.indexAxis = 'y';
                    
                    // Atur scales
                    config.options.scales = {
                        x: {
                            grid: {
                                display: true,
                                drawBorder: true
                            },
                            title: {
                                display: true,
                                text: 'Nilai'
                            },
                            min: 0,
                            max: 100
                        },
                        y: {
                            grid: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: 'Siswa'
                            },
                            ticks: {
                                autoSkip: false,
                                font: {
                                    size: 9
                                }
                            }
                        }
                    };
                    
                    // Atur spacing bars
                    if (config.options.barOptions) {
                        config.options.barOptions.spaceRatio = 0.1;
                    }
                    
                    // Update chart
                    chart.chart_obj.update();
                }
                
                // 6. Styling legend - cari dan modifikasi
                const legendContainer = container.querySelector('.chart-legend, .legend-container');
                if (legendContainer) {
                    legendContainer.style.cssText = `
                        display: flex !important;
                        flex-wrap: wrap !important;
                        gap: 5px !important;
                        max-height: 150px !important;
                        overflow-y: auto !important;
                        padding: 10px !important;
                        margin-top: 10px !important;
                        border-top: 1px solid #e0e0e0 !important;
                    `;
                    
                    // Style individual legend items
                    const legendItems = legendContainer.querySelectorAll('.legend-item, li');
                    legendItems.forEach(item => {
                        item.style.cssText = `
                            display: inline-flex !important;
                            align-items: center !important;
                            margin: 2px 8px 2px 0 !important;
                            font-size: 11px !important;
                        `;
                    });
                }
                
                console.log('Chart styling applied successfully');
                
            } catch (error) {
                console.error('Error in on_render:', error);
            }
        }, 500);
    }
};