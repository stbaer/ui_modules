//@formatter:off
;(function ($, window, document, undefined) {
//@formatter:on

    // Create the defaults once
    var pluginName = "ui_numspin",
        count = 0,
        defaults = {
            classes: '',
            val: 3,
            minVal: 2,
            maxVal: 10,
            step: 1,
            twbs3: false,
            formControlSize: '', //if twbs3 is set to true
            enableReset: true
        };

    // The actual plugin constructor
    function Plugin(element, options) {
        this.element = element;

        this.options = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.count = 0;
        this.init(element, this.options);

    }

    Plugin.prototype = {
        init: function (el, opts) {

            this.count = count++;

            $(el).addClass([this._name, opts.classes, (opts.twbs3 ? 'twbs' : '')].join(' '))
                .append(this.getView())
                .find('input').val(opts.val);

            this.attachEventHandlers(el, opts);

        },
        attachEventHandlers: function (el, opts) {

            var $el = $(el),
                self = this,
                defaults = this._defaults,
                $input = $(el).find('input');

            $el.find('.decr').on('click', function () {
                self.validateAndSet(parseInt($input.val(), 10) - defaults.step);
            });
            $el.find('.incr').on('click', function () {
                self.validateAndSet(parseInt($input.val(), 10) + defaults.step);
            });
            $el.find('input').on('change', function () {
                self.validateAndSet(parseInt($input.val(), 10) + defaults.step);
            });
            $el.find('.reset').on('click', function () {
                self.validateAndSet(defaults.val);
            });
            $el.on('numchanged', function (ev, el, val) {
                $input.val(val);
                self.options.val = val;
            });
        },

        validateAndSet: function (value) {
            var opts = this.options,
                newVal;

            if (value > opts.maxVal) {
                newVal = opts.maxVal;
            } else if (value < opts.minVal || isNaN(value)) {
                newVal = opts.minVal;
            } else {
                newVal = value;
            }

            $(this.element).trigger('numchanged', [this.element, newVal, this.count]);
        },
        /**
         * The View without Bootstrap markup
         * @returns {*}
         */
        getView: function () {

            var opts = this.options,
                object = $('<div/>').html(
                    [
                        '<button type="button" class="decr">-</button>', '<input type="text"/>',
                        '<button class="incr">+</button>',
                        opts.enableReset ? '<button type="button" class="reset">Reset</button>' : ''
                    ].join(''));

            if (!opts.twbs3) {
                return object.children();
            }

            return this.getTwbsView(object);

        },
        /**
         * Takes the base view and returns the bootstrap view
         * @param object
         * @returns {XMLList|*}
         */
        getTwbsView: function (object) {
            object.find('button').addClass('btn btn-default btn-' + this.options.formControlSize)
                .filter(function (i) {
                    if (!$(this).hasClass('reset')) {
                        $(this).wrap('<span class="input-group-btn"></span>');
                    }
                });

            object.find('input').addClass('form-control input-' + this.options.formControlSize);

            object.wrapInner('<div class="input-group"></div>').find('.input-group')
                .after(object.find('.reset').html('<span class="glyphicon glyphicon-repeat"></span>'));

            return object.children();
        }
    };

    $.fn[ pluginName ] = function (options) {
        return this.each(function () {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new Plugin(this, options));
            }
        });
    };

})(jQuery, window, document);
