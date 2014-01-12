//@formatter:off
;(function ($, window, document, undefined) {
//@formatter:on

    // Create the defaults once
    var pluginName = "ui_colorpicker",
        count = 0,
        defaults = {
            classes: '',
            /*
             * options for spectrum
             * see: http://bgrins.github.io/spectrum/#options
             */
            color: 'black',
            appendTo: 'parent', //!
            showInput: false,
            showInitial: true,
            showAlpha: false,
            disabled: false,
            showPalette: true,
            showPaletteOnly: true,
            showSelectionPalette: true,
            chooseText: "OK",
            className: '',
            palette: [
                ['black', 'white', 'wheat', 'rgb(255, 128, 0);', 'hsv 100 70 50'],
                ['red', 'yellow', 'green', 'blue', 'violet']
            ]
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

            var $el = $(el);

            $el.addClass([this._name, opts.classes].join(' '))
                .html('<input type="text" class="colorpicker" />')
                .find('.colorpicker').spectrum(opts);

            $el.on('.colorpicker change', function(ev, colObj){
                $el.trigger('color_changed', colObj.toString());
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
