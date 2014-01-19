//@formatter:off
;(function ($, window, document, undefined) {
//@formatter:on

    // Create the defaults once
    var pluginName = "ui_slider",
        count = 0,
        defaults = {
            classes: '',
            val: 3,
            minVal: 2,
            maxVal: 10,
            step: 1,
            formControlSize: 'sm',
            inputWidth: '10%',
            sliderWidth: '70%'

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
            this.defaults = $.extend({}, opts);

            var $el = $(el);

            $el.addClass([this._name, opts.classes].join(' '));

            $el.find('.slide').noUiSlider({
                range: [opts.minVal, opts.maxVal],
                start: opts.val,
                handles: 1,
                connect: 'lower',
                step: opts.step
            });

            $el.find('input').val(opts.val);

            this.attachEventHandlers(el, opts);

        },
        attachEventHandlers: function(el, opts){
            var self = this,
                $el = $(el),
                $input = $el.find('input'),
                $slider = $el.find('.slide');

            $input.on('change', function(ev){
                var userInput = parseInt($input.val(), 10),
                    newVal;

                if (userInput > opts.maxVal) {
                    newVal = opts.maxVal;
                } else if (userInput < opts.minVal) {
                    newVal = opts.minVal;
                } else {
                    newVal = userInput;
                }

                $slider.val(newVal);
                $el.trigger('slider_changed', newVal);


            });

            $slider.on('change', function(ev){
                $input.val(parseInt($slider.val(), 10)).trigger('change');
            });

            $el.find('.reset').on('click', function(ev){
                $input.val(self.defaults.val).trigger('change');
             //   $slider.val(defaults.val);
            });

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
