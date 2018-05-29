const _ajaxTable = [];

(function ($) {
    $.fn.extend({
        ajaxTable: function (options) {
            this.defaultOptions = {
                source: false,
                sourceContext: {},
                printButtons: true,
                orderBy: 0,
                orderSort: 'desc',
                logging: false,
                onReady: function (table, data) { },
                beforeAjax: function (table, data) { },
                onUpdate: function (table, data) { }
            };

            let settings = $.extend({}, this.defaultOptions, options);

            let lang = window.navigator.userLanguage || window.navigator.language;

            //UTILITIES
            function mergeSort(array, comparefn) {
                function merge(arr, aux, lo, mid, hi, comparefn) {
                    var i = lo;
                    var j = mid + 1;
                    var k = lo;
                    while (true) {
                        var cmp = comparefn(arr[i], arr[j]);
                        if (cmp <= 0) {
                            aux[k++] = arr[i++];
                            if (i > mid) {
                                do
                                    aux[k++] = arr[j++];
                                while (j <= hi);
                                break;
                            }
                        } else {
                            aux[k++] = arr[j++];
                            if (j > hi) {
                                do
                                    aux[k++] = arr[i++];
                                while (i <= mid);
                                break;
                            }
                        }
                    }
                }

                function sortarrtoaux(arr, aux, lo, hi, comparefn) {
                    if (hi < lo) return;
                    if (hi == lo) {
                        aux[lo] = arr[lo];
                        return;
                    }
                    var mid = Math.floor(lo + (hi - lo) / 2);
                    sortarrtoarr(arr, aux, lo, mid, comparefn);
                    sortarrtoarr(arr, aux, mid + 1, hi, comparefn);
                    merge(arr, aux, lo, mid, hi, comparefn);
                }

                function sortarrtoarr(arr, aux, lo, hi, comparefn) {
                    if (hi <= lo) return;
                    var mid = Math.floor(lo + (hi - lo) / 2);
                    sortarrtoaux(arr, aux, lo, mid, comparefn);
                    sortarrtoaux(arr, aux, mid + 1, hi, comparefn);
                    merge(aux, arr, lo, mid, hi, comparefn);
                }

                function merge_sort(arr, comparefn) {
                    var aux = arr.slice(0);
                    sortarrtoarr(arr, aux, 0, arr.length - 1, comparefn);
                    return arr;
                }

                return merge_sort(array, comparefn);
            }

            function htmlToElement(html) {
                var template = document.createElement('template');
                html = html.trim();
                template.innerHTML = html;
                return template.content.firstChild;
            }

            function paginationDisplay(currentPage, pageCount) {
                let delta = 2,
                    left = currentPage - delta,
                    right = currentPage + delta + 1,
                    result = [];

                result = Array.from({ length: pageCount }, (v, k) => k + 1)
                    .filter(i => i && i >= left && i < right);

                if (result.length > 1) {
                    // Add first page and dots
                    if (result[0] > 1) {
                        if (result[0] > 2) {
                            result.unshift('...')
                        }
                        result.unshift(1)
                    }

                    // Add dots and last page
                    if (result[result.length - 1] < pageCount) {
                        if (result[result.length - 1] !== pageCount - 1) {
                            result.push('...')
                        }
                        result.push(pageCount)
                    }
                }

                return result;
            }

            function updateNav(pagination, targetedPage, pageCount, i) {
                $('.pagination-page,.pagination-etc', pagination).remove();
                if (targetedPage != 1) $('.pagination-prev', pagination).removeClass('disabled');
                else $('.pagination-prev', pagination).addClass('disabled');
                if (targetedPage < pageCount) $('.pagination-next', pagination).removeClass('disabled');
                else $('.pagination-next', pagination).addClass('disabled');

                for (li of paginationDisplay(_ajaxTable[i].page, pageCount)) {
                    $('.pagination-next', pagination).before('<li class="' + (li == '...' ? 'pagination-etc' : 'pagination-page') + (li == targetedPage ? ' active' : '') + '" data-page="' + li + '">' + li + '</li>');
                }

                _ajaxTable[i].page = targetedPage;
            }

            function updateTable(table, i) {
                $('tbody', table).empty().append(_ajaxTable[i].filteredData.slice((_ajaxTable[i].page - 1) * 10, _ajaxTable[i].page * 10));
                //Empty test
                if(!_ajaxTable[i].filteredData.slice((_ajaxTable[i].page - 1) * 10, _ajaxTable[i].page * 10).length) $('tbody', table).append('<tr><td class="empty" colspan="'+_ajaxTable[i].columns+'">' + (lang.toLowerCase().includes('fr') ? "Aucune donnée disponible dans le tableau" : "No data available") + '</td></tr>');
                    
                let pageCount = Math.floor((_ajaxTable[i].filteredTotal - 1) / 10) + 1;
                updateNav($(table).next().find('.ajax-table-pagination'), _ajaxTable[i].page, pageCount, i);
            }

            function paginationHandler(table, i, targetedPage, pagination, pageCount) {
                let dataGathering = new Promise((resolve, reject) => {
                    //        AJAX      &&        NOT FULLY LOADED        && ((         NO FILTER          &&              NOT STORED               ) ||           FILTER          )
                    if (settings.source && !_ajaxTable[i].dataFullyLoaded && ((!_ajaxTable[i].activeSearch && !_ajaxTable[i].silentData[targetedPage]) || _ajaxTable[i].activeSearch)) {
                        settings.beforeAjax.call(undefined, table, _ajaxTable[i]);
                        if (settings.logging) console.log('ajaxTable calling source...');
                        LOADER.enable();
                        $.getJSON(settings.source, {
                            page: targetedPage,
                            orderBy: _ajaxTable[i].orderBy,
                            order: _ajaxTable[i].orderSort,
                            search: _ajaxTable[i].search,
                            searchPatterns: _ajaxTable[i].searchPatterns,
                            columns: _ajaxTable[i].columns,
                            total: true,
                            context: settings.sourceContext
                        })
                            .done(json => {
                                $('tbody', table).empty();
                                for (tr of json.data) $('tbody', table).append(tr);
                                //Empty test
                                if(!json.data.length) $('tbody', table).append('<tr><td class="empty" colspan="'+_ajaxTable[i].columns+'">' + (lang.toLowerCase().includes('fr') ? "Aucune donnée disponible dans le tableau" : "No data available") + '</td></tr>');

                                //          NO FILTER          &&                                          NO SORT
                                if (!_ajaxTable[i].activeSearch && (_ajaxTable[i].orderBy == settings.orderBy && _ajaxTable[i].orderSort == settings.orderSort)) {
                                    _ajaxTable[i].silentData["" + targetedPage] = json.data.map(e => htmlToElement(e));
                                    if (settings.logging) console.log('ajaxTable recieved ' + json.data.length + ' items.');
                                } else {
                                    if (settings.logging) console.log('ajaxTable temporally recieved ' + json.data.length + ' items.');
                                }
                                LOADER.disable();
                                resolve(json.total);
                            })
                            .fail((_, textStatus, error) => {
                                let err = "Request Failed: " + textStatus + ", " + error;
                                console.log(_);
                                console.log(err);
                                LOADER.disable();
                                reject(err);
                            });
                        //              AJAX      &&        NOT FULLY LOADED        &&               STORED
                    } else if (settings.source && !_ajaxTable[i].dataFullyLoaded && _ajaxTable[i].silentData[targetedPage]) {
                        $('tbody', table).empty().append(_ajaxTable[i].silentData[targetedPage]);
                        //Empty test
                        if(!_ajaxTable[i].silentData[targetedPage].length) $('tbody', table).append('<tr><td class="empty" colspan="'+_ajaxTable[i].columns+'">' + (lang.toLowerCase().includes('fr') ? "Aucune donnée disponible dans le tableau" : "No data available") + '</td></tr>');
                        
                        resolve(_ajaxTable[i].total);
                    } else {
                        $('tbody', table).empty().append(_ajaxTable[i].filteredData.slice((targetedPage - 1) * 10, targetedPage * 10));
                        //Empty test
                        if(!_ajaxTable[i].filteredData.slice((targetedPage - 1) * 10, targetedPage * 10).length) $('tbody', table).append('<tr><td class="empty" colspan="'+_ajaxTable[i].columns+'">' + (lang.toLowerCase().includes('fr') ? "Aucune donnée disponible dans le tableau" : "No data available") + '</td></tr>');
                        
                        resolve(_ajaxTable[i].filteredData.length);
                    }
                });

                dataGathering.then(items => {
                    _ajaxTable[i].page = targetedPage;
                    updateNav(pagination, targetedPage, Math.floor((items - 1) / 10) + 1, i);
                    settings.onUpdate.call(undefined, table, _ajaxTable[i]);
                }).catch(err => {
                    alert(err);
                });
            }

            function silentLoad(page, i, table) {
                settings.beforeAjax.call(undefined, table, _ajaxTable[i]);
                if (settings.logging) console.log('ajaxTable calling source...');
                $.getJSON(settings.source, {
                    page: page,
                    context: settings.sourceContext
                })
                    .done(json => {
                        _ajaxTable[i].silentData["" + page] = json.data.map(e => htmlToElement(e));
                        if (settings.logging) console.log('ajaxTable silently recieved ' + json.data.length + ' items. (page ' + page + ')');
                        if (page < (Math.floor((_ajaxTable[i].total - 1) / 10) + 1)) silentLoad(page + 1, i);
                        else {
                            _ajaxTable[i].dataFullyLoaded = true;
                            _ajaxTable[i].data = [].concat(...Object.values(_ajaxTable[i].silentData));
                            _ajaxTable[i].filteredData = _ajaxTable[i].data;

                            $('tfoot input', table).filter((_, e) => e.value).each(function () {
                                let index = $(this).parent().index();
                                _ajaxTable[i].filteredData = _ajaxTable[i].filteredData.filter(tr => tr.childNodes[index].hasAttribute('data-search') ? tr.childNodes[index].attr('data-search').toLowerCase().includes(this.value.toLowerCase()) || tr.childNodes[index].innerText.toLowerCase().includes(this.value) : tr.childNodes[index].innerText.toLowerCase().includes(this.value));
                            });

                            _ajaxTable[i].filteredTotal = _ajaxTable[i].filteredData.length;

                            if (settings.logging) console.log('ajaxTable is done with AJAX tasks.');
                        }

                    })
                    .fail((_, textStatus, error) => {
                        let err = "Request Failed: " + textStatus + ", " + error;
                        console.log(_);
                        console.log(err);
                        silentLoad(page, i);
                    });
            }

            function saveState(i){
                localStorage.setItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_search', JSON.stringify(_ajaxTable[i].search));
                localStorage.setItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_orderBy', JSON.stringify(_ajaxTable[i].orderBy));
                localStorage.setItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_order', JSON.stringify(_ajaxTable[i].orderSort));
                localStorage.setItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_expires', new Date().getTime() + 1000 * 60 * 60);
            }

            //MAIN LOOP
            this.each(function (i) {
                let that = this;
                $(this).addClass('ajax-table-processed');

                //Basic settings
                let bundle = {
                    orderBy: settings.orderBy,
                    orderSort: settings.orderSort,
                    search: [],
                    activeSearch: false,
                    searchPatterns: [],
                    columns: $('thead th', that).length,
                    page: 1,
                    total: 1,
                    filteredTotal: 1,
                    printButtons: settings.printButtons,
                    data: [],
                    filteredData: [],
                    silentData: {},
                    dataFullyLoaded: false
                };

                bundle.data = $('tbody>tr', this).get();
                bundle.filteredData = [...bundle.data];

                //Search fields display
                if (!$('tfoot', this).length) $(this).append('<tfoot><tr></tr></tfoot>');
                $('tfoot', this).insertAfter($('thead', this));
                $('tfoot tr', this).empty();
                
                $('thead th', this).each(function () {
                    $('tfoot tr', that).append('<td><input type="text" placeholder="' + (lang.toLowerCase().includes('fr') ? "Entrée pour chercher" : "Enter to search") + '"></td>')
                });
                bundle.search = $('tfoot input', that).get().map(e => e.value);

                //Only keep 10 items shown
                if (bundle.data.length > 10) {
                    $('tbody>tr:nth-of-type(n+11)', this).remove();
                }

                let dataReady = new Promise((resolve, reject) => {
                    //Load items from AJAX
                    if (settings.source) {
                        settings.beforeAjax.call(undefined, that, bundle);
                        if (settings.logging) console.log('ajaxTable calling source...');

                        LOADER.enable();
                        $.getJSON(settings.source, {
                            total: true,
                            context: settings.sourceContext
                        })
                            .done(json => {
                                $('tbody', this).empty();
                                for (tr of json.data) $('tbody', this).append(tr);
                                //Empty test
                                if(!json.data.length) $('tbody', this).append('<tr><td class="empty" colspan="'+bundle.columns+'">' + (lang.toLowerCase().includes('fr') ? "Aucune donnée disponible dans le tableau" : "No data available") + '</td></tr>');
                        
                                bundle.data = json.data.map(e => htmlToElement(e));
                                bundle.filteredData = [...bundle.data];
                                bundle.silentData["1"] = [...bundle.data];
                                bundle.total = json.total;
                                bundle.filteredTotal = json.total;
                                bundle.searchPatterns = $('tbody tr:nth-of-type(1) td', that).get().map(e => e.getAttribute('data-search-template'));
                                if (settings.logging) console.log('ajaxTable recieved ' + json.data.length + ' items.');
                                LOADER.disable();
                                resolve();
                            })
                            .fail((_, textStatus, error) => {
                                let err = "Request Failed: " + textStatus + ", " + error;
                                console.log(_);
                                console.log(err);
                                LOADER.disable();
                                reject(err);
                            });
                    } else {
                        bundle.total = bundle.data.length;
                        bundle.filteredTotal = bundle.filteredData.length;
                        resolve();
                    }
                });

                dataReady.then(_ => {
                    //Store table bundle
                    _ajaxTable.push(bundle);

                    i = _ajaxTable.length - 1;

                    //INITIAL SORTING DISPLAY
                    let orderedColumn = $('thead th', that).eq(_ajaxTable[i].orderBy);
                    orderedColumn.addClass('sorted');
                    if (_ajaxTable[i].orderSort == 'asc') orderedColumn.addClass('inverted');

                    //PAGINATION
                    let pagination = $('<aside class="ajax-table-pagination"><ul><li class="pagination-prev disabled">&laquo;</li><li class="pagination-next">&raquo;</li></ul></aside>');
                    let pageCount = Math.floor((_ajaxTable[i].total - 1) / 10) + 1;
                    updateNav(pagination, 1, pageCount, i);

                    //PRINT BUTTONS
                    let utilities = $('<div class="ajax-table-utilities"></div>');
                    if(settings.printButtons){
                        utilities.append('<aside class="ajax-table-buttons"><ul><li class="export">Excel</li><li class="export">CSV</li><li class="export">PDF</li></ul></aside>');
                    }
                    utilities.append(pagination);
                    $(this).after(utilities);

                    //Pagination click handlers
                    pagination.on('click', 'li.pagination-page:not(.active)', function () {
                        let targetedPage = +$(this).attr('data-page');

                        paginationHandler(that, i, targetedPage, pagination, pageCount);
                    });

                    pagination.on('click', 'li.pagination-prev:not(.disabled),li.pagination-next:not(.disabled)', function () {
                        let targetedPage = +$(this).siblings('.active').attr('data-page');
                        if ($(this).is('.pagination-prev')) targetedPage--;
                        else targetedPage++;

                        paginationHandler(that, i, targetedPage, pagination, pageCount);
                    });

                    //Print click handlers
                    if(settings.printButtons){
                        utilities.on('click','.ajax-table-buttons li',function(){
                            switch ($(this).index()) {
                                case 0:
                                    $(that).excelExport();
                                    break;
                                case 1:
                                    let tableToPrint = $(that).clone();
                                    $('tfoot',tableToPrint).remove();
                                    tableToPrint.csvExport();
                                    break;
                                case 2:
                                    let iframe = $('<iframe class="excel-export" style="visibility: hidden; position: absolute; top:0; right:0;"></iframe>').appendTo('body');
                                    tableToPDF = $(that).clone();
                                    $('tfoot',tableToPDF).remove();
                                    iframe.contents().find('body').append(tableToPDF);
                                    iframe.contents().find('head').append('<link rel="stylesheet" href="https://rawgit.com/Zenoo/ajaxTable/master/ajaxTable.css">');
                                    
                                    iframe[0].contentWindow.print();
                                    iframe.remove();
                                    break;
                                default:
                                    break;
                            }
                        });
                    }

                    //Sorting handler
                    $('thead th', this).on('click', function () {
                        if ($(this).is('.sorted')) {
                            $(this).toggleClass('inverted');
                        } else {
                            $(this).addClass('sorted').siblings().removeClass('sorted inverted');
                        }

                        let order = $(this).hasClass('inverted') ? 1 : -1;
                        _ajaxTable[i].orderBy = $(this).index();
                        _ajaxTable[i].orderSort = order == 1 ? 'asc' : 'desc';
                        _ajaxTable[i].page = 1;

                        let sortingPromise = new Promise((resolve, reject) => {
                            if (settings.source && !_ajaxTable[i].dataFullyLoaded) {
                                settings.beforeAjax.call(undefined, that, _ajaxTable[i]);
                                if (settings.logging) console.log('ajaxTable calling source...');
                                LOADER.enable();
                                $.getJSON(settings.source, {
                                    page: _ajaxTable[i].page,
                                    orderBy: _ajaxTable[i].orderBy,
                                    order: _ajaxTable[i].orderSort,
                                    search: _ajaxTable[i].search,
                                    searchPatterns: _ajaxTable[i].searchPatterns,
                                    columns: _ajaxTable[i].columns,
                                    context: settings.sourceContext
                                })
                                    .done(json => {
                                        $('tbody', that).empty();
                                        for (tr of json.data) $('tbody', that).append(tr);
                                        //Empty test
                                        if(!json.data.length) $('tbody', that).append('<tr><td class="empty" colspan="'+_ajaxTable[i].columns+'">' + (lang.toLowerCase().includes('fr') ? "Aucune donnée disponible dans le tableau" : "No data available") + '</td></tr>');
                        
                                        if (settings.logging) console.log('ajaxTable temporally recieved ' + json.data.length + ' items.');
                                        LOADER.disable();
                                        resolve();
                                    })
                                    .fail((_, textStatus, error) => {
                                        let err = "Request Failed: " + textStatus + ", " + error;
                                        console.log(_);
                                        console.log(err);
                                        LOADER.disable();
                                        reject(err);
                                    });
                            } else {
                                let index = $(this).index();

                                _ajaxTable[i].filteredData = mergeSort(_ajaxTable[i].filteredData, (a, b) => {
                                    let $a_dataOrder = a.childNodes[index].getAttribute('data-order');
                                    let $b_dataOrder = b.childNodes[index].getAttribute('data-order');

                                    let $a_text = a.childNodes[index].innerText;
                                    let $b_text = b.childNodes[index].innerText;

                                    return a.childNodes[index].hasAttribute('data-order') ? !isNaN($a_dataOrder) ? (+$a_dataOrder > +$b_dataOrder ? order : +$a_dataOrder == +$b_dataOrder ? 0 : -order) : $a_dataOrder.localeCompare($b_dataOrder) * order : !isNaN($a_text) ? (+$a_text > +$b_text ? order : +$a_text == +$b_text ? 0 : -order) : $a_text.localeCompare($b_text) * order;
                                });

                                updateTable(that, i);
                                resolve();

                            }
                        });

                        sortingPromise.then(() => {
                            saveState(i);
                            settings.onUpdate.call(undefined, that, _ajaxTable[i]);
                        }).catch(error => {
                            alert(error);
                        });
                    });

                    //Search handler
                    $('tfoot input', this).on('keyup blur', function (e) {
                        if (e.keyCode == 13 || e.type == 'blur' && this.value != _ajaxTable[i].search[$(this).parent().index()]) {
                            _ajaxTable[i].search[$(this).parent().index()] = this.value;
                            _ajaxTable[i].activeSearch = !!_ajaxTable[i].search.filter(e => e.length).length;
                            _ajaxTable[i].page = 1;

                            let searchPromise = new Promise((resolve, reject) => {
                                if (settings.source && !_ajaxTable[i].dataFullyLoaded) {
                                    settings.beforeAjax.call(undefined, that, _ajaxTable[i]);
                                    if (settings.logging) console.log('ajaxTable calling source...');
                                    LOADER.enable();
                                    $.getJSON(settings.source, {
                                        page: _ajaxTable[i].page,
                                        orderBy: _ajaxTable[i].orderBy,
                                        order: _ajaxTable[i].orderSort,
                                        search: _ajaxTable[i].search,
                                        searchPatterns: _ajaxTable[i].searchPatterns,
                                        columns: _ajaxTable[i].columns,
                                        total: true,
                                        context: settings.sourceContext
                                    })
                                        .done(json => {
                                            $('tbody', that).empty();
                                            for (tr of json.data) $('tbody', that).append(tr);
                                            //Empty test
                                            if(!json.data.length) $('tbody', that).append('<tr><td class="empty" colspan="'+_ajaxTable[i].columns+'">' + (lang.toLowerCase().includes('fr') ? "Aucune donnée disponible dans le tableau" : "No data available") + '</td></tr>');
                        
                                            if (settings.logging) console.log('ajaxTable temporally recieved ' + json.data.length + ' items.');
                                            updateNav(pagination, _ajaxTable[i].page, Math.floor((json.total - 1) / 10) + 1, i);
                                            LOADER.disable();
                                            resolve();
                                        })
                                        .fail((_, textStatus, error) => {
                                            let err = "Request Failed: " + textStatus + ", " + error;
                                            console.log(_);
                                            console.log(err);
                                            LOADER.disable();
                                            reject(err);
                                        });
                                } else {
                                    _ajaxTable[i].filteredData = _ajaxTable[i].data;

                                    $('tfoot input', that).filter((_, e) => e.value).each(function () {
                                        let index = $(this).parent().index();
                                        _ajaxTable[i].filteredData = _ajaxTable[i].filteredData.filter(tr => tr.childNodes[index].hasAttribute('data-search') ? tr.childNodes[index].attr('data-search').toLowerCase().includes(this.value.toLowerCase()) || tr.childNodes[index].innerText.toLowerCase().includes(this.value) : tr.childNodes[index].innerText.toLowerCase().includes(this.value));
                                    });

                                    _ajaxTable[i].filteredTotal = _ajaxTable[i].filteredData.length;


                                    updateTable(that, i);
                                }
                            });

                            searchPromise.then(() => {
                                saveState(i);
                                settings.onUpdate.call(undefined, that, _ajaxTable[i]);
                            }).catch(error => {
                                alert(error);
                            });
                        }
                    });

                    //TABLE READY
                    if (settings.logging) console.log('ajaxTable ready.');
                    settings.onReady.call(undefined, that, _ajaxTable[i]);

                    //Reuse user's last sort + filter
                    let storageExpiresAt = localStorage.getItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_expires');
                    if(storageExpiresAt){
                        if(new Date().getTime() < storageExpiresAt){
                            _ajaxTable[i].search = JSON.parse(localStorage.getItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_search'));
                            _ajaxTable[i].orderBy = +JSON.parse(localStorage.getItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_orderBy'));
                            _ajaxTable[i].orderSort = JSON.parse(localStorage.getItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_order'));

                            //Displays searches
                            $('tfoot input', that).each(function(j){
                                this.value = _ajaxTable[i].search[j] ? _ajaxTable[i].search[j] : '';
                            });

                            _ajaxTable[i].activeSearch = !!_ajaxTable[i].search.filter(e => e.length).length;

                            //Displays sorting
                            $('thead th', that).removeClass('sorted inverted');
                            let orderedColumn = $('thead th', that).eq(_ajaxTable[i].orderBy);
                            orderedColumn.addClass('sorted');
                            if (_ajaxTable[i].orderSort == 'asc') orderedColumn.addClass('inverted');

                            if (settings.source && !_ajaxTable[i].dataFullyLoaded) {
                                settings.beforeAjax.call(undefined, that, _ajaxTable[i]);
                                if (settings.logging) console.log('ajaxTable calling source...');
                                LOADER.enable();
                                $.getJSON(settings.source, {
                                    page: _ajaxTable[i].page,
                                    orderBy: _ajaxTable[i].orderBy,
                                    order: _ajaxTable[i].orderSort,
                                    search: _ajaxTable[i].search,
                                    searchPatterns: _ajaxTable[i].searchPatterns,
                                    columns: _ajaxTable[i].columns,
                                    total: true,
                                    context: settings.sourceContext
                                })
                                    .done(json => {
                                        $('tbody', that).empty();
                                        for (tr of json.data) $('tbody', that).append(tr);
                                        //Empty test
                                        if(!json.data.length) $('tbody', that).append('<tr><td class="empty" colspan="'+_ajaxTable[i].columns+'">' + (lang.toLowerCase().includes('fr') ? "Aucune donnée disponible dans le tableau" : "No data available") + '</td></tr>');
                                
                                        if (settings.logging) console.log('ajaxTable temporally recieved ' + json.data.length + ' items.');
                                        _ajaxTable[i].page = 1;
                                        updateNav(pagination, _ajaxTable[i].page, Math.floor((json.total - 1) / 10) + 1, i);
                                        LOADER.disable();
                                    })
                                    .fail((_, textStatus, error) => {
                                        let err = "Request Failed: " + textStatus + ", " + error;
                                        console.log(_);
                                        console.log(err);
                                        LOADER.disable();
                                    });
                            } else {
                                _ajaxTable[i].filteredData = _ajaxTable[i].data;
                                _ajaxTable[i].page = 1;

                                $('tfoot input', that).filter((_, e) => e.value).each(function () {
                                    let index = $(this).parent().index();
                                    _ajaxTable[i].filteredData = _ajaxTable[i].filteredData.filter(tr => tr.childNodes[index].hasAttribute('data-search') ? tr.childNodes[index].attr('data-search').toLowerCase().includes(this.value.toLowerCase()) || tr.childNodes[index].innerText.toLowerCase().includes(this.value) : tr.childNodes[index].innerText.toLowerCase().includes(this.value));
                                });

                                _ajaxTable[i].filteredTotal = _ajaxTable[i].filteredData.length;

                                updateTable(that, i);
                            }
                        }else{
                            localStorage.removeItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_search');
                            localStorage.removeItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_orderBy');
                            localStorage.removeItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_order');
                            localStorage.removeItem(window.location.hostname + window.location.pathname + '_ajaxTable_' + i + '_expires');
                            storageExpiresAt = null;
                        }
                    }

                    if (Math.floor((_ajaxTable[i].total - 1) / 10) + 1 > 1) silentLoad(2, i);
                    else _ajaxTable[i].dataFullyLoaded = true;
                }).catch(err => {
                    alert(err);
                });
            });

            return this;
        }
    });
})(jQuery);
