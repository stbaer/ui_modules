/*!
 * ui_modules - v0.1.0
 * Build date: 2014-03-01 09:26
 * Included files:
 * assets/spectrum/spectrum.js,modules/colorpicker/colorpicker.js,modules/numspin/numspin.js,assets/nouislider/jquery.nouislider.js,modules/slider/slider.js
 */
// Spectrum Colorpicker v1.2.0
// https://github.com/bgrins/spectrum
// Author: Brian Grinstead
// License: MIT

(function (window, $, undefined) {
    var defaultOpts = {

        // Callbacks
        beforeShow: noop,
        move: noop,
        change: noop,
        show: noop,
        hide: noop,

        // Options
        color: false,
        flat: false,
        showInput: false,
        allowEmpty: false,
        showButtons: true,
        clickoutFiresChange: false,
        showInitial: false,
        showPalette: false,
        showPaletteOnly: false,
        showSelectionPalette: true,
        localStorageKey: false,
        appendTo: "body",
        maxSelectionSize: 7,
        cancelText: "cancel",
        chooseText: "choose",
        preferredFormat: false,
        className: "",
        showAlpha: false,
        theme: "sp-light",
        palette: ['fff', '000'],
        selectionPalette: [],
        disabled: false
    },
    spectrums = [],
    IE = !!/msie/i.exec( window.navigator.userAgent ),
    rgbaSupport = (function() {
        function contains( str, substr ) {
            return !!~('' + str).indexOf(substr);
        }

        var elem = document.createElement('div');
        var style = elem.style;
        style.cssText = 'background-color:rgba(0,0,0,.5)';
        return contains(style.backgroundColor, 'rgba') || contains(style.backgroundColor, 'hsla');
    })(),
    inputTypeColorSupport = (function() {
        var colorInput = $("<input type='color' value='!' />")[0];
        return colorInput.type === "color" && colorInput.value !== "!";
    })(),
    replaceInput = [
        "<div class='sp-replacer'>",
            "<div class='sp-preview'><div class='sp-preview-inner'></div></div>",
            "<div class='sp-dd'>&#9660;</div>",
        "</div>"
    ].join(''),
    markup = (function () {

        // IE does not support gradients with multiple stops, so we need to simulate
        //  that for the rainbow slider with 8 divs that each have a single gradient
        var gradientFix = "";
        if (IE) {
            for (var i = 1; i <= 6; i++) {
                gradientFix += "<div class='sp-" + i + "'></div>";
            }
        }

        return [
            "<div class='sp-container sp-hidden'>",
                "<div class='sp-palette-container'>",
                    "<div class='sp-palette sp-thumb sp-cf'></div>",
                "</div>",
                "<div class='sp-picker-container'>",
                    "<div class='sp-top sp-cf'>",
                        "<div class='sp-fill'></div>",
                        "<div class='sp-top-inner'>",
                            "<div class='sp-color'>",
                                "<div class='sp-sat'>",
                                    "<div class='sp-val'>",
                                        "<div class='sp-dragger'></div>",
                                    "</div>",
                                "</div>",
                            "</div>",
                            "<div class='sp-clear sp-clear-display' title='Clear Color Selection'>",
                            "</div>",
                            "<div class='sp-hue'>",
                                "<div class='sp-slider'></div>",
                                gradientFix,
                            "</div>",
                        "</div>",
                        "<div class='sp-alpha'><div class='sp-alpha-inner'><div class='sp-alpha-handle'></div></div></div>",
                    "</div>",
                    "<div class='sp-input-container sp-cf'>",
                        "<input class='sp-input' type='text' spellcheck='false'  />",
                    "</div>",
                    "<div class='sp-initial sp-thumb sp-cf'></div>",
                    "<div class='sp-button-container sp-cf'>",
                        "<a class='sp-cancel' href='#'></a>",
                        "<button class='sp-choose'></button>",
                    "</div>",
                "</div>",
            "</div>"
        ].join("");
    })();

    function paletteTemplate (p, color, className) {
        var html = [];
        for (var i = 0; i < p.length; i++) {
            var current = p[i];
            if(current) {
                var tiny = tinycolor(current);
                var c = tiny.toHsl().l < 0.5 ? "sp-thumb-el sp-thumb-dark" : "sp-thumb-el sp-thumb-light";
                c += (tinycolor.equals(color, current)) ? " sp-thumb-active" : "";

                var swatchStyle = rgbaSupport ? ("background-color:" + tiny.toRgbString()) : "filter:" + tiny.toFilter();
                html.push('<span title="' + tiny.toRgbString() + '" data-color="' + tiny.toRgbString() + '" class="' + c + '"><span class="sp-thumb-inner" style="' + swatchStyle + ';" /></span>');
            } else {
                var cls = 'sp-clear-display';
                html.push('<span title="No Color Selected" data-color="" style="background-color:transparent;" class="' + cls + '"></span>');
            }
        }
        return "<div class='sp-cf " + className + "'>" + html.join('') + "</div>";
    }

    function hideAll() {
        for (var i = 0; i < spectrums.length; i++) {
            if (spectrums[i]) {
                spectrums[i].hide();
            }
        }
    }

    function instanceOptions(o, callbackContext) {
        var opts = $.extend({}, defaultOpts, o);
        opts.callbacks = {
            'move': bind(opts.move, callbackContext),
            'change': bind(opts.change, callbackContext),
            'show': bind(opts.show, callbackContext),
            'hide': bind(opts.hide, callbackContext),
            'beforeShow': bind(opts.beforeShow, callbackContext)
        };

        return opts;
    }

    function spectrum(element, o) {

        var opts = instanceOptions(o, element),
            flat = opts.flat,
            showSelectionPalette = opts.showSelectionPalette,
            localStorageKey = opts.localStorageKey,
            theme = opts.theme,
            callbacks = opts.callbacks,
            resize = throttle(reflow, 10),
            visible = false,
            dragWidth = 0,
            dragHeight = 0,
            dragHelperHeight = 0,
            slideHeight = 0,
            slideWidth = 0,
            alphaWidth = 0,
            alphaSlideHelperWidth = 0,
            slideHelperHeight = 0,
            currentHue = 0,
            currentSaturation = 0,
            currentValue = 0,
            currentAlpha = 1,
            palette = opts.palette.slice(0),
            paletteArray = $.isArray(palette[0]) ? palette : [palette],
            selectionPalette = opts.selectionPalette.slice(0),
            maxSelectionSize = opts.maxSelectionSize,
            draggingClass = "sp-dragging",
            shiftMovementDirection = null;

        var doc = element.ownerDocument,
            body = doc.body,
            boundElement = $(element),
            disabled = false,
            container = $(markup, doc).addClass(theme),
            dragger = container.find(".sp-color"),
            dragHelper = container.find(".sp-dragger"),
            slider = container.find(".sp-hue"),
            slideHelper = container.find(".sp-slider"),
            alphaSliderInner = container.find(".sp-alpha-inner"),
            alphaSlider = container.find(".sp-alpha"),
            alphaSlideHelper = container.find(".sp-alpha-handle"),
            textInput = container.find(".sp-input"),
            paletteContainer = container.find(".sp-palette"),
            initialColorContainer = container.find(".sp-initial"),
            cancelButton = container.find(".sp-cancel"),
            clearButton = container.find(".sp-clear"),
            chooseButton = container.find(".sp-choose"),
            isInput = boundElement.is("input"),
            isInputTypeColor = isInput && inputTypeColorSupport && boundElement.attr("type") === "color",
            shouldReplace = isInput && !flat,
            replacer = (shouldReplace) ? $(replaceInput).addClass(theme).addClass(opts.className) : $([]),
            offsetElement = (shouldReplace) ? replacer : boundElement,
            previewElement = replacer.find(".sp-preview-inner"),
            initialColor = opts.color || (isInput && boundElement.val()),
            colorOnShow = false,
            preferredFormat = opts.preferredFormat,
            currentPreferredFormat = preferredFormat,
            clickoutFiresChange = !opts.showButtons || opts.clickoutFiresChange,
            isEmpty = !initialColor,
            allowEmpty = opts.allowEmpty && !isInputTypeColor;

        function applyOptions() {

            if (opts.showPaletteOnly) {
                opts.showPalette = true;
            }

            container.toggleClass("sp-flat", flat);
            container.toggleClass("sp-input-disabled", !opts.showInput);
            container.toggleClass("sp-alpha-enabled", opts.showAlpha);
            container.toggleClass("sp-clear-enabled", allowEmpty);
            container.toggleClass("sp-buttons-disabled", !opts.showButtons);
            container.toggleClass("sp-palette-disabled", !opts.showPalette);
            container.toggleClass("sp-palette-only", opts.showPaletteOnly);
            container.toggleClass("sp-initial-disabled", !opts.showInitial);
            container.addClass(opts.className);

            reflow();
        }

        function initialize() {

            if (IE) {
                container.find("*:not(input)").attr("unselectable", "on");
            }

            applyOptions();

            if (shouldReplace) {
                boundElement.after(replacer).hide();
            }

            if (!allowEmpty) {
                clearButton.hide();
            }

            if (flat) {
                boundElement.after(container).hide();
            }
            else {

                var appendTo = opts.appendTo === "parent" ? boundElement.parent() : $(opts.appendTo);
                if (appendTo.length !== 1) {
                    appendTo = $("body");
                }

                appendTo.append(container);
            }

            if (localStorageKey && window.localStorage) {

                // Migrate old palettes over to new format.  May want to remove this eventually.
                try {
                    var oldPalette = window.localStorage[localStorageKey].split(",#");
                    if (oldPalette.length > 1) {
                        delete window.localStorage[localStorageKey];
                        $.each(oldPalette, function(i, c) {
                             addColorToSelectionPalette(c);
                        });
                    }
                }
                catch(e) { }

                try {
                    selectionPalette = window.localStorage[localStorageKey].split(";");
                }
                catch (e) { }
            }

            offsetElement.bind("click.spectrum touchstart.spectrum", function (e) {
                if (!disabled) {
                    toggle();
                }

                e.stopPropagation();

                if (!$(e.target).is("input")) {
                    e.preventDefault();
                }
            });

            if(boundElement.is(":disabled") || (opts.disabled === true)) {
                disable();
            }

            // Prevent clicks from bubbling up to document.  This would cause it to be hidden.
            container.click(stopPropagation);

            // Handle user typed input
            textInput.change(setFromTextInput);
            textInput.bind("paste", function () {
                setTimeout(setFromTextInput, 1);
            });
            textInput.keydown(function (e) { if (e.keyCode == 13) { setFromTextInput(); } });

            cancelButton.text(opts.cancelText);
            cancelButton.bind("click.spectrum", function (e) {
                e.stopPropagation();
                e.preventDefault();
                hide("cancel");
            });


            clearButton.bind("click.spectrum", function (e) {
                e.stopPropagation();
                e.preventDefault();

               isEmpty = true;

                move();
                if(flat) {
                    //for the flat style, this is a change event
                    updateOriginalInput(true);
                }
            });


            chooseButton.text(opts.chooseText);
            chooseButton.bind("click.spectrum", function (e) {
                e.stopPropagation();
                e.preventDefault();

                if (isValid()) {
                    updateOriginalInput(true);
                    hide();
                }
            });

            draggable(alphaSlider, function (dragX, dragY, e) {
                currentAlpha = (dragX / alphaWidth);
                isEmpty = false;
                if (e.shiftKey) {
                    currentAlpha = Math.round(currentAlpha * 10) / 10;
                }

                move();
            });

            draggable(slider, function (dragX, dragY) {
                currentHue = parseFloat(dragY / slideHeight);
                isEmpty = false;
                move();
            }, dragStart, dragStop);

            draggable(dragger, function (dragX, dragY, e) {

                // shift+drag should snap the movement to either the x or y axis.
                if (!e.shiftKey) {
                    shiftMovementDirection = null;
                }
                else if (!shiftMovementDirection) {
                    var oldDragX = currentSaturation * dragWidth;
                    var oldDragY = dragHeight - (currentValue * dragHeight);
                    var furtherFromX = Math.abs(dragX - oldDragX) > Math.abs(dragY - oldDragY);

                    shiftMovementDirection = furtherFromX ? "x" : "y";
                }

                var setSaturation = !shiftMovementDirection || shiftMovementDirection === "x";
                var setValue = !shiftMovementDirection || shiftMovementDirection === "y";

                if (setSaturation) {
                    currentSaturation = parseFloat(dragX / dragWidth);
                }
                if (setValue) {
                    currentValue = parseFloat((dragHeight - dragY) / dragHeight);
                }

                isEmpty = false;

                move();

            }, dragStart, dragStop);

            if (!!initialColor) {
                set(initialColor);

                // In case color was black - update the preview UI and set the format
                // since the set function will not run (default color is black).
                updateUI();
                currentPreferredFormat = preferredFormat || tinycolor(initialColor).format;

                addColorToSelectionPalette(initialColor);
            }
            else {
                updateUI();
            }

            if (flat) {
                show();
            }

            function palletElementClick(e) {
                if (e.data && e.data.ignore) {
                    set($(this).data("color"));
                    move();
                }
                else {
                    set($(this).data("color"));
                    updateOriginalInput(true);
                    move();
                    hide();
                }

                return false;
            }

            var paletteEvent = IE ? "mousedown.spectrum" : "click.spectrum touchstart.spectrum";
            paletteContainer.delegate(".sp-thumb-el", paletteEvent, palletElementClick);
            initialColorContainer.delegate(".sp-thumb-el:nth-child(1)", paletteEvent, { ignore: true }, palletElementClick);
        }

        function addColorToSelectionPalette(color) {
            if (showSelectionPalette) {
                var colorRgb = tinycolor(color).toRgbString();
                if ($.inArray(colorRgb, selectionPalette) === -1) {
                    selectionPalette.push(colorRgb);
                    while(selectionPalette.length > maxSelectionSize) {
                        selectionPalette.shift();
                    }
                }

                if (localStorageKey && window.localStorage) {
                    try {
                        window.localStorage[localStorageKey] = selectionPalette.join(";");
                    }
                    catch(e) { }
                }
            }
        }

        function getUniqueSelectionPalette() {
            var unique = [];
            var p = selectionPalette;
            var paletteLookup = {};
            var rgb;

            if (opts.showPalette) {

                for (var i = 0; i < paletteArray.length; i++) {
                    for (var j = 0; j < paletteArray[i].length; j++) {
                        rgb = tinycolor(paletteArray[i][j]).toRgbString();
                        paletteLookup[rgb] = true;
                    }
                }

                for (i = 0; i < p.length; i++) {
                    rgb = tinycolor(p[i]).toRgbString();

                    if (!paletteLookup.hasOwnProperty(rgb)) {
                        unique.push(p[i]);
                        paletteLookup[rgb] = true;
                    }
                }
            }

            return unique.reverse().slice(0, opts.maxSelectionSize);
        }

        function drawPalette() {

            var currentColor = get();

            var html = $.map(paletteArray, function (palette, i) {
                return paletteTemplate(palette, currentColor, "sp-palette-row sp-palette-row-" + i);
            });

            if (selectionPalette) {
                html.push(paletteTemplate(getUniqueSelectionPalette(), currentColor, "sp-palette-row sp-palette-row-selection"));
            }

            paletteContainer.html(html.join(""));
        }

        function drawInitial() {
            if (opts.showInitial) {
                var initial = colorOnShow;
                var current = get();
                initialColorContainer.html(paletteTemplate([initial, current], current, "sp-palette-row-initial"));
            }
        }

        function dragStart() {
            if (dragHeight <= 0 || dragWidth <= 0 || slideHeight <= 0) {
                reflow();
            }
            container.addClass(draggingClass);
            shiftMovementDirection = null;
        }

        function dragStop() {
            container.removeClass(draggingClass);
        }

        function setFromTextInput() {

            var value = textInput.val();

            if ((value === null || value === "") && allowEmpty) {
                set(null);
            }
            else {
                var tiny = tinycolor(value);
                if (tiny.ok) {
                    set(tiny);
                }
                else {
                    textInput.addClass("sp-validation-error");
                }
            }
        }

        function toggle() {
            if (visible) {
                hide();
            }
            else {
                show();
            }
        }

        function show() {
            var event = $.Event('beforeShow.spectrum');

            if (visible) {
                reflow();
                return;
            }

            boundElement.trigger(event, [ get() ]);

            if (callbacks.beforeShow(get()) === false || event.isDefaultPrevented()) {
                return;
            }

            hideAll();
            visible = true;

            $(doc).bind("click.spectrum", hide);
            $(window).bind("resize.spectrum", resize);
            replacer.addClass("sp-active");
            container.removeClass("sp-hidden");

            if (opts.showPalette) {
                drawPalette();
            }
            reflow();
            updateUI();

            colorOnShow = get();

            drawInitial();
            callbacks.show(colorOnShow);
            boundElement.trigger('show.spectrum', [ colorOnShow ]);
        }

        function hide(e) {

            // Return on right click
            if (e && e.type == "click" && e.button == 2) { return; }

            // Return if hiding is unnecessary
            if (!visible || flat) { return; }
            visible = false;

            $(doc).unbind("click.spectrum", hide);
            $(window).unbind("resize.spectrum", resize);

            replacer.removeClass("sp-active");
            container.addClass("sp-hidden");

            var colorHasChanged = !tinycolor.equals(get(), colorOnShow);

            if (colorHasChanged) {
                if (clickoutFiresChange && e !== "cancel") {
                    updateOriginalInput(true);
                }
                else {
                    revert();
                }
            }

            callbacks.hide(get());
            boundElement.trigger('hide.spectrum', [ get() ]);
        }

        function revert() {
            set(colorOnShow, true);
        }

        function set(color, ignoreFormatChange) {
            if (tinycolor.equals(color, get())) {
                return;
            }

            var newColor;
            if (!color && allowEmpty) {
                isEmpty = true;
            } else {
                isEmpty = false;
                newColor = tinycolor(color);
                var newHsv = newColor.toHsv();

                currentHue = (newHsv.h % 360) / 360;
                currentSaturation = newHsv.s;
                currentValue = newHsv.v;
                currentAlpha = newHsv.a;
            }
            updateUI();

            if (newColor && newColor.ok && !ignoreFormatChange) {
                currentPreferredFormat = preferredFormat || newColor.format;
            }
        }

        function get(opts) {
            opts = opts || { };

            if (allowEmpty && isEmpty) {
                return null;
            }

            return tinycolor.fromRatio({
                h: currentHue,
                s: currentSaturation,
                v: currentValue,
                a: Math.round(currentAlpha * 100) / 100
            }, { format: opts.format || currentPreferredFormat });
        }

        function isValid() {
            return !textInput.hasClass("sp-validation-error");
        }

        function move() {
            updateUI();

            callbacks.move(get());
            boundElement.trigger('move.spectrum', [ get() ]);
        }

        function updateUI() {

            textInput.removeClass("sp-validation-error");

            updateHelperLocations();

            // Update dragger background color (gradients take care of saturation and value).
            var flatColor = tinycolor.fromRatio({ h: currentHue, s: 1, v: 1 });
            dragger.css("background-color", flatColor.toHexString());

            // Get a format that alpha will be included in (hex and names ignore alpha)
            var format = currentPreferredFormat;
            if (currentAlpha < 1) {
                if (format === "hex" || format === "hex3" || format === "hex6" || format === "name") {
                    format = "rgb";
                }
            }

            var realColor = get({ format: format }),
                displayColor = '';

             //reset background info for preview element
            previewElement.removeClass("sp-clear-display");
            previewElement.css('background-color', 'transparent');

            if (!realColor && allowEmpty) {
                // Update the replaced elements background with icon indicating no color selection
                previewElement.addClass("sp-clear-display");
            }
            else {
               var realHex = realColor.toHexString(),
                    realRgb = realColor.toRgbString();

                // Update the replaced elements background color (with actual selected color)
                if (rgbaSupport || realColor.alpha === 1) {
                    previewElement.css("background-color", realRgb);
                }
                else {
                    previewElement.css("background-color", "transparent");
                    previewElement.css("filter", realColor.toFilter());
                }

                if (opts.showAlpha) {
                    var rgb = realColor.toRgb();
                    rgb.a = 0;
                    var realAlpha = tinycolor(rgb).toRgbString();
                    var gradient = "linear-gradient(left, " + realAlpha + ", " + realHex + ")";

                    if (IE) {
                        alphaSliderInner.css("filter", tinycolor(realAlpha).toFilter({ gradientType: 1 }, realHex));
                    }
                    else {
                        alphaSliderInner.css("background", "-webkit-" + gradient);
                        alphaSliderInner.css("background", "-moz-" + gradient);
                        alphaSliderInner.css("background", "-ms-" + gradient);
                        alphaSliderInner.css("background", gradient);
                    }
                }

                displayColor = realColor.toString(format);
            }
            // Update the text entry input as it changes happen
            if (opts.showInput) {
                textInput.val(displayColor);
            }

            if (opts.showPalette) {
                drawPalette();
            }

            drawInitial();
        }

        function updateHelperLocations() {
            var s = currentSaturation;
            var v = currentValue;

            if(allowEmpty && isEmpty) {
                //if selected color is empty, hide the helpers
                alphaSlideHelper.hide();
                slideHelper.hide();
                dragHelper.hide();
            }
            else {
                //make sure helpers are visible
                alphaSlideHelper.show();
                slideHelper.show();
                dragHelper.show();

                // Where to show the little circle in that displays your current selected color
                var dragX = s * dragWidth;
                var dragY = dragHeight - (v * dragHeight);
                dragX = Math.max(
                    -dragHelperHeight,
                    Math.min(dragWidth - dragHelperHeight, dragX - dragHelperHeight)
                );
                dragY = Math.max(
                    -dragHelperHeight,
                    Math.min(dragHeight - dragHelperHeight, dragY - dragHelperHeight)
                );
                dragHelper.css({
                    "top": dragY,
                    "left": dragX
                });

                var alphaX = currentAlpha * alphaWidth;
                alphaSlideHelper.css({
                    "left": alphaX - (alphaSlideHelperWidth / 2)
                });

                // Where to show the bar that displays your current selected hue
                var slideY = (currentHue) * slideHeight;
                slideHelper.css({
                    "top": slideY - slideHelperHeight
                });
            }
        }

        function updateOriginalInput(fireCallback) {
            var color = get(),
                displayColor = '',
                hasChanged = !tinycolor.equals(color, colorOnShow);

            if(color) {
                displayColor = color.toString(currentPreferredFormat);
                // Update the selection palette with the current color
                addColorToSelectionPalette(color);
            }

            if (isInput) {
                boundElement.val(displayColor);
            }

            colorOnShow = color;

            if (fireCallback && hasChanged) {
                callbacks.change(color);
                boundElement.trigger('change', [ color ]);
            }
        }

        function reflow() {
            dragWidth = dragger.width();
            dragHeight = dragger.height();
            dragHelperHeight = dragHelper.height();
            slideWidth = slider.width();
            slideHeight = slider.height();
            slideHelperHeight = slideHelper.height();
            alphaWidth = alphaSlider.width();
            alphaSlideHelperWidth = alphaSlideHelper.width();

            if (!flat) {
                container.css("position", "absolute");
                container.offset(getOffset(container, offsetElement));
            }

            updateHelperLocations();
        }

        function destroy() {
            boundElement.show();
            offsetElement.unbind("click.spectrum touchstart.spectrum");
            container.remove();
            replacer.remove();
            spectrums[spect.id] = null;
        }

        function option(optionName, optionValue) {
            if (optionName === undefined) {
                return $.extend({}, opts);
            }
            if (optionValue === undefined) {
                return opts[optionName];
            }

            opts[optionName] = optionValue;
            applyOptions();
        }

        function enable() {
            disabled = false;
            boundElement.attr("disabled", false);
            offsetElement.removeClass("sp-disabled");
        }

        function disable() {
            hide();
            disabled = true;
            boundElement.attr("disabled", true);
            offsetElement.addClass("sp-disabled");
        }

        initialize();

        var spect = {
            show: show,
            hide: hide,
            toggle: toggle,
            reflow: reflow,
            option: option,
            enable: enable,
            disable: disable,
            set: function (c) {
                set(c);
                updateOriginalInput();
            },
            get: get,
            destroy: destroy,
            container: container
        };

        spect.id = spectrums.push(spect) - 1;

        return spect;
    }

    /**
    * checkOffset - get the offset below/above and left/right element depending on screen position
    * Thanks https://github.com/jquery/jquery-ui/blob/master/ui/jquery.ui.datepicker.js
    */
    function getOffset(picker, input) {
        var extraY = 0;
        var dpWidth = picker.outerWidth();
        var dpHeight = picker.outerHeight();
        var inputHeight = input.outerHeight();
        var doc = picker[0].ownerDocument;
        var docElem = doc.documentElement;
        var viewWidth = docElem.clientWidth + $(doc).scrollLeft();
        var viewHeight = docElem.clientHeight + $(doc).scrollTop();
        var offset = input.offset();
        offset.top += inputHeight;

        offset.left -=
            Math.min(offset.left, (offset.left + dpWidth > viewWidth && viewWidth > dpWidth) ?
            Math.abs(offset.left + dpWidth - viewWidth) : 0);

        offset.top -=
            Math.min(offset.top, ((offset.top + dpHeight > viewHeight && viewHeight > dpHeight) ?
            Math.abs(dpHeight + inputHeight - extraY) : extraY));

        return offset;
    }

    /**
    * noop - do nothing
    */
    function noop() {

    }

    /**
    * stopPropagation - makes the code only doing this a little easier to read in line
    */
    function stopPropagation(e) {
        e.stopPropagation();
    }

    /**
    * Create a function bound to a given object
    * Thanks to underscore.js
    */
    function bind(func, obj) {
        var slice = Array.prototype.slice;
        var args = slice.call(arguments, 2);
        return function () {
            return func.apply(obj, args.concat(slice.call(arguments)));
        };
    }

    /**
    * Lightweight drag helper.  Handles containment within the element, so that
    * when dragging, the x is within [0,element.width] and y is within [0,element.height]
    */
    function draggable(element, onmove, onstart, onstop) {
        onmove = onmove || function () { };
        onstart = onstart || function () { };
        onstop = onstop || function () { };
        var doc = element.ownerDocument || document;
        var dragging = false;
        var offset = {};
        var maxHeight = 0;
        var maxWidth = 0;
        var hasTouch = ('ontouchstart' in window);

        var duringDragEvents = {};
        duringDragEvents["selectstart"] = prevent;
        duringDragEvents["dragstart"] = prevent;
        duringDragEvents["touchmove mousemove"] = move;
        duringDragEvents["touchend mouseup"] = stop;

        function prevent(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.returnValue = false;
        }

        function move(e) {
            if (dragging) {
                // Mouseup happened outside of window
                if (IE && document.documentMode < 9 && !e.button) {
                    return stop();
                }

                var touches = e.originalEvent.touches;
                var pageX = touches ? touches[0].pageX : e.pageX;
                var pageY = touches ? touches[0].pageY : e.pageY;

                var dragX = Math.max(0, Math.min(pageX - offset.left, maxWidth));
                var dragY = Math.max(0, Math.min(pageY - offset.top, maxHeight));

                if (hasTouch) {
                    // Stop scrolling in iOS
                    prevent(e);
                }

                onmove.apply(element, [dragX, dragY, e]);
            }
        }
        function start(e) {
            var rightclick = (e.which) ? (e.which == 3) : (e.button == 2);
            var touches = e.originalEvent.touches;

            if (!rightclick && !dragging) {
                if (onstart.apply(element, arguments) !== false) {
                    dragging = true;
                    maxHeight = $(element).height();
                    maxWidth = $(element).width();
                    offset = $(element).offset();

                    $(doc).bind(duringDragEvents);
                    $(doc.body).addClass("sp-dragging");

                    if (!hasTouch) {
                        move(e);
                    }

                    prevent(e);
                }
            }
        }
        function stop() {
            if (dragging) {
                $(doc).unbind(duringDragEvents);
                $(doc.body).removeClass("sp-dragging");
                onstop.apply(element, arguments);
            }
            dragging = false;
        }

        $(element).bind("touchstart mousedown", start);
    }

    function throttle(func, wait, debounce) {
        var timeout;
        return function () {
            var context = this, args = arguments;
            var throttler = function () {
                timeout = null;
                func.apply(context, args);
            };
            if (debounce) clearTimeout(timeout);
            if (debounce || !timeout) timeout = setTimeout(throttler, wait);
        };
    }


    function log(){/* jshint -W021 */if(window.console){if(Function.prototype.bind)log=Function.prototype.bind.call(console.log,console);else log=function(){Function.prototype.apply.call(console.log,console,arguments);};log.apply(this,arguments);}}

    /**
    * Define a jQuery plugin
    */
    var dataID = "spectrum.id";
    $.fn.spectrum = function (opts, extra) {

        if (typeof opts == "string") {

            var returnValue = this;
            var args = Array.prototype.slice.call( arguments, 1 );

            this.each(function () {
                var spect = spectrums[$(this).data(dataID)];
                if (spect) {

                    var method = spect[opts];
                    if (!method) {
                        throw new Error( "Spectrum: no such method: '" + opts + "'" );
                    }

                    if (opts == "get") {
                        returnValue = spect.get();
                    }
                    else if (opts == "container") {
                        returnValue = spect.container;
                    }
                    else if (opts == "option") {
                        returnValue = spect.option.apply(spect, args);
                    }
                    else if (opts == "destroy") {
                        spect.destroy();
                        $(this).removeData(dataID);
                    }
                    else {
                        method.apply(spect, args);
                    }
                }
            });

            return returnValue;
        }

        // Initializing a new instance of spectrum
        return this.spectrum("destroy").each(function () {
            var spect = spectrum(this, opts);
            $(this).data(dataID, spect.id);
        });
    };

    $.fn.spectrum.load = true;
    $.fn.spectrum.loadOpts = {};
    $.fn.spectrum.draggable = draggable;
    $.fn.spectrum.defaults = defaultOpts;

    $.spectrum = { };
    $.spectrum.localization = { };
    $.spectrum.palettes = { };

    $.fn.spectrum.processNativeColorInputs = function () {
        if (!inputTypeColorSupport) {
            $("input[type=color]").spectrum({
                preferredFormat: "hex6"
            });
        }
    };

    // TinyColor v0.9.16
    // https://github.com/bgrins/TinyColor
    // 2013-08-10, Brian Grinstead, MIT License

    (function() {

    var trimLeft = /^[\s,#]+/,
        trimRight = /\s+$/,
        tinyCounter = 0,
        math = Math,
        mathRound = math.round,
        mathMin = math.min,
        mathMax = math.max,
        mathRandom = math.random;

    function tinycolor (color, opts) {

        color = (color) ? color : '';
        opts = opts || { };

        // If input is already a tinycolor, return itself
        if (typeof color == "object" && color.hasOwnProperty("_tc_id")) {
           return color;
        }

        var rgb = inputToRGB(color);
        var r = rgb.r,
            g = rgb.g,
            b = rgb.b,
            a = rgb.a,
            roundA = mathRound(100*a) / 100,
            format = opts.format || rgb.format;

        // Don't let the range of [0,255] come back in [0,1].
        // Potentially lose a little bit of precision here, but will fix issues where
        // .5 gets interpreted as half of the total, instead of half of 1
        // If it was supposed to be 128, this was already taken care of by `inputToRgb`
        if (r < 1) { r = mathRound(r); }
        if (g < 1) { g = mathRound(g); }
        if (b < 1) { b = mathRound(b); }

        return {
            ok: rgb.ok,
            format: format,
            _tc_id: tinyCounter++,
            alpha: a,
            getAlpha: function() {
                return a;
            },
            setAlpha: function(value) {
                a = boundAlpha(value);
                roundA = mathRound(100*a) / 100;
            },
            toHsv: function() {
                var hsv = rgbToHsv(r, g, b);
                return { h: hsv.h * 360, s: hsv.s, v: hsv.v, a: a };
            },
            toHsvString: function() {
                var hsv = rgbToHsv(r, g, b);
                var h = mathRound(hsv.h * 360), s = mathRound(hsv.s * 100), v = mathRound(hsv.v * 100);
                return (a == 1) ?
                  "hsv("  + h + ", " + s + "%, " + v + "%)" :
                  "hsva(" + h + ", " + s + "%, " + v + "%, "+ roundA + ")";
            },
            toHsl: function() {
                var hsl = rgbToHsl(r, g, b);
                return { h: hsl.h * 360, s: hsl.s, l: hsl.l, a: a };
            },
            toHslString: function() {
                var hsl = rgbToHsl(r, g, b);
                var h = mathRound(hsl.h * 360), s = mathRound(hsl.s * 100), l = mathRound(hsl.l * 100);
                return (a == 1) ?
                  "hsl("  + h + ", " + s + "%, " + l + "%)" :
                  "hsla(" + h + ", " + s + "%, " + l + "%, "+ roundA + ")";
            },
            toHex: function(allow3Char) {
                return rgbToHex(r, g, b, allow3Char);
            },
            toHexString: function(allow3Char) {
                return '#' + rgbToHex(r, g, b, allow3Char);
            },
            toRgb: function() {
                return { r: mathRound(r), g: mathRound(g), b: mathRound(b), a: a };
            },
            toRgbString: function() {
                return (a == 1) ?
                  "rgb("  + mathRound(r) + ", " + mathRound(g) + ", " + mathRound(b) + ")" :
                  "rgba(" + mathRound(r) + ", " + mathRound(g) + ", " + mathRound(b) + ", " + roundA + ")";
            },
            toPercentageRgb: function() {
                return { r: mathRound(bound01(r, 255) * 100) + "%", g: mathRound(bound01(g, 255) * 100) + "%", b: mathRound(bound01(b, 255) * 100) + "%", a: a };
            },
            toPercentageRgbString: function() {
                return (a == 1) ?
                  "rgb("  + mathRound(bound01(r, 255) * 100) + "%, " + mathRound(bound01(g, 255) * 100) + "%, " + mathRound(bound01(b, 255) * 100) + "%)" :
                  "rgba(" + mathRound(bound01(r, 255) * 100) + "%, " + mathRound(bound01(g, 255) * 100) + "%, " + mathRound(bound01(b, 255) * 100) + "%, " + roundA + ")";
            },
            toName: function() {
                if (a === 0) {
                    return "transparent";
                }

                return hexNames[rgbToHex(r, g, b, true)] || false;
            },
            toFilter: function(secondColor) {
                var hex = rgbToHex(r, g, b);
                var secondHex = hex;
                var alphaHex = Math.round(parseFloat(a) * 255).toString(16);
                var secondAlphaHex = alphaHex;
                var gradientType = opts && opts.gradientType ? "GradientType = 1, " : "";

                if (secondColor) {
                    var s = tinycolor(secondColor);
                    secondHex = s.toHex();
                    secondAlphaHex = Math.round(parseFloat(s.alpha) * 255).toString(16);
                }

                return "progid:DXImageTransform.Microsoft.gradient("+gradientType+"startColorstr=#" + pad2(alphaHex) + hex + ",endColorstr=#" + pad2(secondAlphaHex) + secondHex + ")";
            },
            toString: function(format) {
                var formatSet = !!format;
                format = format || this.format;

                var formattedString = false;
                var hasAlphaAndFormatNotSet = !formatSet && a < 1 && a > 0;
                var formatWithAlpha = hasAlphaAndFormatNotSet && (format === "hex" || format === "hex6" || format === "hex3" || format === "name");

                if (format === "rgb") {
                    formattedString = this.toRgbString();
                }
                if (format === "prgb") {
                    formattedString = this.toPercentageRgbString();
                }
                if (format === "hex" || format === "hex6") {
                    formattedString = this.toHexString();
                }
                if (format === "hex3") {
                    formattedString = this.toHexString(true);
                }
                if (format === "name") {
                    formattedString = this.toName();
                }
                if (format === "hsl") {
                    formattedString = this.toHslString();
                }
                if (format === "hsv") {
                    formattedString = this.toHsvString();
                }

                if (formatWithAlpha) {
                    return this.toRgbString();
                }

                return formattedString || this.toHexString();
            }
        };
    }

    // If input is an object, force 1 into "1.0" to handle ratios properly
    // String input requires "1.0" as input, so 1 will be treated as 1
    tinycolor.fromRatio = function(color, opts) {
        if (typeof color == "object") {
            var newColor = {};
            for (var i in color) {
                if (color.hasOwnProperty(i)) {
                    if (i === "a") {
                        newColor[i] = color[i];
                    }
                    else {
                        newColor[i] = convertToPercentage(color[i]);
                    }
                }
            }
            color = newColor;
        }

        return tinycolor(color, opts);
    };

    // Given a string or object, convert that input to RGB
    // Possible string inputs:
    //
    //     "red"
    //     "#f00" or "f00"
    //     "#ff0000" or "ff0000"
    //     "rgb 255 0 0" or "rgb (255, 0, 0)"
    //     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
    //     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
    //     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
    //     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
    //     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
    //     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
    //
    function inputToRGB(color) {

        var rgb = { r: 0, g: 0, b: 0 };
        var a = 1;
        var ok = false;
        var format = false;

        if (typeof color == "string") {
            color = stringInputToObject(color);
        }

        if (typeof color == "object") {
            if (color.hasOwnProperty("r") && color.hasOwnProperty("g") && color.hasOwnProperty("b")) {
                rgb = rgbToRgb(color.r, color.g, color.b);
                ok = true;
                format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
            }
            else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("v")) {
                color.s = convertToPercentage(color.s);
                color.v = convertToPercentage(color.v);
                rgb = hsvToRgb(color.h, color.s, color.v);
                ok = true;
                format = "hsv";
            }
            else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("l")) {
                color.s = convertToPercentage(color.s);
                color.l = convertToPercentage(color.l);
                rgb = hslToRgb(color.h, color.s, color.l);
                ok = true;
                format = "hsl";
            }

            if (color.hasOwnProperty("a")) {
                a = color.a;
            }
        }

        a = boundAlpha(a);

        return {
            ok: ok,
            format: color.format || format,
            r: mathMin(255, mathMax(rgb.r, 0)),
            g: mathMin(255, mathMax(rgb.g, 0)),
            b: mathMin(255, mathMax(rgb.b, 0)),
            a: a
        };
    }


    // Conversion Functions
    // --------------------

    // `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
    // <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

    // `rgbToRgb`
    // Handle bounds / percentage checking to conform to CSS color spec
    // <http://www.w3.org/TR/css3-color/>
    // *Assumes:* r, g, b in [0, 255] or [0, 1]
    // *Returns:* { r, g, b } in [0, 255]
    function rgbToRgb(r, g, b){
        return {
            r: bound01(r, 255) * 255,
            g: bound01(g, 255) * 255,
            b: bound01(b, 255) * 255
        };
    }

    // `rgbToHsl`
    // Converts an RGB color value to HSL.
    // *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
    // *Returns:* { h, s, l } in [0,1]
    function rgbToHsl(r, g, b) {

        r = bound01(r, 255);
        g = bound01(g, 255);
        b = bound01(b, 255);

        var max = mathMax(r, g, b), min = mathMin(r, g, b);
        var h, s, l = (max + min) / 2;

        if(max == min) {
            h = s = 0; // achromatic
        }
        else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h /= 6;
        }

        return { h: h, s: s, l: l };
    }

    // `hslToRgb`
    // Converts an HSL color value to RGB.
    // *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
    // *Returns:* { r, g, b } in the set [0, 255]
    function hslToRgb(h, s, l) {
        var r, g, b;

        h = bound01(h, 360);
        s = bound01(s, 100);
        l = bound01(l, 100);

        function hue2rgb(p, q, t) {
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        if(s === 0) {
            r = g = b = l; // achromatic
        }
        else {
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    // `rgbToHsv`
    // Converts an RGB color value to HSV
    // *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
    // *Returns:* { h, s, v } in [0,1]
    function rgbToHsv(r, g, b) {

        r = bound01(r, 255);
        g = bound01(g, 255);
        b = bound01(b, 255);

        var max = mathMax(r, g, b), min = mathMin(r, g, b);
        var h, s, v = max;

        var d = max - min;
        s = max === 0 ? 0 : d / max;

        if(max == min) {
            h = 0; // achromatic
        }
        else {
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h, s: s, v: v };
    }

    // `hsvToRgb`
    // Converts an HSV color value to RGB.
    // *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
    // *Returns:* { r, g, b } in the set [0, 255]
     function hsvToRgb(h, s, v) {

        h = bound01(h, 360) * 6;
        s = bound01(s, 100);
        v = bound01(v, 100);

        var i = math.floor(h),
            f = h - i,
            p = v * (1 - s),
            q = v * (1 - f * s),
            t = v * (1 - (1 - f) * s),
            mod = i % 6,
            r = [v, q, p, p, t, v][mod],
            g = [t, v, v, q, p, p][mod],
            b = [p, p, t, v, v, q][mod];

        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    // `rgbToHex`
    // Converts an RGB color to hex
    // Assumes r, g, and b are contained in the set [0, 255]
    // Returns a 3 or 6 character hex
    function rgbToHex(r, g, b, allow3Char) {

        var hex = [
            pad2(mathRound(r).toString(16)),
            pad2(mathRound(g).toString(16)),
            pad2(mathRound(b).toString(16))
        ];

        // Return a 3 character hex if possible
        if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
            return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
        }

        return hex.join("");
    }

    // `equals`
    // Can be called with any tinycolor input
    tinycolor.equals = function (color1, color2) {
        if (!color1 || !color2) { return false; }
        return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
    };
    tinycolor.random = function() {
        return tinycolor.fromRatio({
            r: mathRandom(),
            g: mathRandom(),
            b: mathRandom()
        });
    };


    // Modification Functions
    // ----------------------
    // Thanks to less.js for some of the basics here
    // <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>

    tinycolor.desaturate = function (color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.s -= amount / 100;
        hsl.s = clamp01(hsl.s);
        return tinycolor(hsl);
    };
    tinycolor.saturate = function (color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.s += amount / 100;
        hsl.s = clamp01(hsl.s);
        return tinycolor(hsl);
    };
    tinycolor.greyscale = function(color) {
        return tinycolor.desaturate(color, 100);
    };
    tinycolor.lighten = function(color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.l += amount / 100;
        hsl.l = clamp01(hsl.l);
        return tinycolor(hsl);
    };
    tinycolor.darken = function (color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.l -= amount / 100;
        hsl.l = clamp01(hsl.l);
        return tinycolor(hsl);
    };
    tinycolor.complement = function(color) {
        var hsl = tinycolor(color).toHsl();
        hsl.h = (hsl.h + 180) % 360;
        return tinycolor(hsl);
    };


    // Combination Functions
    // ---------------------
    // Thanks to jQuery xColor for some of the ideas behind these
    // <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

    tinycolor.triad = function(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 120) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 240) % 360, s: hsl.s, l: hsl.l })
        ];
    };
    tinycolor.tetrad = function(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 90) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 180) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 270) % 360, s: hsl.s, l: hsl.l })
        ];
    };
    tinycolor.splitcomplement = function(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 72) % 360, s: hsl.s, l: hsl.l}),
            tinycolor({ h: (h + 216) % 360, s: hsl.s, l: hsl.l})
        ];
    };
    tinycolor.analogous = function(color, results, slices) {
        results = results || 6;
        slices = slices || 30;

        var hsl = tinycolor(color).toHsl();
        var part = 360 / slices;
        var ret = [tinycolor(color)];

        for (hsl.h = ((hsl.h - (part * results >> 1)) + 720) % 360; --results; ) {
            hsl.h = (hsl.h + part) % 360;
            ret.push(tinycolor(hsl));
        }
        return ret;
    };
    tinycolor.monochromatic = function(color, results) {
        results = results || 6;
        var hsv = tinycolor(color).toHsv();
        var h = hsv.h, s = hsv.s, v = hsv.v;
        var ret = [];
        var modification = 1 / results;

        while (results--) {
            ret.push(tinycolor({ h: h, s: s, v: v}));
            v = (v + modification) % 1;
        }

        return ret;
    };


    // Readability Functions
    // ---------------------
    // <http://www.w3.org/TR/AERT#color-contrast>

    // `readability`
    // Analyze the 2 colors and returns an object with the following properties:
    //    `brightness`: difference in brightness between the two colors
    //    `color`: difference in color/hue between the two colors
    tinycolor.readability = function(color1, color2) {
        var a = tinycolor(color1).toRgb();
        var b = tinycolor(color2).toRgb();
        var brightnessA = (a.r * 299 + a.g * 587 + a.b * 114) / 1000;
        var brightnessB = (b.r * 299 + b.g * 587 + b.b * 114) / 1000;
        var colorDiff = (
            Math.max(a.r, b.r) - Math.min(a.r, b.r) +
            Math.max(a.g, b.g) - Math.min(a.g, b.g) +
            Math.max(a.b, b.b) - Math.min(a.b, b.b)
        );

        return {
            brightness: Math.abs(brightnessA - brightnessB),
            color: colorDiff
        };
    };

    // `readable`
    // http://www.w3.org/TR/AERT#color-contrast
    // Ensure that foreground and background color combinations provide sufficient contrast.
    // *Example*
    //    tinycolor.readable("#000", "#111") => false
    tinycolor.readable = function(color1, color2) {
        var readability = tinycolor.readability(color1, color2);
        return readability.brightness > 125 && readability.color > 500;
    };

    // `mostReadable`
    // Given a base color and a list of possible foreground or background
    // colors for that base, returns the most readable color.
    // *Example*
    //    tinycolor.mostReadable("#123", ["#fff", "#000"]) => "#000"
    tinycolor.mostReadable = function(baseColor, colorList) {
        var bestColor = null;
        var bestScore = 0;
        var bestIsReadable = false;
        for (var i=0; i < colorList.length; i++) {

            // We normalize both around the "acceptable" breaking point,
            // but rank brightness constrast higher than hue.

            var readability = tinycolor.readability(baseColor, colorList[i]);
            var readable = readability.brightness > 125 && readability.color > 500;
            var score = 3 * (readability.brightness / 125) + (readability.color / 500);

            if ((readable && ! bestIsReadable) ||
                (readable && bestIsReadable && score > bestScore) ||
                ((! readable) && (! bestIsReadable) && score > bestScore)) {
                bestIsReadable = readable;
                bestScore = score;
                bestColor = tinycolor(colorList[i]);
            }
        }
        return bestColor;
    };


    // Big List of Colors
    // ------------------
    // <http://www.w3.org/TR/css3-color/#svg-color>
    var names = tinycolor.names = {
        aliceblue: "f0f8ff",
        antiquewhite: "faebd7",
        aqua: "0ff",
        aquamarine: "7fffd4",
        azure: "f0ffff",
        beige: "f5f5dc",
        bisque: "ffe4c4",
        black: "000",
        blanchedalmond: "ffebcd",
        blue: "00f",
        blueviolet: "8a2be2",
        brown: "a52a2a",
        burlywood: "deb887",
        burntsienna: "ea7e5d",
        cadetblue: "5f9ea0",
        chartreuse: "7fff00",
        chocolate: "d2691e",
        coral: "ff7f50",
        cornflowerblue: "6495ed",
        cornsilk: "fff8dc",
        crimson: "dc143c",
        cyan: "0ff",
        darkblue: "00008b",
        darkcyan: "008b8b",
        darkgoldenrod: "b8860b",
        darkgray: "a9a9a9",
        darkgreen: "006400",
        darkgrey: "a9a9a9",
        darkkhaki: "bdb76b",
        darkmagenta: "8b008b",
        darkolivegreen: "556b2f",
        darkorange: "ff8c00",
        darkorchid: "9932cc",
        darkred: "8b0000",
        darksalmon: "e9967a",
        darkseagreen: "8fbc8f",
        darkslateblue: "483d8b",
        darkslategray: "2f4f4f",
        darkslategrey: "2f4f4f",
        darkturquoise: "00ced1",
        darkviolet: "9400d3",
        deeppink: "ff1493",
        deepskyblue: "00bfff",
        dimgray: "696969",
        dimgrey: "696969",
        dodgerblue: "1e90ff",
        firebrick: "b22222",
        floralwhite: "fffaf0",
        forestgreen: "228b22",
        fuchsia: "f0f",
        gainsboro: "dcdcdc",
        ghostwhite: "f8f8ff",
        gold: "ffd700",
        goldenrod: "daa520",
        gray: "808080",
        green: "008000",
        greenyellow: "adff2f",
        grey: "808080",
        honeydew: "f0fff0",
        hotpink: "ff69b4",
        indianred: "cd5c5c",
        indigo: "4b0082",
        ivory: "fffff0",
        khaki: "f0e68c",
        lavender: "e6e6fa",
        lavenderblush: "fff0f5",
        lawngreen: "7cfc00",
        lemonchiffon: "fffacd",
        lightblue: "add8e6",
        lightcoral: "f08080",
        lightcyan: "e0ffff",
        lightgoldenrodyellow: "fafad2",
        lightgray: "d3d3d3",
        lightgreen: "90ee90",
        lightgrey: "d3d3d3",
        lightpink: "ffb6c1",
        lightsalmon: "ffa07a",
        lightseagreen: "20b2aa",
        lightskyblue: "87cefa",
        lightslategray: "789",
        lightslategrey: "789",
        lightsteelblue: "b0c4de",
        lightyellow: "ffffe0",
        lime: "0f0",
        limegreen: "32cd32",
        linen: "faf0e6",
        magenta: "f0f",
        maroon: "800000",
        mediumaquamarine: "66cdaa",
        mediumblue: "0000cd",
        mediumorchid: "ba55d3",
        mediumpurple: "9370db",
        mediumseagreen: "3cb371",
        mediumslateblue: "7b68ee",
        mediumspringgreen: "00fa9a",
        mediumturquoise: "48d1cc",
        mediumvioletred: "c71585",
        midnightblue: "191970",
        mintcream: "f5fffa",
        mistyrose: "ffe4e1",
        moccasin: "ffe4b5",
        navajowhite: "ffdead",
        navy: "000080",
        oldlace: "fdf5e6",
        olive: "808000",
        olivedrab: "6b8e23",
        orange: "ffa500",
        orangered: "ff4500",
        orchid: "da70d6",
        palegoldenrod: "eee8aa",
        palegreen: "98fb98",
        paleturquoise: "afeeee",
        palevioletred: "db7093",
        papayawhip: "ffefd5",
        peachpuff: "ffdab9",
        peru: "cd853f",
        pink: "ffc0cb",
        plum: "dda0dd",
        powderblue: "b0e0e6",
        purple: "800080",
        red: "f00",
        rosybrown: "bc8f8f",
        royalblue: "4169e1",
        saddlebrown: "8b4513",
        salmon: "fa8072",
        sandybrown: "f4a460",
        seagreen: "2e8b57",
        seashell: "fff5ee",
        sienna: "a0522d",
        silver: "c0c0c0",
        skyblue: "87ceeb",
        slateblue: "6a5acd",
        slategray: "708090",
        slategrey: "708090",
        snow: "fffafa",
        springgreen: "00ff7f",
        steelblue: "4682b4",
        tan: "d2b48c",
        teal: "008080",
        thistle: "d8bfd8",
        tomato: "ff6347",
        turquoise: "40e0d0",
        violet: "ee82ee",
        wheat: "f5deb3",
        white: "fff",
        whitesmoke: "f5f5f5",
        yellow: "ff0",
        yellowgreen: "9acd32"
    };

    // Make it easy to access colors via `hexNames[hex]`
    var hexNames = tinycolor.hexNames = flip(names);


    // Utilities
    // ---------

    // `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
    function flip(o) {
        var flipped = { };
        for (var i in o) {
            if (o.hasOwnProperty(i)) {
                flipped[o[i]] = i;
            }
        }
        return flipped;
    }

    // Return a valid alpha value [0,1] with all invalid values being set to 1
    function boundAlpha(a) {
        a = parseFloat(a);

        if (isNaN(a) || a < 0 || a > 1) {
            a = 1;
        }

        return a;
    }

    // Take input from [0, n] and return it as [0, 1]
    function bound01(n, max) {
        if (isOnePointZero(n)) { n = "100%"; }

        var processPercent = isPercentage(n);
        n = mathMin(max, mathMax(0, parseFloat(n)));

        // Automatically convert percentage into number
        if (processPercent) {
            n = parseInt(n * max, 10) / 100;
        }

        // Handle floating point rounding errors
        if ((math.abs(n - max) < 0.000001)) {
            return 1;
        }

        // Convert into [0, 1] range if it isn't already
        return (n % max) / parseFloat(max);
    }

    // Force a number between 0 and 1
    function clamp01(val) {
        return mathMin(1, mathMax(0, val));
    }

    // Parse an integer into hex
    function parseHex(val) {
        return parseInt(val, 16);
    }

    // Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
    // <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
    function isOnePointZero(n) {
        return typeof n == "string" && n.indexOf('.') != -1 && parseFloat(n) === 1;
    }

    // Check to see if string passed in is a percentage
    function isPercentage(n) {
        return typeof n === "string" && n.indexOf('%') != -1;
    }

    // Force a hex value to have 2 characters
    function pad2(c) {
        return c.length == 1 ? '0' + c : '' + c;
    }

    // Replace a decimal with it's percentage value
    function convertToPercentage(n) {
        if (n <= 1) {
            n = (n * 100) + "%";
        }

        return n;
    }

    var matchers = (function() {

        // <http://www.w3.org/TR/css3-values/#integers>
        var CSS_INTEGER = "[-\\+]?\\d+%?";

        // <http://www.w3.org/TR/css3-values/#number-value>
        var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

        // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
        var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

        // Actual matching.
        // Parentheses and commas are optional, but not required.
        // Whitespace can take the place of commas or opening paren
        var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
        var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

        return {
            rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
            rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
            hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
            hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
            hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
            hex3: /^([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex6: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
        };
    })();

    // `stringInputToObject`
    // Permissive string parsing.  Take in a number of formats, and output an object
    // based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
    function stringInputToObject(color) {

        color = color.replace(trimLeft,'').replace(trimRight, '').toLowerCase();
        var named = false;
        if (names[color]) {
            color = names[color];
            named = true;
        }
        else if (color == 'transparent') {
            return { r: 0, g: 0, b: 0, a: 0, format: "name" };
        }

        // Try to match string input using regular expressions.
        // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
        // Just return an object and let the conversion functions handle that.
        // This way the result will be the same whether the tinycolor is initialized with string or object.
        var match;
        if ((match = matchers.rgb.exec(color))) {
            return { r: match[1], g: match[2], b: match[3] };
        }
        if ((match = matchers.rgba.exec(color))) {
            return { r: match[1], g: match[2], b: match[3], a: match[4] };
        }
        if ((match = matchers.hsl.exec(color))) {
            return { h: match[1], s: match[2], l: match[3] };
        }
        if ((match = matchers.hsla.exec(color))) {
            return { h: match[1], s: match[2], l: match[3], a: match[4] };
        }
        if ((match = matchers.hsv.exec(color))) {
            return { h: match[1], s: match[2], v: match[3] };
        }
        if ((match = matchers.hex6.exec(color))) {
            return {
                r: parseHex(match[1]),
                g: parseHex(match[2]),
                b: parseHex(match[3]),
                format: named ? "name" : "hex"
            };
        }
        if ((match = matchers.hex3.exec(color))) {
            return {
                r: parseHex(match[1] + '' + match[1]),
                g: parseHex(match[2] + '' + match[2]),
                b: parseHex(match[3] + '' + match[3]),
                format: named ? "name" : "hex"
            };
        }

        return false;
    }

    // Expose tinycolor to window, does not need to run in non-browser context.
    window.tinycolor = tinycolor;

    })();


    $(function () {
        if ($.fn.spectrum.load) {
            $.fn.spectrum.processNativeColorInputs();
        }
    });

})(window, jQuery);

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
                ['black', 'white', 'rgb(255, 128, 0);', 'red', 'yellow', 'blue'],
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
            this.defaults = $.extend({}, opts);

            $(el).addClass([this._name, opts.classes, (opts.twbs3 ? 'twbs' : '')].join(' '))
                .append(this.getView())
                .find('input').val(opts.val);

            this.attachEventHandlers(el, opts);

        },
        attachEventHandlers: function (el, opts) {

            var $el = $(el),
                self = this,
                $input = $(el).find('input');

            $el.find('.decr').on('click', function () {
                self.validateAndSet(parseInt($input.val(), 10) - self.defaults.step);
            });
            $el.find('.incr').on('click', function () {
                self.validateAndSet(parseInt($input.val(), 10) + self.defaults.step);
            });
            $el.find('input').on('change', function () {
                self.validateAndSet(parseInt($input.val(), 10) + self.defaults.step);
            });
            $el.find('.reset').on('click', function () {
                self.validateAndSet(self.defaults.val);
            });
            $el.on('numchanged', function (ev, el, val) {
                $input.val(val);
                opts.val = val;
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
                        '<button type="button" class="incr">+</button>',
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

/*! $.noUiSlider
 @version 5.0.0
 @author Leon Gersen https://twitter.com/LeonGersen
 @license WTFPL http://www.wtfpl.net/about/
 @documentation http://refreshless.com/nouislider/
*/

// ==ClosureCompiler==
// @externs_url http://refreshless.com/externs/jquery-1.8.js
// @compilation_level ADVANCED_OPTIMIZATIONS
// @warning_level VERBOSE
// ==/ClosureCompiler==

/*jshint laxcomma: true */
/*jshint smarttabs: true */
/*jshint sub: true */

/*jslint browser: true */
/*jslint continue: true */
/*jslint plusplus: true */
/*jslint white: true */
/*jslint sub: true */

(function( $ ){

	'use strict';

	if ( $['zepto'] && !$.fn.removeData ) {
		throw new ReferenceError('Zepto is loaded without the data module.');
	}

	$.fn['noUiSlider'] = function( options, rebuild ){

		var
		// Cache the document and body selectors;
		 doc = $(document)
		,body = $('body')

		// Namespace for binding and unbinding slider events;
		,namespace = '.nui'

		// Copy of the current value function;
		,$VAL = $.fn.val

		// Re-usable list of classes;
		,clsList = [
		/*  0 */  'noUi-base'
		/*  1 */ ,'noUi-origin'
		/*  2 */ ,'noUi-handle'
		/*  3 */ ,'noUi-input'
		/*  4 */ ,'noUi-active'
		/*  5 */ ,'noUi-state-tap'
		/*  6 */ ,'noUi-target'
		/*  7 */ ,'-lower'
		/*  8 */ ,'-upper'
		/*  9 */ ,'noUi-connect'
		/* 10 */ ,'noUi-horizontal'
		/* 11 */ ,'noUi-vertical'
		/* 12 */ ,'noUi-background'
		/* 13 */ ,'noUi-stacking'
		/* 14 */ ,'noUi-block'
		/* 15 */ ,'noUi-state-blocked'
		/* 16 */ ,'noUi-ltr'
		/* 17 */ ,'noUi-rtl'
		/* 18 */ ,'noUi-dragable'
		/* 19 */ ,'noUi-extended'
		/* 20 */ ,'noUi-state-drag'
		]

		// Determine the events to bind. IE11 implements pointerEvents without
		// a prefix, which breaks compatibility with the IE10 implementation.
		,actions = window.navigator['pointerEnabled'] ? {
			 start: 'pointerdown'
			,move: 'pointermove'
			,end: 'pointerup'
		} : window.navigator['msPointerEnabled'] ? {
			 start: 'MSPointerDown'
			,move: 'MSPointerMove'
			,end: 'MSPointerUp'
		} : {
			 start: 'mousedown touchstart'
			,move: 'mousemove touchmove'
			,end: 'mouseup touchend'
		};


// Percentage calculation

	// (percentage) How many percent is this value of this range?
		function fromPercentage ( range, value ) {
			return (value * 100) / ( range[1] - range[0] );
		}

	// (percentage) Where is this value on this range?
		function toPercentage ( range, value ) {
			return fromPercentage( range, range[0] < 0 ?
				value + Math.abs(range[0]) :
					value - range[0] );
		}

	// (value) How much is this percentage on this range?
		function isPercentage ( range, value ) {
			return ((value * ( range[1] - range[0] )) / 100) + range[0];
		}


// Type tests

	// Test in an object is an instance of jQuery or Zepto.
		function isInstance ( a ) {
			return a instanceof $ || ( $['zepto'] && $['zepto']['isZ'](a) );
		}

	// Checks whether a value is numerical.
		function isNumeric ( a ) {
			return !isNaN( parseFloat( a ) ) && isFinite( a );
		}


// General helper functions

	// Test an array of objects, and calls them if they are a function.
		function call ( functions, scope ) {

			// Allow the passing of an unwrapped function.
			// Leaves other code a more comprehensible.
			if( !$.isArray( functions ) ){
				functions = [ functions ];
			}

			$.each( functions, function(){
				if (typeof this === 'function') {
					this.call(scope);
				}
			});
		}

	// Returns a proxy to set a target using the public value method.
		function setN ( target, number ) {

			return function(){

				// Determine the correct position to set,
				// leave the other one unchanged.
				var val = [null, null];
				val[ number ] = $(this).val();

				// Trigger the 'set' callback
				target.val(val, true);
			};
		}

	// Round a value to the closest 'to'.
		function closest ( value, to ){
			return Math.round(value / to) * to;
		}

	// Format output value to specified standards.
		function format ( value, options ) {

			// Round the value to the resolution that was set
			// with the serialization options.
			value = value.toFixed( options['decimals'] );

			// Rounding away decimals might cause a value of -0
			// when using very small ranges. Remove those cases.
			if ( parseFloat(value) === 0 ) {
				value = value.replace('-0', '0');
			}

			// Apply the proper decimal mark to the value.
			return value.replace( '.', options['serialization']['mark'] );
		}

	// Determine the handle closest to an event.
		function closestHandle ( handles, location, style ) {

			if ( handles.length === 1 ) {
				return handles[0];
			}

			var total = handles[0].offset()[style] +
						handles[1].offset()[style];

			return handles[ location < total / 2 ? 0 : 1 ];
		}

	// Round away small numbers in floating point implementation.
		function digits ( value, round ) {
			return parseFloat(value.toFixed(round));
		}

// Event abstraction

	// Provide a clean event with standardized offset values.
		function fixEvent ( e ) {

			// Prevent scrolling and panning on touch events, while
			// attempting to slide. The tap event also depends on this.
			e.preventDefault();

			// Filter the event to register the type, which can be
			// touch, mouse or pointer. Offset changes need to be
			// made on an event specific basis.
			var  touch = e.type.indexOf('touch') === 0
				,mouse = e.type.indexOf('mouse') === 0
				,pointer = e.type.indexOf('pointer') === 0
				,x,y, event = e;

			// IE10 implemented pointer events with a prefix;
			if ( e.type.indexOf('MSPointer') === 0 ) {
				pointer = true;
			}

			// Get the originalEvent, if the event has been wrapped
			// by jQuery. Zepto doesn't wrap the event.
			if ( e.originalEvent ) {
				e = e.originalEvent;
			}

			if ( touch ) {
				// noUiSlider supports one movement at a time,
				// so we can select the first 'changedTouch'.
				x = e.changedTouches[0].pageX;
				y = e.changedTouches[0].pageY;
			}
			if ( mouse || pointer ) {

				// Polyfill the pageXOffset and pageYOffset
				// variables for IE7 and IE8;
				if( !pointer && window.pageXOffset === undefined ){
					window.pageXOffset = document.documentElement.scrollLeft;
					window.pageYOffset = document.documentElement.scrollTop;
				}

				x = e.clientX + window.pageXOffset;
				y = e.clientY + window.pageYOffset;
			}

			return $.extend( event, {
				 'pointX': x
				,'pointY': y
				,cursor: mouse
			});
		}

	// Handler for attaching events trough a proxy
		function attach ( events, element, callback, pass ) {

			var target = pass.target;

			// Add the noUiSlider namespace to all events.
			events = events.replace( /\s/g, namespace + ' ' ) + namespace;

			// Bind a closure on the target.
			return element.on( events, function( e ){

				// jQuery and Zepto handle unset attributes differently.
				var disabled = target.attr('disabled');
					disabled = !( disabled === undefined || disabled === null );

				// Test if there is anything that should prevent an event
				// from being handled, such as a disabled state or an active
				// 'tap' transition.
				if( target.hasClass('noUi-state-tap') || disabled ) {
					return false;
				}

				// Call the event handler with three arguments:
				// - The event;
				// - An object with data for the event;
				// - The slider options;
				// Having the slider options as a function parameter prevents
				// getting it in every function, which muddies things up.
				callback (
					 fixEvent( e )
					,pass
					,target.data('base').data('options')
				);
			});
		}


// Serialization and value storage

	// Store a value on all serialization targets, or get the current value.
		function serialize ( a ) {

			/*jshint validthis: true */

			// Re-scope target for availability within .each;
			var target = this.target;

			// Get the value for this handle
			if ( a === undefined ) {
				return this.element.data('value');
			}

			// Write the value to all serialization objects
			// or store a new value on the handle
			if ( a === true ) {
				a = this.element.data('value');
			} else {
				this.element.data('value', a);
			}

			// Prevent a serialization call if the value wasn't initialized.
			if ( a === undefined ) {
				return;
			}

			// If the provided element was a function,
			// call it with the slider as scope. Otherwise,
			// simply call the function on the object.
			$.each( this.elements, function() {
				if ( typeof this === 'function' ) {
					this.call(target, a);
				} else {
					this[0][this[1]](a);
				}
			});
		}

	// Map serialization to [ element, method ]. Attach events where required.
		function storeElement ( handle, item, number ) {

			// Add a change event to the supplied jQuery objects,
			// which triggers the value-setting function on the target.
			if ( isInstance( item ) ) {

				var elements = [], target = handle.data('target');

				// Link the field to the other handle if the
				// slider is inverted.
				if ( handle.data('options').direction ) {
					number = number ? 0 : 1;
				}

				// Loop all items so the change event is properly bound,
				// and the items can individually be added to the array.
				item.each(function(){

					// Bind the change event.
					$(this).on('change' + namespace, setN( target, number ));

					// Store the element with the proper handler.
					elements.push([ $(this), 'val' ]);
				});

				return elements;
			}

			// Append a new input to the noUiSlider base.
			// Prevent the change event from flowing upward.
			if ( typeof item === 'string' ) {

				item = [ $('<input type="hidden" name="'+ item +'">')
					.appendTo(handle)
					.addClass(clsList[3])
					.change(function ( e ) {
						e.stopPropagation();
					}), 'val'];
			}

			return [item];
		}

	// Access point and abstraction for serialization.
		function store ( handle, i, serialization ) {

			var elements = [];

			// Loops all items in the provided serialization setting,
			// add the proper events to them or create new input fields,
			// and add them as data to the handle so they can be kept
			// in sync with the slider value.
			$.each( serialization['to'][i], function( index ){
				elements = elements.concat(
					storeElement( handle, serialization['to'][i][index], i )
				);
			});

			return {
				 element: handle
				,elements: elements
				,target: handle.data('target')
				,'val': serialize
			};
		}


// Handle placement

	// Fire callback on unsuccessful handle movement.
		function block ( base, stateless ) {

			var target = base.data('target');

			if ( !target.hasClass(clsList[14]) ){

				// The visual effects should not always be applied.
				if ( !stateless ) {
					target.addClass(clsList[15]);
					setTimeout(function(){
						target.removeClass(clsList[15]);
					}, 450);
				}

				target.addClass(clsList[14]);
				call( base.data('options').block, target );
			}
		}

	// Change inline style and apply proper classes.
		function placeHandle ( handle, to ) {

			var settings = handle.data('options');

			to = digits(to, 7);

			// If the slider can move, remove the class
			// indicating the block state.
			handle.data('target').removeClass(clsList[14]);

			// Set handle to new location
			handle.css( settings['style'], to + '%' ).data('pct', to);

			// Force proper handle stacking
			if ( handle.is(':first-child') ) {
				handle.toggleClass(clsList[13], to > 50 );
			}

			if ( settings['direction'] ) {
				to = 100 - to;
			}

			// Write the value to the serialization object.
			handle.data('store').val(
				format ( isPercentage( settings['range'], to ), settings )
			);
		}

	// Test suggested values and apply margin, step.
		function setHandle ( handle, to ) {

			var base = handle.data('base'), settings = base.data('options'),
				handles = base.data('handles'), lower = 0, upper = 100;

			// Catch invalid user input
			if ( !isNumeric( to ) ){
				return false;
			}

			// Handle the step option.
			if ( settings['step'] ){
				to = closest( to, settings['step'] );
			}

			if ( handles.length > 1 ){
				if ( handle[0] !== handles[0][0] ) {
					lower = digits(handles[0].data('pct')+settings['margin'],7);
				} else {
					upper = digits(handles[1].data('pct')-settings['margin'],7);
				}
			}

			// Limit position to boundaries. When the handles aren't set yet,
			// they return -1 as a percentage value.
			to = Math.min( Math.max( to, lower ), upper < 0 ? 100 : upper );

			// Stop handling this call if the handle can't move past another.
			// Return an array containing the hit limit, so the caller can
			// provide feedback. ( block callback ).
			if ( to === handle.data('pct') ) {
				return [!lower ? false : lower, upper === 100 ? false : upper];
			}

			placeHandle ( handle, to );
			return true;
		}

	// Handles movement by tapping
		function jump ( base, handle, to, callbacks ) {

			// Flag the slider as it is now in a transitional state.
			// Transition takes 300 ms, so re-enable the slider afterwards.
			base.addClass(clsList[5]);
			setTimeout(function(){
				base.removeClass(clsList[5]);
			}, 300);

			// Move the handle to the new position.
			setHandle( handle, to );

			// Trigger the 'slide' and 'set' callbacks,
			// pass the target so that it is 'this'.
			call( callbacks, base.data('target') );

			base.data('target').change();
		}


// Event handlers

	// Handle movement on document for handle and range drag.
		function move ( event, Dt, Op ) {

			// Map event movement to a slider percentage.
			var handles = Dt.handles, limits,
				proposal = event[ Dt.point ] - Dt.start[ Dt.point ];

			proposal = ( proposal * 100 ) / Dt.size;

			if ( handles.length === 1 ) {

				// Run handle placement, receive true for success or an
				// array with potential limits.
				limits = setHandle( handles[0], Dt.positions[0] + proposal );

				if ( limits !== true ) {

					if ( $.inArray ( handles[0].data('pct'), limits ) >= 0 ){
						block ( Dt.base, !Op['margin'] );
					}
					return;
				}

			} else {

				// Dragging the range could be implemented by forcing the
				// 'move' event on both handles, but this solution proved
				// lagging on slower devices, resulting in range errors. The
				// slightly ugly solution below is considerably faster, and
				// it can't move the handle out of sync. Bypass the standard
				// setting method, as other checks are needed.

				var l1, u1, l2, u2;

				// Round the proposal to the step setting.
				if ( Op['step'] ) {
					proposal = closest( proposal, Op['step'] );
				}

				// Determine the new position, store it twice. Once for
				// limiting, once for checking whether placement should occur.
				l1 = l2 = Dt.positions[0] + proposal;
				u1 = u2 = Dt.positions[1] + proposal;

				// Round the values within a sensible range.
				if ( l1 < 0 ) {
					u1 += -1 * l1;
					l1 = 0;
				} else if ( u1 > 100 ) {
					l1 -= ( u1 - 100 );
					u1 = 100;
				}

				// Don't perform placement if no handles are to be changed.
				// Check if the lowest value is set to zero.
				if ( l2 < 0 && !l1 && !handles[0].data('pct') ) {
					return;
				}
				// The highest value is limited to 100%.
				if ( u1 === 100 && u2 > 100 && handles[1].data('pct') === 100 ){
					return;
				}

				placeHandle ( handles[0], l1 );
				placeHandle ( handles[1], u1 );
			}

			// Trigger the 'slide' event, if the handle was moved.
			call( Op['slide'], Dt.target );
		}

	// Unbind move events on document, call callbacks.
		function end ( event, Dt, Op ) {

			// The handle is no longer active, so remove the class.
			if ( Dt.handles.length === 1 ) {
				Dt.handles[0].data('grab').removeClass(clsList[4]);
			}

			// Remove cursor styles and text-selection events bound to the body.
			if ( event.cursor ) {
				body.css('cursor', '').off( namespace );
			}

			// Unbind the move and end events, which are added on 'start'.
			doc.off( namespace );

			// Trigger the change event.
			Dt.target.removeClass( clsList[14] +' '+ clsList[20]).change();

			// Trigger the 'end' callback.
			call( Op['set'], Dt.target );
		}

	// Bind move events on document.
		function start ( event, Dt, Op ) {

			// Mark the handle as 'active' so it can be styled.
			if( Dt.handles.length === 1 ) {
				Dt.handles[0].data('grab').addClass(clsList[4]);
			}

			// A drag should never propagate up to the 'tap' event.
			event.stopPropagation();

			// Attach the move event.
			attach ( actions.move, doc, move, {
				 start: event
				,base: Dt.base
				,target: Dt.target
				,handles: Dt.handles
				,positions: [ Dt.handles[0].data('pct')
					   ,Dt.handles[ Dt.handles.length - 1 ].data('pct') ]
				,point: Op['orientation'] ? 'pointY' : 'pointX'
				,size: Op['orientation'] ? Dt.base.height() : Dt.base.width()
			});

			// Unbind all movement when the drag ends.
			attach ( actions.end, doc, end, {
				 target: Dt.target
				,handles: Dt.handles
			});

			// Text selection isn't an issue on touch devices,
			// so adding additional callbacks isn't required.
			if ( event.cursor ) {

				// Prevent the 'I' cursor and extend the range-drag cursor.
				body.css('cursor', $(event.target).css('cursor'));

				// Mark the target with a dragging state.
				if ( Dt.handles.length > 1 ) {
					Dt.target.addClass(clsList[20]);
				}

				// Prevent text selection when dragging the handles.
				body.on('selectstart' + namespace, function( ){
					return false;
				});
			}
		}

	// Move closest handle to tapped location.
		function tap ( event, Dt, Op ) {

			var base = Dt.base, handle, to, point, size;

			// The tap event shouldn't propagate up to trigger 'edge'.
			event.stopPropagation();

			// Determine the direction of the slider.
			if ( Op['orientation'] ) {
				point = event['pointY'];
				size = base.height();
			} else {
				point = event['pointX'];
				size = base.width();
			}

			// Find the closest handle and calculate the tapped point.
			handle = closestHandle( base.data('handles'), point, Op['style'] );
			to = (( point - base.offset()[ Op['style'] ] ) * 100 ) / size;

			// The set handle to the new position.
			jump( base, handle, to, [ Op['slide'], Op['set'] ]);
		}

	// Move handle to edges when target gets tapped.
		function edge ( event, Dt, Op ) {

			var handles = Dt.base.data('handles'), to, i;

			i = Op['orientation'] ? event['pointY'] : event['pointX'];
			i = i < Dt.base.offset()[Op['style']];

			to = i ? 0 : 100;
			i = i ? 0 : handles.length - 1;

			jump ( Dt.base, handles[i], to, [ Op['slide'], Op['set'] ]);
		}

// API

	// Validate and standardize input.
		function test ( input, sliders ){

	/*	Every input option is tested and parsed. This'll prevent
		endless validation in internal methods. These tests are
		structured with an item for every option available. An
		option can be marked as required by setting the 'r' flag.
		The testing function is provided with three arguments:
			- The provided value for the option;
			- A reference to the options object;
			- The name for the option;

		The testing function returns false when an error is detected,
		or true when everything is OK. It can also modify the option
		object, to make sure all values can be correctly looped elsewhere. */

			function values ( a ) {

				if ( a.length !== 2 ){
					return false;
				}

				// Convert the array to floats
				a = [ parseFloat(a[0]), parseFloat(a[1]) ];

				// Test if all values are numerical
				if( !isNumeric(a[0]) || !isNumeric(a[1]) ){
					return false;
				}

				// The lowest value must really be the lowest value.
				if( a[1] < a[0] ){
					return false;
				}

				return a;
			}

			var serialization = {
				 resolution: function(q,o){

					// Parse the syntactic sugar that is the serialization
					// resolution option to a usable integer.
					// Checking for a string '1', since the resolution needs
					// to be cast to a string to split in on the period.
					switch( q ){
						case 1:
						case 0.1:
						case 0.01:
						case 0.001:
						case 0.0001:
						case 0.00001:
							q = q.toString().split('.');
							o['decimals'] = q[0] === '1' ? 0 : q[1].length;
							break;
						case undefined:
							o['decimals'] = 2;
							break;
						default:
							return false;
					}

					return true;
				}
				,mark: function(q,o,w){

					if ( !q ) {
						o[w]['mark'] = '.';
						return true;
					}

					switch( q ){
						case '.':
						case ',':
							return true;
						default:
							return false;
					}
				}
				,to: function(q,o,w){

					// Checks whether a variable is a candidate to be a
					// valid serialization target.
					function ser(r){
						return isInstance ( r ) ||
							typeof r === 'string' ||
							typeof r === 'function' ||
							r === false ||
							( isInstance ( r[0] ) &&
							  typeof r[0][r[1]] === 'function' );
					}

					// Flatten the serialization array into a reliable
					// set of elements, which can be tested and looped.
					function filter ( value ) {

						var items = [[],[]];

						// If a single value is provided it can be pushed
						// immediately.
						if ( ser(value) ) {
							items[0].push(value);
						} else {

							// Otherwise, determine whether this is an
							// array of single elements or sets.
							$.each(value, function(i, val) {

								// Don't handle an overflow of elements.
								if( i > 1 ){
									return;
								}

								// Decide if this is a group or not
								if( ser(val) ){
									items[i].push(val);
								} else {
									items[i] = items[i].concat(val);
								}
							});
						}

						return items;
					}

					if ( !q ) {
						o[w]['to'] = [[],[]];
					} else {

						var i, j;

						// Flatten the serialization array
						q = filter ( q );

						// Reverse the API for RTL sliders.
						if ( o['direction'] && q[1].length ) {
							q.reverse();
						}

						// Test all elements in the flattened array.
						for ( i = 0; i < o['handles']; i++ ) {
							for ( j = 0; j < q[i].length; j++ ) {

								// Return false on invalid input
								if( !ser(q[i][j]) ){
									return false;
								}

								// Remove 'false' elements, since those
								// won't be handled anyway.
								if( !q[i][j] ){
									q[i].splice(j, 1);
								}
							}
						}

						// Write the new values back
						o[w]['to'] = q;
					}

					return true;
				}
			}, tests = {
				/*	Handles.
				 *	Has default, can be 1 or 2.
				 */
				 'handles': {
					 'r': true
					,'t': function(q){
						q = parseInt(q, 10);
						return ( q === 1 || q === 2 );
					}
				}
				/*	Range.
				 *	Must be an array of two numerical floats,
				 *	which can't be identical.
				 */
				,'range': {
					 'r': true
					,'t': function(q,o,w){

						o[w] = values(q);

						// The values can't be identical.
						return o[w] && o[w][0] !== o[w][1];
					}
				 }
				/*	Start.
				 *	Must be an array of two numerical floats when handles = 2;
				 *	Uses 'range' test.
				 *	When handles = 1, a single float is also allowed.
				 */
				,'start': {
					 'r': true
					,'t': function(q,o,w){
						if( o['handles'] === 1 ){
							if( $.isArray(q) ){
								q = q[0];
							}
							q = parseFloat(q);
							o.start = [q];
							return isNumeric(q);
						}

						o[w] = values(q);
						return !!o[w];
					}
				}
				/*	Connect.
				 *	Must be true or false when handles = 2;
				 *	Can use 'lower' and 'upper' when handles = 1.
				 */
				,'connect': {
					 'r': true
					,'t': function(q,o,w){

						if ( q === 'lower' ) {
							o[w] = 1;
						} else if ( q === 'upper' ) {
							o[w] = 2;
						} else if ( q === true ) {
							o[w] = 3;
						} else if ( q === false ) {
							o[w] = 0;
						} else {
							return false;
						}

						return true;
					}
				}
				/*	Connect.
				 *	Will default to horizontal, not required.
				 */
				,'orientation': {
					 't': function(q,o,w){
						switch (q){
							case 'horizontal':
								o[w] = 0;
								break;
							case 'vertical':
								o[w] = 1;
								break;
							default: return false;
						}
						return true;
					}
				}
				/*	Margin.
				 *	Must be a float, has a default value.
				 */
				,'margin': {
					 'r': true
					,'t': function(q,o,w){
						q = parseFloat(q);
						o[w] = fromPercentage(o['range'], q);
						return isNumeric(q);
					}
				}
				/*	Direction.
				 *	Required, can be 'ltr' or 'rtl'.
				 */
				,'direction': {
					 'r': true
					,'t': function(q,o,w){

						switch ( q ) {
							case 'ltr': o[w] = 0;
								break;
							case 'rtl': o[w] = 1;
								// Invert connection for RTL sliders;
								o['connect'] = [0,2,1,3][o['connect']];
								break;
							default:
								return false;
						}

						return true;
					}
				}
				/*	Behaviour.
				 *	Required, defines responses to tapping and
				 *	dragging elements.
				 */
				,'behaviour': {
					 'r': true
					,'t': function(q,o,w){

						o[w] = {
							 'tap': q !== (q = q.replace('tap', ''))
							,'extend': q !== (q = q.replace('extend', ''))
							,'drag': q !== (q = q.replace('drag', ''))
							,'fixed': q !== (q = q.replace('fixed', ''))
						};

						return !q.replace('none','').replace(/\-/g,'');
					}
				}
				/*	Serialization.
				 *	Required, but has default. Must be an array
				 *	when using two handles, can be a single value when using
				 *	one handle. 'mark' can be period (.) or comma (,).
				 */
				,'serialization': {
					 'r': true
					,'t': function(q,o,w){

						return serialization.to( q['to'], o, w ) &&
							   serialization.resolution( q['resolution'], o ) &&
							   serialization.mark( q['mark'], o, w );
					}
				}
				/*	Slide.
				 *	Not required. Must be a function.
				 */
				,'slide': {
					 't': function(q){
						return $.isFunction(q);
					}
				}
				/*	Set.
				 *	Not required. Must be a function.
				 *	Tested using the 'slide' test.
				 */
				,'set': {
					 't': function(q){
						return $.isFunction(q);
					}
				}
				/*	Block.
				 *	Not required. Must be a function.
				 *	Tested using the 'slide' test.
				 */
				,'block': {
					 't': function(q){
						return $.isFunction(q);
					}
				}
				/*	Step.
				 *	Not required.
				 */
				,'step': {
					 't': function(q,o,w){
						q = parseFloat(q);
						o[w] = fromPercentage ( o['range'], q );
						return isNumeric(q);
					}
				}
			};

			$.each( tests, function( name, test ){

				/*jslint devel: true */

				var value = input[name], isSet = value !== undefined;

				// If the value is required but not set, fail.
				if( ( test['r'] && !isSet ) ||
				// If the test returns false, fail.
					( isSet && !test['t']( value, input, name ) ) ){

					// For debugging purposes it might be very useful to know
					// what option caused the trouble. Since throwing an error
					// will prevent further script execution, log the error
					// first. Test for console, as it might not be available.
					if( console && console.log && console.group ){
						console.group( 'Invalid noUiSlider initialisation:' );
						console.log( 'Option:\t', name );
						console.log( 'Value:\t', value );
						console.log( 'Slider(s):\t', sliders );
						console.groupEnd();
					}

					throw new RangeError('noUiSlider');
				}
			});
		}

	// Parse options, add classes, attach events, create HTML.
		function create ( options ) {

			/*jshint validthis: true */

			// Store the original set of options on all targets,
			// so they can be re-used and re-tested later.
			// Make sure to break the relation with the options,
			// which will be changed by the 'test' function.
			this.data('options', $.extend(true, {}, options));

			// Set defaults where applicable;
			options = $.extend({
				 'handles': 2
				,'margin': 0
				,'connect': false
				,'direction': 'ltr'
				,'behaviour': 'tap'
				,'orientation': 'horizontal'
			}, options);

			// Make sure the test for serialization runs.
			options['serialization'] = options['serialization'] || {};

			// Run all options through a testing mechanism to ensure correct
			// input. The test function will throw errors, so there is
			// no need to capture the result of this call. It should be noted
			// that options might get modified to be handled properly. E.g.
			// wrapping integers in arrays.
			test( options, this );

			// Pre-define the styles.
			options['style'] = options['orientation'] ? 'top' : 'left';

			return this.each(function(){

				var target = $(this), i, dragable, handles = [], handle,
					base = $('<div/>').appendTo(target);

				// Throw an error if the slider was already initialized.
				if ( target.data('base') ) {
					throw new Error('Slider was already initialized.');
				}

				// Apply classes and data to the target.
				target.data('base', base).addClass([
					clsList[6]
				   ,clsList[16 + options['direction']]
				   ,clsList[10 + options['orientation']] ].join(' '));

				for (i = 0; i < options['handles']; i++ ) {

					handle = $('<div><div/></div>').appendTo(base);

					// Add all default and option-specific classes to the
					// origins and handles.
					handle.addClass( clsList[1] );

					handle.children().addClass([
						clsList[2]
					   ,clsList[2] + clsList[ 7 + options['direction'] +
						( options['direction'] ? -1 * i : i ) ]].join(' ') );

					// Make sure every handle has access to all variables.
					handle.data({
						 'base': base
						,'target': target
						,'options': options
						,'grab': handle.children()
						,'pct': -1
					}).attr('data-style', options['style']);

					// Every handle has a storage point, which takes care
					// of triggering the proper serialization callbacks.
					handle.data({
						'store': store(handle, i, options['serialization'])
					});

					// Store handles on the base
					handles.push(handle);
				}

				// Apply the required connection classes to the elements
				// that need them. Some classes are made up for several
				// segments listed in the class list, to allow easy
				// renaming and provide a minor compression benefit.
				switch ( options['connect'] ) {
					case 1:	target.addClass( clsList[9] );
							handles[0].addClass( clsList[12] );
							break;
					case 3: handles[1].addClass( clsList[12] );
							/* falls through */
					case 2: handles[0].addClass( clsList[9] );
							/* falls through */
					case 0: target.addClass(clsList[12]);
							break;
				}

				// Merge base classes with default,
				// and store relevant data on the base element.
				base.addClass( clsList[0] ).data({
					 'target': target
					,'options': options
					,'handles': handles
				});

				// Use the public value method to set the start values.
				target.val( options['start'] );

				// Attach the standard drag event to the handles.
				if ( !options['behaviour']['fixed'] ) {
					for ( i = 0; i < handles.length; i++ ) {

						// These events are only bound to the visual handle
						// element, not the 'real' origin element.
						attach ( actions.start, handles[i].children(), start, {
							 base: base
							,target: target
							,handles: [ handles[i] ]
						});
					}
				}

				// Attach the tap event to the slider base.
				if ( options['behaviour']['tap'] ) {
					attach ( actions.start, base, tap, {
						 base: base
						,target: target
					});
				}

				// Extend tapping behaviour to target
				if ( options['behaviour']['extend'] ) {

					target.addClass( clsList[19] );

					if ( options['behaviour']['tap'] ) {
						attach ( actions.start, target, edge, {
							 base: base
							,target: target
						});
					}
				}

				// Make the range dragable.
				if ( options['behaviour']['drag'] ){

					dragable = base.find('.'+clsList[9]).addClass(clsList[18]);

					// When the range is fixed, the entire range can
					// be dragged by the handles. The handle in the first
					// origin will propagate the start event upward,
					// but it needs to be bound manually on the other.
					if ( options['behaviour']['fixed'] ) {
						dragable = dragable
							.add( base.children().not(dragable).data('grab') );
					}

					attach ( actions.start, dragable, start, {
						 base: base
						,target: target
						,handles: handles
					});
				}
			});
		}

	// Return value for the slider, relative to 'range'.
		function getValue ( ) {

			/*jshint validthis: true */

			var base = $(this).data('base'), answer = [];

			// Loop the handles, and get the value from the input
			// for every handle on its' own.
			$.each( base.data('handles'), function(){
				answer.push( $(this).data('store').val() );
			});

			// If the slider has just one handle, return a single value.
			// Otherwise, return an array, which is in reverse order
			// if the slider is used RTL.
			if ( answer.length === 1 ) {
				return answer[0];
			}

			if ( base.data('options').direction ) {
				return answer.reverse();
			}

			return answer;
		}

	// Set value for the slider, relative to 'range'.
		function setValue ( args, set ) {

			/*jshint validthis: true */

			// If the value is to be set to a number, which is valid
			// when using a one-handle slider, wrap it in an array.
			if( !$.isArray(args) ){
				args = [args];
			}

			// Setting is handled properly for each slider in the data set.
			return this.each(function(){

				var b = $(this).data('base'), to, i,
					handles = Array.prototype.slice.call(b.data('handles'),0),
					settings = b.data('options');

				// If there are multiple handles to be set run the setting
				// mechanism twice for the first handle, to make sure it
				// can be bounced of the second one properly.
				if ( handles.length > 1) {
					handles[2] = handles[0];
				}

				// The RTL settings is implemented by reversing the front-end,
				// internal mechanisms are the same.
				if ( settings['direction'] ) {
					args.reverse();
				}

				for ( i = 0; i < handles.length; i++ ){

					// Calculate a new position for the handle.
					to = args[ i%2 ];

					// The set request might want to ignore this handle.
					// Test for 'undefined' too, as a two-handle slider
					// can still be set with an integer.
					if( to === null || to === undefined ) {
						continue;
					}

					// Add support for the comma (,) as a decimal symbol.
					// Replace it by a period so it is handled properly by
					// parseFloat. Omitting this would result in a removal
					// of decimals. This way, the developer can also
					// input a comma separated string.
					if( $.type(to) === 'string' ) {
						to = to.replace(',', '.');
					}

					// Calculate the new handle position
					to = toPercentage( settings['range'], parseFloat( to ) );

					// Invert the value if this is an right-to-left slider.
					if ( settings['direction'] ) {
						to = 100 - to;
					}

					// If the value of the input doesn't match the slider,
					// reset it. Sometimes the input is changed to a value the
					// slider has rejected. This can occur when using 'select'
					// or 'input[type="number"]' elements. In this case, set
					// the value back to the input.
					if ( setHandle( handles[i], to ) !== true ){
						handles[i].data('store').val( true );
					}

					// Optionally trigger the 'set' event.
					if( set === true ) {
						call( settings['set'], $(this) );
					}
				}
			});
		}

	// Unbind all attached events, remove classed and HTML.
		function destroy ( target ) {

			// Start the list of elements to be unbound with the target.
			var elements = [[target,'']];

			// Get the fields bound to both handles.
			$.each(target.data('base').data('handles'), function(){
				elements = elements.concat( $(this).data('store').elements );
			});

			// Remove all events added by noUiSlider.
			$.each(elements, function(){
				if( this.length > 1 ){
					this[0].off( namespace );
				}
			});

			// Remove all classes from the target.
			target.removeClass(clsList.join(' '));

			// Empty the target and remove all data.
			target.empty().removeData('base options');
		}

	// Merge options with current initialization, destroy slider
	// and reinitialize.
		function build ( options ) {

			/*jshint validthis: true */

			return this.each(function(){

				// When uninitialised, jQuery will return '',
				// Zepto returns undefined. Both are falsy.
				var values = $(this).val() || false,
					current = $(this).data('options'),
				// Extend the current setup with the new options.
					setup = $.extend( {}, current, options );

				// If there was a slider initialised, remove it first.
				if ( values !== false ) {
					destroy( $(this) );
				}

				// Make the destroy method publicly accessible.
				if( !options ) {
					return;
				}

				// Create a new slider
				$(this)['noUiSlider']( setup );

				// Set the slider values back. If the start options changed,
				// it gets precedence.
				if ( values !== false && setup.start === current.start ) {
					$(this).val( values );
				}
			});
		}

	// Overwrite the native jQuery value function
	// with a simple handler. noUiSlider will use the internal
	// value method, anything else will use the standard method.
		$.fn.val = function(){

			// If the function is called without arguments,
			// act as a 'getter'. Call the getValue function
			// in the same scope as this call.
			if ( this.hasClass( clsList[6] ) ){
				return arguments.length ?
					setValue.apply( this, arguments ) :
					getValue.apply( this );
			}

			// If this isn't noUiSlider, continue with jQuery's
			// original method.
			return $VAL.apply( this, arguments );
		};

		return ( rebuild ? build : create ).call( this, options );
	};

}( window['jQuery'] || window['Zepto'] ));

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
