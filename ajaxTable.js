const _ajaxTable = [];

function paginationDisplay(currentPage, pageCount) {
    let delta = 2,
        left = currentPage - delta,
        right = currentPage + delta + 1,
        result = [];

    result = Array.from({length: pageCount}, (v, k) => k + 1)
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

(function ($) {
    $.fn.extend({
        ajaxTable: function (options) {
            this.defaultOptions = {
                source: false,
                openTreeview: false,
                printButtons: true,
                orderBy: 0,
                orderSort: 'desc',
                onReady: function (table, data) { },
                beforeAjax: function (table, data) { },
                onUpdate: function (table, data) { }
            };

            let settings = $.extend({}, this.defaultOptions, options);

            this.each(function (i) {

                //Basic settings
                let bundle = {
                    orderBy: settings.orderBy,
                    orderSort: settings.orderSort,
                    search: {},
                    page: 1,
                    total: 1,
                    filteredTotal: 1,
                    printButtons: settings.printButtons,
                    data: []
                };

                bundle.data = $('tbody>tr', this).get().map(e => e.outerHTML.replace(/[\n\t]| +/g, ' '));

                //Only keep 10 items shown
                if (bundle.data.length > 10) {
                    $('tbody>tr:nth-of-type(n+11)', this).remove();
                }

                //Load items from AJAX
                if (settings.source) {

                } else {
                    total = bundle.data.length;
                    filteredTotal = total;
                }

                //Store table bundle
                _ajaxTable.push(bundle);

                //PAGINATION
                let pagination = $('<aside class="ajax-table-pagination"><ul><li class="pagination-prev disabled">&lt;</li><li class="pagination-next">&gt;</li></ul></aside>');
                let pageCount = Math.floor(total / 10) + 1;

                for(li of paginationDisplay(bundle.page, pageCount)){
                    $('.pagination-next',pagination).before('<li class="pagination-page'+(li == 1 ? ' active' : '')+'" data-page="'+li+'">'+li+'</li>');
                }

                $(this).after(pagination);

                let that = this;
                //Pagination click handlers
                $(pagination).on('click', 'li.pagination-page:not(.active)', function(){
                    $('tbody>tr',that).remove();
                    $(this).addClass('active').siblings('.active').removeClass('active');
                    let targetedPage = +$(this).attr('data-page');
                    $('tbody',that).append(_ajaxTable[i].data.slice((targetedPage-1)*10+1,targetedPage*10+1).join(''));
                });

                

                settings.onReady.call(undefined, this, bundle);
            });

            return this;
        }
    });
})(jQuery);
