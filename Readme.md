# ui-modules

Some jquery modules / widgets

## Number spinner

- a simple spinner that can be used with bootstrap 3

    #### default options:

        classes: '', // additional classes for the widget container
        val: 3,      // start value
        minVal: 2,   // minimum value
        maxVal: 10,  // maximum value
        step: 1,     // step (@todo for floats)
        twbs3: false,   //if true, markup for a bootstrap input group will be used
        formControlSize: 'sm', //only has an effect if twbs3 is set to true, ('sm', 'md' ..., '' for default)
        enableReset: true   //if false, no reset-to-default button will be rendered

    #### depends on:

    - jquery
    - bootstrap 3 (optional)

    #### usage:

        $('.someEmptyDiv').ui_numspin(options);

    #### events:

        ...on('numchanged', function(event, element, value){
            //Do sth
        });

## Colorpicker

- colorpicker, uses [spectrum](http://bgrins.github.io/spectrum/)

    #### default options:

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

    #### depends on:

    - jquery

    #### includes:

    - spectrum.js / spectrum.css

    #### usage:

        $('.someEmptyDiv').ui_colorpicker(options);

    #### events:

        ...on('numchanged', function(event, color){
            //Do sth
        });

## Slider

- slider widget, uses [noUiSlider](http://refreshless.com/nouislider/)

    #### depends on:

    - jquery

    #### includes:

    - jquery.nouislider.js / jquery.nouislider.css

    ### minimal Markup:

        <div class="example">
            <input type="text" />
            <div class="slide"></div>
            <button class="reset">Reset</button>
        </div>

    #### usage:

        $('.example').ui_slider(options);

    #### events:

        ...on('slider_changed', function(event, value){
            //Do sth
        });
