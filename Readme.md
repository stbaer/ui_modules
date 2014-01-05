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

## @TODO
